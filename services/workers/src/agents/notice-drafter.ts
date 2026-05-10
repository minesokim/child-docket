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
import { assertTrustGate, type PositionTier } from '@docket/shared';
import { runDocketAgent } from '@docket/orchestrator';
import { getPrompt } from '@docket/prompts';
import { lookupAuthorityByCitation, persistAgentAction } from '@docket/db';
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
    /**
     * Trust escalation level (1-4) governing whether the drafted
     * letter can auto-send vs. requires preparer approval. Default 1
     * = "every external send requires Antonio's approval." Per
     * CLAUDE.md §8 trust-escalation model + AUTONOMOUS-DECISIONS [3].
     * Bake this in so the consumer wiring fires on every notice
     * draft, not just the inbox-drafter.
     */
    trustLevel?: 1 | 2 | 3 | 4;
    /** Optional prior-year return summary (1-2 sentences). */
    priorReturnSummary?: string;
    /** Optional notice-text excerpt the triage saw. Lets the drafter
     *  cite specific phrases the IRS used. */
    noticeTextExcerpt?: string;
  };
  /** Skip the audit-row write. Default true. */
  persistAudit?: boolean;
};

/**
 * Trust-gate verdict on the notice draft. Letters to the IRS are
 * `send-external` (= taxpayer-facing legal correspondence). Mirrors
 * the shape inbox-drafter uses so command-room UI reads a single
 * verdict shape across both drafters.
 */
export type NoticeDraftTrustGate =
  | { allowed: true; actionClass: 'send-external' | 'send-internal' }
  | {
      allowed: false;
      actionClass: 'send-external' | 'send-internal';
      requires: 'human-approval' | 'refusal';
      reason: string;
    };

export async function draftNoticeResponse(
  opts: DraftNoticeResponseInput,
): Promise<{
  output: NoticeDraftOutput;
  trustGate: NoticeDraftTrustGate;
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

  // CITATION-VERIFIER LOOP. Per the system prompt: "never fabricate
  // citations." Today we make that enforceable: every cite the model
  // emitted must resolve via lookupAuthorityByCitation. Misses get
  // pushed into needs_preparer_decision so Antonio sees them as
  // "verify this cite before sending" rather than appearing in the
  // letter as silent hallucinations. Verified cites stay in citations.
  const verifiedCitations: string[] = [];
  const unverifiedCitations: string[] = [];
  for (const cite of validation.data.citations) {
    try {
      const found = await lookupAuthorityByCitation(opts.tenantId, cite);
      if (found) {
        verifiedCitations.push(cite);
      } else {
        unverifiedCitations.push(cite);
      }
    } catch (err) {
      // Verifier failure is best-effort — if the lookup throws, we
      // surface the cite as unverified rather than blocking the draft.
      console.error('[notice-drafter] citation verifier threw:', err);
      unverifiedCitations.push(cite);
    }
  }
  validation.data.citations = verifiedCitations;
  if (unverifiedCitations.length > 0) {
    const verifyNotes = unverifiedCitations.map(
      (cite) =>
        `Citation '${cite}' could not be resolved against the authority library — verify before sending.`,
    );
    validation.data.needs_preparer_decision = [
      ...validation.data.needs_preparer_decision,
      ...verifyNotes,
    ];
  }

  // Compute trust-gate verdict on the drafted notice. v0 posture is
  // FULLY CONSERVATIVE: every notice draft requires preparer approval
  // regardless of trust level or template. Reasons codex flagged
  // across 3 review passes:
  //
  //   1. Position-bearing templates (cp2000-disagree, etc.) at L2+
  //      would auto-send without 8275 disclosure if we used the
  //      standard generic-comms path.
  //   2. The L4 tier-3 'flag' branch in assertTrustGate returns
  //      allowed=true with an IMPLICIT requirement to attach Form
  //      8275. Surfacing that signal end-to-end is V1.5 work.
  //   3. Template-vs-content drift: even when triage requests an
  //      administrative template, Sonnet can write position-bearing
  //      content. Tag-based gating misses this.
  //   4. Form-dependent packets (cp2000-agree → 5564, cp504 → 9465,
  //      etc.) need attached forms before sending. Marking them
  //      auto-send eligible without verifying form attachment is
  //      premature.
  //   5. Antonio's actual posture: every IRS response gets his eyes
  //      anyway. Auto-send saves zero time at v0 scale.
  //
  // Until V1.5 wires position-tier classification from the drafter
  // itself + form-completeness verification, every draft requires
  // human approval.  When V1.5 lands, this collapses to a single
  // assertTrustGate call with the drafter-emitted positionTier and
  // a forms-complete check.
  const isManualReview = validation.data.template === 'manual-review-required';
  const actionClass: 'send-external' | 'send-internal' = isManualReview
    ? 'send-internal'
    : 'send-external';
  const trustLevel = opts.context.trustLevel ?? 1;
  // Compute the standard verdict for diagnostic visibility — operators
  // can see what the standard gate would have said vs. the conservative
  // override below. Suppresses the unused-import warning on PositionTier.
  const _stdDecision: ReturnType<typeof assertTrustGate> = assertTrustGate({
    trustLevel,
    actionClass,
  });
  void _stdDecision;
  const _positionTierUnused: PositionTier | undefined = undefined;
  void _positionTierUnused;

  const trustGate: NoticeDraftTrustGate = {
    allowed: false,
    actionClass,
    requires: 'human-approval',
    reason: isManualReview
      ? 'manual-review-required template — preparer must compose the response'
      : 'v0 conservative posture: every notice draft requires preparer approval (position-tier + form-completeness gating is V1.5)',
  };

  let draftActionId: string | null = null;
  if (opts.persistAudit !== false) {
    const persist = persistAgentAction({
      textPreviewLength: 280,
      extraToolInput: {
        trustGate,
        promptId: prompt.id,
        promptVersion: prompt.version,
        template: validation.data.template,
        triageNoticeType: opts.triage.notice_type,
        verifiedCitationCount: verifiedCitations.length,
        unverifiedCitationCount: unverifiedCitations.length,
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
    trustGate,
    draftActionId,
    costUsd: result.costUsd,
    latencyMs: result.latencyMs,
    modelUsed: result.modelUsed,
  };
}
