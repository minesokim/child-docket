// Smoke: composeDiscoveryScan flow end-to-end EXCEPT the Discovery
// agent call itself. The agent (C7) has its own smoke at
// scripts/smoke-discovery.ts that exercises the live Anthropic /
// Bedrock + retrieval path; this script focuses on the COMPOSITION
// glue (agent output → PDF render → R2 upload → signed URL).
//
// Two reasons we stub the agent in this smoke:
//   1. Anthropic + Bedrock cost: ~$0.08 per Discovery call. The
//      agent smoke covers that path; this one shouldn't double-pay.
//   2. The C9 surface area beyond Discovery is: PDF render
//      (covered by @docket/discovery-pdf smoke), R2 upload (covered
//      by storage tests + production traffic), signed-URL gen
//      (storage). Together with composition glue (this script),
//      the end-to-end is verified at $0 incremental cost.
//
// Usage:
//   pnpm --filter @docket/workers smoke:compose-discovery
//
// IMPORTANT — writes a real PDF to R2 under
//   discovery-scans/<smoke-tenant>/<ulid>.pdf
// then deletes it. Operator should NOT run this against the
// production R2 bucket without confirming.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
loadEnv({ path: path.join(repoRoot, '.env') });
loadEnv({ path: path.join(repoRoot, '.env.local'), override: true });

import { asTenantId, asClientId } from '@docket/shared';
import { deleteObject, getPresignedDownloadUrl } from '@docket/storage';
import { renderDiscoveryScanPdf, type DiscoveryScanInput } from '@docket/discovery-pdf';
import { putObject, ulid } from '@docket/storage';

// Minimal sample — focus on the composition glue, not the content.
const SAMPLE_INPUT: DiscoveryScanInput = {
  meta: {
    firmName: 'Compose Smoke Test Firm',
    preparedFor: 'Smoke Test User',
    taxYear: 2024,
    generatedAt: '2026-05-12',
  },
  positions: [
    {
      claim: 'Sample Tier 1 position for smoke validation.',
      tier: 1,
      authority: [
        {
          source: 'irc',
          cite: '§162',
          summary: 'Trade or business expenses.',
        },
      ],
      estimatedImpact: { dollars: 1000, certainty: 'estimate' },
      auditRisk: 'low',
      disclosureRequired: false,
      rationale: 'Smoke test rationale.',
      gapsToConfirm: [],
    },
  ],
  refusedPositions: [],
};

async function main() {
  console.log('--- compose-discovery-scan smoke ---');
  console.log();

  // 1. Render PDF (covers @docket/discovery-pdf composition)
  console.log('Step 1: render PDF…');
  const t0 = Date.now();
  const pdfBuffer = await renderDiscoveryScanPdf(SAMPLE_INPUT);
  if (pdfBuffer.subarray(0, 5).toString('utf-8') !== '%PDF-') {
    throw new Error('PDF magic bytes missing');
  }
  console.log(`  PASS  ${pdfBuffer.length} bytes in ${Date.now() - t0}ms`);

  // 2. Upload to R2
  console.log('Step 2: upload to R2…');
  const tenantId = asTenantId('00000000-0000-0000-0000-000000000001');
  const storageKey = `discovery-scans/${tenantId}/${ulid()}-smoke.pdf`;
  const tUpload = Date.now();
  await putObject({
    storageKey,
    body: pdfBuffer,
    mimeType: 'application/pdf',
  });
  console.log(`  PASS  uploaded to ${storageKey} in ${Date.now() - tUpload}ms`);

  // 3. Generate signed download URL
  console.log('Step 3: generate signed download URL…');
  const presigned = await getPresignedDownloadUrl({
    storageKey,
    ttlSeconds: 60, // short — this is a smoke
    disposition: 'attachment',
    downloadFilename: 'smoke-scan.pdf',
  });
  if (!presigned.url.startsWith('http')) {
    throw new Error(`Signed URL malformed: ${presigned.url.slice(0, 60)}…`);
  }
  console.log(`  PASS  signed URL generated (expires ${new Date(presigned.expiresAt).toISOString()})`);
  console.log(`        ${presigned.url.slice(0, 100)}…`);

  // 4. Fetch via signed URL to confirm round-trip
  console.log('Step 4: fetch via signed URL…');
  const tFetch = Date.now();
  const res = await fetch(presigned.url);
  if (!res.ok) {
    throw new Error(`Signed URL fetch failed: ${res.status} ${res.statusText}`);
  }
  const fetched = Buffer.from(await res.arrayBuffer());
  if (fetched.length !== pdfBuffer.length) {
    throw new Error(
      `Round-trip size mismatch: uploaded ${pdfBuffer.length}, fetched ${fetched.length}`,
    );
  }
  if (fetched.subarray(0, 5).toString('utf-8') !== '%PDF-') {
    throw new Error('Fetched bytes are not a PDF');
  }
  console.log(`  PASS  fetched ${fetched.length} bytes in ${Date.now() - tFetch}ms`);

  // 5. Cleanup — delete the smoke object so the bucket doesn't fill
  // with throwaway test artifacts. Storage tests use the same
  // pattern (storage.test.ts).
  console.log('Step 5: cleanup…');
  await deleteObject({ storageKey });
  console.log(`  PASS  deleted ${storageKey}`);

  console.log();
  console.log('SMOKE OK: PDF render → R2 upload → signed URL → fetch → cleanup');
  console.log(`Total: ${Date.now() - t0}ms`);
}

main().catch((err) => {
  console.error('smoke-compose-discovery-scan FAILED:', err);
  process.exit(1);
});
