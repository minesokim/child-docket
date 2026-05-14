// Multi-turn agent loop tests.
//
// Strategy: mock `callClaudeWithFallover` to return canned responses
// + mock the McpGateway to return canned tool results. Exercise the
// loop's branching: text-only termination, tool_use routing,
// gateway-error surfacing, max_iterations cap, no_tools_to_route
// safety, audit-hook firing, cost accumulation.
//
// What's covered (per /edge-cases 12 cases enumerated for C30):
//   - Happy path: 1 iteration, end_turn, no tools
//   - Happy path: 2 iterations, tool_use → end_turn
//   - Tool-not-bound: NO_TOOL_BINDING + stop after iteration
//   - Gateway error: tool result surfaces isError=true, loop continues
//     so Claude can react (next iteration ends_turn with a recovery msg)
//   - max_iterations cap: loop terminates with max_iterations stopReason
//   - max_tokens stop reason propagates
//   - onAction fires per iteration with cost telemetry
//   - Cost aggregation across iterations is correct
//   - assistantContent appended to messages between iterations
//   - Multi-tool-call iteration: 2 tools in one turn, both invoked
//
// What's NOT covered (deferred to /e2e + real-DB smoke):
//   - Live Anthropic API call (would burn budget in CI; tested
//     manually via providers.test.ts existing harness + smoke-bedrock.ts)
//   - Live gateway call writing to actions table (covered by
//     @docket/mcp-gateway test suite + integration smokes when
//     C31 ledger MCP ships)

import { describe, expect, test, mock } from 'bun:test';
import { z } from 'zod';
import type { TenantId, UserId } from '@docket/shared';
import type { CallClaudeResult } from './providers.js';

// ────────────────────────────────────────────────────────────────
// Mock callClaudeWithFallover. The mock returns a queue of canned
// responses; each callClaude() consumes one.
//
// IMPORTANT: bun's mock.module replaces the module GLOBALLY for the
// rest of the bun test process. To avoid breaking sibling tests
// (providers.test.ts imports `_testOnly` and other non-mocked exports),
// we spread the original module's exports first and override only
// callClaudeWithFallover. Without this spread, providers.test.ts errors
// with "Export named '_testOnly' not found".
// ────────────────────────────────────────────────────────────────

const cannedResponses: CallClaudeResult[] = [];
const callClaudeCallLog: Array<{
  systemPrompt: string;
  messageCount: number;
  toolCount: number;
  /** Snapshot of the messages passed in. Tests assert on tool_result
   *  payload contents (e.g., bigint sentinel via codex r2 P3 fix). */
  messages: Array<{ role: string; content: unknown }>;
}> = [];

const actualProviders = await import('./providers.ts');

mock.module('./providers.ts', () => ({
  ...actualProviders,
  callClaudeWithFallover: async (
    input: {
      systemPrompt: string;
      messages?: Array<{ role: string; content: unknown }>;
      userPrompt?: string;
      tools?: Array<unknown>;
    },
  ): Promise<CallClaudeResult> => {
    callClaudeCallLog.push({
      systemPrompt: input.systemPrompt,
      messageCount: input.messages?.length ?? (input.userPrompt ? 1 : 0),
      toolCount: input.tools?.length ?? 0,
      // Deep clone via structuredClone — the agent loop mutates the
      // same `messages` array across iterations, so storing the
      // reference would let later mutations overwrite earlier snapshots.
      messages: input.messages ? structuredClone(input.messages) : [],
    });
    const next = cannedResponses.shift();
    if (!next) {
      throw new Error(
        '[agent-loop test] Out of canned responses; test set up incorrectly',
      );
    }
    return next;
  },
}));

const { runDocketAgentWithTools } = await import('./agent-loop.js');

// ────────────────────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────────────────────

const TENANT_A = '11111111-1111-1111-1111-111111111111' as TenantId;
const USER_A = '22222222-2222-2222-2222-222222222222' as UserId;

function makeCannedResponse(
  partial: Partial<CallClaudeResult> & {
    stopReason: CallClaudeResult['stopReason'];
  },
): CallClaudeResult {
  return {
    text: partial.text ?? '',
    provider: partial.provider ?? 'anthropic',
    inputTokens: partial.inputTokens ?? 100,
    outputTokens: partial.outputTokens ?? 50,
    cachedInputTokens: partial.cachedInputTokens ?? 0,
    cacheCreationInputTokens: partial.cacheCreationInputTokens ?? 0,
    latencyMs: partial.latencyMs ?? 1000,
    stopReason: partial.stopReason,
    toolUses: partial.toolUses ?? [],
    assistantContent: partial.assistantContent ?? [],
  };
}

type GatewayCallLog = {
  connectorName: string;
  toolName: string;
  input: Record<string, unknown>;
};
function makeStubGateway(opts: {
  toolResults?: Array<
    | { ok: true; output: unknown }
    | { ok: false; errorCode: string; errorMessage: string }
  >;
  callLog?: GatewayCallLog[];
}) {
  const results = [...(opts.toolResults ?? [])];
  return {
    callTool: async (callOpts: {
      connectorName: string;
      toolName: string;
      input: Record<string, unknown>;
    }) => {
      opts.callLog?.push({
        connectorName: callOpts.connectorName,
        toolName: callOpts.toolName,
        input: callOpts.input,
      });
      const next = results.shift();
      if (!next) {
        return {
          ok: false as const,
          error: {
            code: 'TEST_OUT_OF_RESULTS',
            message: 'no canned result',
          },
          actionId: null,
          latencyMs: 0,
        };
      }
      if (next.ok) {
        return {
          ok: true as const,
          output: next.output,
          actionId: 'stub-action-id',
          latencyMs: 0,
        };
      }
      return {
        ok: false as const,
        error: { code: next.errorCode, message: next.errorMessage },
        actionId: 'stub-action-id',
        latencyMs: 0,
      };
    },
    // Other McpGateway methods we don't exercise in these tests.
    register: () => {},
    list: () => [],
    get: () => null,
    readResource: async () => ({
      ok: false as const,
      error: { code: 'UNKNOWN_RESOURCE' as const, message: '' },
      actionId: null,
      latencyMs: 0,
    }),
  } as unknown as import('@docket/mcp-gateway').McpGateway;
}

function resetMocks() {
  cannedResponses.length = 0;
  callClaudeCallLog.length = 0;
}

// ────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────

describe('runDocketAgentWithTools — happy paths', () => {
  test('single iteration text-only response → end_turn', async () => {
    resetMocks();
    cannedResponses.push(
      makeCannedResponse({
        text: 'Hello world',
        stopReason: 'end_turn',
        assistantContent: [{ type: 'text', text: 'Hello world' }],
      }),
    );
    const gw = makeStubGateway({});
    const result = await runDocketAgentWithTools({
      tenantId: TENANT_A,
      userId: USER_A,
      agentId: 'test-agent',
      systemPrompt: 'You are helpful.',
      userPrompt: 'Say hello',
      tools: [],
      gateway: gw,
    });
    expect(result.text).toBe('Hello world');
    expect(result.stopReason).toBe('end_turn');
    expect(result.iterations).toBe(1);
    expect(result.totalToolCalls).toBe(0);
    expect(callClaudeCallLog).toHaveLength(1);
    expect(callClaudeCallLog[0]?.toolCount).toBe(0);
  });

  test('tool_use → end_turn (2 iterations)', async () => {
    resetMocks();
    const gatewayCallLog: GatewayCallLog[] = [];
    cannedResponses.push(
      makeCannedResponse({
        stopReason: 'tool_use',
        toolUses: [
          { id: 'tu_1', name: 'list_clients', input: { limit: 10 } },
        ],
        assistantContent: [
          { type: 'tool_use', id: 'tu_1', name: 'list_clients', input: { limit: 10 } },
        ],
      }),
      makeCannedResponse({
        text: 'You have 2 clients: Alice and Bob.',
        stopReason: 'end_turn',
        assistantContent: [
          { type: 'text', text: 'You have 2 clients: Alice and Bob.' },
        ],
      }),
    );
    const gw = makeStubGateway({
      toolResults: [{ ok: true, output: ['Alice', 'Bob'] }],
      callLog: gatewayCallLog,
    });
    const result = await runDocketAgentWithTools({
      tenantId: TENANT_A,
      userId: USER_A,
      agentId: 'test-agent',
      systemPrompt: 'You are helpful.',
      userPrompt: 'How many clients do I have?',
      tools: [
        {
          definition: {
            name: 'list_clients',
            description: 'List clients',
            inputSchema: z.toJSONSchema(z.object({ limit: z.number() })) as Record<string, unknown>,
          },
          connectorName: 'ledger',
        },
      ],
      gateway: gw,
    });
    expect(result.text).toBe('You have 2 clients: Alice and Bob.');
    expect(result.stopReason).toBe('end_turn');
    expect(result.iterations).toBe(2);
    expect(result.totalToolCalls).toBe(1);
    expect(gatewayCallLog).toHaveLength(1);
    expect(gatewayCallLog[0]?.connectorName).toBe('ledger');
    expect(gatewayCallLog[0]?.toolName).toBe('list_clients');
    // Second call should have more messages (initial user + assistant turn + tool_results)
    expect(callClaudeCallLog[1]?.messageCount).toBeGreaterThan(
      callClaudeCallLog[0]?.messageCount ?? 0,
    );
  });

  test('multiple tools in one iteration → all invoked', async () => {
    resetMocks();
    const gatewayCallLog: GatewayCallLog[] = [];
    cannedResponses.push(
      makeCannedResponse({
        stopReason: 'tool_use',
        toolUses: [
          { id: 'tu_1', name: 'list_clients', input: {} },
          { id: 'tu_2', name: 'get_audit_chain', input: { tenantId: 'x' } },
        ],
        assistantContent: [
          { type: 'tool_use', id: 'tu_1', name: 'list_clients', input: {} },
          { type: 'tool_use', id: 'tu_2', name: 'get_audit_chain', input: { tenantId: 'x' } },
        ],
      }),
      makeCannedResponse({
        text: 'Aggregated answer',
        stopReason: 'end_turn',
        assistantContent: [{ type: 'text', text: 'Aggregated answer' }],
      }),
    );
    const gw = makeStubGateway({
      toolResults: [
        { ok: true, output: ['Alice'] },
        { ok: true, output: { count: 100 } },
      ],
      callLog: gatewayCallLog,
    });
    const result = await runDocketAgentWithTools({
      tenantId: TENANT_A,
      userId: USER_A,
      agentId: 'test-agent',
      systemPrompt: 'You are helpful.',
      userPrompt: 'Tell me about my clients and audit chain',
      tools: [
        {
          definition: {
            name: 'list_clients',
            description: 'List',
            inputSchema: {} as Record<string, unknown>,
          },
          connectorName: 'ledger',
        },
        {
          definition: {
            name: 'get_audit_chain',
            description: 'Chain',
            inputSchema: {} as Record<string, unknown>,
          },
          connectorName: 'ledger',
        },
      ],
      gateway: gw,
    });
    expect(result.totalToolCalls).toBe(2);
    expect(gatewayCallLog).toHaveLength(2);
    expect(result.iterations).toBe(2);
  });
});

describe('runDocketAgentWithTools — error and safety paths', () => {
  test('gateway tool error → tool_result with isError, loop continues for recovery', async () => {
    resetMocks();
    cannedResponses.push(
      makeCannedResponse({
        stopReason: 'tool_use',
        toolUses: [{ id: 'tu_1', name: 'list_clients', input: {} }],
        assistantContent: [
          { type: 'tool_use', id: 'tu_1', name: 'list_clients', input: {} },
        ],
      }),
      makeCannedResponse({
        text: "Couldn't list clients due to permission error.",
        stopReason: 'end_turn',
        assistantContent: [{ type: 'text', text: "Couldn't list clients due to permission error." }],
      }),
    );
    const gw = makeStubGateway({
      toolResults: [
        {
          ok: false,
          errorCode: 'TRUST_GATE_DENIED',
          errorMessage: 'requires firm_owner role',
        },
      ],
    });
    const result = await runDocketAgentWithTools({
      tenantId: TENANT_A,
      userId: USER_A,
      agentId: 'test-agent',
      systemPrompt: 'You are helpful.',
      userPrompt: 'Try',
      tools: [
        {
          definition: {
            name: 'list_clients',
            description: 'List',
            inputSchema: {} as Record<string, unknown>,
          },
          connectorName: 'ledger',
        },
      ],
      gateway: gw,
    });
    expect(result.iterations).toBe(2);
    expect(result.stopReason).toBe('end_turn');
    const iterOne = result.trace[0];
    expect(iterOne?.toolCalls).toHaveLength(1);
    expect(iterOne?.toolCalls[0]?.result.ok).toBe(false);
    if (iterOne && !iterOne.toolCalls[0]?.result.ok) {
      expect(iterOne.toolCalls[0]?.result.error.code).toBe('TRUST_GATE_DENIED');
    }
  });

  test('unbound tool → NO_TOOL_BINDING + stop after iteration', async () => {
    resetMocks();
    cannedResponses.push(
      makeCannedResponse({
        stopReason: 'tool_use',
        toolUses: [{ id: 'tu_1', name: 'unknown_tool', input: {} }],
        assistantContent: [
          { type: 'tool_use', id: 'tu_1', name: 'unknown_tool', input: {} },
        ],
      }),
    );
    const gw = makeStubGateway({});
    const result = await runDocketAgentWithTools({
      tenantId: TENANT_A,
      userId: USER_A,
      agentId: 'test-agent',
      systemPrompt: 'You are helpful.',
      userPrompt: 'Try',
      tools: [
        {
          definition: {
            name: 'list_clients',
            description: 'List',
            inputSchema: {} as Record<string, unknown>,
          },
          connectorName: 'ledger',
        },
      ],
      gateway: gw,
    });
    expect(result.stopReason).toBe('no_tools_to_route');
    expect(result.iterations).toBe(1);
    const iter = result.trace[0];
    expect(iter?.toolCalls).toHaveLength(1);
    if (iter && !iter.toolCalls[0]?.result.ok) {
      expect(iter.toolCalls[0]?.result.error.code).toBe('NO_TOOL_BINDING');
    }
  });

  test('max_iterations cap fires', async () => {
    resetMocks();
    // Queue 5 tool_use responses (loop will hit cap before consuming them all)
    for (let i = 0; i < 5; i++) {
      cannedResponses.push(
        makeCannedResponse({
          stopReason: 'tool_use',
          toolUses: [{ id: `tu_${i}`, name: 't', input: {} }],
          assistantContent: [
            { type: 'tool_use', id: `tu_${i}`, name: 't', input: {} },
          ],
        }),
      );
    }
    const gw = makeStubGateway({
      toolResults: Array.from({ length: 5 }, () => ({
        ok: true as const,
        output: 'r',
      })),
    });
    const result = await runDocketAgentWithTools({
      tenantId: TENANT_A,
      userId: USER_A,
      agentId: 'test-agent',
      systemPrompt: 'p',
      userPrompt: 'p',
      maxIterations: 3,
      tools: [
        {
          definition: { name: 't', description: 'd', inputSchema: {} as Record<string, unknown> },
          connectorName: 'ledger',
        },
      ],
      gateway: gw,
    });
    expect(result.iterations).toBe(3);
    expect(result.stopReason).toBe('max_iterations');
  });

  test('max_tokens stop reason propagates', async () => {
    resetMocks();
    cannedResponses.push(
      makeCannedResponse({
        text: 'partial',
        stopReason: 'max_tokens',
        assistantContent: [{ type: 'text', text: 'partial' }],
      }),
    );
    const gw = makeStubGateway({});
    const result = await runDocketAgentWithTools({
      tenantId: TENANT_A,
      userId: USER_A,
      agentId: 'test-agent',
      systemPrompt: 'p',
      userPrompt: 'p',
      tools: [],
      gateway: gw,
    });
    expect(result.stopReason).toBe('max_tokens');
    expect(result.text).toBe('partial');
  });
});

describe('runDocketAgentWithTools — audit + cost', () => {
  test('onAction fires once per LLM iteration with per-iteration cost', async () => {
    resetMocks();
    cannedResponses.push(
      makeCannedResponse({
        stopReason: 'tool_use',
        inputTokens: 1_000_000,
        outputTokens: 0,
        toolUses: [{ id: 'tu_1', name: 't', input: {} }],
        assistantContent: [
          { type: 'tool_use', id: 'tu_1', name: 't', input: {} },
        ],
      }),
      makeCannedResponse({
        text: 'done',
        stopReason: 'end_turn',
        inputTokens: 0,
        outputTokens: 1_000_000,
        assistantContent: [{ type: 'text', text: 'done' }],
      }),
    );
    const gw = makeStubGateway({
      toolResults: [{ ok: true, output: 'ok' }],
    });
    const auditEntries: Array<{ cost: number; tokens: number }> = [];
    const result = await runDocketAgentWithTools({
      tenantId: TENANT_A,
      userId: USER_A,
      agentId: 'test-agent',
      modelTier: 'sonnet-4-6',
      systemPrompt: 'p',
      userPrompt: 'p',
      tools: [
        {
          definition: { name: 't', description: 'd', inputSchema: {} as Record<string, unknown> },
          connectorName: 'ledger',
        },
      ],
      gateway: gw,
      onAction: async (entry) => {
        auditEntries.push({
          cost: entry.costUsd ?? 0,
          tokens: (entry.inputTokens ?? 0) + (entry.outputTokens ?? 0),
        });
      },
    });
    expect(auditEntries).toHaveLength(2);
    // First iteration: 1M input tokens × $3/M = $3.00
    expect(auditEntries[0]?.cost).toBeCloseTo(3.0, 2);
    // Second iteration: 1M output tokens × $15/M = $15.00
    expect(auditEntries[1]?.cost).toBeCloseTo(15.0, 2);
    // Aggregate: $18.00
    expect(result.totalCostUsd).toBeCloseTo(18.0, 2);
    expect(result.totalInputTokens).toBe(1_000_000);
    expect(result.totalOutputTokens).toBe(1_000_000);
  });

  test('cache-read tokens billed at cached rate, not base rate', async () => {
    // Per Anthropic API: input_tokens excludes both cache_read and
    // cache_creation. Each bucket bills at a different rate:
    //   - input (uncached): base
    //   - cache_creation:   1.25× base (5-min TTL)
    //   - cache_read:       0.1× base (90% discount)
    resetMocks();
    cannedResponses.push(
      makeCannedResponse({
        text: 'r',
        stopReason: 'end_turn',
        inputTokens: 100_000, // fresh input
        cachedInputTokens: 900_000, // cache read
        outputTokens: 0,
        assistantContent: [{ type: 'text', text: 'r' }],
      }),
    );
    const gw = makeStubGateway({});
    const result = await runDocketAgentWithTools({
      tenantId: TENANT_A,
      userId: USER_A,
      agentId: 'test-agent',
      modelTier: 'sonnet-4-6',
      systemPrompt: 'p',
      userPrompt: 'p',
      tools: [],
      gateway: gw,
    });
    // Sonnet pricing: input=$3/M, cached=$0.30/M.
    // 100K input × $3/M     = $0.30
    // 900K cache-read × $0.30/M = $0.27
    // Total = $0.57
    expect(result.totalCostUsd).toBeCloseTo(0.57, 2);
    expect(result.totalCachedTokens).toBe(900_000);
  });

  test('cache-write tokens billed at write rate (codex r1 P2 fix)', async () => {
    // Cache creation (first call that warms the cache) is billed
    // higher than cache reads. Codex r1 P2 flagged that the original
    // implementation silently dropped cache_creation_input_tokens
    // from the cost — underreporting spend by ~12× on the cache-warm
    // iteration. Regression test: a cache-creation-only iteration
    // must show non-zero billed cost at the write rate.
    resetMocks();
    cannedResponses.push(
      makeCannedResponse({
        text: 'r',
        stopReason: 'end_turn',
        inputTokens: 100_000, // fresh input
        cacheCreationInputTokens: 1_000_000, // cache write (warming)
        outputTokens: 0,
        assistantContent: [{ type: 'text', text: 'r' }],
      }),
    );
    const gw = makeStubGateway({});
    const result = await runDocketAgentWithTools({
      tenantId: TENANT_A,
      userId: USER_A,
      agentId: 'test-agent',
      modelTier: 'sonnet-4-6',
      systemPrompt: 'p',
      userPrompt: 'p',
      tools: [],
      gateway: gw,
    });
    // Sonnet pricing: input=$3/M, cacheWrite=$3.75/M (1.25× base).
    // 100K input × $3/M       = $0.30
    // 1M cache-write × $3.75/M = $3.75
    // Total = $4.05
    expect(result.totalCostUsd).toBeCloseTo(4.05, 2);
    expect(result.totalCachedTokens).toBe(1_000_000);
  });

  test('safeStringify falls back gracefully on bigint tool output', async () => {
    // Codex r1 P2: raw JSON.stringify on a tool output containing a
    // bigint throws TypeError and aborts the loop. The fix wraps
    // serialization in safeStringify which converts bigints to a
    // "<digits>n" string suffix so Claude can still see the result.
    resetMocks();
    cannedResponses.push(
      makeCannedResponse({
        text: '',
        stopReason: 'tool_use',
        toolUses: [{ id: 'tu_1', name: 't', input: {} }],
        assistantContent: [
          { type: 'tool_use', id: 'tu_1', name: 't', input: {} },
        ],
      }),
      makeCannedResponse({
        text: 'observed bigint',
        stopReason: 'end_turn',
        assistantContent: [{ type: 'text', text: 'observed bigint' }],
      }),
    );
    const gw = makeStubGateway({
      // bigint inside the gateway output. JSON.stringify would throw
      // TypeError; safeStringify converts to "<digits>n". Construct
      // from string to preserve precision above Number.MAX_SAFE_INTEGER
      // — BigInt(9007199254740993) coerces through float first and
      // silently loses the last digit.
      toolResults: [
        { ok: true, output: { count: BigInt('9007199254740993') } },
      ],
    });
    const result = await runDocketAgentWithTools({
      tenantId: TENANT_A,
      userId: USER_A,
      agentId: 'test-agent',
      systemPrompt: 'p',
      userPrompt: 'p',
      tools: [
        {
          definition: {
            name: 't',
            description: 'd',
            inputSchema: {} as Record<string, unknown>,
          },
          connectorName: 'ledger',
        },
      ],
      gateway: gw,
    });
    expect(result.stopReason).toBe('end_turn');
    expect(result.iterations).toBe(2);
    expect(result.text).toBe('observed bigint');

    // Codex r2 P3: assert the bigint sentinel actually reached the
    // next LLM call's tool_result content. Without this assertion, a
    // formatting regression (e.g., dropping the "n" suffix) would
    // pass the test silently because we only checked end-state text.
    const secondCall = callClaudeCallLog[1];
    expect(secondCall).toBeDefined();
    const toolResultMsg = secondCall!.messages.find(
      (m) =>
        m.role === 'user' &&
        Array.isArray(m.content) &&
        m.content.some(
          (b: { type?: string }) => b?.type === 'tool_result',
        ),
    );
    expect(toolResultMsg).toBeDefined();
    const toolResultBlock = (toolResultMsg!.content as Array<{
      type: string;
      content: string;
      isError?: boolean;
    }>).find((b) => b.type === 'tool_result');
    expect(toolResultBlock).toBeDefined();
    expect(toolResultBlock!.isError).toBe(false);
    // bigint serialized as "<digits>n"
    expect(toolResultBlock!.content).toContain('9007199254740993n');
  });
});
