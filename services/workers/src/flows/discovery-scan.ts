// composeDiscoveryScan — the high-level flow that runs a Discovery
// agent + renders the result to a PDF + uploads it to R2 + returns a
// signed download URL. The single function that callers (Inngest
// jobs, server actions, smoke tests, future API endpoints) compose
// against. Encapsulates the multi-step orchestration so individual
// callers don't have to wire everything by hand.
//
// FLOW
//   1. runDiscovery(opts) — C7. Surfaces positions; verifies cites.
//   2. renderDiscoveryScanPdf(input) — C8. PDF Buffer.
//   3. putObject(R2 bucket, key=discovery-scans/<tenant>/<ulid>.pdf)
//   4. getPresignedDownloadUrl({ storageKey, ttl }) — signed link.
//
// RETURNS
//   {
//     storageKey, signedUrl, urlExpiresAt,
//     positions, refusedPositions, costUsd, latencyMs, ...
//   }
//
// COST + LATENCY (per scan)
//   - Discovery agent: $0.05-0.10 on Sonnet 4.6 (Bedrock fallover
//     pre-paid in case Anthropic SDK times out on RAG-shaped prompt)
//   - Voyage retrieval: ~$0 (free tier covers smoke volume)
//   - PDF render: $0 + ~300ms
//   - R2 upload: $0.00015 per upload
//   - Signed URL gen: $0
//   - Total: ~$0.06-0.10 per scan, 60-150s end-to-end
//
// USAGE
//   const scan = await composeDiscoveryScan({
//     agentInput: {
//       context: { tenantId, clientId, trustLevel: 1 },
//       intakeAnswers,
//       jurisdictions: ['federal', 'CA'],
//     },
//     pdfMeta: {
//       firmName: 'Vazant Consulting',
//       preparedFor: 'Antonio Vazquez, EA',
//       taxYear: 2024,
//       generatedAt: new Date().toISOString().slice(0, 10),
//     },
//     signedUrlTtlSeconds: 14 * 24 * 3600, // 14 days
//   });
//   sendEmail(scan.signedUrl);

import {
  runDiscovery,
  type DiscoverOptions,
  type DiscoveryOutput,
  type DiscoveryTrustGate,
} from '../agents/discovery-agent.js';
import {
  renderDiscoveryScanPdf,
  type DiscoveryScanInput,
  type PdfScanMeta,
  type PdfPosition,
  type PdfRefusedPosition,
} from '@docket/discovery-pdf';
import { putObject, getPresignedDownloadUrl, ulid } from '@docket/storage';
import type { TenantId } from '@docket/shared';

export interface ComposeDiscoveryScanOptions {
  /** Full agent input including tenant context. */
  agentInput: DiscoverOptions['input'];
  /**
   * PDF delivery metadata (firm name, prepared-for contact, etc.).
   * `generatedAt` is filled with today's ISO date if omitted.
   */
  pdfMeta: Omit<PdfScanMeta, 'generatedAt'> & {
    generatedAt?: string;
  };
  /** Sonnet 4.6 by default. Override for evals (haiku). */
  modelTier?: DiscoverOptions['modelTier'];
  /**
   * Whether to include DRAFT-DAVID firm memos in retrieval +
   * citation verifier. Default false — production callers MUST
   * leave this off so prospects never see drafts.
   */
  includeDrafts?: boolean;
  /**
   * TTL on the signed R2 download URL. Default 14 days
   * (matches the DESIGN-PARTNER-ACQUISITION-PLAN's outreach window:
   * prospect should still be able to re-open the PDF 2 weeks after
   * delivery).
   */
  signedUrlTtlSeconds?: number;
  /** Optional onAction hook for cost telemetry + audit trail. */
  onAction?: DiscoverOptions['onAction'];
}

export interface ComposeDiscoveryScanResult {
  /** Agent output + trust-gate + retrieval count. */
  agent: {
    output: DiscoveryOutput;
    trustGate: DiscoveryTrustGate;
    retrievalHitCount: number;
    costUsd: number;
    latencyMs: number;
    modelUsed: 'haiku-4-5' | 'sonnet-4-6' | 'opus-4-7';
  };
  /** R2 storage key. Use this to delete or re-fetch the PDF later. */
  storageKey: string;
  /** Signed download URL — what the firm gets in the email. */
  signedUrl: string;
  /** ISO-8601 timestamp when the signed URL expires. */
  urlExpiresAt: string;
  /** Size of the rendered PDF in bytes (for cost/Sentry telemetry). */
  pdfBytes: number;
}

/**
 * Run a Discovery scan end-to-end and return everything the caller
 * needs to deliver the artifact (signed URL + telemetry + trust-gate).
 *
 * Does NOT send email — that's C10 (delivery worker). Does NOT
 * persist the scan to a `scans` table — that's C11 (audit trail
 * for the scan deliverable). Both call into this function.
 */
export async function composeDiscoveryScan(
  opts: ComposeDiscoveryScanOptions,
): Promise<ComposeDiscoveryScanResult> {
  // 1. Agent — surface positions + verify citations.
  const agent = await runDiscovery({
    input: opts.agentInput,
    modelTier: opts.modelTier ?? 'sonnet-4-6',
    includeDrafts: opts.includeDrafts ?? false,
    onAction: opts.onAction,
  });

  // 2. Map the agent output (DiscoveryOutput shape) to the PDF input
  // shape (DiscoveryScanInput). The two shapes overlap heavily but
  // diverge on delivery-metadata fields; the agent doesn't track
  // firm name / prepared-for contact / etc.
  const pdfInput: DiscoveryScanInput = {
    meta: {
      ...opts.pdfMeta,
      generatedAt:
        opts.pdfMeta.generatedAt ?? new Date().toISOString().slice(0, 10),
    },
    positions: agent.output.positions.map(
      (p): PdfPosition => ({
        claim: p.claim,
        tier: p.tier,
        authority: p.authority.map((a) => ({
          source: a.source,
          cite: a.cite,
          summary: a.summary,
        })),
        estimatedImpact: p.estimatedImpact,
        auditRisk: p.auditRisk,
        disclosureRequired: p.disclosureRequired,
        rationale: p.rationale,
        gapsToConfirm: p.gapsToConfirm,
      }),
    ),
    refusedPositions: agent.output.refusedPositions.map(
      (r): PdfRefusedPosition => ({
        hypothetical: r.hypothetical,
        reason: r.reason,
      }),
    ),
    reasoning: agent.output.reasoning,
    confidence: agent.output.confidence,
  };

  // 3. Render the PDF.
  const pdfBuffer = await renderDiscoveryScanPdf(pdfInput);

  // 4. Upload to R2 under a tenant-scoped key. Key shape:
  //   discovery-scans/<tenantId>/<ulid>.pdf
  // tenantId-prefix means future bulk-delete (offboarding) is a
  // simple prefix-scan; ulid keeps keys monotonic + collision-free.
  const tenantId: TenantId = opts.agentInput.context.tenantId;
  const storageKey = `discovery-scans/${tenantId}/${ulid()}.pdf`;
  await putObject({
    storageKey,
    body: pdfBuffer,
    mimeType: 'application/pdf',
  });

  // 5. Generate a signed download URL. 14 days default matches the
  // outreach cadence — prospects re-open the PDF over a 2-week
  // window after delivery (per DESIGN-PARTNER-ACQUISITION-PLAN).
  // Mark as 'attachment' so clicking the link in the email triggers
  // a download (preferred UX for a deliverable artifact, vs inline
  // browser-render which can be ambiguous on some PDF viewers).
  const ttlSeconds = opts.signedUrlTtlSeconds ?? 14 * 24 * 3600;
  const presigned = await getPresignedDownloadUrl({
    storageKey,
    ttlSeconds,
    disposition: 'attachment',
    downloadFilename: `Discovery-Scan-${opts.pdfMeta.firmName.replace(/\s+/g, '-')}-TY${opts.pdfMeta.taxYear}.pdf`,
  });
  const signedUrl = presigned.url;
  const urlExpiresAt = new Date(presigned.expiresAt).toISOString();

  return {
    agent: {
      output: agent.output,
      trustGate: agent.trustGate,
      retrievalHitCount: agent.retrievalHitCount,
      costUsd: agent.costUsd,
      latencyMs: agent.latencyMs,
      modelUsed: agent.modelUsed,
    },
    storageKey,
    signedUrl,
    urlExpiresAt,
    pdfBytes: pdfBuffer.length,
  };
}
