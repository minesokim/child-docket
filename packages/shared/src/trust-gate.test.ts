// Tests for the trust-gate enforcement helper.

import { describe, expect, test } from 'bun:test';
import { assertTrustGate, isAllowedByTrustGate, type TrustGateInput } from './trust-gate.js';

describe('assertTrustGate / always-EA action classes', () => {
  test('mutate-tax-software always EA regardless of trust level + tier', () => {
    for (const trustLevel of [1, 2, 3, 4] as const) {
      for (const positionTier of [1, 2, 3, 4] as const) {
        const d = assertTrustGate({
          trustLevel,
          positionTier,
          actionClass: 'mutate-tax-software',
        });
        expect(d.allowed).toBe(false);
        if (!d.allowed) expect(d.requires).toBe('human-approval');
      }
    }
  });

  test('file always EA regardless of trust level + tier', () => {
    for (const trustLevel of [1, 2, 3, 4] as const) {
      const d = assertTrustGate({ trustLevel, actionClass: 'file' });
      expect(d.allowed).toBe(false);
      if (!d.allowed) expect(d.requires).toBe('human-approval');
    }
  });
});

describe('assertTrustGate / never-gated action classes', () => {
  test('read passes at every trust level', () => {
    for (const trustLevel of [1, 2, 3, 4] as const) {
      expect(assertTrustGate({ trustLevel, actionClass: 'read' }).allowed).toBe(true);
    }
  });

  test('classify, draft, send-internal, mutate-intake all pass', () => {
    const passes: TrustGateInput['actionClass'][] = [
      'classify',
      'draft',
      'send-internal',
      'mutate-intake',
    ];
    for (const actionClass of passes) {
      expect(assertTrustGate({ trustLevel: 1, actionClass }).allowed).toBe(true);
      expect(assertTrustGate({ trustLevel: 4, actionClass }).allowed).toBe(true);
    }
  });
});

describe('assertTrustGate / send-external + position tier', () => {
  test('Level 1: every tier requires EA', () => {
    for (const tier of [1, 2, 3, 4] as const) {
      const d = assertTrustGate({
        trustLevel: 1,
        actionClass: 'send-external',
        positionTier: tier,
      });
      expect(d.allowed).toBe(false);
      if (!d.allowed) expect(d.requires).toBe('human-approval');
    }
  });

  test('Level 2: tier 1 auto, tier 2-4 EA', () => {
    const auto = assertTrustGate({ trustLevel: 2, actionClass: 'send-external', positionTier: 1 });
    expect(auto.allowed).toBe(true);
    for (const tier of [2, 3, 4] as const) {
      const d = assertTrustGate({ trustLevel: 2, actionClass: 'send-external', positionTier: tier });
      expect(d.allowed).toBe(false);
    }
  });

  test('Level 3: tier 1-2 auto, tier 3-4 EA', () => {
    expect(assertTrustGate({ trustLevel: 3, actionClass: 'send-external', positionTier: 1 }).allowed).toBe(true);
    expect(assertTrustGate({ trustLevel: 3, actionClass: 'send-external', positionTier: 2 }).allowed).toBe(true);
    expect(assertTrustGate({ trustLevel: 3, actionClass: 'send-external', positionTier: 3 }).allowed).toBe(false);
    expect(assertTrustGate({ trustLevel: 3, actionClass: 'send-external', positionTier: 4 }).allowed).toBe(false);
  });

  test('Level 4: tier 1-2 auto, tier 3 flag (still allowed), tier 4 EA', () => {
    expect(assertTrustGate({ trustLevel: 4, actionClass: 'send-external', positionTier: 1 }).allowed).toBe(true);
    expect(assertTrustGate({ trustLevel: 4, actionClass: 'send-external', positionTier: 2 }).allowed).toBe(true);
    // Tier 3 at L4 = "flag" = auto-execute with default 8275 disclosure.
    // Decision is allowed=true; the disclosure is the agent's responsibility
    // to attach.
    expect(assertTrustGate({ trustLevel: 4, actionClass: 'send-external', positionTier: 3 }).allowed).toBe(true);
    expect(assertTrustGate({ trustLevel: 4, actionClass: 'send-external', positionTier: 4 }).allowed).toBe(false);
  });

  test('below-floor (tier 5) refuses at every trust level', () => {
    for (const trustLevel of [1, 2, 3, 4] as const) {
      const d = assertTrustGate({ trustLevel, actionClass: 'send-external', positionTier: 5 });
      expect(d.allowed).toBe(false);
      if (!d.allowed) expect(d.requires).toBe('refusal');
    }
  });
});

describe('assertTrustGate / send-external without position tier', () => {
  test('Level 1: requires EA (drafts always need approval)', () => {
    const d = assertTrustGate({ trustLevel: 1, actionClass: 'send-external' });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.requires).toBe('human-approval');
  });

  test('Level 2-4: auto-allowed (non-position generic comms)', () => {
    for (const trustLevel of [2, 3, 4] as const) {
      const d = assertTrustGate({ trustLevel, actionClass: 'send-external' });
      expect(d.allowed).toBe(true);
    }
  });
});

describe('isAllowedByTrustGate convenience', () => {
  test('returns true/false matching assertTrustGate.allowed', () => {
    expect(isAllowedByTrustGate({ trustLevel: 1, actionClass: 'read' })).toBe(true);
    expect(isAllowedByTrustGate({ trustLevel: 1, actionClass: 'file' })).toBe(false);
    expect(
      isAllowedByTrustGate({ trustLevel: 4, actionClass: 'send-external', positionTier: 2 }),
    ).toBe(true);
  });
});

describe('assertTrustGate / decision rationale', () => {
  test('EA decision includes explanation referencing the trust level + tier', () => {
    const d = assertTrustGate({ trustLevel: 1, actionClass: 'send-external', positionTier: 2 });
    if (d.allowed) throw new Error('expected blocked');
    expect(d.reason.toLowerCase()).toContain('tier');
    expect(d.reason.toLowerCase()).toContain('approval');
  });

  test('refusal decision references the framework floor', () => {
    const d = assertTrustGate({ trustLevel: 4, actionClass: 'send-external', positionTier: 5 });
    if (d.allowed) throw new Error('expected blocked');
    expect(d.reason.toLowerCase()).toContain('refusal');
  });

  test('always-EA decision references the action class', () => {
    const d = assertTrustGate({ trustLevel: 4, actionClass: 'file', positionTier: 1 });
    if (d.allowed) throw new Error('expected blocked');
    expect(d.reason).toContain('file');
  });
});
