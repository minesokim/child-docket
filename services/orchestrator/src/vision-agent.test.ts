// vision-agent Bedrock fallover tests.
//
// Session 14 (2026-05-16): mirrors docket-agent.test.ts pattern.
// Mocks the Anthropic vision client + the Bedrock client so we can
// drive specific failure modes through the classifier + assert the
// fallover behavior end-to-end:
//
//   1. Transient Anthropic error → Bedrock invoked → result tagged
//      provider='bedrock'.
//   2. Permanent Anthropic error (401, 400 non-billing) → throws,
//      Bedrock NEVER called.
//   3. Both providers fail → aggregated error message names both.
//   4. Anthropic success → Bedrock never touched, provider='anthropic'.
//
// The classifier itself is tested exhaustively in providers.test.ts;
// these tests verify the WIRING (which call path fires when), not
// the classification logic.

import { describe, expect, test, mock } from 'bun:test';
import type { AgentId, TenantId } from '@docket/shared';

// ────────────────────────────────────────────────────────────────
// Test fixtures.
// ────────────────────────────────────────────────────────────────

const TENANT = '11111111-1111-1111-1111-111111111111' as TenantId;
const AGENT = 'vision-test' as AgentId;

const baseInput = {
  tenantId: TENANT,
  agentId: AGENT,
  systemPrompt: 'classify the image',
  userPrompt: 'what is this',
  images: [
    {
      kind: 'base64' as const,
      data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAA',
      mediaType: 'image/png' as const,
    },
  ],
};

// ────────────────────────────────────────────────────────────────
// Anthropic SDK mock — controllable per test.
// ────────────────────────────────────────────────────────────────

let anthropicShouldThrow: unknown = null;
let anthropicCallCount = 0;
const anthropicResponseShape = {
  content: [{ type: 'text', text: 'looks like a w-2' }],
  usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
};

mock.module('@anthropic-ai/sdk', () => {
  const Anthropic = class {
    messages = {
      create: async () => {
        anthropicCallCount += 1;
        if (anthropicShouldThrow) {
          // eslint-disable-next-line @typescript-eslint/no-throw-literal
          throw anthropicShouldThrow;
        }
        return anthropicResponseShape;
      },
    };
  };
  return { default: Anthropic, Anthropic };
});

// ────────────────────────────────────────────────────────────────
// Bedrock client mock — controllable per test.
// ────────────────────────────────────────────────────────────────

let bedrockShouldThrow: unknown = null;
let bedrockCallCount = 0;
const bedrockResponseShape = {
  output: {
    message: {
      content: [{ text: 'bedrock classified as 1099' }],
    },
  },
  usage: { inputTokens: 12, outputTokens: 7 },
};

// Replace the bedrockClient + ConverseCommand path. We mock
// the entire AWS SDK module so the test doesn't open real AWS
// connections + doesn't need credentials.
mock.module('@aws-sdk/client-bedrock-runtime', () => {
  class ConverseCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  class BedrockRuntimeClient {
    config = { region: 'us-east-1' };
    async send(_cmd: unknown) {
      bedrockCallCount += 1;
      if (bedrockShouldThrow) {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw bedrockShouldThrow;
      }
      return bedrockResponseShape;
    }
  }
  return { ConverseCommand, BedrockRuntimeClient };
});

// Re-import AFTER mocks land so the modules pick up the mocked
// versions. providers.ts uses the Bedrock SDK; vision-agent.ts
// uses the Anthropic SDK; both must see the mocks.
process.env.ANTHROPIC_API_KEY = 'test-key';
process.env.AWS_ACCESS_KEY_ID = 'test-access';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';

const { runVisionAgent } = await import('./vision-agent.ts');

function resetCounts() {
  anthropicCallCount = 0;
  bedrockCallCount = 0;
  anthropicShouldThrow = null;
  bedrockShouldThrow = null;
}

// ────────────────────────────────────────────────────────────────
// Tests.
// ────────────────────────────────────────────────────────────────

describe('runVisionAgent — Bedrock fallover', () => {
  test('happy path: Anthropic succeeds → provider=anthropic, Bedrock never called', async () => {
    resetCounts();
    const result = await runVisionAgent(baseInput);
    expect(result.provider).toBe('anthropic');
    expect(anthropicCallCount).toBe(1);
    expect(bedrockCallCount).toBe(0);
    expect(result.text).toContain('w-2');
  });

  test('transient Anthropic 429 → Bedrock invoked → provider=bedrock', async () => {
    resetCounts();
    anthropicShouldThrow = { status: 429, type: 'rate_limit_error' };
    const result = await runVisionAgent(baseInput);
    expect(result.provider).toBe('bedrock');
    expect(anthropicCallCount).toBe(1);
    expect(bedrockCallCount).toBe(1);
    expect(result.text).toContain('1099');
  });

  test('transient Anthropic 5xx → Bedrock invoked → provider=bedrock', async () => {
    resetCounts();
    anthropicShouldThrow = { status: 503, error: { type: 'service_unavailable' } };
    const result = await runVisionAgent(baseInput);
    expect(result.provider).toBe('bedrock');
    expect(bedrockCallCount).toBe(1);
  });

  test('credit-balance 400 (transient per classifier) → Bedrock invoked', async () => {
    // The classifier treats status=400 + invalid_request_error +
    // message matching /credit balance/i as transient (different
    // billing relationship on Bedrock). Verifies the vision side
    // gets the same treatment as text — Antonio's intake doesn't
    // stall when Anthropic credit runs out.
    resetCounts();
    anthropicShouldThrow = {
      status: 400,
      type: 'invalid_request_error',
      error: {
        type: 'invalid_request_error',
        message: 'Your credit balance is too low to access the Anthropic API.',
      },
      message: '400 Your credit balance is too low',
    };
    const result = await runVisionAgent(baseInput);
    expect(result.provider).toBe('bedrock');
    expect(bedrockCallCount).toBe(1);
  });

  test('permanent Anthropic 401 → throws, Bedrock NEVER called', async () => {
    resetCounts();
    anthropicShouldThrow = { status: 401, error: { type: 'authentication_error' } };
    await expect(runVisionAgent(baseInput)).rejects.toBeDefined();
    expect(anthropicCallCount).toBe(1);
    expect(bedrockCallCount).toBe(0);
  });

  test('permanent Anthropic 400 (non-billing) → throws, Bedrock NEVER called', async () => {
    resetCounts();
    anthropicShouldThrow = {
      status: 400,
      type: 'invalid_request_error',
      error: { type: 'invalid_request_error', message: 'Malformed prompt' },
      message: 'Malformed prompt',
    };
    await expect(runVisionAgent(baseInput)).rejects.toBeDefined();
    expect(bedrockCallCount).toBe(0);
  });

  test('both fail → aggregated error names both providers', async () => {
    resetCounts();
    anthropicShouldThrow = { status: 503, error: { type: 'service_unavailable' } };
    bedrockShouldThrow = new Error('bedrock-down');
    let caught: unknown;
    try {
      await runVisionAgent(baseInput);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    const msg = (caught as Error).message;
    expect(msg).toMatch(/Anthropic/);
    expect(msg).toMatch(/Bedrock/);
    expect(msg).toMatch(/bedrock-down/);
  });
});
