// Inbox Drafter — the agent behind the "Send as Antonio" button.
//
// Input: a classified issue (output of triage-classifier) + client context.
// Output: a channel-aware, language-aware draft message in Antonio's voice.
//
// Model tier: Sonnet 4.6 (drafting needs voice + judgment; classification is Haiku-fine).
// 9 of 11 issue types produce client-facing drafts. ero_pending and meeting_prep
// produce Antonio-INTERNAL drafts (workpaper notes / call briefs), not client messages.

import { z } from 'zod';
import type { AgentId, ClientId, IssueType, TenantId } from '@docket/shared';
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
  signature: z.string(),                                    // signoff line: 'Antonio' / 'Antonio Vazquez, EA'
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

  return {
    output: validation.data,
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
