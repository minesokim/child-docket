// Tests for the Position Library v0 catalog + lookup helpers.
//
// Coverage:
//   - Catalog invariants (every entry has IRC section, valid tier,
//     non-empty docs/triggers, refusalIf populated for Tier 3+)
//   - Tier distribution sanity (some across all 4 tiers)
//   - getPositionLibraryEntry by positionType
//   - getPositionsByTier filters correctly
//   - findPositionsByTrigger matches signal+match pairs
//   - compoundConfidence (noisy-OR rule) — boundary + multi-hit cases
//   - Type identity smoke (TaxPosition / DiscoveredPosition compile-time
//     shape match)

import { describe, expect, test } from 'bun:test';
import {
  compoundConfidence,
  findPositionsByTrigger,
  getPositionLibraryEntry,
  getPositionsByTier,
  POSITION_LIBRARY_V0,
  POSITION_TIERS,
  TIER_LABEL,
  TIER_RANK,
} from './positions.js';

describe('POSITION_LIBRARY_V0 catalog invariants', () => {
  test('has at least 20 entries (v0 target)', () => {
    expect(POSITION_LIBRARY_V0.length).toBeGreaterThanOrEqual(20);
  });

  test('every entry has a non-empty IRC section', () => {
    for (const e of POSITION_LIBRARY_V0) {
      expect(e.ircSection.length).toBeGreaterThan(0);
      expect(e.ircSection).toMatch(/^§\d/);
    }
  });

  test('every entry has at least one trigger + one doc-checklist item', () => {
    for (const e of POSITION_LIBRARY_V0) {
      expect(e.triggers.length).toBeGreaterThan(0);
      expect(e.documentationChecklist.length).toBeGreaterThan(0);
    }
  });

  test('every Tier 3 + 4 entry has refusalIf populated', () => {
    for (const e of POSITION_LIBRARY_V0) {
      if (e.tier === 'reasonable_basis' || e.tier === 'more_likely_than_not') {
        expect(e.refusalIf.length).toBeGreaterThan(0);
      }
    }
  });

  test('every Tier 3 + 4 entry requires Form 8275 disclosure', () => {
    for (const e of POSITION_LIBRARY_V0) {
      if (e.tier === 'reasonable_basis' || e.tier === 'more_likely_than_not') {
        expect(e.disclosureRequired).toBe(true);
      }
    }
  });

  test('all 4 tiers represented in v0', () => {
    const tierCounts: Record<string, number> = {};
    for (const e of POSITION_LIBRARY_V0) {
      tierCounts[e.tier] = (tierCounts[e.tier] ?? 0) + 1;
    }
    expect(tierCounts.settled).toBeGreaterThan(0);
    expect(tierCounts.substantial).toBeGreaterThan(0);
    expect(tierCounts.reasonable_basis).toBeGreaterThan(0);
    expect(tierCounts.more_likely_than_not).toBeGreaterThan(0);
  });

  test('positionType is unique across the catalog', () => {
    const seen = new Set<string>();
    for (const e of POSITION_LIBRARY_V0) {
      expect(seen.has(e.positionType)).toBe(false);
      seen.add(e.positionType);
    }
  });

  test('sustainabilityPct is 0-100', () => {
    for (const e of POSITION_LIBRARY_V0) {
      expect(e.baselineSustainabilityPct).toBeGreaterThanOrEqual(0);
      expect(e.baselineSustainabilityPct).toBeLessThanOrEqual(100);
    }
  });

  test('all trigger confidenceBoost values are 0-1', () => {
    for (const e of POSITION_LIBRARY_V0) {
      for (const t of e.triggers) {
        expect(t.confidenceBoost).toBeGreaterThanOrEqual(0);
        expect(t.confidenceBoost).toBeLessThanOrEqual(1);
      }
    }
  });

  test('estimatedSavings range is monotonic (low ≤ high)', () => {
    for (const e of POSITION_LIBRARY_V0) {
      expect(e.estimatedSavingsLow).toBeLessThanOrEqual(e.estimatedSavingsHigh);
    }
  });
});

describe('TIER_RANK + TIER_LABEL', () => {
  test('rank ordering is monotonic', () => {
    expect(TIER_RANK.settled).toBeLessThan(TIER_RANK.substantial);
    expect(TIER_RANK.substantial).toBeLessThan(TIER_RANK.reasonable_basis);
    expect(TIER_RANK.reasonable_basis).toBeLessThan(TIER_RANK.more_likely_than_not);
  });

  test('every tier has a label', () => {
    for (const tier of POSITION_TIERS) {
      expect(TIER_LABEL[tier].length).toBeGreaterThan(0);
    }
  });
});

describe('getPositionLibraryEntry', () => {
  test('returns entry by positionType', () => {
    const aug = getPositionLibraryEntry('augusta_rule_280a_g');
    expect(aug).toBeDefined();
    expect(aug?.tier).toBe('reasonable_basis');
    expect(aug?.ircSection).toBe('§280A(g)');
  });

  test('returns undefined for unknown type', () => {
    expect(getPositionLibraryEntry('not_a_real_position')).toBeUndefined();
  });
});

describe('getPositionsByTier', () => {
  test('filters to a single tier', () => {
    const t3 = getPositionsByTier('reasonable_basis');
    for (const e of t3) {
      expect(e.tier).toBe('reasonable_basis');
    }
    expect(t3.length).toBeGreaterThan(0);
  });

  test('returns empty array for a tier with no entries — but every tier has at least 1', () => {
    for (const tier of POSITION_TIERS) {
      expect(getPositionsByTier(tier).length).toBeGreaterThan(0);
    }
  });
});

describe('findPositionsByTrigger', () => {
  test('matches by signal + match pair', () => {
    const hits = findPositionsByTrigger('income_type', 'self_employment');
    expect(hits.length).toBeGreaterThan(0);
    for (const { trigger } of hits) {
      expect(trigger.signal).toBe('income_type');
      expect(trigger.match).toBe('self_employment');
    }
  });

  test('returns empty for unmatched signals', () => {
    expect(
      findPositionsByTrigger('income_type', 'nonexistent_signal_match'),
    ).toEqual([]);
  });

  test('1098 doc presence surfaces mortgage interest', () => {
    const hits = findPositionsByTrigger('document_present', 'form_1098');
    const mortgageHit = hits.find((h) => h.entry.positionType === 'mortgage_interest');
    expect(mortgageHit).toBeDefined();
  });
});

describe('compoundConfidence (noisy-OR)', () => {
  test('empty array returns 0', () => {
    expect(compoundConfidence([])).toBe(0);
  });

  test('single 0.5 returns 0.5', () => {
    expect(compoundConfidence([0.5])).toBeCloseTo(0.5, 5);
  });

  test('two 0.5s compound to 0.75', () => {
    expect(compoundConfidence([0.5, 0.5])).toBeCloseTo(0.75, 5);
  });

  test('three 0.4s compound to 0.784', () => {
    expect(compoundConfidence([0.4, 0.4, 0.4])).toBeCloseTo(0.784, 3);
  });

  test('clamps boosts > 1 to 1.0 max', () => {
    expect(compoundConfidence([2.0])).toBe(1);
  });

  test('clamps negative boosts to 0', () => {
    expect(compoundConfidence([-1, 0.5])).toBeCloseTo(0.5, 5);
  });

  test('one boost of 1.0 short-circuits to 1.0', () => {
    expect(compoundConfidence([1.0, 0.3])).toBe(1);
  });

  test('compounding is order-independent (noisy-OR is symmetric)', () => {
    const ab = compoundConfidence([0.3, 0.6, 0.4]);
    const ba = compoundConfidence([0.4, 0.3, 0.6]);
    expect(ab).toBeCloseTo(ba, 5);
  });
});
