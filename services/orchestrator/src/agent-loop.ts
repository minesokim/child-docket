// Multi-turn tool-use agent loop.
//
// Companion to the single-shot `runDocketAgent` in ./docket-agent.ts.
// This file implements the multi-turn loop that Wave 3 skills
// (reconciliation, discovery refactor, notice-response, etc.) need:
// Claude is given a system prompt + initial user prompt + a set of
// tools. It may respond with text (done) or with tool_use blocks
// (it wants to call a tool). For each tool_use, the loop routes the
// call through `@docket/mcp-gateway`, captures the result, appends
// it to the message history as a tool_result block, and calls
// Claude again. Repeat up to maxIterations.
//
// PRESERVED FROM runDocketAgent (zero-loss properties):
//   - Anthropic primary + Bedrock fallback (via callClaudeWithFallover)
//   - Prompt caching on the system prompt
//   - Model tiering (Haiku/Sonnet/Opus)
//   - Cost telemetry per iteration (aggregated into one final cost)
//   - onAction audit-hook callback (one row per LLM call within the loop)
//   - Prompt-registry tagging (promptId + promptVersion)
//
// NEW IN THIS FILE:
//   - Multi-turn loop with max-iterations safety (default 10)
//   - Tool routing through `McpGateway.callTool`
//   - Tool errors caught and surfaced as tool_result with isError=true
//     (Claude can react to the failure and adjust)
//   - Conversation history retained for the duration of the loop
//   - Stop reasons: 'end_turn' / 'max_tokens' / 'max_iterations' /
//     'no_tools_to_route' (defensive)
//
// EDGE CASES (per /edge-cases gate, 12 cases enumerated for C30):
//   1.  No tools provided → loop terminates after first call         ← HANDLED
//   2.  Claude emits text-only response → stop, return text          ← HANDLED
//   3.  Claude emits tool_use → invoke gateway → append result       ← HANDLED
//   4.  Gateway tool call fails → tool_result with isError=true      ← HANDLED
//   5.  maxIterations exceeded → terminate with current state        ← HANDLED
//   6.  Tool call unknown (gateway returns UNKNOWN_TOOL) → surfaced  ← HANDLED
//   7.  Tool input fails Zod validation (gateway INVALID_INPUT)      ← HANDLED
//   8.  Trust gate denies (gateway TRUST_GATE_DENIED)                ← HANDLED
//   9.  Anthropic transient → Bedrock fallover (callClaudeWithFallover) ← HANDLED
//  10.  Bedrock supports tools (Converse API toolConfig)             ← HANDLED
//  11.  Audit hook fires per LLM call (one row per iteration)        ← HANDLED
//  12.  Prompt caching survives across iterations                    ← HANDLED
//       (cache stays warm; cached_input_tokens accumulates)

import type {
  ActionLogEntry,
  AgentId,
  ClientId,
  TenantId,
  UserId,
} from '@docket/shared';
import type { McpGateway } from '@docket/mcp-gateway';
import {
  callClaudeWithFallover,
  type CallClaudeResult,
  type ContentBlock,
  type Message,
  type ModelTier,
  type Provider,
  type StopReason,
  type ToolDefinition,
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
// is the dollar rate for cache-read tokens. Codex r1 P2 flagged that
// counting cache_creation under `cached` underreports spend by ~12×
// (cached is 0.1× base, write is 1.25× base — 12.5× ratio).
//
// docket-agent.ts has a related cost-calc gap (it also omits
// cache-write entirely); fixing that is tracked as a followup, NOT in
// C30 scope, so the bug isn't widened by this commit.
const PRICING = {
  'haiku-4-5':  { input: 0.80,  output: 4.00,  cached: 0.08, cacheWrite: 1.00 },
  'sonnet-4-6': { input: 3.00,  output: 15.00, cached: 0.30, cacheWrite: 3.75 },
  'opus-4-7':   { input: 15.00, output: 75.00, cached: 1.50, cacheWrite: 18.75 },
} as const;

/**
 * One step of the agent loop's history. Captures the LLM call's
 * provider + cost + which tool calls happened. Returned to the caller
 * so they can render a reasoning trail or per-step audit if needed.
 */
export interface AgentLoopIteration {
  iteration: number;
  provider: Provider;
  modelUsed: ModelTier;
  stopReason: StopReason;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  costUsd: number;
  latencyMs: number;
  /** Tool calls Claude made in this iteration. */
  toolCalls: AgentLoopToolCall[];
  /** Text emitted by Claude in this iteration (may be empty for
   *  pure tool_use responses). */
  text: string;
}

/**
 * One tool call within an iteration. Captures the gateway invocation
 * input + output for traceability.
 */
export interface AgentLoopToolCall {
  toolUseId: string;
  connectorName: string;
  toolName: string;
  input: Record<string, unknown>;
  /** Gateway result. ok=false captures the user-visible error. */
  result:
    | { ok: true; output: unknown; actionId: string | null; latencyMs: number }
    | {
        ok: false;
        error: { code: string; message: string };
        actionId: string | null;
        latencyMs: number;
      };
}

/**
 * Why the loop terminated. 'end_turn' / 'max_tokens' come from
 * Claude. 'max_iterations' fires when the loop hits its safety cap.
 * 'no_tools_to_route' fires (rare) if Claude emits a tool_use block
 * referencing a tool the agent didn't make available — defensive.
 */
export type AgentLoopStopReason =
  | 'end_turn'
  | 'max_tokens'
  | 'max_iterations'
  | 'no_tools_to_route'
  | 'other';

export type RunDocketAgentWithToolsOptions = {
  tenantId: TenantId;
  userId: UserId;
  agentId: AgentId;
  /** Optional client this agent is operating on behalf of; threaded
   *  into the gateway for client-scoped audit rows + into onAction
   *  audit entries. Branded as ClientId (use asClientId) to match
   *  ActionLogEntry. */
  clientId?: ClientId | null;
  systemPrompt: string;
  userPrompt: string;
  modelTier?: ModelTier;
  maxTokens?: number;
  cachedSystem?: boolean;
  /**
   * Per-iteration LLM call timeout safety. Capped at maxIterations
   * to prevent infinite loops on a pathological tool_use sequence.
   * Default 10 — comfortable for most cross-source skills; raise
   * for skills that need deep multi-turn reasoning.
   */
  maxIterations?: number;
  /** Tool definitions Claude may call. Map maps each tool name to
   *  the gateway connector that hosts it. */
  tools: AgentLoopToolBinding[];
  /** Gateway instance to route tool calls through. Required when
   *  tools is non-empty; agents that don't need tools should use
   *  runDocketAgent (single-shot) instead. */
  gateway: McpGateway;
  /** Audit-hook callback. Fires ONCE PER LLM CALL in the loop
   *  (typically 2-4 calls for cross-source skills). Each entry has
   *  per-call cost + token counts. Aggregate cost is also returned
   *  in the function result for cost-dashboard tagging. */
  onAction?: (entry: Omit<ActionLogEntry, 'id' | 'createdAt'>) => Promise<void>;
  /**
   * If the systemPrompt was sourced from @docket/prompts, pass the
   * id + version so cost telemetry tags each iteration's row with
   * which prompt produced this loop. Same pattern as docket-agent.ts.
   */
  promptId?: string;
  promptVersion?: string;
};

/**
 * Tool binding: how a tool name in Claude's response maps to a
 * gateway connector + tool. The agent specifies these so the loop
 * knows where to route each tool_use block.
 *
 * Why this exists: a skill author wants Claude to see a tool called
 * "list_actions" but the actual gateway tool is at connector="ledger"
 * tool="query_actions". This indirection lets skill authors curate
 * Claude's tool surface (sensible names, narrower than the full
 * connector tool list) without renaming the underlying tool.
 */
export type AgentLoopToolBinding = {
  /** Definition Claude sees (name + description + JSON schema). */
  definition: ToolDefinition;
  /** Where on the gateway this maps to. */
  connectorName: string;
  /** Tool name registered on the connector. Defaults to definition.name. */
  toolName?: string;
};

export type RunDocketAgentWithToolsResult = {
  /** Final assistant text from the last iteration. Empty when the
   *  loop terminated mid-tool-use (e.g., max_iterations). */
  text: string;
  /** Why the loop stopped. */
  stopReason: AgentLoopStopReason;
  /** Number of iterations actually executed. */
  iterations: number;
  /** Per-iteration trace; useful for reasoning-trail rendering. */
  trace: AgentLoopIteration[];
  /** Aggregated cost across all iterations (USD). */
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedTokens: number;
  /** Total tool calls made across the loop (sum of trace[].toolCalls.length). */
  totalToolCalls: number;
  /** Total wall-clock time across all iterations. */
  totalLatencyMs: number;
};

/**
 * Run the multi-turn agent loop.
 *
 * @throws if both providers fail on any single iteration. Throws
 *         propagate up; the loop does not retry past the per-iteration
 *         fallover that callClaudeWithFallover already handles.
 */
export async function runDocketAgentWithTools(
  opts: RunDocketAgentWithToolsOptions,
): Promise<RunDocketAgentWithToolsResult> {
  const tier: ModelTier = opts.modelTier ?? 'sonnet-4-6';
  const maxTokens = opts.maxTokens ?? 4096;
  const maxIterations = opts.maxIterations ?? 10;

  // Index toolBindings by Claude-facing name for O(1) lookup when
  // routing tool_use blocks.
  const toolByName = new Map<string, AgentLoopToolBinding>();
  for (const binding of opts.tools) {
    toolByName.set(binding.definition.name, binding);
  }

  // Conversation history. Grows as the loop runs.
  const messages: Message[] = [
    { role: 'user', content: opts.userPrompt },
  ];

  const trace: AgentLoopIteration[] = [];
  let totalCostUsd = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCachedTokens = 0;
  let totalToolCalls = 0;
  let totalLatencyMs = 0;
  let stopReason: AgentLoopStopReason = 'other';
  let finalText = '';

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    const result: CallClaudeResult = await callClaudeWithFallover({
      modelTier: tier,
      systemPrompt: opts.systemPrompt,
      messages,
      tools: opts.tools.map((b) => b.definition),
      maxTokens,
      ...(opts.cachedSystem !== undefined
        ? { cachedSystem: opts.cachedSystem }
        : {}),
    });

    // Cost calculation per iteration. Anthropic reports three input
    // buckets (uncached / cache-write / cache-read), each at a
    // different rate. See PRICING comment above. Bedrock reports
    // analogous fields via cacheReadInputTokens + cacheWriteInputTokens.
    //
    // `cachedTokens` returned to the caller is the SUM of read + write
    // — it's the "how much cache activity happened this iteration"
    // signal for a reasoning trail. The cost formula bills each
    // bucket at its proper rate.
    const cachedTokens =
      result.cachedInputTokens + result.cacheCreationInputTokens;
    const pricing = PRICING[tier];
    const iterCost =
      (result.inputTokens * pricing.input) / 1_000_000 +
      (result.cacheCreationInputTokens * pricing.cacheWrite) / 1_000_000 +
      (result.cachedInputTokens * pricing.cached) / 1_000_000 +
      (result.outputTokens * pricing.output) / 1_000_000;

    // If Claude wants to call tools, route each one through the gateway.
    // Collect the tool calls + their results for the trace.
    const toolCalls: AgentLoopToolCall[] = [];
    if (result.stopReason === 'tool_use' && result.toolUses.length > 0) {
      for (const toolUse of result.toolUses) {
        const binding = toolByName.get(toolUse.name);
        if (!binding) {
          // Defensive: Claude emitted a tool_use for a name we didn't
          // expose. Surface as tool_result with isError + stop the
          // loop after appending so Claude sees the failure (it might
          // recover by emitting text). The loop's stop check below
          // catches this via no_tools_to_route.
          toolCalls.push({
            toolUseId: toolUse.id,
            connectorName: '(unbound)',
            toolName: toolUse.name,
            input: toolUse.input,
            result: {
              ok: false,
              error: {
                code: 'NO_TOOL_BINDING',
                message: `Tool "${toolUse.name}" not bound to a connector in this loop.`,
              },
              actionId: null,
              latencyMs: 0,
            },
          });
          continue;
        }
        const gatewayResult = await opts.gateway.callTool({
          tenantId: opts.tenantId,
          userId: opts.userId,
          ...(opts.clientId !== undefined ? { clientId: opts.clientId } : {}),
          connectorName: binding.connectorName,
          toolName: binding.toolName ?? binding.definition.name,
          input: toolUse.input,
          agentName: opts.agentId,
        });
        toolCalls.push({
          toolUseId: toolUse.id,
          connectorName: binding.connectorName,
          toolName: binding.toolName ?? binding.definition.name,
          input: toolUse.input,
          result: gatewayResult,
        });
      }
      totalToolCalls += toolCalls.length;
    }

    // Append this iteration to the trace + accumulators.
    trace.push({
      iteration,
      provider: result.provider,
      modelUsed: tier,
      stopReason: result.stopReason,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      cachedTokens,
      costUsd: iterCost,
      latencyMs: result.latencyMs,
      toolCalls,
      text: result.text,
    });
    totalCostUsd += iterCost;
    totalInputTokens += result.inputTokens;
    totalOutputTokens += result.outputTokens;
    totalCachedTokens += cachedTokens;
    totalLatencyMs += result.latencyMs;
    finalText = result.text;

    // Audit hook: one row per LLM call. Caller can persist via
    // @docket/db persistAgentAction or write a custom row.
    if (opts.onAction) {
      await opts.onAction({
        tenantId: opts.tenantId,
        clientId: opts.clientId ?? null,
        userId: opts.userId,
        agentId: opts.agentId,
        actionClass: 'read',
        toolName:
          result.provider === 'anthropic'
            ? 'anthropic.messages.create'
            : 'bedrock.converse',
        toolInput: {
          modelTier: tier,
          provider: result.provider,
          maxTokens,
          iteration,
          toolsAvailable: opts.tools.map((b) => b.definition.name),
          toolCallsMade: toolCalls.map((tc) => ({
            connector: tc.connectorName,
            tool: tc.toolName,
            ok: tc.result.ok,
          })),
          ...(opts.promptId ? { promptId: opts.promptId } : {}),
          ...(opts.promptVersion ? { promptVersion: opts.promptVersion } : {}),
        },
        toolOutput: {
          stopReason: result.stopReason,
          textPreview: result.text.slice(0, 200),
        },
        modelUsed: tier,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        cachedTokens,
        costUsd: iterCost,
        latencyMs: result.latencyMs,
        success: true,
        errorMessage: null,
      });
    }

    // Terminate when Claude is done OR when we hit no_tools_to_route.
    // Append the assistant response + tool_results to messages before
    // continuing the loop.
    if (result.stopReason === 'end_turn') {
      stopReason = 'end_turn';
      break;
    }
    if (result.stopReason === 'max_tokens') {
      stopReason = 'max_tokens';
      break;
    }
    if (result.stopReason !== 'tool_use') {
      stopReason = 'other';
      break;
    }

    // Append assistant turn (text + tool_use blocks).
    messages.push({
      role: 'assistant',
      content: result.assistantContent,
    });

    // Check for the no_tools_to_route case: if ANY tool call failed
    // with NO_TOOL_BINDING, we still surface tool_results so Claude
    // sees the failure, BUT after this iteration we stop the loop
    // (Claude can't make progress without the missing tool).
    const hasUnboundTool = toolCalls.some(
      (tc) => !tc.result.ok && tc.result.error.code === 'NO_TOOL_BINDING',
    );

    // Append tool_result blocks for each tool call.
    //
    // Serialization: gateway tool outputs are passed back to Claude as
    // text. Most outputs are JSON-serializable, but a connector COULD
    // return a value with a `bigint`, a circular reference, or a
    // non-serializable object. Codex r1 P2 flagged that a raw
    // JSON.stringify in that case would throw and abort the loop
    // mid-iteration — Claude never sees the failure and can't react.
    // Wrap in safeStringify so the failure surfaces as a tool_result
    // with isError=true; Claude can then choose a different tool or
    // emit a recovery message.
    const toolResultBlocks: ContentBlock[] = toolCalls.map((tc) => {
      if (!tc.result.ok) {
        return {
          type: 'tool_result',
          toolUseId: tc.toolUseId,
          content: `Tool call failed [${tc.result.error.code}]: ${tc.result.error.message}`,
          isError: true,
        };
      }
      if (typeof tc.result.output === 'string') {
        return {
          type: 'tool_result',
          toolUseId: tc.toolUseId,
          content: tc.result.output,
          isError: false,
        };
      }
      const serialized = safeStringify(tc.result.output);
      return {
        type: 'tool_result',
        toolUseId: tc.toolUseId,
        content: serialized.ok
          ? serialized.value
          : `Tool output serialization failed: ${serialized.error}`,
        isError: !serialized.ok,
      };
    });
    messages.push({ role: 'user', content: toolResultBlocks });

    if (hasUnboundTool) {
      stopReason = 'no_tools_to_route';
      break;
    }
    // Otherwise loop continues for next iteration.
  }

  // If we exhausted the loop without hitting a stop condition, that's
  // max_iterations.
  if (trace.length === maxIterations && stopReason === 'other') {
    stopReason = 'max_iterations';
  }

  return {
    text: finalText,
    stopReason,
    iterations: trace.length,
    trace,
    totalCostUsd,
    totalInputTokens,
    totalOutputTokens,
    totalCachedTokens,
    totalToolCalls,
    totalLatencyMs,
  };
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

/**
 * Safely serialize an arbitrary tool output to a string suitable for
 * a tool_result.content. Returns `{ ok: true, value }` on success or
 * `{ ok: false, error }` with a short reason on failure. Handles:
 *   - bigint values (JSON.stringify throws TypeError) → custom replacer
 *     converts to string with "n" suffix preserving the bigint identity
 *   - circular references (TypeError "Converting circular structure to
 *     JSON") → caught and surfaced as a serialization error
 *   - any other throw from a getter or toJSON → caught generically
 *
 * Output is truncated to 64 KiB to keep tool_result payloads bounded
 * (Anthropic accepts much larger but the model rarely needs it; a
 * 1MB JSON blob is almost certainly a bug, not a feature).
 */
function safeStringify(
  value: unknown,
): { ok: true; value: string } | { ok: false; error: string } {
  try {
    const replacer = (_key: string, v: unknown): unknown => {
      if (typeof v === 'bigint') return `${v.toString()}n`;
      // Native JSON.stringify silently drops object keys whose values
      // are undefined, and replaces array-slot undefineds with null.
      // Codex r2 P3 flagged that downstream readers can't tell whether
      // a field was "missing" vs "explicitly undefined." Sentinel
      // preserves the distinction.
      if (v === undefined) return '__undefined__';
      return v;
    };
    const serialized = JSON.stringify(value, replacer);
    if (serialized === undefined) {
      return { ok: false, error: 'value serialized to undefined' };
    }
    const MAX_BYTES = 64 * 1024;
    if (serialized.length > MAX_BYTES) {
      return {
        ok: true,
        value:
          serialized.slice(0, MAX_BYTES) +
          `\n... (truncated; ${serialized.length - MAX_BYTES} bytes elided)`,
      };
    }
    return { ok: true, value: serialized };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
