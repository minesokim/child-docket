// Tests for requiredDocsFor — specifically the stale-income-types leak
// when service path flips from personal → biz mid-intake.
//
// The forward-flow gate (commit faaa579) prevents fresh biz-path intakes
// from seeing /income at all. This test covers the read-time output gate
// for the path-flip scenario: state.income.types persists in JSONB even
// after the user backtracks and switches to a biz path, so the docs
// checklist still asked for W-2 etc. for corp clients. Fixed in this
// commit by short-circuiting incomeTypes to [] when isEntityOnlyFiling.

import { describe, expect, test } from 'bun:test';
import { requiredDocsFor } from './required-docs.js';
import type { IntakeState } from './intake.js';

const baseState = (overrides: Partial<IntakeState> = {}): IntakeState => ({
  ...overrides,
}) as IntakeState;

describe('requiredDocsFor — stale income leak on service-path flip', () => {
  test('biz path with C-Corp entityType: 1040 income docs suppressed even with stale W-2 in state', () => {
    const state = baseState({
      service: { kind: 'biz' },
      business: { entityType: 'C-Corp' },
      personal: { fullName: 'Antonio Vazquez' },
      // Stale from a prior personal-path session — should be ignored
      income: { types: ['w2', 'self', 'invest'] },
    });
    const docs = requiredDocsFor(state);
    const ids = docs.map((d) => d.id);
    expect(ids).not.toContain('income-w2');
    expect(ids).not.toContain('income-1099nec');
    expect(ids).not.toContain('income-1099int');
    expect(ids).not.toContain('income-1099div');
    expect(ids).not.toContain('income-brokerage');
    // Identity docs still required for the signing officer
    expect(ids).toContain('identity-dl');
    expect(ids).toContain('identity-ssn');
  });

  test('biz path with S-Corp entityType: same suppression', () => {
    const state = baseState({
      service: { kind: 'biz' },
      business: { entityType: 'S-Corp' },
      personal: { fullName: 'Officer Name' },
      income: { types: ['w2'] },
    });
    const ids = requiredDocsFor(state).map((d) => d.id);
    expect(ids).not.toContain('income-w2');
    expect(ids).toContain('identity-dl');
  });

  test('biz path with Partnership entityType: same suppression', () => {
    const state = baseState({
      service: { kind: 'biz' },
      business: { entityType: 'Partnership' },
      personal: { fullName: 'Managing Partner' },
      income: { types: ['w2', 'self'] },
    });
    const ids = requiredDocsFor(state).map((d) => d.id);
    expect(ids).not.toContain('income-w2');
    expect(ids).not.toContain('income-1099nec');
  });

  test('biz path with empty entityType (the actual Antonio bug): entity-only by default per service.kind=biz', () => {
    const state = baseState({
      service: { kind: 'biz' },
      business: { entityType: '' },
      personal: { fullName: 'Antonio Vazquez' },
      income: { types: ['w2'] },
    });
    const ids = requiredDocsFor(state).map((d) => d.id);
    expect(ids).not.toContain('income-w2');
  });

  test('personal path with W-2: W-2 doc still surfaces (regression check — no over-suppression)', () => {
    const state = baseState({
      service: { kind: 'personal' },
      personal: { fullName: 'Jane Doe' },
      income: { types: ['w2'] },
    });
    const ids = requiredDocsFor(state).map((d) => d.id);
    expect(ids).toContain('income-w2');
    expect(ids).toContain('identity-dl');
  });

  test('personal path with no income types yet: identity docs only', () => {
    const state = baseState({
      service: { kind: 'personal' },
      personal: { fullName: 'New Client' },
    });
    const ids = requiredDocsFor(state).map((d) => d.id);
    expect(ids).toContain('identity-dl');
    expect(ids).toContain('identity-ssn');
    expect(ids).not.toContain('income-w2');
  });

  test('biz path with Sole-Prop entityType: NOT entity-only (Schedule C is 1040), W-2 still surfaces', () => {
    const state = baseState({
      service: { kind: 'biz' },
      business: { entityType: 'Sole Prop' },
      personal: { fullName: 'Sole Trader' },
      income: { types: ['w2', 'self'] },
    });
    const ids = requiredDocsFor(state).map((d) => d.id);
    // Sole-prop is 1040 / Schedule C — entity-only gate should NOT fire
    expect(ids).toContain('income-w2');
    expect(ids).toContain('income-1099nec');
  });
});
