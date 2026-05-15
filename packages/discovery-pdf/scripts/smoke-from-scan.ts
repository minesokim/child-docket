// Smoke: end-to-end pipeline from IntakeState through the catalog
// scanner through the adapter through the PDF renderer. Proves the
// wedge demo path works without needing a real client or the LLM
// agent.
//
//   IntakeState (synthetic S-corp owner)
//     ↓ scanPositionLibrary (deterministic catalog scan)
//   ScanResult
//     ↓ discoveredToPdfInput (the adapter from this commit)
//   DiscoveryScanInput
//     ↓ renderDiscoveryScanPdf
//   PDF Buffer → writes to disk
//
// Usage:
//   pnpm --filter @docket/discovery-pdf smoke-from-scan
//
// Writes to packages/discovery-pdf/dist/scan-from-intake.pdf —
// gitignored (generated artifact).

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IntakeState } from '@docket/shared';
import { scanPositionLibrary } from '@docket/tax-graph';
import { renderDiscoveryScanPdf } from '../src/index.js';
import { discoveredToPdfInput } from '../src/from-scan.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Synthetic IntakeState — a CA S-corp owner with matching home/biz
// address, dependent kids, and SE income. Designed to hit a broad
// swath of the v0 catalog (home office, accountable plan, Augusta,
// QBI, SEP-IRA / solo 401(k), CTC, dependent care credit, SALT, etc.).
const SYNTHETIC_INTAKE: IntakeState = {
  filing: { status: 'mfj' },
  income: { types: ['self'] },
  state: { primaryState: 'California' },
  service: { kind: 'biz' },
  business: {
    legalName: 'Hernandez Construction Inc.',
    entityType: 'S-Corp',
    street: '1247 Olive Tree Way',
  },
  personal: { street: '1247 Olive Tree Way' },
  dependents: { count: 2 },
  deductions: { childcare: true, charity: true },
  taxQuestions: { retirement: true, healthAll: true },
};

async function main(): Promise<void> {
  const start = Date.now();

  // 1. SCAN
  const scan = scanPositionLibrary(SYNTHETIC_INTAKE, {
    clientId: 'cli_synthetic_hernandez',
    taxYear: 2025,
    sourceArtifactIds: ['intake_synthetic_demo'],
  });
  const scanElapsed = Date.now() - start;

  console.log(`\n  [SCAN]    ${scan.positions.length} positions surfaced + ${scan.rejected.length} rejected  ${scanElapsed}ms`);
  console.log(`            Signals extracted: ${scan.signals.length}`);
  for (const p of scan.positions) {
    console.log(
      `            ${p.tier.padEnd(22)} ${p.positionType.padEnd(40)} confidence=${p.surfaceConfidence.toFixed(2)}`,
    );
  }

  // 2. ADAPT
  const adaptStart = Date.now();
  const pdfInput = discoveredToPdfInput(scan, {
    firmName: 'Hernandez Construction Inc.',
    preparedFor: 'David Hernandez, Owner',
    entityType: 'S-Corp (1120-S)',
    agiBucket: '$200K-$300K',
    schedules: ['K-1 (1120-S)', 'Schedule A', 'Schedule C'],
    states: ['CA'],
    generatedAt: '2026-05-15',
    // Matches the taxYear passed to scanPositionLibrary above — the
    // adapter now requires this explicitly (no wall-clock fallback)
    // so the PDF stamp can't drift when a scan returns zero positions.
    taxYear: 2025,
    reasoning:
      'Scan ran against the synthetic intake for a CA S-corp owner with matching home/business address, two dependents, and SE income. All cited authority drawn from the Petal Position Library v0 (Antonio-reviewed).',
  });
  const adaptElapsed = Date.now() - adaptStart;
  console.log(`\n  [ADAPT]   ${pdfInput.positions.length} → PdfPosition + ${pdfInput.refusedPositions.length} refused  ${adaptElapsed}ms`);

  // 3. RENDER
  const renderStart = Date.now();
  const buffer = await renderDiscoveryScanPdf(pdfInput);
  const renderElapsed = Date.now() - renderStart;
  console.log(`  [RENDER]  ${buffer.length.toLocaleString()} bytes  ${renderElapsed}ms`);

  // Assertions — guard against the failure modes a "did it render"
  // smoke would miss (mislabeled refusals + wrong tax year stamp +
  // empty position list silently producing a valid but useless PDF).
  //
  // (1) PDF magic header — buffer is actually a PDF.
  const magic = buffer.subarray(0, 4).toString('utf8');
  if (magic !== '%PDF') {
    throw new Error(`Expected %PDF magic header, got "${magic}"`);
  }
  // (2) Position count — catalog scanner surfaced something. The
  //     synthetic CA S-corp owner intake hits a broad swath of the
  //     catalog; if we get zero positions, the scanner or adapter
  //     regressed.
  if (pdfInput.positions.length === 0) {
    throw new Error('Expected at least one surfaced position; got zero — scan or adapter regressed.');
  }
  // (3a) Rejections actually exist on the scan — otherwise (3b) is
  //      vacuously true and the "rejections must not leak into
  //      refusedPositions" invariant stops being exercised. The
  //      synthetic CA S-corp owner intake hits roughly 14 of the 20
  //      catalog entries; the other 6 should land in scan.rejected.
  if (scan.rejected.length === 0) {
    throw new Error(
      'Expected scan.rejected.length > 0 so the refused-leak invariant is actually tested; got zero. ' +
        'Either the catalog grew to match every intake field or the synthetic fixture drifted.',
    );
  }
  // (3b) Refused-position invariant — v0 catalog has zero entries
  //      below Reasonable Basis, so refusedPositions MUST be empty
  //      even when scan.rejected is non-empty. If non-empty, the
  //      adapter mis-mapped no_trigger_match rejections back into
  //      the refusal-floor bucket.
  if (pdfInput.refusedPositions.length !== 0) {
    throw new Error(
      `Expected refusedPositions.length === 0 in v0 (no catalog entries below Reasonable Basis), got ${pdfInput.refusedPositions.length}. ` +
        'no_trigger_match / below_threshold rejections must NOT render as refusals.',
    );
  }
  // (4) Tax year stamp — the meta carries the year we passed in, not
  //     a wall-clock fallback.
  if (pdfInput.meta.taxYear !== 2025) {
    throw new Error(
      `Expected meta.taxYear === 2025 (matches scan + adapter input), got ${pdfInput.meta.taxYear}.`,
    );
  }
  // (5) PDF size sanity — a fully-rendered 6-12 page scan is
  //     ~30-60KB. <5KB means most positions failed to render or the
  //     document collapsed to cover-only.
  if (buffer.length < 5_000) {
    throw new Error(`PDF suspiciously small (${buffer.length} bytes) — expected >5KB for a real scan.`);
  }
  console.log(
    `  [ASSERT]  magic=%PDF · positions=${pdfInput.positions.length} · refused=${pdfInput.refusedPositions.length}/${scan.rejected.length}-rejected · taxYear=${pdfInput.meta.taxYear} · size>5KB`,
  );

  // Write to disk
  const outDir = path.join(__dirname, '..', 'dist');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, 'scan-from-intake.pdf');
  await fs.writeFile(outPath, buffer);
  console.log(`\n  [WRITE]   ${path.relative(process.cwd(), outPath)}`);

  const totalElapsed = Date.now() - start;
  console.log(`\n  ━━ pipeline complete in ${totalElapsed}ms (scan ${scanElapsed}ms + adapt ${adaptElapsed}ms + render ${renderElapsed}ms) ━━\n`);
}

main().catch((err: unknown) => {
  console.error('Smoke failed:', err);
  process.exit(1);
});
