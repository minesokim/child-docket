// DiscoveryScanInput — the shape the PDF renderer takes. Mirrors the
// Discovery agent's runtime output (services/workers/src/agents/
// discovery-agent.ts → DiscoveryOutput) plus delivery metadata (firm
// name, tax year, AGI bucket, etc.) that the agent doesn't track.
//
// Why a separate input shape rather than DiscoveryOutput directly?
//   - DiscoveryOutput is the agent's internal result. The PDF is a
//     deliverable artifact with additional context (firm, prepared-for
//     contact, scan metadata, branded copy blocks).
//   - Keeping a separate type means the agent and the PDF renderer
//     can evolve independently. The composer (e.g., a worker that
//     runs Discovery + builds the PDF) maps one to the other.
//
// All numeric dollar amounts are in USD. Estimated impact is the
// agent-surfaced figure per CLAUDE.md §13 (Position Framework).

export type Tier = 1 | 2 | 3 | 4;

export interface PdfCitation {
  source:
    | 'irc'
    | 'treas-reg'
    | 'irs-pub'
    | 'ftb-pub'
    | 'tax-court'
    | 'rev-rul'
    | 'ftb-legal-ruling';
  cite: string;
  summary: string;
}

export interface PdfPosition {
  claim: string;
  tier: Tier;
  authority: PdfCitation[];
  estimatedImpact: {
    dollars: number;
    certainty: 'estimate' | 'precise';
  };
  auditRisk: 'low' | 'moderate' | 'high';
  disclosureRequired: boolean;
  rationale: string;
  gapsToConfirm: string[];
}

export interface PdfRefusedPosition {
  hypothetical: string;
  reason: string;
}

export interface PdfScanMeta {
  /** Firm receiving the scan, displayed on cover + footer. */
  firmName: string;
  /** Person prepared for, displayed on cover ("Prepared for ..."). */
  preparedFor: string;
  /** Tax year of the return scanned. */
  taxYear: number;
  /** ISO date string of generation. Formatted server-side. */
  generatedAt: string;
  /** Entity type — "S-Corp", "Sole Prop", "LLC", etc. */
  entityType?: string;
  /** AGI bucket — "$200K-$300K", etc. Optional; some firms refuse. */
  agiBucket?: string;
  /** Schedules present — "K-1 (1120-S), Schedule E, Schedule A". */
  schedules?: string[];
  /** Primary state(s) the return touches. */
  states?: string[];
}

export interface DiscoveryScanInput {
  meta: PdfScanMeta;
  positions: PdfPosition[];
  refusedPositions: PdfRefusedPosition[];
  /**
   * Optional summary written by the agent or the preparer. Renders on
   * the executive-summary page below the totals table.
   */
  reasoning?: string;
  /**
   * Confidence score [0, 1] from the agent. Rendered with a friendly
   * label ("High" >= 0.8, "Moderate" >= 0.5, "Low" < 0.5).
   */
  confidence?: number;
}

/**
 * Sum estimated impact across positions, optionally filtered by tier.
 * Helper used by the executive summary table.
 */
export function sumImpactByTier(
  positions: PdfPosition[],
  tier?: Tier,
): number {
  return positions
    .filter((p) => (tier == null ? true : p.tier === tier))
    .reduce((acc, p) => acc + p.estimatedImpact.dollars, 0);
}
