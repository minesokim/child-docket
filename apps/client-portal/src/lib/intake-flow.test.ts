// ────────────────────────────────────────────────────────────────
// Tests for the declarative intake flow graph.
//
// The flow file is the single source of truth for all conditional
// routing in the 25-step intake. A regression in any branch could
// strand a real client mid-intake. These tests lock down every
// branch + edge case so refactors don't silently break flow.
//
// Run: bun test from apps/client-portal/
// ────────────────────────────────────────────────────────────────

import { describe, test, expect } from 'bun:test';
import type { IntakeState } from '@docket/shared';
import {
  INTAKE_FLOW,
  getNextStep,
  getPrevStep,
  getResumeStep,
  getApplicableSteps,
  getStepProgress,
  getStep,
  isIntakeComplete,
} from './intake-flow';

// ────────────────────────────────────────────────────────────────
// Helpers - common state fixtures
// ────────────────────────────────────────────────────────────────

const empty: IntakeState = {};

const singleNoDeps: IntakeState = {
  filing: { status: 'single' },
  dependents: { count: 0 },
};

const mfjNoDeps: IntakeState = {
  filing: { status: 'mfj' },
  dependents: { count: 0 },
};

const mfjWithDeps: IntakeState = {
  filing: { status: 'mfj' },
  dependents: { count: 2 },
};

const w2Only: IntakeState = { income: { types: ['w2'] } };
const selfOnly: IntakeState = { income: { types: ['self'] } };
const rentalOnly: IntakeState = { income: { types: ['rental'] } };
const selfPlusRental: IntakeState = { income: { types: ['self', 'rental'] } };

// ────────────────────────────────────────────────────────────────
// getNextStep - every branch
// ────────────────────────────────────────────────────────────────

describe('getNextStep - happy linear path', () => {
  test('welcome → quick-start', () => {
    expect(getNextStep('/welcome', empty)).toBe('/quick-start');
  });
  test('quick-start → tutorial', () => {
    expect(getNextStep('/quick-start', empty)).toBe('/tutorial');
  });
  test('tutorial → services', () => {
    expect(getNextStep('/tutorial', empty)).toBe('/services');
  });
  test('services → services-addons', () => {
    expect(getNextStep('/services', empty)).toBe('/services-addons');
  });
  test('services-addons → personal', () => {
    expect(getNextStep('/services-addons', empty)).toBe('/personal');
  });
  test('personal → state', () => {
    expect(getNextStep('/personal', empty)).toBe('/state');
  });
  test('state → filing', () => {
    expect(getNextStep('/state', empty)).toBe('/filing');
  });
});

describe('getNextStep - filing branches on status', () => {
  test('mfj → spouse', () => {
    expect(getNextStep('/filing', { filing: { status: 'mfj' } })).toBe('/spouse');
  });
  test('mfs → spouse', () => {
    expect(getNextStep('/filing', { filing: { status: 'mfs' } })).toBe('/spouse');
  });
  test('single → deps (skips spouse)', () => {
    expect(getNextStep('/filing', { filing: { status: 'single' } })).toBe('/deps');
  });
  test('hoh → deps (skips spouse)', () => {
    expect(getNextStep('/filing', { filing: { status: 'hoh' } })).toBe('/deps');
  });
  test('qw → deps (skips spouse)', () => {
    expect(getNextStep('/filing', { filing: { status: 'qw' } })).toBe('/deps');
  });
});

describe('getNextStep - spouse always goes to deps', () => {
  test('spouse → deps', () => {
    expect(getNextStep('/spouse', mfjNoDeps)).toBe('/deps');
  });
});

describe('getNextStep - deps branches on count', () => {
  test('count=0 → income (skips deps-detail)', () => {
    expect(getNextStep('/deps', singleNoDeps)).toBe('/income');
  });
  test('count=1 → deps-detail', () => {
    expect(getNextStep('/deps', { dependents: { count: 1 } })).toBe('/deps-detail');
  });
  test('count=5 → deps-detail', () => {
    expect(getNextStep('/deps', { dependents: { count: 5 } })).toBe('/deps-detail');
  });
  test('undefined count defaults to 0 → income', () => {
    expect(getNextStep('/deps', empty)).toBe('/income');
  });
});

describe('getNextStep - deps-detail always goes to income', () => {
  test('deps-detail → income', () => {
    expect(getNextStep('/deps-detail', mfjWithDeps)).toBe('/income');
  });
});

describe('getNextStep - income branches on selected types', () => {
  test('w2 only → tax-questions', () => {
    expect(getNextStep('/income', w2Only)).toBe('/tax-questions');
  });
  test('self → self-employment', () => {
    expect(getNextStep('/income', selfOnly)).toBe('/self-employment');
  });
  test('rental → rental-detail', () => {
    expect(getNextStep('/income', rentalOnly)).toBe('/rental-detail');
  });
  test('self + rental → self-employment first (rental visited later)', () => {
    expect(getNextStep('/income', selfPlusRental)).toBe('/self-employment');
  });
  test('w2 + retire → tax-questions (no detail pages)', () => {
    expect(getNextStep('/income', { income: { types: ['w2', 'retire'] } })).toBe(
      '/tax-questions',
    );
  });
  test('empty income → tax-questions (defensive)', () => {
    expect(getNextStep('/income', { income: { types: [] } })).toBe('/tax-questions');
  });
});

describe('getNextStep - self-employment branches on rental presence', () => {
  test('self only → tax-questions', () => {
    expect(getNextStep('/self-employment', selfOnly)).toBe('/tax-questions');
  });
  test('self + rental → rental-detail', () => {
    expect(getNextStep('/self-employment', selfPlusRental)).toBe('/rental-detail');
  });
});

describe('getNextStep - rental-detail always goes to tax-questions', () => {
  test('rental-detail → tax-questions', () => {
    expect(getNextStep('/rental-detail', rentalOnly)).toBe('/tax-questions');
  });
  test('rental-detail → tax-questions even if self also present', () => {
    expect(getNextStep('/rental-detail', selfPlusRental)).toBe('/tax-questions');
  });
});

describe('getNextStep - back half of flow', () => {
  test('tax-questions → deductions', () => {
    expect(getNextStep('/tax-questions', empty)).toBe('/deductions');
  });
  test('deductions → life-events', () => {
    expect(getNextStep('/deductions', empty)).toBe('/life-events');
  });
  test('life-events → refund', () => {
    expect(getNextStep('/life-events', empty)).toBe('/refund');
  });
  test('refund → docs', () => {
    expect(getNextStep('/refund', empty)).toBe('/docs');
  });
  test('docs → engagement (contact-info already at top of flow)', () => {
    expect(getNextStep('/docs', empty)).toBe('/engagement');
  });
  test('engagement → consent', () => {
    expect(getNextStep('/engagement', empty)).toBe('/consent');
  });
  test('consent → appt', () => {
    expect(getNextStep('/consent', empty)).toBe('/appt');
  });
  test('appt → deposit', () => {
    expect(getNextStep('/appt', empty)).toBe('/deposit');
  });
  test('deposit → done', () => {
    expect(getNextStep('/deposit', empty)).toBe('/done');
  });
  test('done → null (end of flow)', () => {
    expect(getNextStep('/done', empty)).toBeNull();
  });
});

describe('getNextStep - defensive: unknown route', () => {
  test('unknown route returns null', () => {
    expect(getNextStep('/totally-fake-route', empty)).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────
// getPrevStep - back-nav respects applicable filtering
// ────────────────────────────────────────────────────────────────

describe('getPrevStep - back-nav skips inapplicable steps', () => {
  test('welcome has no prev (start of flow)', () => {
    expect(getPrevStep('/welcome', empty)).toBeNull();
  });
  test('quick-start → welcome', () => {
    expect(getPrevStep('/quick-start', empty)).toBe('/welcome');
  });
  test('tutorial → quick-start', () => {
    expect(getPrevStep('/tutorial', empty)).toBe('/quick-start');
  });
  test('services → tutorial', () => {
    expect(getPrevStep('/services', empty)).toBe('/tutorial');
  });
  test('personal → services-addons', () => {
    expect(getPrevStep('/personal', empty)).toBe('/services-addons');
  });
  test('deps from single user → filing (skips inapplicable spouse)', () => {
    expect(getPrevStep('/deps', singleNoDeps)).toBe('/filing');
  });
  test('deps from mfj user → spouse', () => {
    expect(getPrevStep('/deps', mfjWithDeps)).toBe('/spouse');
  });
  test('income from 0-deps user → deps (skips inapplicable deps-detail)', () => {
    expect(getPrevStep('/income', singleNoDeps)).toBe('/deps');
  });
  test('income from N-deps user → deps-detail', () => {
    expect(getPrevStep('/income', mfjWithDeps)).toBe('/deps-detail');
  });
  test('tax-questions from w2 user → income (skips self-employment + rental-detail)', () => {
    expect(getPrevStep('/tax-questions', { ...singleNoDeps, ...w2Only })).toBe('/income');
  });
  test('tax-questions from self-only user → self-employment', () => {
    expect(getPrevStep('/tax-questions', { ...singleNoDeps, ...selfOnly })).toBe(
      '/self-employment',
    );
  });
  test('tax-questions from rental-only user → rental-detail', () => {
    expect(getPrevStep('/tax-questions', { ...singleNoDeps, ...rentalOnly })).toBe(
      '/rental-detail',
    );
  });
});

// ────────────────────────────────────────────────────────────────
// isApplicable - side-path gating
// ────────────────────────────────────────────────────────────────

describe('isApplicable - side paths gated correctly', () => {
  test('spouse applicable iff mfj or mfs', () => {
    expect(getStep('/spouse')!.isApplicable({ filing: { status: 'mfj' } })).toBe(true);
    expect(getStep('/spouse')!.isApplicable({ filing: { status: 'mfs' } })).toBe(true);
    expect(getStep('/spouse')!.isApplicable({ filing: { status: 'single' } })).toBe(false);
    expect(getStep('/spouse')!.isApplicable({ filing: { status: 'hoh' } })).toBe(false);
    expect(getStep('/spouse')!.isApplicable(empty)).toBe(false);
  });

  test('deps-detail applicable iff count > 0', () => {
    expect(getStep('/deps-detail')!.isApplicable({ dependents: { count: 1 } })).toBe(true);
    expect(getStep('/deps-detail')!.isApplicable({ dependents: { count: 5 } })).toBe(true);
    expect(getStep('/deps-detail')!.isApplicable({ dependents: { count: 0 } })).toBe(false);
    expect(getStep('/deps-detail')!.isApplicable(empty)).toBe(false);
  });

  test('self-employment applicable iff "self" in income types', () => {
    expect(getStep('/self-employment')!.isApplicable(selfOnly)).toBe(true);
    expect(getStep('/self-employment')!.isApplicable(selfPlusRental)).toBe(true);
    expect(getStep('/self-employment')!.isApplicable(w2Only)).toBe(false);
    expect(getStep('/self-employment')!.isApplicable(rentalOnly)).toBe(false);
    expect(getStep('/self-employment')!.isApplicable(empty)).toBe(false);
  });

  test('rental-detail applicable iff "rental" in income types', () => {
    expect(getStep('/rental-detail')!.isApplicable(rentalOnly)).toBe(true);
    expect(getStep('/rental-detail')!.isApplicable(selfPlusRental)).toBe(true);
    expect(getStep('/rental-detail')!.isApplicable(selfOnly)).toBe(false);
    expect(getStep('/rental-detail')!.isApplicable(w2Only)).toBe(false);
    expect(getStep('/rental-detail')!.isApplicable(empty)).toBe(false);
  });

  test('business-info applicable iff service.kind = biz', () => {
    expect(getStep('/business-info')!.isApplicable({ service: { kind: 'biz' } })).toBe(true);
    expect(getStep('/business-info')!.isApplicable({ service: { kind: 'self' } })).toBe(false);
    expect(getStep('/business-info')!.isApplicable({ service: { kind: 'personal' } })).toBe(
      false,
    );
    expect(getStep('/business-info')!.isApplicable(empty)).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────
// getResumeStep - first applicable + incomplete
// ────────────────────────────────────────────────────────────────

describe('getResumeStep', () => {
  test('empty state → quick-start (welcome is always pass-through)', () => {
    // welcome.isComplete() === true always; quick-start needs name+DOB+email.
    expect(getResumeStep(empty)).toBe('/quick-start');
  });

  test('quick-start filled, tutorial not complete → tutorial', () => {
    const state: IntakeState = {
      personal: { fullName: 'A B', dateOfBirth: '1990-01-01', email: 'a@b.com' },
    };
    expect(getResumeStep(state)).toBe('/tutorial');
  });

  test('through filing complete, single → deps', () => {
    const state: IntakeState = {
      tutorial: { completed: true },
      service: { kind: 'personal' },
      personal: { fullName: 'A B', dateOfBirth: '1990-01-01', email: 'a@b.com', ssn: '123' },
      state: { primaryState: 'California' },
      filing: { status: 'single' },
    };
    expect(getResumeStep(state)).toBe('/deps');
  });

  test('through deps complete, no income yet → income', () => {
    const state: IntakeState = {
      tutorial: { completed: true },
      service: { kind: 'personal' },
      personal: { fullName: 'A B', dateOfBirth: '1990-01-01', email: 'a@b.com', ssn: '123' },
      state: { primaryState: 'California' },
      filing: { status: 'single' },
      dependents: { count: 0 },
    };
    expect(getResumeStep(state)).toBe('/income');
  });
});

// ────────────────────────────────────────────────────────────────
// getApplicableSteps - count varies by state
// ────────────────────────────────────────────────────────────────

describe('getApplicableSteps', () => {
  test('w2-only single user with no deps has fewer steps than mfj-with-deps-and-self', () => {
    const simple = getApplicableSteps({
      filing: { status: 'single' },
      dependents: { count: 0 },
      income: { types: ['w2'] },
    });
    const complex = getApplicableSteps({
      filing: { status: 'mfj' },
      dependents: { count: 2 },
      income: { types: ['self', 'rental'] },
    });
    expect(simple.length).toBeLessThan(complex.length);
  });

  test('side paths only appear when applicable', () => {
    const simple = getApplicableSteps(singleNoDeps);
    const routes = simple.map((s) => s.route);
    expect(routes).not.toContain('/spouse');
    expect(routes).not.toContain('/deps-detail');
    expect(routes).not.toContain('/self-employment');
    expect(routes).not.toContain('/rental-detail');
    expect(routes).not.toContain('/business-info');
    expect(routes).not.toContain('/business-formation');
    expect(routes).not.toContain('/strategic-topics');
  });
});

// ────────────────────────────────────────────────────────────────
// getStepProgress - "step N of M"
// ────────────────────────────────────────────────────────────────

describe('getStepProgress', () => {
  test('first step shows 1 of N', () => {
    const p = getStepProgress('/welcome', empty);
    expect(p.current).toBe(1);
    expect(p.total).toBeGreaterThan(0);
  });

  test('total varies with state (fewer applicable steps = smaller denominator)', () => {
    const simple = getStepProgress('/welcome', singleNoDeps);
    const complex = getStepProgress('/welcome', {
      filing: { status: 'mfj' },
      dependents: { count: 2 },
      income: { types: ['self', 'rental'] },
    });
    expect(simple.total).toBeLessThan(complex.total);
  });
});

// ────────────────────────────────────────────────────────────────
// isIntakeComplete - full-flow gating
// ────────────────────────────────────────────────────────────────

describe('isIntakeComplete', () => {
  test('empty state is not complete', () => {
    expect(isIntakeComplete(empty)).toBe(false);
  });

  test('partially-filled state is not complete', () => {
    expect(isIntakeComplete(singleNoDeps)).toBe(false);
  });

  test('every applicable step complete → true', () => {
    const fullySatisfied: IntakeState = {
      tutorial: { completed: true },
      service: { kind: 'personal' },
      personal: {
        fullName: 'Alex Bee',
        dateOfBirth: '1990-01-01',
        email: 'alex@bee.com',
        ssn: '123-45-6789',
      },
      state: { primaryState: 'California' },
      filing: { status: 'single' },
      dependents: { count: 0 },
      income: { types: ['w2'] },
      taxQuestions: {},
      deductions: { none: true },  // user said "no deductions to claim"
      lifeEvents: {},
      refund: { preference: 'direct_deposit' },
      documents: { uploadComplete: true },
      engagement: { signed: true },
      consent: { signed: true },
      // contact-info now uses personal.fullName + personal.email (set above).
      appointment: {},
      deposit: { paid: true },
    };
    expect(isIntakeComplete(fullySatisfied)).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────
// Sanity: every step has unique route + id
// ────────────────────────────────────────────────────────────────

describe('flow integrity', () => {
  test('every step has a unique route', () => {
    const routes = INTAKE_FLOW.map((s) => s.route);
    expect(new Set(routes).size).toBe(routes.length);
  });

  test('every step has a unique id', () => {
    const ids = INTAKE_FLOW.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every step has a section', () => {
    for (const step of INTAKE_FLOW) {
      expect(step.section).toBeTruthy();
    }
  });
});
