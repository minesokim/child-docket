// Inbox Drafter — the agent behind the "Send as Antonio" button.
//
// Input: a classified issue (output of triage-classifier) + client context.
// Output: a channel-aware, language-aware draft message in Antonio's voice.
//
// Model tier: Sonnet 4.6 (drafting needs voice + judgment; classification is Haiku-fine).
// 9 of 11 issue types produce client-facing drafts. ero_pending and meeting_prep
// produce Antonio-INTERNAL drafts (workpaper notes / call briefs), not client messages.

import { z } from 'zod';
import type { AgentId, ClientId, IssueType, TenantId, TrustLevel } from '@docket/shared';
import { assertTrustGate } from '@docket/shared';
import { runDocketAgent } from '@docket/orchestrator';
import { getPrompt } from '@docket/prompts';
import type { ClassifierOutput } from './triage-classifier.js';

// ────────────────────────────────────────────────────────────────
// Input — what the drafter needs to write a good draft.
// ────────────────────────────────────────────────────────────────
export type DrafterContext = {
  tenantId: TenantId;
  clientId: ClientId;
  clientFullName: string;
  clientFirstName: string;
  preferredLanguage: 'en' | 'es' | 'zh' | 'vi' | 'tl';   // v0: en/es honored; others fallback to en
  channel: 'email' | 'sms' | 'portal_chat';
  preparerFullName: string;                              // 'Antonio Vazquez'
  preparerSignOff: string;                                // 'Antonio' (casual) or 'Antonio Vazquez, EA' (formal)
  firmName: string;                                       // 'Vazant Consulting'
  // Firm's currently-configured trust level (per tenants.defaultTrustLevel).
  // Drives the trust-gate verdict computed post-draft. Default L1 if the
  // caller doesn't pass one — L1 is the conservative posture (every
  // external send requires Antonio's approval). See CLAUDE.md §8 +
  // POSITION-FRAMEWORK.md §6 + packages/shared/src/trust-gate.ts.
  trustLevel?: TrustLevel;
  // Optional history for voice consistency (will be sparse in v0)
  recentOutboundDrafts?: Array<{ channel: string; body: string }>;
  // The original inbound signal that triggered the issue, if any
  originalMessage?: { channel: string; body: string; receivedAt: string };
};

export type DrafterInput = {
  issue: ClassifierOutput;
  context: DrafterContext;
};

// ────────────────────────────────────────────────────────────────
// Output schema — the draft itself.
// ────────────────────────────────────────────────────────────────
export const DraftOutputSchema = z.object({
  isClientFacing: z.boolean(),                             // false for ero_pending / meeting_prep / internal-only
  channel: z.enum(['email', 'sms', 'portal_chat']),
  language: z.enum(['en', 'es']),
  subject: z.string().nullable(),                          // null for sms / portal_chat
  body: z.string().min(5),
  // The prompt's own rules say: SMS has NO sign-off ("just message")
  // and internal-only issues (ero_pending / meeting_prep with
  // isClientFacing=false) skip the signature entirely. Both surfaced as
  // model outputs of null. Schema must allow null on both paths.
  signature: z.string().nullable(),                         // signoff: 'Antonio' / 'Antonio Vazquez, EA' / null (sms or internal)
  suggestedAttachments: z
    .array(
      z.object({
        kind: z.enum(['portal_link', 'document', 'calendar_invite', 'payment_link', 'form_link']),
        ref: z.string(),
        label: z.string(),
      }),
    )
    .default([]),
  followUpDate: z.string().nullable(),                     // ISO 8601 date for auto-follow-up reminder
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),                                    // why this tone/wording for this issue+client
});

export type DraftOutput = z.infer<typeof DraftOutputSchema>;

// ────────────────────────────────────────────────────────────────
// Trust-gate verdict — attached to draftReply()'s return shape so the
// command-room inbox UI can label the draft "auto-send eligible" vs
// "requires Antonio's approval" vs "refused — below floor."
//
// NOT part of DraftOutputSchema (the model doesn't emit it; we compute
// it deterministically post-draft from the firm's trust level + issue's
// action class).
// ────────────────────────────────────────────────────────────────
export type DraftTrustGate =
  | { allowed: true; actionClass: 'send-external' | 'send-internal' }
  | {
      allowed: false;
      actionClass: 'send-external' | 'send-internal';
      requires: 'human-approval' | 'refusal';
      reason: string;
    };

// ────────────────────────────────────────────────────────────────
// System prompt sourced from @docket/prompts (registry id
// 'inbox-drafter'). Edit there, not here.
// ────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────
// Drafter function — the public API.
// ────────────────────────────────────────────────────────────────
export type DraftOptions = {
  input: DrafterInput;
  modelTier?: 'haiku-4-5' | 'sonnet-4-6';
  onAction?: Parameters<typeof runDocketAgent>[0]['onAction'];
};

export async function draftReply(opts: DraftOptions): Promise<{
  output: DraftOutput;
  trustGate: DraftTrustGate;
  costUsd: number;
  latencyMs: number;
  modelUsed: 'haiku-4-5' | 'sonnet-4-6' | 'opus-4-7';
}> {
  const userPrompt = JSON.stringify(opts.input);
  const prompt = await getPrompt('inbox-drafter');

  const result = await runDocketAgent({
    tenantId: opts.input.context.tenantId,
    agentId: 'inbox-drafter' as AgentId,
    systemPrompt: prompt.template,
    userPrompt,
    modelTier: opts.modelTier ?? 'sonnet-4-6',
    cachedSystem: true,
    maxTokens: 1500,
    onAction: opts.onAction,
    promptId: prompt.id,
    promptVersion: prompt.version,
  });

  // Extract first JSON object from response
  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(
      `inbox-drafter: model returned no JSON. Raw text: ${result.text.slice(0, 500)}`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    throw new Error(
      `inbox-drafter: JSON.parse failed. Raw text: ${result.text.slice(0, 500)}`,
    );
  }
  const validation = DraftOutputSchema.safeParse(parsed);
  if (!validation.success) {
    throw new Error(
      `inbox-drafter: schema validation failed. Errors: ${JSON.stringify(validation.error.issues)}. Parsed: ${JSON.stringify(parsed).slice(0, 500)}`,
    );
  }

  // Compute the trust-gate verdict post-draft. The action class is
  // 'send-external' for client-facing drafts (email/sms/portal_chat to
  // taxpayer) and 'send-internal' for ero_pending / meeting_prep (the
  // drafter's internal Antonio-only notes). The verdict lets the
  // command-room inbox UI label the draft accordingly:
  //
  //   allowed=true  → "auto-send eligible" (only at L4 firms today)
  //   requires=human-approval → "requires Antonio's approval" (L1-L3
  //                              default, every external send)
  //   requires=refusal        → "refused — below framework floor"
  //                             (never, for v1 drafts; refusal is
  //                              for tier-bound positions which the
  //                              drafter does not emit yet)
  //
  // The verdict is also written to actions.tool_input via the orchestrator
  // onAction hook downstream, so the audit trail captures it. When the
  // command-room inbox UI lands, it reads this verdict to badge each draft.
  const actionClass: 'send-external' | 'send-internal' = validation.data.isClientFacing
    ? 'send-external'
    : 'send-internal';
  const trustLevel = opts.input.context.trustLevel ?? 1;
  const decision = assertTrustGate({ trustLevel, actionClass });
  const trustGate: DraftTrustGate = decision.allowed
    ? { allowed: true, actionClass }
    : {
        allowed: false,
        actionClass,
        requires: decision.requires,
        reason: decision.reason,
      };

  return {
    output: validation.data,
    trustGate,
    costUsd: result.costUsd,
    latencyMs: result.latencyMs,
    modelUsed: result.modelUsed,
  };
}

// Helper: which issue types produce client-facing drafts (vs. internal notes)
export function isClientFacingIssue(type: IssueType): boolean {
  switch (type) {
    case 'ero_pending':
    case 'meeting_prep':
      return false;
    default:
      return true;
  }
}
