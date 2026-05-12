// Tests for the Anthropic → Bedrock failover classifier.
//
// `isTransientAnthropicError` is the load-bearing decision: get it
// wrong on the transient side and we fail-fast on conditions that
// should retry (defeating fallback's purpose). Get it wrong on the
// permanent side and we mask real config bugs behind "both providers
// failed" messages, making diagnosis harder.
//
// Tests cover the named edge cases from /edge-cases analysis:
//   1. Anthropic 429 → transient
//   2. Anthropic 5xx → transient
//   3. Anthropic timeout / network errors → transient
//   4. Anthropic 401 → NOT transient (config error)
//   5. Anthropic 400 → NOT transient (caller bug)
//   plus malformed inputs (null / undefined / random objects) →
//   safely classified as NOT transient.
//
// These tests don't exercise the live API. The Bedrock end-to-end
// reachability test lives in scripts/smoke-bedrock.ts; that runs
// against the real AWS account from local.

import { describe, expect, test } from 'bun:test';
import { _testOnly } from './providers.js';

const { isTransientAnthropicError } = _testOnly;

describe('isTransientAnthropicError', () => {
  describe('transient cases — should fall back to Bedrock', () => {
    test('500 server error', () => {
      expect(isTransientAnthropicError({ status: 500 })).toBe(true);
    });

    test('502 bad gateway', () => {
      expect(isTransientAnthropicError({ status: 502 })).toBe(true);
    });

    test('503 service unavailable', () => {
      expect(isTransientAnthropicError({ status: 503 })).toBe(true);
    });

    test('504 gateway timeout', () => {
      expect(isTransientAnthropicError({ status: 504 })).toBe(true);
    });

    test('429 rate limit', () => {
      expect(isTransientAnthropicError({ status: 429 })).toBe(true);
    });

    test('overloaded_error from Anthropic SDK', () => {
      expect(
        isTransientAnthropicError({
          status: 529,
          error: { type: 'overloaded_error' },
        }),
      ).toBe(true);
    });

    test('rate_limit_error error type', () => {
      expect(
        isTransientAnthropicError({
          status: 429,
          error: { type: 'rate_limit_error' },
        }),
      ).toBe(true);
    });

    test('api_error error type without specific status', () => {
      expect(
        isTransientAnthropicError({ error: { type: 'api_error' } }),
      ).toBe(true);
    });

    test('service_unavailable error type', () => {
      expect(
        isTransientAnthropicError({ error: { type: 'service_unavailable' } }),
      ).toBe(true);
    });

    // Edge case 16 (2026-05-12 addition): Anthropic returns
    //   400 + invalid_request_error + message="credit balance too low"
    // when the workspace runs out of credits. Structurally a 400 but
    // semantically transient — same request succeeds via Bedrock (different
    // billing relationship) and via Anthropic once topped up.
    test('billing 400: "Your credit balance is too low" → transient', () => {
      expect(
        isTransientAnthropicError({
          status: 400,
          error: {
            type: 'invalid_request_error',
            message: 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.',
          },
        }),
      ).toBe(true);
    });

    test('billing 400: case-insensitive "Credit Balance" match', () => {
      expect(
        isTransientAnthropicError({
          status: 400,
          error: {
            type: 'invalid_request_error',
            message: 'CREDIT BALANCE exhausted',
          },
        }),
      ).toBe(true);
    });

    // The Anthropic SDK's APIError populates `e.type` at the top level
    // from `body.error.type`, and wraps the raw JSON body in `e.error`
    // as `{ type: 'error', error: { type, message } }`. So `e.error.type`
    // is ALWAYS 'error' (the wire wrapper) — the semantic type lives at
    // `e.type` or `e.error.error.type`. These tests cover the real SDK
    // shape so the classifier doesn't silently miss live errors.
    test('SDK shape: e.type === overloaded_error (top-level)', () => {
      expect(
        isTransientAnthropicError({
          status: 529,
          type: 'overloaded_error',
          error: { type: 'error', error: { type: 'overloaded_error' } },
        }),
      ).toBe(true);
    });

    test('SDK shape: e.type === rate_limit_error (top-level)', () => {
      expect(
        isTransientAnthropicError({
          status: 429,
          type: 'rate_limit_error',
          error: { type: 'error', error: { type: 'rate_limit_error' } },
        }),
      ).toBe(true);
    });

    test('SDK shape: billing 400 with e.type at top + nested message', () => {
      expect(
        isTransientAnthropicError({
          status: 400,
          type: 'invalid_request_error',
          message:
            '400 Your credit balance is too low to access the Anthropic API.',
          error: {
            type: 'error',
            error: {
              type: 'invalid_request_error',
              message:
                'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.',
            },
          },
        }),
      ).toBe(true);
    });

    test('SDK shape: billing 400 message check uses top-level e.message when nested missing', () => {
      expect(
        isTransientAnthropicError({
          status: 400,
          type: 'invalid_request_error',
          message: '400 Your credit balance is too low',
          error: { type: 'error', error: { type: 'invalid_request_error' } },
        }),
      ).toBe(true);
    });

    // Raw body shape: caller passes the response body directly (not
    // wrapped in an APIError). The outer `type: 'error'` wrapper must
    // not lock the classifier — it should look through to the nested
    // semantic type. Codex round 1 caught a regression here when
    // earlier code used `??` (which picks the first truthy value).
    test('raw body shape: outer type:"error" wrapper does not mask inner overloaded_error', () => {
      expect(
        isTransientAnthropicError({
          status: 529,
          type: 'error',
          error: { type: 'error', error: { type: 'overloaded_error' } },
        }),
      ).toBe(true);
    });

    test('raw body shape: outer type:"error" wrapper does not mask billing 400', () => {
      expect(
        isTransientAnthropicError({
          status: 400,
          type: 'error',
          error: {
            type: 'error',
            error: {
              type: 'invalid_request_error',
              message: 'Your credit balance is too low to access the Anthropic API.',
            },
          },
        }),
      ).toBe(true);
    });

    test('raw body shape: outer type:"error" wrapper does not mask api_error without status', () => {
      expect(
        isTransientAnthropicError({
          type: 'error',
          error: { type: 'error', error: { type: 'api_error' } },
        }),
      ).toBe(true);
    });

    test('Node ETIMEDOUT network error', () => {
      expect(isTransientAnthropicError({ code: 'ETIMEDOUT' })).toBe(true);
    });

    test('Node ECONNRESET network error', () => {
      expect(isTransientAnthropicError({ code: 'ECONNRESET' })).toBe(true);
    });

    test('Node ECONNREFUSED network error', () => {
      expect(isTransientAnthropicError({ code: 'ECONNREFUSED' })).toBe(true);
    });

    test('AbortError (fetch timeout aborted)', () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      expect(isTransientAnthropicError(err)).toBe(true);
    });

    test('TimeoutError', () => {
      const err = new Error('request timed out');
      err.name = 'TimeoutError';
      expect(isTransientAnthropicError(err)).toBe(true);
    });
  });

  describe('permanent cases — should propagate, NOT fall back', () => {
    test('401 invalid API key (config error)', () => {
      expect(isTransientAnthropicError({ status: 401 })).toBe(false);
    });

    test('400 bad request (caller sent malformed payload)', () => {
      expect(isTransientAnthropicError({ status: 400 })).toBe(false);
    });

    test('403 forbidden (e.g., model access denied)', () => {
      expect(isTransientAnthropicError({ status: 403 })).toBe(false);
    });

    test('404 not found (e.g., bad model ID)', () => {
      expect(isTransientAnthropicError({ status: 404 })).toBe(false);
    });

    test('413 payload too large', () => {
      expect(isTransientAnthropicError({ status: 413 })).toBe(false);
    });

    test('422 unprocessable entity', () => {
      expect(isTransientAnthropicError({ status: 422 })).toBe(false);
    });

    test('invalid_request_error from Anthropic SDK (no message)', () => {
      expect(
        isTransientAnthropicError({
          status: 400,
          error: { type: 'invalid_request_error' },
        }),
      ).toBe(false);
    });

    test('invalid_request_error with non-billing message → caller bug, NOT transient', () => {
      expect(
        isTransientAnthropicError({
          status: 400,
          error: {
            type: 'invalid_request_error',
            message: 'messages.0.content: must be a string or array',
          },
        }),
      ).toBe(false);
    });

    test('invalid_request_error with empty message → NOT transient', () => {
      expect(
        isTransientAnthropicError({
          status: 400,
          error: { type: 'invalid_request_error', message: '' },
        }),
      ).toBe(false);
    });

    test('authentication_error from Anthropic SDK', () => {
      expect(
        isTransientAnthropicError({
          status: 401,
          error: { type: 'authentication_error' },
        }),
      ).toBe(false);
    });

    test('permission_error from Anthropic SDK', () => {
      expect(
        isTransientAnthropicError({
          status: 403,
          error: { type: 'permission_error' },
        }),
      ).toBe(false);
    });
  });

  describe('malformed inputs — should not crash, classify as NOT transient', () => {
    test('null returns false', () => {
      expect(isTransientAnthropicError(null)).toBe(false);
    });

    test('undefined returns false', () => {
      expect(isTransientAnthropicError(undefined)).toBe(false);
    });

    test('empty object returns false', () => {
      expect(isTransientAnthropicError({})).toBe(false);
    });

    test('string returns false', () => {
      expect(isTransientAnthropicError('error')).toBe(false);
    });

    test('number returns false', () => {
      expect(isTransientAnthropicError(500)).toBe(false);
    });

    test('object with status as string returns false (wrong type)', () => {
      expect(isTransientAnthropicError({ status: '500' })).toBe(false);
    });

    test('plain Error without status returns false', () => {
      expect(isTransientAnthropicError(new Error('something failed'))).toBe(false);
    });

    test('object with unknown error.type returns false', () => {
      expect(
        isTransientAnthropicError({ error: { type: 'something_made_up' } }),
      ).toBe(false);
    });
  });

  describe('boundary cases — exact HTTP status code coverage', () => {
    test('499 (just below 5xx) returns false', () => {
      expect(isTransientAnthropicError({ status: 499 })).toBe(false);
    });

    test('500 (start of 5xx) returns true', () => {
      expect(isTransientAnthropicError({ status: 500 })).toBe(true);
    });

    test('599 (end of 5xx) returns true', () => {
      expect(isTransientAnthropicError({ status: 599 })).toBe(true);
    });

    test('600 (above 5xx) returns false', () => {
      expect(isTransientAnthropicError({ status: 600 })).toBe(false);
    });

    test('200 success — should never be classified as error', () => {
      expect(isTransientAnthropicError({ status: 200 })).toBe(false);
    });
  });
});

// ────────────────────────────────────────────────────────────────
// Model ID mapping coverage
//
// Both maps must have an entry for every ModelTier. A new tier
// added to the type without a Bedrock fallback ID would silently
// route to `undefined` model name → AWS validation error.
// ────────────────────────────────────────────────────────────────

describe('model ID mapping completeness', () => {
  test('every ModelTier has an Anthropic model ID', () => {
    const tiers: Array<keyof typeof _testOnly.ANTHROPIC_MODEL_IDS> = [
      'haiku-4-5',
      'sonnet-4-6',
      'opus-4-7',
    ];
    for (const tier of tiers) {
      expect(_testOnly.ANTHROPIC_MODEL_IDS[tier]).toBeTruthy();
      expect(_testOnly.ANTHROPIC_MODEL_IDS[tier]).toContain('claude');
    }
  });

  test('every ModelTier has a Bedrock model ID', () => {
    const tiers: Array<keyof typeof _testOnly.BEDROCK_MODEL_IDS> = [
      'haiku-4-5',
      'sonnet-4-6',
      'opus-4-7',
    ];
    for (const tier of tiers) {
      expect(_testOnly.BEDROCK_MODEL_IDS[tier]).toBeTruthy();
      // Bedrock IDs use cross-region inference profile prefix `us.`
      expect(_testOnly.BEDROCK_MODEL_IDS[tier]).toMatch(
        /^us\.anthropic\.claude-/,
      );
      expect(_testOnly.BEDROCK_MODEL_IDS[tier]).toMatch(/v1:0$/);
    }
  });
});
