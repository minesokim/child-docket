// Docket-agent (single-shot) tests.
//
// Strategy: mirror agent-loop.test.ts — mock callClaudeWithFallover
// to return canned token counts + assert runDocketAgent's cost formula
// bills each input bucket at its proper rate.
//
// Regression coverage: cache_creation_input_tokens must be billed at
// the write rate, not silently dropped (was the bug per AUTONOMOUS-
// DECISIONS #34; the agent-loop fix shipped at dd916b5; this file
// covers the same bug class in runDocketAgent).

import { describe, expect, test, mock } from 'bun:test';
import type { AgentId, TenantId } from '@docket/shared';
import type { CallClaudeResult } from './providers.js';

const cannedResponses: CallClaudeResult[] = [];

const actualProviders = await import('./providers.ts');

mock.module('./providers.ts', () => ({
  ...actualProviders,
  callClaudeWithFallover: async (): Promise<CallClaudeResult> => {
    const next = cannedResponses.shift();
    if (!next) {
      throw new Error(
        '[docket-agent test] Out of canned responses; test set up incorrectly',
      );
    }
    return next;
  },
}));

const { runDocketAgent } = await import('./docket-agent.js');

const TENANT_A = '11111111-1111-1111-1111-111111111111' as TenantId;
const AGENT_A = 'test-agent' as AgentId;

function makeCannedResponse(
  partial: Partial<CallClaudeResult>,
): CallClaudeResult {
  return {
    text: partial.text ?? 'ok',
    provider: partial.provider ?? 'anthropic',
    inputTokens: partial.inputTokens ?? 0,
    outputTokens: partial.outputTokens ?? 0,
    cachedInputTokens: partial.cachedInputTokens ?? 0,
    cacheCreationInputTokens: partial.cacheCreationInputTokens ?? 0,
    latencyMs: partial.latencyMs ?? 1000,
    stopReason: partial.stopReason ?? 'end_turn',
    toolUses: partial.toolUses ?? [],
    assistantContent: partial.assistantContent ?? [],
  };
}

describe('runDocketAgent — cost formula', () => {
  test('cache-write tokens billed at write rate (decision #34 followup)', async () => {
    // Cache creation (the call that warms the cache) is billed higher
    // than cache reads. Before this fix the formula silently dropped
    // cache_creation_input_tokens — underreporting spend by ~12× on
    // cache-warm iterations. Regression test: a cache-creation-only
    // call must show non-zero billed cost at the write rate.
    cannedResponses.length = 0;
    cannedResponses.push(
      makeCannedResponse({
        text: 'r',
        inputTokens: 100_000, // fresh input
        cacheCreationInputTokens: 1_000_000, // cache write (warming)
        outputTokens: 0,
      }),
    );
    const result = await runDocketAgent({
      tenantId: TENANT_A,
      agentId: AGENT_A,
      modelTier: 'sonnet-4-6',
      systemPrompt: 'p',
      userPrompt: 'p',
    });
    // Sonnet pricing: input=$3/M, cacheWrite=$3.75/M (1.25× base).
    //   100K input × $3/M       = $0.30
    //   1M cache-write × $3.75/M = $3.75
    //   Total = $4.05
    expect(result.costUsd).toBeCloseTo(4.05, 2);
    expect(result.cachedTokens).toBe(1_000_000);
  });

  test('uncached call bills only input + output', async () => {
    cannedResponses.length = 0;
    cannedResponses.push(
      makeCannedResponse({
        text: 'r',
        inputTokens: 1_000_000,
        outputTokens: 100_000,
      }),
    );
    const result = await runDocketAgent({
      tenantId: TENANT_A,
      agentId: AGENT_A,
      modelTier: 'sonnet-4-6',
      systemPrompt: 'p',
      userPrompt: 'p',
    });
    // Sonnet: input=$3/M, output=$15/M.
    //   1M input × $3/M       = $3.00
    //   100K output × $15/M    = $1.50
    //   Total = $4.50
    expect(result.costUsd).toBeCloseTo(4.5, 2);
    expect(result.cachedTokens).toBe(0);
  });

  test('cache-read tokens billed at cached rate (not at full input rate)', async () => {
    cannedResponses.length = 0;
    cannedResponses.push(
      makeCannedResponse({
        text: 'r',
        inputTokens: 100_000, // fresh tokens not in cache
        cachedInputTokens: 900_000, // cache-read (90% discount)
        outputTokens: 0,
      }),
    );
    const result = await runDocketAgent({
      tenantId: TENANT_A,
      agentId: AGENT_A,
      modelTier: 'sonnet-4-6',
      systemPrompt: 'p',
      userPrompt: 'p',
    });
    // Sonnet: input=$3/M, cached=$0.30/M.
    // The bug-fixed formula NO LONGER subtracts cachedInputTokens from
    // inputTokens — they're separate buckets in Anthropic's API.
    //   100K input × $3/M       = $0.30
    //   900K cache-read × $0.30/M = $0.27
    //   Total = $0.57
    expect(result.costUsd).toBeCloseTo(0.57, 2);
    expect(result.cachedTokens).toBe(900_000);
  });
});
