// Thin Docket layer over Claude inference (Anthropic primary + Bedrock
// fallback per PRODUCTION-READINESS §A vendor-resilience posture).
//
// v0: single agent run, audit-trail hook stub, model tiering, cost
// telemetry, automatic failover. Adds: trust-escalation gate, MCP tool
// routing, sub-agents (later).

import type { ActionLogEntry, AgentId, TenantId } from '@docket/shared';
import {
  callClaudeWithFallover,
  type CallClaudeResult,
  type ModelTier,
  type Provider,
} from './providers.js';

// Per-million-token pricing (USD). Cached column is the prompt-cache
// hit price (90% discount on Anthropic; Bedrock pricing parity).
//
// EDGE CASE 14 (Bedrock retail cost ~+5-10%): for v0 we use the
// Anthropic-direct prices for both providers. The 5-10% Bedrock
// premium is small enough that surfacing it as separate columns
// adds noise more than signal. When monthly Bedrock spend crosses
// $500/mo (PRODUCTION-READINESS §B cost dashboard threshold), we
// split the columns and re-run cost analytics.
const PRICING = {
  'haiku-4-5':  { input: 0.80,  output: 4.00,  cached: 0.08 },
  'sonnet-4-6': { input: 3.00,  output: 15.00, cached: 0.30 },
  'opus-4-7':   { input: 15.00, output: 75.00, cached: 1.50 },
} as const;

export type DocketAgentOptions = {
  tenantId: TenantId;
  agentId: AgentId;
  systemPrompt: string;
  userPrompt: string;
  modelTier?: ModelTier;
  maxTokens?: number;
  cachedSystem?: boolean;
  onAction?: (entry: Omit<ActionLogEntry, 'id' | 'createdAt'>) => Promise<void>;
  /**
   * If the systemPrompt was sourced from @docket/prompts, pass the
   * prompt id + version so cost telemetry tags actions.tool_input
   * with which prompt produced this call. Lets the cost dashboard
   * break down spend per prompt version + detect regressions when
   * a new prompt version's per-call cost spikes.
   */
  promptId?: string;
  promptVersion?: string;
};

export type DocketAgentResult = {
  text: string;
  modelUsed: ModelTier;
  /**
   * Which control plane responded. Anthropic is primary; bedrock
   * fires only on transient primary failure (5xx / 429 / timeout /
   * network error). Cost telemetry tags by this so the dashboard can
   * surface per-provider spend + flag if Bedrock fires more than
   * ~1% of calls (signals Anthropic instability).
   */
  provider: Provider;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  costUsd: number;
  latencyMs: number;
};

export async function runDocketAgent(opts: DocketAgentOptions): Promise<DocketAgentResult> {
  const tier: ModelTier = opts.modelTier ?? 'sonnet-4-6';

  // Delegates the provider-selection + failover logic to providers.ts.
  // This file stays focused on cost telemetry + audit-trail wiring.
  const result: CallClaudeResult = await callClaudeWithFallover({
    modelTier: tier,
    systemPrompt: opts.systemPrompt,
    userPrompt: opts.userPrompt,
    maxTokens: opts.maxTokens ?? 1024,
    cachedSystem: opts.cachedSystem,
  });

  const cachedTokens = result.cachedInputTokens + result.cacheCreationInputTokens;

  const pricing = PRICING[tier];
  const costUsd =
    ((result.inputTokens - result.cachedInputTokens) * pricing.input) / 1_000_000 +
    (result.cachedInputTokens * pricing.cached) / 1_000_000 +
    (result.outputTokens * pricing.output) / 1_000_000;

  if (opts.onAction) {
    await opts.onAction({
      tenantId: opts.tenantId,
      clientId: null,
      userId: null,
      agentId: opts.agentId,
      actionClass: 'read',
      toolName:
        result.provider === 'anthropic'
          ? 'anthropic.messages.create'
          : 'bedrock.converse',
      toolInput: {
        modelTier: tier,
        provider: result.provider,
        maxTokens: opts.maxTokens ?? 1024,
        // Prompt-registry tracking. Both fields are optional so legacy
        // call sites (orchestrator-internal calls) don't break; agent
        // call sites that source from @docket/prompts pass them.
        ...(opts.promptId ? { promptId: opts.promptId } : {}),
        ...(opts.promptVersion ? { promptVersion: opts.promptVersion } : {}),
      },
      toolOutput: { textPreview: result.text.slice(0, 200) },
      modelUsed: tier,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      cachedTokens,
      costUsd,
      latencyMs: result.latencyMs,
      success: true,
      errorMessage: null,
    });
  }

  return {
    text: result.text,
    modelUsed: tier,
    provider: result.provider,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    cachedTokens,
    costUsd,
    latencyMs: result.latencyMs,
  };
}
