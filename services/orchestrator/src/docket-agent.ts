// Thin Docket layer over Claude inference (Anthropic primary + Bedrock
// fallback per PRODUCTION-READINESS §A vendor-resilience posture).
//
// v0: single agent run, audit-trail hook stub, model tiering, cost
// telemetry, automatic failover. Adds: trust-escalation gate, MCP tool
// routing, sub-agents (later).

import type {
  ActionClass,
  ActionLogEntry,
  AgentId,
  TenantId,
  TrustLevel,
} from '@docket/shared';
import {
  assertTrustGate,
  type PositionTier,
  type TrustGateDecision,
} from '@docket/shared';
import {
  callClaudeWithFallover,
  type CallClaudeResult,
  type ModelTier,
  type Provider,
} from './providers.js';

// Per-million-token pricing (USD).
//
// Anthropic Messages API reports three buckets of input tokens, each
// charged at a different rate (Anthropic billing docs, verified 2026-05):
//   - input_tokens          → base rate                  (uncached)
//   - cache_creation_input  → 1.25× base rate            (5-min TTL write)
//   - cache_read_input      → 0.1× base rate             (90% discount)
// Output is billed flat at the output rate.
//
// `cacheWrite` is the dollar rate for cache-creation tokens; `cached`
// is the dollar rate for cache-read tokens. Both buckets must be
// billed separately — counting cache_creation under `cached` under-
// reports spend by ~12× (cached is 0.1× base, write is 1.25× base —
// 12.5× ratio).
//
// EDGE CASE 14 (Bedrock retail cost ~+5-10%): for v0 we use the
// Anthropic-direct prices for both providers. The 5-10% Bedrock
// premium is small enough that surfacing it as separate columns
// adds noise more than signal. When monthly Bedrock spend crosses
// $500/mo (PRODUCTION-READINESS §B cost dashboard threshold), we
// split the columns and re-run cost analytics.
const PRICING = {
  'haiku-4-5':  { input: 0.80,  output: 4.00,  cached: 0.08, cacheWrite: 1.00 },
  'sonnet-4-6': { input: 3.00,  output: 15.00, cached: 0.30, cacheWrite: 3.75 },
  'opus-4-7':   { input: 15.00, output: 75.00, cached: 1.50, cacheWrite: 18.75 },
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
  /**
   * OPTIONAL central trust-gate enforcement.
   *
   * If the agent's NEXT step after this LLM call is a side-effecting
   * action with a KNOWN-UP-FRONT action class (e.g., a classifier
   * that's deciding whether to send-external a confirmation, or an
   * outreach flow with a fixed action shape), pass downstreamAction
   * here. runDocketAgent will call assertTrustGate(...) and surface
   * the result on DocketAgentResult.gateDecision. The CALLER must
   * still branch on gateDecision before executing the side effect —
   * this option doesn't STOP the side effect, it just hands the
   * caller a decision computed by the central gate.
   *
   * When omitted (the legacy + most-common case), runDocketAgent
   * does NOT call assertTrustGate and gateDecision is undefined.
   * Agents whose action class depends on the LLM output (e.g.,
   * discovery-agent inferring highest position tier, inbox-drafter
   * inferring send-external vs send-internal from the issue type)
   * keep calling assertTrustGate themselves AFTER the LLM returns.
   *
   * Either pattern satisfies check-trust-gate-coverage.ts. The CI
   * lint guard checks for "assertTrustGate(" in the agent file —
   * a downstreamAction-based call site still matches via the
   * import + usage somewhere in the agent's wrapper.
   *
   * Per CLAUDE.md §8 trust escalation + POSITION-FRAMEWORK §6 +
   * the Session 7 trust-gate central-enforcement audit.
   */
  downstreamAction?: {
    actionClass: ActionClass;
    /** Required when actionClass is position-bearing (send-external
     *  for a tax-position output). Omit for non-position generic
     *  comms. */
    positionTier?: PositionTier;
    /** Firm's currently-configured trust level
     *  (tenants.defaultTrustLevel). */
    trustLevel: TrustLevel;
  };
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
  /**
   * Populated iff the caller passed `downstreamAction` on the
   * options. Contains the central trust-gate decision the caller
   * must branch on before executing the downstream side effect.
   * Undefined when downstreamAction was omitted.
   */
  gateDecision?: TrustGateDecision;
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

  // Anthropic reports three input buckets (uncached / cache-write /
  // cache-read), each at a different rate. `cachedTokens` returned to
  // the caller is the SUM of read + write — it's the "how much cache
  // activity happened this call" signal for cost dashboards. The cost
  // formula bills each bucket at its proper rate.
  const cachedTokens = result.cachedInputTokens + result.cacheCreationInputTokens;

  const pricing = PRICING[tier];
  const costUsd =
    (result.inputTokens * pricing.input) / 1_000_000 +
    (result.cacheCreationInputTokens * pricing.cacheWrite) / 1_000_000 +
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

  // Central trust-gate enforcement, OPT-IN per call site. When the
  // caller supplied `downstreamAction`, evaluate the gate and surface
  // the decision on the result. Caller is responsible for branching
  // on `gateDecision.allowed` before executing the side effect — this
  // helper does NOT stop the side effect, it provides the decision.
  // Session 7 trust-gate audit (2026-05-15).
  let gateDecision: TrustGateDecision | undefined;
  if (opts.downstreamAction) {
    gateDecision = assertTrustGate({
      trustLevel: opts.downstreamAction.trustLevel,
      actionClass: opts.downstreamAction.actionClass,
      positionTier: opts.downstreamAction.positionTier,
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
    ...(gateDecision ? { gateDecision } : {}),
  };
}
