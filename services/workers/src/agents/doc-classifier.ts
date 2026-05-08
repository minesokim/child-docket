// Document classifier — the agent that turns an uploaded scan / photo
// / PDF into structured fields for the documents row.
//
// Input: image bytes (R2-fetched) + original filename.
// Output: docKind + confidence + extractedFields + suggestedFilename + legibility.
//
// Model tier: Haiku 4.5 (per CLAUDE.md §6 cost discipline). Vision is
// the canonical Haiku case — fast, cheap, structured output.
//
// THE DOCS THIS AGENT HANDLES (v0)
//   W-2, 1099-NEC, 1099-MISC, 1099-INT, 1099-DIV, 1099-R, 1098-mortgage,
//   1098-T, 1095-A, K-1 (1065/1120-S), bank statement, brokerage
//   statement, driver's license, SSN card, prior-year return.
//
//   "other" is the catch-all for anything else (receipts, contracts,
//   notices). The notice-triage agent handles 'irs_notice' separately
//   on the command-room side; this agent flags them but doesn't
//   process them.

import { z } from 'zod';
import type { AgentId, TenantId } from '@docket/shared';
import { runVisionAgent, type VisionImageInput } from '@docket/orchestrator';
import { getPrompt } from '@docket/prompts';

// ────────────────────────────────────────────────────────────────
// Doc kinds — the v0 catalog. Add to this list (and to the system
// prompt example block) when new document types come up.
// ────────────────────────────────────────────────────────────────
export const DOC_KINDS = [
  'w2',
  '1099_nec',
  '1099_misc',
  '1099_int',
  '1099_div',
  '1099_r',
  '1098_mortgage',
  '1098_t',
  '1095_a',
  'k1_1065',
  'k1_1120s',
  'bank_statement',
  'brokerage_statement',
  'drivers_license',
  'ssn_card',
  'prior_return',
  'irs_notice',
  'other',
] as const;

export type DocKind = (typeof DOC_KINDS)[number];

// ────────────────────────────────────────────────────────────────
// Output schema — what the classifier returns.
// ────────────────────────────────────────────────────────────────
export const DocClassifierOutputSchema = z.object({
  docKind: z.enum(DOC_KINDS),
  confidence: z.number().min(0).max(1),
  legibility: z
    .number()
    .min(0)
    .max(1)
    .describe('How readable the document is — 1.0 perfect, 0.5 borderline, <0.3 retake'),
  /**
   * Fields extracted from the document. Keys depend on docKind:
   *   - w2:           { employer, ein, wagesBox1, fedTaxBox2, ssTaxBox4, medicareTaxBox6, taxYear }
   *   - 1099_nec:     { payer, payerEin, recipientName, recipientTin, nonemployeeComp, taxYear }
   *   - 1099_misc:    { payer, payerEin, rents, royalties, otherIncome, fedTax, taxYear }
   *   - 1099_int:     { payer, interestIncome, fedTax, taxYear }
   *   - 1098_mortgage:{ lender, mortgageInterest, propertyAddress, taxYear }
   *   - 1095_a:       { marketplaceId, advancePayments, monthlyPremiums, taxYear }
   *   - k1_*:         { entityName, entityEin, ordinaryIncome, ... }
   *   - drivers_license: { fullName, address, dobIso, expiryIso, state, licenseNumber }
   *   - ssn_card:     { fullName, ssn }   ← extracted but encrypted before persistence
   *   - other:        {} (no extraction)
   */
  extractedFields: z.record(z.unknown()),
  /**
   * Suggested filename for the document. Pattern:
   *   "{taxYear}_{DocType}_{Identifier}.{ext}"
   * e.g., "2024_W-2_RiversideUnified.pdf", "2024_1099-NEC_TikTokInc.pdf",
   * "DriversLicense_CA_2027exp.jpg"
   */
  suggestedFilename: z.string().min(3).max(120),
  /**
   * Optional retake hint when legibility < 0.5. Plain-English nudge
   * for the client ("hold camera steady", "avoid glare on top half").
   */
  retakeHint: z.string().optional(),
});

export type DocClassifierOutput = z.infer<typeof DocClassifierOutputSchema>;

// ────────────────────────────────────────────────────────────────
// System prompt — the doc-classifier's brain.
// Cached as ephemeral so repeated calls in the same minute share
// prompt-cache, dropping cost ~80% per CLAUDE.md §7.
// ────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────
// Public API — classifyDocument.
// ────────────────────────────────────────────────────────────────
export type ClassifyDocumentOptions = {
  tenantId: TenantId;
  /** Image to classify. Caller fetches from R2 + base64-encodes. */
  image: VisionImageInput;
  /** Original filename (for context, in case the model picks up on naming hints). */
  originalFilename: string;
  modelTier?: 'haiku-4-5' | 'sonnet-4-6';
  onAction?: Parameters<typeof runVisionAgent>[0]['onAction'];
};

export async function classifyDocument(opts: ClassifyDocumentOptions): Promise<{
  output: DocClassifierOutput;
  costUsd: number;
  latencyMs: number;
  modelUsed: 'haiku-4-5' | 'sonnet-4-6' | 'opus-4-7';
}> {
  const userPrompt = `Classify the attached document. Original filename: ${opts.originalFilename}`;
  const prompt = await getPrompt('doc-classifier');

  const result = await runVisionAgent({
    tenantId: opts.tenantId,
    agentId: 'doc-classifier' as AgentId,
    systemPrompt: prompt.template,
    userPrompt,
    images: [opts.image],
    modelTier: opts.modelTier ?? 'haiku-4-5',
    cachedSystem: true,
    maxTokens: 1024,
    onAction: opts.onAction,
    promptId: prompt.id,
    promptVersion: prompt.version,
  });

  // Extract first JSON object from response. Same defensive parsing as
  // the triage classifier — model occasionally adds a code fence.
  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(
      `doc-classifier: model returned no JSON. Raw text: ${result.text.slice(0, 500)}`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error(
      `doc-classifier: JSON.parse failed. Raw text: ${result.text.slice(0, 500)}`,
    );
  }
  const validation = DocClassifierOutputSchema.safeParse(parsed);
  if (!validation.success) {
    throw new Error(
      `doc-classifier: schema validation failed. Errors: ${JSON.stringify(
        validation.error.issues,
      )}. Parsed: ${JSON.stringify(parsed).slice(0, 500)}`,
    );
  }

  return {
    output: validation.data,
    costUsd: result.costUsd,
    latencyMs: result.latencyMs,
    modelUsed: result.modelUsed,
  };
}

export { DOC_KINDS as DOC_KINDS_LIST };
