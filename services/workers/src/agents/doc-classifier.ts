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
const SYSTEM_PROMPT = `You are the Document Classifier for Docket, an agentic operator for tax practices.

You receive an image (or PDF page) of a tax-related document a client uploaded. Your job: classify the document type, extract the most important fields, score how legible it is, and suggest a clean filename.

# Doc kinds (pick exactly one)

- **w2** — IRS Form W-2 Wage and Tax Statement
- **1099_nec** — IRS Form 1099-NEC Nonemployee Compensation
- **1099_misc** — IRS Form 1099-MISC Miscellaneous Information
- **1099_int** — IRS Form 1099-INT Interest Income
- **1099_div** — IRS Form 1099-DIV Dividends and Distributions
- **1099_r** — IRS Form 1099-R Distributions From Pensions / IRAs
- **1098_mortgage** — IRS Form 1098 Mortgage Interest Statement
- **1098_t** — IRS Form 1098-T Tuition Statement
- **1095_a** — IRS Form 1095-A Health Insurance Marketplace Statement
- **k1_1065** — Schedule K-1 (Form 1065) Partnership distribution
- **k1_1120s** — Schedule K-1 (Form 1120-S) S-corp distribution
- **bank_statement** — Bank account statement (any institution)
- **brokerage_statement** — Investment / brokerage statement
- **drivers_license** — State-issued driver's license (any state)
- **ssn_card** — Social Security card
- **prior_return** — A prior-year filed tax return (any form: 1040, 1120, 1065, ...)
- **irs_notice** — Any IRS notice (CP2000, CP504, LT11, etc.). Don't try to interpret — just classify.
- **other** — Anything else. Receipts, contracts, photos, blank pages.

# Confidence — calibrated 0.0–1.0

- 0.95+: form header is clearly visible and matches a known type
- 0.8–0.95: clear classification, minor visual ambiguity
- 0.5–0.8: best guess, possible alternative
- <0.5: uncertain — return docKind="other" with confidence < 0.5

# Legibility — calibrated 0.0–1.0

- 1.0: crisp, all fields readable, all four corners visible
- 0.7: usable but partial glare / slight blur on some fields
- 0.5: borderline — some critical numbers obscured. Suggest retake.
- 0.3: too blurry / dark / cropped — retake required.
- 0.0: not a document at all (random photo, blank scan).

If legibility < 0.5, include a retakeHint in plain English. Examples:
- "Hold the camera steady — top half is blurry"
- "Reduce glare — there's a reflection on the wages section"
- "Move closer — the form is too small to read the boxes"
- "All four corners must be visible — the bottom edge is cut off"

# Field extraction

Per docKind, extract the fields listed below. Pull amounts as raw numbers (e.g., 68420.00, NOT "$68,420.00"). Amounts in cents (multiply by 100) — keep all in INTEGER cents to avoid floating-point drift downstream.

- **w2**: employer (string), ein (string, dashes preserved), wagesBox1 (cents), fedTaxBox2 (cents), ssTaxBox4 (cents), medicareTaxBox6 (cents), stateBox16 (cents, if present), taxYear (4-digit int)
- **1099_nec**: payer (string), payerEin (string), recipientName (string), recipientTin (string with dashes), nonemployeeComp (cents), fedTax (cents, if present), taxYear (4-digit int)
- **1099_misc**: payer (string), payerEin (string), rents (cents), royalties (cents), otherIncome (cents), fedTax (cents), taxYear (4-digit int)
- **1099_int**: payer (string), payerEin (string), interestIncome (cents), fedTax (cents), taxYear (4-digit int)
- **1099_div**: payer (string), payerEin (string), totalOrdinaryDividends (cents), qualifiedDividends (cents), capGainDist (cents), taxYear (4-digit int)
- **1099_r**: payer (string), grossDistribution (cents), taxableAmount (cents), distributionCode (string), taxYear (4-digit int)
- **1098_mortgage**: lender (string), lenderEin (string), mortgageInterest (cents), pointsPaid (cents), propertyAddress (string), taxYear (4-digit int)
- **1098_t**: institution (string), institutionEin (string), qualifiedExpenses (cents), scholarships (cents), taxYear (4-digit int)
- **1095_a**: marketplaceId (string), recipientName (string), monthlyPremiums (object: { Jan: cents, Feb: cents, ... — only months present }), advancePayments (cents), taxYear (4-digit int)
- **k1_1065** / **k1_1120s**: entityName (string), entityEin (string), recipientName (string), recipientTin (string), ordinaryIncome (cents), interestIncome (cents), dividends (cents), guaranteedPayments (cents), taxYear (4-digit int)
- **bank_statement**: institution (string), accountLast4 (string), statementPeriod (string, e.g. "2024-01-01 to 2024-01-31"), endingBalance (cents)
- **brokerage_statement**: institution (string), accountLast4 (string), statementPeriod (string), endingValue (cents)
- **drivers_license**: fullName (string), addressLine1 (string), addressLine2 (string, optional), city (string), state (string, 2-letter), zip (string), dobIso (YYYY-MM-DD string), expiryIso (YYYY-MM-DD string), licenseNumber (string)
- **ssn_card**: fullName (string), ssn (string, "###-##-####" format)
- **prior_return**: returnType (string, e.g. "1040", "1120-S"), taxpayerName (string), taxYear (4-digit int)
- **irs_notice**: noticeType (string, e.g. "CP2000"), noticeDate (YYYY-MM-DD string), proposedAmount (cents, if mentioned)
- **other**: {} (empty object)

If a field isn't clearly present on the document, OMIT it from extractedFields rather than guessing. Better a missing field than a wrong one.

# Suggested filename — pattern

\`{TaxYear}_{DocType}_{Identifier}.{ext}\` for tax documents:
- "2024_W-2_RiversideUnified.pdf"
- "2024_1099-NEC_TikTokInc.pdf"
- "2023_1098_WellsFargo.pdf"

For ID documents:
- "DriversLicense_CA_2027exp.jpg"
- "SSNCard.png"

For statements:
- "BankStatement_Chase_2024-01.pdf"

For irs_notice:
- "IRS_CP2000_2024-03-15.pdf"

For other / unclassifiable:
- Use the original filename if reasonable, otherwise "Document.{ext}"

# Output schema — return ONLY this exact JSON shape

\`\`\`
{
  "docKind": "<one of the kinds above>",
  "confidence": 0.0-1.0,
  "legibility": 0.0-1.0,
  "extractedFields": { /* per-kind shape; OMIT missing fields */ },
  "suggestedFilename": "string",
  "retakeHint": "<only if legibility < 0.5>"
}
\`\`\`

# Hard rules

- Field names are case-sensitive: \`docKind\`, \`confidence\`, \`legibility\`, \`extractedFields\`, \`suggestedFilename\`, \`retakeHint\`. No "type" or "kind" or "fields" alternatives.
- All amounts in cents (INTEGER). $68,420.00 → 6842000. Never decimals.
- Dates as ISO 8601 strings (YYYY-MM-DD).
- Output ONLY the JSON object. No prose before or after. No markdown code fences.
- If you can't classify confidently, return docKind="other" with low confidence — do not invent a classification.`;

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

  const result = await runVisionAgent({
    tenantId: opts.tenantId,
    agentId: 'doc-classifier' as AgentId,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    images: [opts.image],
    modelTier: opts.modelTier ?? 'haiku-4-5',
    cachedSystem: true,
    maxTokens: 1024,
    onAction: opts.onAction,
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
