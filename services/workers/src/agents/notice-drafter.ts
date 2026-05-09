// Notice Drafter agent — given a triaged notice + client context,
// draft the response letter + identify forms / attachments needed.
//
// Per CLAUDE.md section 9 + section 13 white-space bet 4. Counterpart
// to notice-triage; chains: triage classifies + extracts -> drafter
// composes the response in the preparer's voice.
//
// SCOPE
//   v0 takes the triage output + a thin client context blob (legal
//   name, tax year, prior return summary if available). v1 chains
//   into the knowledge layer (authorities table) for citation
//   grounding once that ingest lands.
//
// MODEL
//   Sonnet 4.6 + cachedSystem (the 4k system prompt benefits hugely
//   from caching).

import { z } from 'zod';
import type { AgentId, ClientId, TenantId } from '@docket/shared';
import { runDocketAgent } from '@docket/orchestrator';
import { getPrompt } from '@docket/prompts';
import { persistAgentAction } from '@docket/db';
import type { NoticeTriageOutput } from './notice-triage.js';

export const NoticeDraftSchema = z.object({
  template: z.enum([
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
  letter_subject: z.string().nullable(),
  letter_body: z.string(),
  forms_to_include: z.array(z.string()).default([]),
  citations: z.array(z.string()).default([]),
  attachments_needed: z.array(z.string()).default([]),
  deadline_note: z.string().nullable(),
  mailing_instructions: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(5),
  needs_preparer_decision: z.array(z.string()).default([]),
});

export type NoticeDraftOutput = z.infer<typeof NoticeDraftSchema>;

export type DraftNoticeResponseInput = {
  tenantId: TenantId;
  clientId: ClientId;
  /** Triage output from notice-triage. Required — drafter does not
   *  re-classify. */
  triage: NoticeTriageOutput;
  /** Thin client context. v1 expands. */
  context: {
    clientFullName: string;
    preparerFullName: string;
    preparerSignOff: string;
    firmName: string;
    taxYear: number;
    /** Optional prior-year return summary (1-2 sentences). */
    priorReturnSummary?: string;
    /** Optional notice-text excerpt the triage saw. Lets the drafter
     *  cite specific phrases the IRS used. */
    noticeTextExcerpt?: string;
  };
  /** Skip the audit-row write. Default true. */
  persistAudit?: boolean;
};

export async function draftNoticeResponse(
  opts: DraftNoticeResponseInput,
): Promise<{
  output: NoticeDraftOutput;
  draftActionId: string | null;
  costUsd: number;
  latencyMs: number;
  modelUsed: 'haiku-4-5' | 'sonnet-4-6' | 'opus-4-7';
}> {
  const prompt = await getPrompt('notice-drafter');
  const userPrompt = JSON.stringify({
    triage: opts.triage,
    context: opts.context,
  });

  const result = await runDocketAgent({
    tenantId: opts.tenantId,
    agentId: 'notice-drafter' as AgentId,
    systemPrompt: prompt.template,
    userPrompt,
    modelTier: 'sonnet-4-6',
    cachedSystem: true,
    maxTokens: 3000,
    promptId: prompt.id,
    promptVersion: prompt.version,
  });

  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(
      `notice-drafter: model returned no JSON. Raw: ${result.text.slice(0, 500)}`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error(
      `notice-drafter: JSON.parse failed. Raw: ${result.text.slice(0, 500)}`,
    );
  }
  const validation = NoticeDraftSchema.safeParse(parsed);
  if (!validation.success) {
    throw new Error(
      `notice-drafter: schema validation failed. Errors: ${JSON.stringify(validation.error.issues)}. Parsed: ${JSON.stringify(parsed).slice(0, 500)}`,
    );
  }

  // Defensive consistency: drafter MUST honor the triage's chosen
  // template. If the model picked a different one, override (this
  // catches the rare drift where Sonnet ignores the input field).
  if (validation.data.template !== opts.triage.recommended_response_template) {
    validation.data.template = opts.triage.recommended_response_template;
  }

  let draftActionId: string | null = null;
  if (opts.persistAudit !== false) {
    const persist = persistAgentAction({
      textPreviewLength: 280,
      extraToolInput: {
        promptId: prompt.id,
        promptVersion: prompt.version,
        template: validation.data.template,
        triageNoticeType: opts.triage.notice_type,
      },
      onPersisted: async (id) => {
        draftActionId = id;
      },
    });
    try {
      await persist({
        tenantId: opts.tenantId,
        clientId: opts.clientId,
        userId: null,
        agentId: 'notice-drafter' as AgentId,
        actionClass: 'draft',
        toolName:
          result.provider === 'anthropic'
            ? 'notice-drafter.via.anthropic'
            : 'notice-drafter.via.bedrock',
        toolInput: {
          taxYear: opts.context.taxYear,
          triageNoticeType: opts.triage.notice_type,
          triageSeverity: opts.triage.severity,
        },
        toolOutput: {
          template: validation.data.template,
          letter_subject: validation.data.letter_subject,
          letter_body: validation.data.letter_body,
          forms_to_include: validation.data.forms_to_include,
          attachments_needed: validation.data.attachments_needed,
          confidence: validation.data.confidence,
          reasoning: validation.data.reasoning,
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
      console.error('[notice-drafter] audit-row persist failed:', err);
    }
  }

  return {
    output: validation.data,
    draftActionId,
    costUsd: result.costUsd,
    latencyMs: result.latencyMs,
    modelUsed: result.modelUsed,
  };
}
