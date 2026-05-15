// Tests for the Head of Household §2(b) verdict helper. This is the
// audit-defense logic — every branch needs explicit coverage because
// it drives whether Antonio sees a green/amber/red flag on the HoH
// claim before filing.

import { describe, expect, test } from 'bun:test';
import { deriveHohVerdict, type HohQualifyAnswers } from './hoh-qualification.js';

const allYes: HohQualifyAnswers = {
  unmarriedOrConsideredUnmarried: 'yes',
  paidMoreThanHalfHomeCost: 'yes',
  qualifyingPersonLivedWithYou: 'yes',
  qualifyingPersonIsChildOrRelative: 'yes',
};

describe('deriveHohVerdict', () => {
  test('all yes → passes_at_face', () => {
    expect(deriveHohVerdict(allYes)).toBe('passes_at_face');
  });

  test('any single no → fails_at_face', () => {
    expect(
      deriveHohVerdict({ ...allYes, unmarriedOrConsideredUnmarried: 'no' }),
    ).toBe('fails_at_face');
    expect(deriveHohVerdict({ ...allYes, paidMoreThanHalfHomeCost: 'no' })).toBe(
      'fails_at_face',
    );
    expect(
      deriveHohVerdict({
        ...allYes,
        qualifyingPersonLivedWithYou: 'no',
        // Parent-exception follow-up is now required when
        // livedWithYou='no'. With isParent='no' the cohabitation
        // failure stands.
        qualifyingPersonIsParent: 'no',
      }),
    ).toBe('fails_at_face');
    expect(
      deriveHohVerdict({ ...allYes, qualifyingPersonIsChildOrRelative: 'no' }),
    ).toBe('fails_at_face');
  });

  test('no short-circuits not_sure (no wins)', () => {
    expect(
      deriveHohVerdict({
        unmarriedOrConsideredUnmarried: 'no',
        paidMoreThanHalfHomeCost: 'not_sure',
        qualifyingPersonLivedWithYou: 'yes',
        qualifyingPersonIsChildOrRelative: 'yes',
      }),
    ).toBe('fails_at_face');
  });

  test('any not_sure (no nos) → uncertain', () => {
    expect(
      deriveHohVerdict({ ...allYes, paidMoreThanHalfHomeCost: 'not_sure' }),
    ).toBe('uncertain');
  });

  test('any missing answer → incomplete', () => {
    expect(
      deriveHohVerdict({
        unmarriedOrConsideredUnmarried: 'yes',
        paidMoreThanHalfHomeCost: 'yes',
        qualifyingPersonLivedWithYou: 'yes',
        // qualifyingPersonIsChildOrRelative missing
      }),
    ).toBe('incomplete');
  });

  test('undefined answers obj → incomplete', () => {
    expect(deriveHohVerdict(undefined)).toBe('incomplete');
  });

  test('empty-string answer treated as missing → incomplete', () => {
    // Empty string lands in state when the field is initialized via
    // useIntakeField('', '') but hasn't been touched yet. The helper
    // must treat it as missing (incomplete), not as a valid answer.
    expect(
      deriveHohVerdict({
        unmarriedOrConsideredUnmarried: 'yes',
        paidMoreThanHalfHomeCost: 'yes',
        qualifyingPersonLivedWithYou: 'yes',
        qualifyingPersonIsChildOrRelative: '' as 'yes',
      }),
    ).toBe('incomplete');
  });

  test('verdict is idempotent', () => {
    const v1 = deriveHohVerdict(allYes);
    const v2 = deriveHohVerdict(allYes);
    expect(v1).toBe(v2);
  });

  test('not_sure dominates yes (no fully-yes blockers)', () => {
    expect(
      deriveHohVerdict({
        unmarriedOrConsideredUnmarried: 'not_sure',
        paidMoreThanHalfHomeCost: 'not_sure',
        qualifyingPersonLivedWithYou: 'not_sure',
        qualifyingPersonIsChildOrRelative: 'not_sure',
      }),
    ).toBe('uncertain');
  });

  // ─── §2(b)(1)(B) parent-exception path ────────────────────────────
  describe('parent exception', () => {
    test('livedWithYou=no + isParent=yes → uncertain, not fails_at_face', () => {
      // Real-world: client supports an elderly parent in a separate
      // home. §2(b)(1)(B) allows HoH if taxpayer paid >half the cost
      // of parent's home. We route to uncertain so Antonio verifies.
      expect(
        deriveHohVerdict({
          unmarriedOrConsideredUnmarried: 'yes',
          paidMoreThanHalfHomeCost: 'yes',
          qualifyingPersonLivedWithYou: 'no',
          qualifyingPersonIsParent: 'yes',
          qualifyingPersonIsChildOrRelative: 'yes',
        }),
      ).toBe('uncertain');
    });

    test('livedWithYou=no + isParent=no → fails_at_face', () => {
      // Cohabitation 'no' with non-parent qualifying person genuinely
      // fails the §2(b) residency test.
      expect(
        deriveHohVerdict({
          unmarriedOrConsideredUnmarried: 'yes',
          paidMoreThanHalfHomeCost: 'yes',
          qualifyingPersonLivedWithYou: 'no',
          qualifyingPersonIsParent: 'no',
          qualifyingPersonIsChildOrRelative: 'yes',
        }),
      ).toBe('fails_at_face');
    });

    test('livedWithYou=no + isParent=not_sure → fails_at_face', () => {
      // Conservative posture: if the client isn't sure the qualifying
      // person is a parent, we don't grant them the §2(b)(1)(B)
      // exception. Antonio asks.
      expect(
        deriveHohVerdict({
          unmarriedOrConsideredUnmarried: 'yes',
          paidMoreThanHalfHomeCost: 'yes',
          qualifyingPersonLivedWithYou: 'no',
          qualifyingPersonIsParent: 'not_sure',
          qualifyingPersonIsChildOrRelative: 'yes',
        }),
      ).toBe('fails_at_face');
    });

    test('livedWithYou=no + isParent unset → incomplete', () => {
      // Follow-up required when livedWithYou='no'. Verdict cannot
      // resolve until the client answers the parent-exception
      // question.
      expect(
        deriveHohVerdict({
          unmarriedOrConsideredUnmarried: 'yes',
          paidMoreThanHalfHomeCost: 'yes',
          qualifyingPersonLivedWithYou: 'no',
          qualifyingPersonIsChildOrRelative: 'yes',
        }),
      ).toBe('incomplete');
    });

    test('livedWithYou=yes: isParent is ignored', () => {
      // When the qualifying person actually lives with the taxpayer,
      // the parent-exception follow-up is irrelevant. isParent value
      // (or absence) does not affect the verdict.
      expect(
        deriveHohVerdict({
          unmarriedOrConsideredUnmarried: 'yes',
          paidMoreThanHalfHomeCost: 'yes',
          qualifyingPersonLivedWithYou: 'yes',
          qualifyingPersonIsChildOrRelative: 'yes',
        }),
      ).toBe('passes_at_face');
      // Same outcome with isParent set to anything.
      expect(
        deriveHohVerdict({
          unmarriedOrConsideredUnmarried: 'yes',
          paidMoreThanHalfHomeCost: 'yes',
          qualifyingPersonLivedWithYou: 'yes',
          qualifyingPersonIsParent: 'no',
          qualifyingPersonIsChildOrRelative: 'yes',
        }),
      ).toBe('passes_at_face');
    });

    test('livedWithYou=not_sure: isParent is ignored', () => {
      expect(
        deriveHohVerdict({
          unmarriedOrConsideredUnmarried: 'yes',
          paidMoreThanHalfHomeCost: 'yes',
          qualifyingPersonLivedWithYou: 'not_sure',
          qualifyingPersonIsChildOrRelative: 'yes',
        }),
      ).toBe('uncertain');
    });
  });
});
