// Triage classifier — the agent that decides what kind of issue a signal is.
//
// Input: a normalized signal (Gmail message, portal upload, manual flag).
// Output: classified IssueType + severity + confidence + recommended action + evidence + sources.
//
// Model tier: Haiku 4.5 (cost discipline; classification doesn't need Sonnet).
// Promote to Sonnet only for ambiguous signals where Haiku confidence < 0.7.

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type {
  AgentId,
  ClientId,
  IssueSeverity,
  IssueSource,
  IssueType,
  TenantId,
} from '@docket/shared';
import { ISSUE_TYPES } from '@docket/shared';
import { runDocketAgent } from '@docket/orchestrator';

// ────────────────────────────────────────────────────────────────
// Input schema — what we pass to the classifier.
// Caller (Inngest function) is responsible for assembling this from
// gmail_threads / documents / portal events.
// ────────────────────────────────────────────────────────────────
export type ClassifierSignal =
  | {
      kind: 'gmail_message';
      from: string;
      to: string[];
      subject: string | null;
      bodyText: string;
      receivedAt: string; // ISO
    }
  | {
      kind: 'portal_upload';
      filename: string;
      mimeType: string;
      uploadedAt: string;
      ocrPreview?: string;
    }
  | {
      kind: 'manual_flag';
      authorUserId: string;
      note: string;
    };

export type ClassifierContext = {
  tenantId: TenantId;
  clientId: ClientId | null;
  clientFullName?: string;
  engagementType?: string;
  engagementStatus?: string;
  recentDocs?: Array<{ filename: string; classification: string | null }>;
  intakeAnswers?: Record<string, unknown>; // a few key fields
  lastInteractionDays?: number;
};

// ────────────────────────────────────────────────────────────────
// Output schema — what the classifier returns.
// ────────────────────────────────────────────────────────────────
export const ClassifierOutputSchema = z.object({
  issueType: z.enum(ISSUE_TYPES as readonly [IssueType, ...IssueType[]]),
  severity: z.enum(['high', 'medium', 'low'] as const),
  confidence: z.number().min(0).max(1),
  title: z.string().min(5).max(120),
  summary: z.string().min(5).max(200),
  whyThisMatters: z.string().min(10).max(1000),
  recommendedAction: z.string().min(5).max(500),
  evidence: z.record(z.unknown()),
  sources: z.array(
    z.object({
      kind: z.enum([
        'email',
        'document',
        'intake_response',
        'prior_return',
        'irs_transcript',
        'xero_invoice',
        'calendar_event',
        'manual_note',
      ]),
      ref: z.string(),
      label: z.string(),
    }),
  ),
});

export type ClassifierOutput = z.infer<typeof ClassifierOutputSchema>;

// ────────────────────────────────────────────────────────────────
// System prompt — the classifier's brain.
// ────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are the Triage Classifier for Docket, an agentic operator for tax practices.

Your job: take a signal (Gmail message, portal upload, manual flag) and classify it into ONE of 11 issue types that surface in the preparer's Triage queue.

# Issue types (pick exactly one)

- **doc_mismatch**: the document we just received contradicts what the client said in intake (numbers, names, status). High severity unless trivial.
- **doc_gap**: the client uploaded a document we needed, OR a needed document is still missing. Medium severity unless deadline-imminent.
- **ero_pending**: a 1040 / 1120 / 1065 return is signed by the client and ready to e-file pending ERO countersignature. High severity (we want returns out the door).
- **prep_decision**: a structural choice is blocking prep — entity choice (S-corp vs LLC), filing status, election timing.
- **signature_pending**: an engagement letter, §7216 consent, 8879, 2848, or 8821 is awaiting client signature.
- **extension_risk**: the client has been silent / non-responsive AND the deadline is approaching AND we don't have what we need.
- **payment_status**: a client paid (good — surface for next step) OR has unpaid invoice blocking work.
- **meeting_prep**: a scheduled call needs a brief.
- **missing_info**: a specific data point is missing — 1095-A, basis, dependent SSN, prior-year AGI.
- **quick_reply**: short inbound message from the client awaiting a short outbound reply.
- **irs_notice**: a CP2000, CP504, LT11, etc. arrived (uploaded notice doc OR mention in email).

# How to think

1. Read the signal carefully.
2. Cross-reference the client context (intake answers, engagement status, recent documents).
3. Identify what kind of issue this represents.
4. Pull EVIDENCE from the signal — quote specific numbers, document references, dates.
5. Cite SOURCES — every claim needs a source kind + ref + label.
6. Recommend a NEXT ACTION for the preparer in plain English.

# Severity rubric

- **high**: deadline imminent (≤7 days) OR financial impact > $5k OR client at extension risk OR signature blocking a file.
- **medium**: most other issues — needs attention this week.
- **low**: routine, can wait days, no time pressure.

# Confidence

A real number 0.0–1.0. Be calibrated:
- 0.95+: signal is unambiguous (e.g., 8879 signed and dated, ERO pending)
- 0.8–0.95: clear classification with minor ambiguity
- 0.5–0.8: plausible but could be another type
- <0.5: don't classify — return type with the lowest plausibility and confidence < 0.5

# Output schema — return ONLY this exact JSON shape

\`\`\`
{
  "issueType": "doc_mismatch" | "doc_gap" | "ero_pending" | "prep_decision" | "signature_pending" | "extension_risk" | "payment_status" | "meeting_prep" | "missing_info" | "quick_reply" | "irs_notice",
  "severity": "high" | "medium" | "low",
  "confidence": 0.0-1.0,
  "title": "Short headline of the issue (5-120 chars). Include the client's first name.",
  "summary": "One-line subtitle that appears below the title (5-200 chars).",
  "whyThisMatters": "2-4 sentence explanation of what's going on and why it needs attention (10-1000 chars).",
  "recommendedAction": "Plain-English next step for the preparer (5-500 chars).",
  "evidence": { /* object — keys depend on issueType. For doc_mismatch: { intakeAmount, documentAmount, difference, field }. For others, see your inference. */ },
  "sources": [
    { "kind": "email" | "document" | "intake_response" | "prior_return" | "irs_transcript" | "xero_invoice" | "calendar_event" | "manual_note", "ref": "stable-identifier-string", "label": "Human-readable label" }
  ]
}
\`\`\`

# Example output (for a Priya-like doc_mismatch signal)

\`\`\`json
{
  "issueType": "doc_mismatch",
  "severity": "high",
  "confidence": 0.94,
  "title": "Priya's TikTok 1099 doesn't match her intake",
  "summary": "TikTok 1099 shows $4,320 vs $2,300 reported in intake",
  "whyThisMatters": "The 1099-NEC from TikTok shows $4,320 in earnings, which doesn't match the $2,300 Priya reported in her intake. We need to confirm the correct amount to avoid filing delays or IRS notices.",
  "recommendedAction": "Send a message to Priya to confirm which amount is correct and request any additional TikTok income not received.",
  "evidence": {
    "intakeAmount": { "value": 230000, "source": "Intake response (Jan 18)", "confidence": "high" },
    "documentAmount": { "value": 432000, "source": "TikTok 1099-NEC", "confidence": "high" },
    "difference": 202000,
    "field": "income_1099_nec"
  },
  "sources": [
    { "kind": "intake_response", "ref": "intake-priya-2025", "label": "Intake response (Jan 18)" },
    { "kind": "document", "ref": "doc-priya-1099", "label": "TikTok 1099-NEC" }
  ]
}
\`\`\`

# Source kinds — pick the right one

- Inbound Gmail / outbound email → \`"email"\` (NOT "gmail_message" or "gmail_email")
- Uploaded files (PDFs, images, scans) → \`"document"\`
- Answers from the client portal intake form → \`"intake_response"\`
- Last year's filed return → \`"prior_return"\`
- IRS account/wage transcripts → \`"irs_transcript"\`
- Xero invoice / payment record → \`"xero_invoice"\`
- Google Calendar event → \`"calendar_event"\`
- Antonio's manual note → \`"manual_note"\`

# Hard rules

- Field names are case-sensitive and exact: \`issueType\` (not "classification"), \`whyThisMatters\` (not "why_this_matters" or "explanation"), \`recommendedAction\` (not "next_step" or "action").
- \`evidence\` is an OBJECT (not an array). The keys depend on issueType.
- \`sources\` is an ARRAY of objects, each with EXACTLY \`kind\`, \`ref\`, \`label\`. \`kind\` MUST be one of the 8 values listed above.
- All required fields must be present. No extra top-level fields.
- Output ONLY the JSON object. No prose before or after. No markdown code fences.`;

// ────────────────────────────────────────────────────────────────
// Classifier function — the public API.
// ────────────────────────────────────────────────────────────────
export type ClassifyOptions = {
  signal: ClassifierSignal;
  context: ClassifierContext;
  modelTier?: 'haiku-4-5' | 'sonnet-4-6';
  onAction?: Parameters<typeof runDocketAgent>[0]['onAction'];
};

export async function classifySignal(opts: ClassifyOptions): Promise<{
  output: ClassifierOutput;
  costUsd: number;
  latencyMs: number;
  modelUsed: 'haiku-4-5' | 'sonnet-4-6' | 'opus-4-7';
}> {
  const userPrompt = JSON.stringify({ signal: opts.signal, context: opts.context });

  const result = await runDocketAgent({
    tenantId: opts.context.tenantId,
    agentId: 'triage-classifier' as AgentId,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    modelTier: opts.modelTier ?? 'haiku-4-5',
    cachedSystem: true,
    maxTokens: 1024,
    onAction: opts.onAction,
  });

  // Extract first JSON object from response (model may wrap in code fences or add prose).
  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(
      `triage-classifier: model returned no JSON. Raw text: ${result.text.slice(0, 500)}`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    throw new Error(
      `triage-classifier: JSON.parse failed. Raw text: ${result.text.slice(0, 500)}`,
    );
  }
  const validation = ClassifierOutputSchema.safeParse(parsed);
  if (!validation.success) {
    throw new Error(
      `triage-classifier: schema validation failed. Errors: ${JSON.stringify(validation.error.issues)}. Parsed: ${JSON.stringify(parsed).slice(0, 500)}`,
    );
  }
  const output = validation.data;

  return {
    output,
    costUsd: result.costUsd,
    latencyMs: result.latencyMs,
    modelUsed: result.modelUsed,
  };
}

// Re-export for consumer convenience
export type { IssueSeverity, IssueSource, IssueType };
