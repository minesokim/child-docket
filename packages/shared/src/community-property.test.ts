// Tests for community property state detection + Form 8958 trigger.
//
// Coverage:
//   - all 9 mandatory community property states detected (AZ CA ID
//     LA NV NM TX WA WI)
//   - common non-community states return false (NY FL OH WY DC etc)
//   - Alaska (opt-in CP) correctly excluded from default trigger
//   - case-insensitive detection (lower / upper / mixed)
//   - whitespace tolerance
//   - requiresForm8958 short-circuits when filing != mfs
//   - requiresForm8958 returns false for missing inputs

import { describe, expect, test } from 'bun:test';
import {
  COMMUNITY_PROPERTY_STATES,
  isCommunityPropertyState,
  requiresForm8958,
} from './community-property.js';

describe('isCommunityPropertyState', () => {
  test('all 9 mandatory CP states detected', () => {
    for (const code of COMMUNITY_PROPERTY_STATES) {
      expect(isCommunityPropertyState(code)).toBe(true);
    }
  });

  test('case insensitive', () => {
    expect(isCommunityPropertyState('ca')).toBe(true);
    expect(isCommunityPropertyState('Ca')).toBe(true);
    expect(isCommunityPropertyState('CA')).toBe(true);
  });

  test('whitespace stripped', () => {
    expect(isCommunityPropertyState(' CA ')).toBe(true);
    expect(isCommunityPropertyState('\tTX\n')).toBe(true);
  });

  test('common non-CP states return false', () => {
    expect(isCommunityPropertyState('NY')).toBe(false);
    expect(isCommunityPropertyState('FL')).toBe(false);
    expect(isCommunityPropertyState('OH')).toBe(false);
    expect(isCommunityPropertyState('PA')).toBe(false);
    expect(isCommunityPropertyState('DC')).toBe(false);
    expect(isCommunityPropertyState('WY')).toBe(false);
    expect(isCommunityPropertyState('GA')).toBe(false);
    expect(isCommunityPropertyState('IL')).toBe(false);
  });

  test('Alaska excluded (opt-in CP, not default)', () => {
    // Alaska allows couples to ELECT community property treatment
    // by agreement, but it's not the state-law default. We don't
    // trigger the Form 8958 flow on Alaska — Antonio handles the
    // rare election manually.
    expect(isCommunityPropertyState('AK')).toBe(false);
  });

  test('empty string returns false', () => {
    expect(isCommunityPropertyState('')).toBe(false);
  });

  test('full state name (not 2-letter) returns false', () => {
    // Caller is responsible for normalizing to 2-letter code before
    // calling this function. The intake-flow helper handles
    // both shapes; this helper is strict on the 2-letter contract.
    expect(isCommunityPropertyState('California')).toBe(false);
  });
});

describe('requiresForm8958', () => {
  test('MFS + CA → true', () => {
    expect(requiresForm8958('mfs', 'CA')).toBe(true);
  });

  test('MFS + each of the 9 CP states → true', () => {
    for (const code of COMMUNITY_PROPERTY_STATES) {
      expect(requiresForm8958('mfs', code)).toBe(true);
    }
  });

  test('MFS + non-CP state → false', () => {
    expect(requiresForm8958('mfs', 'NY')).toBe(false);
    expect(requiresForm8958('mfs', 'FL')).toBe(false);
  });

  test('MFJ + CP state → false (allocation moot on joint return)', () => {
    expect(requiresForm8958('mfj', 'CA')).toBe(false);
    expect(requiresForm8958('mfj', 'TX')).toBe(false);
  });

  test('Single / HoH / QW + CP state → false (not married)', () => {
    expect(requiresForm8958('single', 'CA')).toBe(false);
    expect(requiresForm8958('hoh', 'CA')).toBe(false);
    expect(requiresForm8958('qw', 'CA')).toBe(false);
  });

  test('missing filing status → false', () => {
    expect(requiresForm8958(undefined, 'CA')).toBe(false);
  });

  test('missing state → false', () => {
    expect(requiresForm8958('mfs', undefined)).toBe(false);
    expect(requiresForm8958('mfs', '')).toBe(false);
  });
});
