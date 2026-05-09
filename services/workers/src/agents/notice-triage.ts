// Notice Triage agent — classifies an IRS / state notice + extracts
// the structured fields a preparer needs to act.
//
// Per CLAUDE.md section 13 white-space bet #4 (EA representation
// rights as a second pillar) + section 9 agent fleet.
//
// SCOPE
//   v0 takes pre-OCR'd text. The OCR pipeline (Haiku vision via the
//   doc-classifier) is what produces the text from a notice photo or
//   PDF upload. v1 chains: doc-classifier (kind=irs_notice) ->
//   notice-triage (this agent) -> notice-drafter (response template).
//
// MODEL
//   Sonnet 4.6. Notice text is dense + legal; Haiku misclassifies the
//   long tail of weird formats. Sonnet + caching gets per-call cost
//   to ~$0.01-0.02.
//
// AUDIT
//   draftReply pattern: this agent owns its audit-row write via
//   persistAgentAction so the structured triage output (notice_type,
//   severity, deadline, etc.) lands in tool_input/tool_output.
//   action_class='classify'.

import { z } from 'zod';
import type { AgentId, ClientId, TenantId } from '@docket/shared';
import { runDocketAgent } from '@docket/orchestrator';
import { getPrompt } from '@docket/prompts';
import { persistAgentAction } from '@docket/db';

export type NoticeIssuingAuthority =
  | 'irs'
  | 'ca-ftb'
  | 'cdtfa'
  | 'edd'
  | 'other-state'
  | 'unknown';

export type NoticeSeverity = 'low' | 'medium' | 'high';

export type NoticeResponseTemplate =
  | 'cp2000-agree-with-changes'
  | 'cp2000-disagree-with-explanation'
  | 'cp14-pay-immediately'
  | 'cp504-form-9465-installment'
  | 'lt11-form-12153-cdp-hearing'
  | 'cp3219a-petition-tax-court'
  | 'identity-theft-form-14039'
  | 'state-residency-defense'
  | 'manual-review-required';

export const NoticeTriageSchema = z.object({
  notice_type: z.string().min(1),
  issuing_authority: z.enum([
    'irs',
    'ca-ftb',
    'cdtfa',
    'edd',
    'other-state',
    'unknown',
  ]),
  irs_form_referenced: z.array(z.string()).default([]),
  tax_period: z.string().nullable(),
  amount_at_issue: z.number().nullable(),
  /** ISO YYYY-MM-DD. */
  response_deadline: z.string().nullable(),
  severity: z.enum(['low', 'medium', 'high']),
  recommended_response_template: z.enum([
    'cp2000-agree-with-changes',
    'cp2000-disagree-with-explanation',
    'cp14-pay-immediately',
    'cp504-form-9465-installment',
    'lt11-form-12153-cdp-hearing',
    'cp3219a-petition-tax-court',
    'identity-theft-form-14039',
    'state-residency-defense',
    'manual-review-required',
  ]),
  citations: z.array(z.string()).default([]),
  summary: z.string().min(5),
  why_this_matters: z.string().min(10),
  recommended_action: z.string().min(5),
  gaps_to_confirm: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(5),
});

export type NoticeTriageOutput = z.infer<typeof NoticeTriageSchema>;

export type TriageNoticeInput = {
  tenantId: TenantId;
  clientId: ClientId;
  /** OCR'd text of the notice. The doc-classifier's parse_phase=
   *  'classified' rows have this in ai_extracted.fullText (when set). */
  noticeText: string;
  /** Optional document id linking the audit row back to the source. */
  documentId?: string;
  /** Skip the audit-row write (for evals + tests). Defaults to true. */
  persistAudit?: boolean;
};

export async function triageNotice(opts: TriageNoticeInput): Promise<{
  output: NoticeTriageOutput;
  triageActionId: string | null;
  costUsd: number;
  latencyMs: number;
  modelUsed: 'haiku-4-5' | 'sonnet-4-6' | 'opus-4-7';
}> {
  if (!opts.noticeText || opts.noticeText.trim().length < 50) {
    throw new Error('notice-triage: noticeText must be >=50 chars (OCR not run yet?)');
  }

  const prompt = await getPrompt('notice-triage');
  const userPrompt = JSON.stringify({ noticeText: opts.noticeText });

  const result = await runDocketAgent({
    tenantId: opts.tenantId,
    agentId: 'notice-classifier' as AgentId,
    systemPrompt: prompt.template,
    userPrompt,
    modelTier: 'sonnet-4-6',
    cachedSystem: true,
    maxTokens: 2000,
    promptId: prompt.id,
    promptVersion: prompt.version,
  });

  // Extract first JSON object from response.
  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(
      `notice-triage: model returned no JSON. Raw: ${result.text.slice(0, 500)}`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error(
      `notice-triage: JSON.parse failed. Raw: ${result.text.slice(0, 500)}`,
    );
  }
  const validation = NoticeTriageSchema.safeParse(parsed);
  if (!validation.success) {
    throw new Error(
      `notice-triage: schema validation failed. Errors: ${JSON.stringify(validation.error.issues)}. Parsed: ${JSON.stringify(parsed).slice(0, 500)}`,
    );
  }

  // Hard-rule enforcement (defensive — the prompt instructs these but
  // model output occasionally drifts):
  if (validation.data.notice_type === 'CP3219A') {
    if (validation.data.severity !== 'high') {
      validation.data.severity = 'high';
    }
    if (validation.data.recommended_response_template !== 'cp3219a-petition-tax-court') {
      validation.data.recommended_response_template = 'cp3219a-petition-tax-court';
    }
  }
  const LEVY_NOTICES = new Set(['CP504', 'LT11', 'LT1058', 'CP90', 'CP297', 'FTB 4921']);
  if (LEVY_NOTICES.has(validation.data.notice_type) && validation.data.severity !== 'high') {
    validation.data.severity = 'high';
  }

  let triageActionId: string | null = null;
  if (opts.persistAudit !== false) {
    const persist = persistAgentAction({
      textPreviewLength: 280,
      extraToolInput: {
        promptId: prompt.id,
        promptVersion: prompt.version,
        noticeType: validation.data.notice_type,
        severity: validation.data.severity,
        responseTemplate: validation.data.recommended_response_template,
      },
      onPersisted: async (id) => {
        triageActionId = id;
      },
    });
    try {
      await persist({
        tenantId: opts.tenantId,
        clientId: opts.clientId,
        userId: null,
        agentId: 'notice-classifier' as AgentId,
        actionClass: 'classify',
        toolName:
          result.provider === 'anthropic'
            ? 'notice-triage.via.anthropic'
            : 'notice-triage.via.bedrock',
        toolInput: {
          documentId: opts.documentId,
          noticeTextLength: opts.noticeText.length,
        },
        toolOutput: {
          notice_type: validation.data.notice_type,
          issuing_authority: validation.data.issuing_authority,
          severity: validation.data.severity,
          response_deadline: validation.data.response_deadline,
          amount_at_issue: validation.data.amount_at_issue,
          recommended_response_template: validation.data.recommended_response_template,
          summary: validation.data.summary,
          confidence: validation.data.confidence,
        },
        modelUsed: result.modelUsed,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        cachedTokens: result.cachedTokens,
        costUsd: result.costUsd,
        latencyMs: result.latencyMs,
        success: true,
        errorMessage: null,
      });
    } catch (err) {
      console.error('[notice-triage] audit-row persist failed:', err);
    }
  }

  return {
    output: validation.data,
    triageActionId,
    costUsd: result.costUsd,
    latencyMs: result.latencyMs,
    modelUsed: result.modelUsed,
  };
}
