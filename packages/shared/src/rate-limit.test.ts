// Token-bucket rate limiter tests. Verifies the consume/refill behavior
// + the time-based window expiry. We use Date.now mocking to make
// time-window assertions deterministic.

import { afterEach, describe, expect, test } from 'bun:test';
import { clearRateLimits, consumeRateToken } from './rate-limit.js';

afterEach(() => {
  clearRateLimits();
});

describe('consumeRateToken — basic budget consumption', () => {
  test('first N calls within window are allowed', () => {
    for (let i = 0; i < 5; i++) {
      expect(consumeRateToken('test-key', 5, 60_000).allowed).toBe(true);
    }
  });

  test('N+1th call is denied with retryAfterMs', () => {
    for (let i = 0; i < 5; i++) consumeRateToken('test-key', 5, 60_000);
    const result = consumeRateToken('test-key', 5, 60_000);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterMs).toBeGreaterThan(0);
      expect(result.retryAfterMs).toBeLessThanOrEqual(60_000);
    }
  });
});

describe('consumeRateToken — independent keys', () => {
  test('different keys have independent budgets', () => {
    for (let i = 0; i < 5; i++) consumeRateToken('user-A', 5, 60_000);
    // user-A is exhausted; user-B should still work.
    expect(consumeRateToken('user-A', 5, 60_000).allowed).toBe(false);
    expect(consumeRateToken('user-B', 5, 60_000).allowed).toBe(true);
  });
});

describe('consumeRateToken — window refill', () => {
  test('refills after the window expires', () => {
    const realNow = Date.now;
    let mockedNow = 1_700_000_000_000; // some fixed t0
    Date.now = () => mockedNow;

    try {
      // Burn the budget at t0.
      for (let i = 0; i < 3; i++) consumeRateToken('refill-key', 3, 1000);
      expect(consumeRateToken('refill-key', 3, 1000).allowed).toBe(false);

      // Advance past the window.
      mockedNow += 1500;
      // Should refill on next call.
      expect(consumeRateToken('refill-key', 3, 1000).allowed).toBe(true);
      expect(consumeRateToken('refill-key', 3, 1000).allowed).toBe(true);
      expect(consumeRateToken('refill-key', 3, 1000).allowed).toBe(true);
      expect(consumeRateToken('refill-key', 3, 1000).allowed).toBe(false);
    } finally {
      Date.now = realNow;
    }
  });
});
