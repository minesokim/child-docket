// Adapter — convert deterministic-scanner output to PDF input shape.
//
// ⚠️ SCOPE CLARIFIER (2026-05-15 audit fix)
// ───────────────────────────────────────────────────────────────
// This adapter bridges the DEV/DEBUG deterministic scanner at
// @docket/tax-graph/discovery-scan.ts to the PDF renderer. It is
// NOT the production path from the /scan landing page to a
// delivered Petal-branded PDF.
//
// The PRODUCTION pipeline is:
//   /scan form submit (apps/client-portal/src/app/api/scan-intake-stub)
//     → manual David review (per DISCOVERY-SCAN-OPERATIONAL.md
//                            "Manual gate during first 30 scans")
//     → composeDiscoveryScan flow
//       (services/workers/src/flows/discovery-scan.ts)
//     → LLM Discovery agent
//       (services/workers/src/agents/discovery-agent.ts)
//     → its own adapter into DiscoveryScanInput
//     → @docket/discovery-pdf renderer
//     → R2 upload + Resend delivery
//
// This adapter (`from-scan.ts`) is invoked only by the dev smoke at
// `scripts/smoke-from-scan.ts`. It's useful for testing the PDF
// renderer's output shape against deterministic input without
// needing the LLM agent + authority-RAG corpus + Anthropic credits.
//
// Audit found I (Claude) shipped this adapter today (2026-05-15)
// without realizing the LLM Discovery agent already had its own
// adapter shipped 5/12. This banner exists so the next reader sees
// the duality + doesn't mistake the smoke path for the prod path.
// ───────────────────────────────────────────────────────────────
//
// The catalog scanner (@docket/tax-graph/discovery-scan.ts) emits
// DiscoveredPosition[] with string-tier + explicit IRC/TreasReg/case
// fields. The PDF renderer expects PdfPosition[] with numeric-tier +
// PdfCitation[] array of source/cite/summary tuples.
//
// This function is the BRIDGE — it lets the deterministic catalog
// scanner emit PDF input for the dev smoke without rewriting either
// the scanner or the renderer. The two systems can evolve
// independently as long as this adapter stays in sync.
//
// USAGE
//   import {
//     renderDiscoveryScanPdf,
//     discoveredToPdfInput,
//   } from '@docket/discovery-pdf';
//   import { scanPositionLibrary } from '@docket/tax-graph';
//
//   const scan = scanPositionLibrary(intakeState, { clientId, taxYear: 2025 });
//   const pdfInput = discoveredToPdfInput(scan, {
//     firmName: 'Vazant Consulting',
//     preparedFor: 'Antonio Vazquez, EA',
//     taxYear: 2025, // required — must match the scan's taxYear
//   });
//   const buffer = await renderDiscoveryScanPdf(pdfInput);

import {
  type DiscoveredPosition,
  type ScanResult,
  TIER_RANK,
} from '@docket/tax-graph';
import type {
  DiscoveryScanInput,
  PdfCitation,
  PdfPosition,
  PdfRefusedPosition,
  PdfScanMeta,
  Tier,
} from './types.js';

// v0 invariant — the deterministic catalog scanner emits zero genuine
// refusals because every entry in POSITION_LIBRARY_V0 is Tier 1-4
// (settled / substantial / reasonable_basis / more_likely_than_not).
// Nothing lives below the Reasonable Basis floor in the catalog, so
// the PDF's "Refused — below Reasonable Basis" section stays empty
// for any scan whose only rejections are no_trigger_match (catalog
// miss) or below_confidence_threshold (weak signal). Surfacing those
// as refusedPositions would mislabel them — the PDF body copy at
// DiscoveryScanDocument.tsx:493 + :522 explicitly ties refusals to
// the framework's structural floor against unsupportable positions.
// Both finding categories should render as "considered but did not
// apply" in a future PDF section; that work is deferred to v1.
//
// emptyV0Refusals() returns a FRESH array on each call rather than
// sharing a module-level instance — `PdfRefusedPosition[]` is a
// mutable type, so a downstream `.push(...)` against a shared sentinel
// would corrupt every subsequent adapter call from the same module
// lifetime.
function emptyV0Refusals(): PdfRefusedPosition[] {
  return [];
}

/**
 * Convert a single DiscoveredPosition (catalog scanner output) to a
 * PdfPosition (PDF renderer input). The mapping:
 *
 *   - tier (string) → TIER_RANK numeric (settled → 1, ...)
 *   - ircSection / treasReg / controllingCase / revRuling / irsPub
 *     → PdfCitation[] (one entry per non-null authority)
 *   - estimatedSavingsLow + High → midpoint as the impact dollars
 *     with certainty='estimate' (we have a RANGE not a point)
 *   - sustainabilityEstimatePct → auditRisk band (≥90 = low, ≥70 =
 *     moderate, < 70 = high). Inverse correlation: lower
 *     sustainability = higher audit risk.
 *   - documentationChecklist → gapsToConfirm (the items the EA needs
 *     to verify or collect)
 *   - displayName + shortDescription → claim + rationale
 */
export function discoveredToPdfPosition(
  dp: DiscoveredPosition,
): PdfPosition {
  const authority: PdfCitation[] = [];

  // Every position has an IRC section — primary anchor goes first.
  authority.push({
    source: 'irc',
    cite: dp.ircSection,
    summary: `Primary statutory anchor for ${dp.displayName}.`,
  });

  if (dp.treasReg) {
    authority.push({
      source: 'treas-reg',
      cite: dp.treasReg,
      summary: `Implementing regulation for ${dp.ircSection}.`,
    });
  }

  if (dp.controllingCase) {
    authority.push({
      source: 'tax-court',
      cite: dp.controllingCase,
      summary: 'Controlling case authority.',
    });
  }

  if (dp.revRuling) {
    authority.push({
      source: 'rev-rul',
      cite: dp.revRuling,
      summary: 'IRS guidance.',
    });
  }

  if (dp.irsPub) {
    authority.push({
      source: 'irs-pub',
      cite: dp.irsPub,
      summary: 'Taxpayer-facing IRS publication.',
    });
  }

  // Tier mapping: TIER_RANK is 1-4 and matches the PDF's Tier type.
  const tier = TIER_RANK[dp.tier] as Tier;

  // Audit-risk bands derived from sustainabilityEstimatePct.
  // High-sustainability positions (Tier 1 settled) are low audit risk;
  // lower-sustainability positions (Tier 3-4) are higher audit risk.
  let auditRisk: PdfPosition['auditRisk'];
  if (dp.sustainabilityEstimatePct >= 90) {
    auditRisk = 'low';
  } else if (dp.sustainabilityEstimatePct >= 70) {
    auditRisk = 'moderate';
  } else {
    auditRisk = 'high';
  }

  // Impact: midpoint of the savings range, certainty=estimate (we
  // have a range, not a point estimate).
  const dollars = Math.round(
    (dp.estimatedSavingsLow + dp.estimatedSavingsHigh) / 2,
  );

  return {
    claim: dp.displayName,
    tier,
    authority,
    estimatedImpact: {
      dollars,
      certainty: 'estimate',
    },
    auditRisk,
    disclosureRequired: dp.disclosureRequired,
    rationale: dp.shortDescription,
    // Documentation checklist becomes the "gaps to confirm" list —
    // the items the EA needs to collect or verify before claiming
    // the position. Naming difference is intentional: the catalog
    // says "documentation"; the PDF says "gaps to confirm" because
    // some items may already exist (no actual gap) and the EA
    // mentally checks them off during review.
    gapsToConfirm: dp.documentationChecklist,
  };
}

/**
 * Adapter options — metadata the catalog scanner doesn't capture but
 * the PDF needs (firm name, preparedFor name, entity context, etc.).
 * The caller (worker / API route) provides these.
 */
export type DiscoveredToPdfOptions = {
  /** Firm receiving the scan ("Vazant Consulting" / "John's CPA"). */
  firmName: string;
  /** Person prepared for. Defaults to firmName when omitted. */
  preparedFor?: string;
  /** Optional context for the cover page + footer. */
  entityType?: string;
  agiBucket?: string;
  schedules?: string[];
  states?: string[];
  /** Overrides the generation timestamp. ISO date. Default: new
   *  Date().toISOString().slice(0, 10). Made parametric so smoke
   *  tests can lock the date for snapshot-style assertions. */
  generatedAt?: string;
  /** Tax year stamped on the meta block. REQUIRED — the caller
   *  always knows the tax year (it was passed to scanPositionLibrary
   *  as ScanOptions.taxYear), so requiring it here removes the
   *  wall-clock fallback that would mislabel the PDF when a scan
   *  returns zero surfaced positions. */
  taxYear: number;
  /** Optional executive summary text. */
  reasoning?: string;
  /** Overall scan confidence (0-1). When omitted, derived as the
   *  average surfaceConfidence across all surfaced positions. */
  confidence?: number;
};

/**
 * Convert a full ScanResult to the DiscoveryScanInput shape the PDF
 * renderer consumes. Includes:
 *   - Positions: every DiscoveredPosition in result.positions
 *   - RefusedPositions: always empty for v0 — see V0_REFUSED_POSITIONS
 *     comment above for why no_trigger_match / below_threshold
 *     rejections do NOT map to the PDF's refusal-floor section.
 *   - Meta: composed from options (taxYear required; no wall-clock
 *     fallback — see DiscoveredToPdfOptions.taxYear).
 *   - Confidence: derived if not provided.
 */
export function discoveredToPdfInput(
  scan: ScanResult,
  options: DiscoveredToPdfOptions,
): DiscoveryScanInput {
  const positions: PdfPosition[] = scan.positions.map(discoveredToPdfPosition);

  // refusedPositions stays empty in v0 — see emptyV0Refusals above.
  // Surfacing no_trigger_match rejections here would label them
  // "Refused — below Reasonable Basis" in the PDF body, which is
  // factually wrong: they're catalog misses, not refusal-floor
  // refusals. The catalog's `refusalIf` arrays are the right input
  // for genuine refusals, but the v0 scanner doesn't evaluate them
  // against IntakeState yet (v1 work).
  const refusedPositions = emptyV0Refusals();

  const generatedAt =
    options.generatedAt ?? new Date().toISOString().slice(0, 10);

  const meta: PdfScanMeta = {
    firmName: options.firmName,
    preparedFor: options.preparedFor ?? options.firmName,
    taxYear: options.taxYear,
    generatedAt,
    entityType: options.entityType,
    agiBucket: options.agiBucket,
    schedules: options.schedules,
    states: options.states,
  };

  // Confidence: explicit option > average surfaceConfidence across
  // surfaced positions > 0 (when nothing surfaced).
  let confidence = options.confidence;
  if (confidence == null) {
    if (scan.positions.length === 0) {
      confidence = 0;
    } else {
      const sum = scan.positions.reduce(
        (acc, p) => acc + p.surfaceConfidence,
        0,
      );
      confidence = sum / scan.positions.length;
    }
  }

  return {
    meta,
    positions,
    refusedPositions,
    reasoning: options.reasoning,
    confidence,
  };
}
