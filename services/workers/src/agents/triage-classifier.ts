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
import { getPrompt } from '@docket/prompts';

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
// System prompt sourced from @docket/prompts (registry id
// 'triage-classifier'). Edit there, not here. Hash drift detection
// fires at first getPrompt() call if the template was edited
// without a version bump.
// ────────────────────────────────────────────────────────────────

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
  const prompt = await getPrompt('triage-classifier');

  const result = await runDocketAgent({
    tenantId: opts.context.tenantId,
    agentId: 'triage-classifier' as AgentId,
    systemPrompt: prompt.template,
    userPrompt,
    modelTier: opts.modelTier ?? prompt.model,
    cachedSystem: true,
    maxTokens: 1024,
    onAction: opts.onAction,
    promptId: prompt.id,
    promptVersion: prompt.version,
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
