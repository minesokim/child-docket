// Nudge Agent — proactive outreach surfacing.
//
// SKIP-TRUST-GATE: drafts preparer-to-client outreach (life-event reminders, quarterly-estimate prompts, drift alerts) for preparer approve/edit/dismiss — does not emit tax positions or recommend filing actions. Every nudge requires explicit preparer approval before any outbound send (the critical-authorization boundary at send-time), so the L1-L4 trust ladder for position decisions doesn't apply at this layer. If a future iteration of this agent ever surfaces a position recommendation alongside the outreach draft, that branch needs its own assertTrustGate call.
//
// Per CLAUDE.md §8 Nudges section + §9 Nudges Agent. Daily cron
// walks enabled nudge_rules (migration 0033) + client_facts +
// engagement state + calendar_events. Produces nudges rows for
// preparer approve/edit/dismiss.
//
// Locked 2026-05-13 after Slant.app research. Their daily nudge
// feed is the structural reference; we apply to tax with the
// 6-class trigger taxonomy.
//
// V0 STATUS (this file): Agent spec + input/output types +
// rule-evaluation contract. The actual Haiku/Sonnet draft
// generation + Inngest cron hookup ship in C21+ when we wire
// to real client_facts + calendar_events triggers.
//
// Model tier: Sonnet 4.6 — draft generation needs Antonio-voice +
// position-aware reasoning. Haiku is too thin for outreach drafts
// that have to land emotionally + technically correct.

import { z } from 'zod';
import type { TenantId, ClientId, ReasoningStep } from '@docket/shared';

// ────────────────────────────────────────────────────────────────
// Input — what triggers a nudge evaluation.
// ────────────────────────────────────────────────────────────────

export type NudgeTriggerClass =
  | 'life_event'
  | 'time_window'
  | 'drift'
  | 'milestone'
  | 'drift_from_prior'
  | 'compliance_risk';

export type NudgeRecommendedChannel = 'sms' | 'email' | 'portal_chat' | 'phone_call';

export type NudgeTriggerEvent = {
  triggerClass: NudgeTriggerClass;
  triggerKey: string;
  /**
   * Free-form context describing the trigger. The Nudge agent
   * uses this to compose the title + body + draft outreach.
   * Examples:
   *   - { client_fact_id: 'abc', current_year_w2: 220000, prior_year_w2: 158000 }
   *   - { engagement_id: 'def', sos_status: 'Suspended', days_to_resolve: 23 }
   *   - { calendar_event_id: 'ghi', meeting_in_hours: 24 }
   */
  context: Record<string, unknown>;
};

export interface NudgeContext {
  tenantId: TenantId;
  clientId: ClientId;
  clientDisplayName: string;
  /** Brief facts pulled from client_facts for prompt context. */
  clientFactsSummary?: string;
  /** Optional list of recent memories for the agent to reference. */
  recentMemories?: string[];
  /** Firm voice profile from firm_profile (procedural memory). */
  firmVoiceProfile?: string;
}

// ────────────────────────────────────────────────────────────────
// Output — what the agent emits per nudge.
// ────────────────────────────────────────────────────────────────

export const NudgeDraftSchema = z.object({
  /**
   * Canonical alert format per CLAUDE.md §8:
   * "{ClientName}'s {situation} · {quantified impact}". Pre-composed
   * by the agent; ≤500 chars enforced at DB layer.
   */
  title: z.string().min(5).max(500),
  /** Long-form rationale + which facts triggered + suggested approach. */
  body: z.string().min(20),
  /** Pre-drafted outreach text. NULL means agent declined to draft. */
  draftOutreach: z.string().max(5000).nullable().optional(),
  /** Recommended channel (caller decides whether to override). */
  recommendedChannel: z
    .enum(['sms', 'email', 'portal_chat', 'phone_call'])
    .nullable()
    .optional(),
  /** 0..1 confidence the nudge is worth surfacing. */
  confidence: z.number().min(0).max(1),
  /**
   * Days from now until this nudge auto-expires if not approved.
   * Compliance-risk nudges get shorter expiry (urgency).
   */
  expiresInDays: z.number().int().min(1).max(365),
  /**
   * Reasoning trail per CLAUDE.md §9 Agent contract.
   * Curated steps showing fact_query / authority_lookup / decision /
   * consideration / discard reasoning.
   */
  reasoningTrail: z.array(
    z.object({
      kind: z.enum([
        'fact_query',
        'authority_lookup',
        'decision',
        'consideration',
        'discard',
      ]),
      label: z.string().min(1).max(80),
      detail: z.string().max(500).optional(),
    }),
  ),
});

export const NudgeAgentOutputSchema = z.object({
  /** When the agent decides this trigger is worth surfacing, emit a draft. */
  draft: NudgeDraftSchema.nullable(),
  /** When the agent decides NOT to surface, the reason for audit. */
  skipReason: z.string().nullable().optional(),
});

export type NudgeDraft = z.infer<typeof NudgeDraftSchema>;
export type NudgeAgentOutput = z.infer<typeof NudgeAgentOutputSchema>;

// ────────────────────────────────────────────────────────────────
// Helpers — used by both the live agent (C21+) and consumers
// inspecting agent outputs.
// ────────────────────────────────────────────────────────────────

/**
 * Default expiry per trigger class. Compliance-risk gets 7 days
 * (urgency); life events get 30 days; time windows get the natural
 * window distance.
 */
export function defaultExpiryDays(triggerClass: NudgeTriggerClass): number {
  switch (triggerClass) {
    case 'compliance_risk':
      return 7;
    case 'milestone':
      return 14;
    case 'drift':
    case 'drift_from_prior':
      return 14;
    case 'time_window':
      return 30;
    case 'life_event':
      return 30;
  }
}

/**
 * Format a numeric impact value (dollars, percentage, count) into
 * the canonical alert string suffix. Used by the agent to compose
 * the title's quantified-impact half.
 *
 * Examples:
 *   formatImpact({ kind: 'dollars', value: 14000 })   // "est. $14K"
 *   formatImpact({ kind: 'percent', value: 40 })       // "+40%"
 *   formatImpact({ kind: 'days', value: 23 })          // "23 days"
 */
export function formatImpact(impact: {
  kind: 'dollars' | 'percent' | 'days' | 'count';
  value: number;
  certainty?: 'estimate' | 'precise';
}): string {
  const prefix = impact.certainty === 'estimate' ? 'est. ' : '';
  switch (impact.kind) {
    case 'dollars': {
      const formatted =
        impact.value >= 1000
          ? `$${(impact.value / 1000).toFixed(impact.value >= 10000 ? 0 : 1)}K`
          : `$${impact.value.toLocaleString()}`;
      return `${prefix}${formatted}`;
    }
    case 'percent':
      return `${prefix}${impact.value >= 0 ? '+' : ''}${impact.value}%`;
    case 'days':
      return `${prefix}${impact.value} day${impact.value === 1 ? '' : 's'}`;
    case 'count':
      return `${prefix}${impact.value}`;
  }
}

/**
 * Compose the canonical alert title.
 *
 *   "{ClientName}'s {situation} · {quantified impact}"
 *
 * Used by the agent at output time + by callers verifying that
 * stored titles conform to the canonical format.
 */
export function composeNudgeTitle(
  clientDisplayName: string,
  situation: string,
  impact: string,
): string {
  return `${clientDisplayName}'s ${situation} · ${impact}`;
}

// ────────────────────────────────────────────────────────────────
// Agent placeholder.
//
// The actual draft call lives here once we wire it (C21+). Shape
// mirrors discovery-agent + memory-curator:
//   - Pull prompt from @docket/prompts registry
//   - Call runDocketAgent with Sonnet 4.6 + cached system prompt
//   - Parse JSON output through NudgeAgentOutputSchema
//   - Honor rule confidence_floor (caller responsibility)
//   - Return draft for caller to persist to nudges table
// ────────────────────────────────────────────────────────────────

export interface DraftNudgeArgs {
  trigger: NudgeTriggerEvent;
  context: NudgeContext;
}

export interface DraftNudgeResult {
  ok: boolean;
  draft: NudgeDraft | null;
  skipReason?: string;
  costUsd?: number;
  latencyMs?: number;
}

/**
 * Draft a single nudge for a single (client, trigger) pair.
 *
 * V0 STUB: returns ok + null draft + reason='not-yet-implemented'.
 * Wire actual drafting in C21+ once Inngest function + prompt
 * template land.
 */
export async function draftNudge(
  args: DraftNudgeArgs,
): Promise<DraftNudgeResult> {
  const { trigger, context } = args;
  // Stub: confirm types are wired correctly, return null draft.
  void trigger;
  void context;

  return {
    ok: true,
    draft: null,
    skipReason:
      'nudge-agent-stub: draft generation not yet implemented; see C21+ for live wiring',
    costUsd: 0,
    latencyMs: 0,
  };
}

// Re-export ReasoningStep type so consumers can import once.
export type { ReasoningStep };
