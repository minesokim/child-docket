// Tests for isEntityOnlyFiling — the gate that determines whether intake
// asks 1040-specific questions (W-2, deductions, etc.) or skips them
// because the filing goes on the entity's own return (1120/1120-S/1065).
//
// Antonio's bug 2026-05-09: corp clients were being asked about W-2
// income. The fix gates /income on service.kind === 'biz' (collected on
// /services, upstream of /income), with refinements when entityType is
// available. These tests lock down the conditional skip so the regression
// can't come back.

import { describe, expect, test } from 'bun:test';
import { isEntityOnlyFiling, type IntakeState } from './intake.js';

describe('isEntityOnlyFiling — biz path with explicit entity-level entityType', () => {
  test('biz path + C-Corp → entity-only', () => {
    const s: IntakeState = { service: { kind: 'biz' }, business: { entityType: 'C-Corp' } };
    expect(isEntityOnlyFiling(s)).toBe(true);
  });

  test('biz path + S-Corp → entity-only', () => {
    const s: IntakeState = { service: { kind: 'biz' }, business: { entityType: 'S-Corp' } };
    expect(isEntityOnlyFiling(s)).toBe(true);
  });

  test('biz path + Partnership → entity-only', () => {
    const s: IntakeState = {
      service: { kind: 'biz' },
      business: { entityType: 'Partnership' },
    };
    expect(isEntityOnlyFiling(s)).toBe(true);
  });

  test('biz path + 1120-S notation → entity-only', () => {
    const s: IntakeState = {
      service: { kind: 'biz' },
      business: { entityType: '1120-S' },
    };
    expect(isEntityOnlyFiling(s)).toBe(true);
  });

  test('biz path + 1065 notation → entity-only', () => {
    const s: IntakeState = {
      service: { kind: 'biz' },
      business: { entityType: 'Form 1065' },
    };
    expect(isEntityOnlyFiling(s)).toBe(true);
  });

  test('biz path + bare LLC → entity-only (default treatment when filing biz return)', () => {
    const s: IntakeState = { service: { kind: 'biz' }, business: { entityType: 'LLC' } };
    expect(isEntityOnlyFiling(s)).toBe(true);
  });

  test('case-insensitive: lowercase "s corp" still entity-only', () => {
    const s: IntakeState = { service: { kind: 'biz' }, business: { entityType: 's corp' } };
    expect(isEntityOnlyFiling(s)).toBe(true);
  });

  test('whitespace tolerated: "  C-Corp  " still entity-only', () => {
    const s: IntakeState = {
      service: { kind: 'biz' },
      business: { entityType: '  C-Corp  ' },
    };
    expect(isEntityOnlyFiling(s)).toBe(true);
  });
});

describe('isEntityOnlyFiling — biz path with empty entityType (Antonio bug)', () => {
  // /business-info is NOT in the canonical forward chain in current intake
  // flow, so entityType is empty when corp clients reach /income. The fix:
  // empty entityType + biz path = entity-only (skip /income).
  test('biz path + no entityType yet → entity-only (the actual production case)', () => {
    const s: IntakeState = { service: { kind: 'biz' } };
    expect(isEntityOnlyFiling(s)).toBe(true);
  });

  test('biz path + empty-string entityType → entity-only', () => {
    const s: IntakeState = { service: { kind: 'biz' }, business: { entityType: '' } };
    expect(isEntityOnlyFiling(s)).toBe(true);
  });

  test('biz path + whitespace-only entityType → entity-only', () => {
    const s: IntakeState = { service: { kind: 'biz' }, business: { entityType: '   ' } };
    expect(isEntityOnlyFiling(s)).toBe(true);
  });
});

describe('isEntityOnlyFiling — individual-grade entities on biz path', () => {
  test('biz path + Sole Prop → individual (Schedule C goes on 1040)', () => {
    const s: IntakeState = {
      service: { kind: 'biz' },
      business: { entityType: 'Sole Prop' },
    };
    expect(isEntityOnlyFiling(s)).toBe(false);
  });

  test('biz path + "Sole Proprietor" (full word) → individual', () => {
    const s: IntakeState = {
      service: { kind: 'biz' },
      business: { entityType: 'Sole Proprietor' },
    };
    expect(isEntityOnlyFiling(s)).toBe(false);
  });

  test('biz path + "Sole Proprietorship" → individual', () => {
    const s: IntakeState = {
      service: { kind: 'biz' },
      business: { entityType: 'Sole Proprietorship' },
    };
    expect(isEntityOnlyFiling(s)).toBe(false);
  });

  test('biz path + "Schedule C" → individual', () => {
    const s: IntakeState = {
      service: { kind: 'biz' },
      business: { entityType: 'Schedule C' },
    };
    expect(isEntityOnlyFiling(s)).toBe(false);
  });

  test('biz path + Disregarded entity → individual', () => {
    const s: IntakeState = {
      service: { kind: 'biz' },
      business: { entityType: 'Disregarded entity' },
    };
    expect(isEntityOnlyFiling(s)).toBe(false);
  });

  test('biz path + "Single Member LLC" → individual (default disregarded)', () => {
    const s: IntakeState = {
      service: { kind: 'biz' },
      business: { entityType: 'Single Member LLC' },
    };
    expect(isEntityOnlyFiling(s)).toBe(false);
  });

  test('biz path + "single-member LLC" hyphenated → individual', () => {
    const s: IntakeState = {
      service: { kind: 'biz' },
      business: { entityType: 'single-member LLC' },
    };
    expect(isEntityOnlyFiling(s)).toBe(false);
  });

  test('biz path + "SMLLC" abbreviation → individual', () => {
    const s: IntakeState = {
      service: { kind: 'biz' },
      business: { entityType: 'SMLLC' },
    };
    expect(isEntityOnlyFiling(s)).toBe(false);
  });
});

describe('isEntityOnlyFiling — corp election overrides default treatment', () => {
  // Single-member LLC that elected S-Corp or C-Corp treatment files 1120-S
  // or 1120 — entity-level. The entity-level keyword scan runs first so the
  // election wins over the default disregarded treatment.
  test('biz path + "Single-member LLC (S-Corp election)" → entity-only', () => {
    const s: IntakeState = {
      service: { kind: 'biz' },
      business: { entityType: 'Single-member LLC (S-Corp election)' },
    };
    expect(isEntityOnlyFiling(s)).toBe(true);
  });

  test('biz path + "SMLLC taxed as C-Corp" → entity-only', () => {
    const s: IntakeState = {
      service: { kind: 'biz' },
      business: { entityType: 'SMLLC taxed as C-Corp' },
    };
    expect(isEntityOnlyFiling(s)).toBe(true);
  });
});

describe('isEntityOnlyFiling — also preparing personal return', () => {
  test('biz path + S-Corp + preparingPersonal=yes → still need 1040 questions', () => {
    const s: IntakeState = {
      service: { kind: 'biz' },
      business: { entityType: 'S-Corp', preparingPersonal: 'yes' },
    };
    expect(isEntityOnlyFiling(s)).toBe(false);
  });

  test('biz path + S-Corp + preparingPersonal=no → entity-only', () => {
    const s: IntakeState = {
      service: { kind: 'biz' },
      business: { entityType: 'S-Corp', preparingPersonal: 'no' },
    };
    expect(isEntityOnlyFiling(s)).toBe(true);
  });

  test('biz path + empty entityType + preparingPersonal=yes → not entity-only', () => {
    const s: IntakeState = {
      service: { kind: 'biz' },
      business: { preparingPersonal: 'yes' },
    };
    expect(isEntityOnlyFiling(s)).toBe(false);
  });
});

describe('isEntityOnlyFiling — non-biz service paths', () => {
  test('personal path → never entity-only', () => {
    const s: IntakeState = { service: { kind: 'personal' } };
    expect(isEntityOnlyFiling(s)).toBe(false);
  });

  test('self path (1099/freelance) → never entity-only', () => {
    const s: IntakeState = { service: { kind: 'self' } };
    expect(isEntityOnlyFiling(s)).toBe(false);
  });

  test('other path (formation/books/strategy) → never entity-only', () => {
    const s: IntakeState = { service: { kind: 'other', otherSub: 'formation' } };
    expect(isEntityOnlyFiling(s)).toBe(false);
  });

  test('personal path + leftover business.entityType (data carryover) → not entity-only', () => {
    // Defensive: if a user changes service.kind from biz back to personal, any
    // stale business.entityType shouldn't accidentally gate them out of /income.
    const s: IntakeState = {
      service: { kind: 'personal' },
      business: { entityType: 'C-Corp' },
    };
    expect(isEntityOnlyFiling(s)).toBe(false);
  });
});

describe('isEntityOnlyFiling — empty / undefined state', () => {
  test('empty state → not entity-only (no service.kind set)', () => {
    expect(isEntityOnlyFiling({})).toBe(false);
  });

  test('service set without kind → not entity-only', () => {
    expect(isEntityOnlyFiling({ service: {} })).toBe(false);
  });
});
