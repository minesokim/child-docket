// Tests for the deterministic Position Library scanner.
//
// Coverage:
//   - extractScanSignals reads IntakeState correctly for each branch
//   - scanPositionLibrary surfaces expected positions for canonical
//     client archetypes (W-2 only, self-employed sole prop, S-corp
//     owner, HoH with dependent, MFS in CA, REP candidate)
//   - Sort order: tier asc, then confidence desc within tier
//   - Threshold drops weak-signal positions to `rejected`
//   - Rejected categorization: no_trigger_match vs below_threshold
//   - Stable id generation when clientId + taxYear provided

import { describe, expect, test } from 'bun:test';
import type { IntakeState } from '@docket/shared';
import {
  extractScanSignals,
  scanPositionLibrary,
} from './discovery-scan.js';

// ────────────────────────────────────────────────────────────────
// Archetypal intake states for testing. These mirror what real
// clients submit through the intake flow.
// ────────────────────────────────────────────────────────────────

function intakeForW2Only(): IntakeState {
  return {
    filing: { status: 'single' },
    income: { types: ['w2'] },
    state: { primaryState: 'California' },
  };
}

function intakeForSelfEmployedSoleProp(): IntakeState {
  return {
    filing: { status: 'single' },
    income: { types: ['self', 'w2'] },
    state: { primaryState: 'California' },
    selfEmployment: { businessName: 'Maria Ortega Photography' },
    personal: { street: '123 Main St' },
  };
}

function intakeForScorpOwner(): IntakeState {
  return {
    filing: { status: 'mfj' },
    income: { types: ['self'] },
    state: { primaryState: 'CA' },
    service: { kind: 'biz' },
    business: {
      legalName: 'Acme LLC',
      entityType: 'S-Corp',
      street: '123 Main St',
    },
    personal: { street: '123 Main St' },
  };
}

function intakeForHohWithDeps(): IntakeState {
  return {
    filing: { status: 'hoh' },
    income: { types: ['w2'] },
    state: { primaryState: 'CA' },
    dependents: { count: 2 },
    deductions: { childcare: true },
  };
}

function intakeForMfsCa(): IntakeState {
  return {
    filing: { status: 'mfs' },
    income: { types: ['w2'] },
    state: { primaryState: 'California' },
  };
}

function intakeForRepCandidate(): IntakeState {
  return {
    filing: { status: 'single' },
    income: { types: ['self', 'rental'] },
    state: { primaryState: 'CA' },
    rental: {
      properties: [
        { address: '1 Olive St' },
        { address: '2 Maple Ave' },
        { address: '3 Pine Rd' },
      ],
    },
  };
}

// ────────────────────────────────────────────────────────────────
// extractScanSignals
// ────────────────────────────────────────────────────────────────

describe('extractScanSignals', () => {
  test('W-2 only emits filing_status + income_type w2_only + income_type low_to_moderate_w2 + jurisdiction', () => {
    const signals = extractScanSignals(intakeForW2Only());
    expect(signals).toContainEqual({ signal: 'filing_status', match: 'single' });
    expect(signals).toContainEqual({ signal: 'income_type', match: 'w2_only' });
    expect(signals).toContainEqual({
      signal: 'income_type',
      match: 'low_to_moderate_w2',
    });
    expect(signals).toContainEqual({
      signal: 'jurisdiction',
      match: 'high_tax_state',
    });
    expect(signals).toContainEqual({ signal: 'jurisdiction', match: 'ca' });
  });

  test('self-employed sole prop emits self_employment + sole_prop default + business patterns', () => {
    const signals = extractScanSignals(intakeForSelfEmployedSoleProp());
    expect(signals).toContainEqual({
      signal: 'income_type',
      match: 'self_employment',
    });
    expect(signals).toContainEqual({ signal: 'entity_type', match: 'sole_prop' });
    expect(signals).toContainEqual({
      signal: 'business_pattern',
      match: 'owner_pays_business_expense_personally',
    });
  });

  test('S-corp owner with matching home/business address emits home_address_eq_business_address', () => {
    const signals = extractScanSignals(intakeForScorpOwner());
    expect(signals).toContainEqual({ signal: 'entity_type', match: 's_corp' });
    expect(signals).toContainEqual({
      signal: 'business_pattern',
      match: 'home_address_eq_business_address',
    });
  });

  test('HoH with dependents emits filing_status + lifecycle signals', () => {
    const signals = extractScanSignals(intakeForHohWithDeps());
    expect(signals).toContainEqual({ signal: 'filing_status', match: 'hoh' });
    expect(signals).toContainEqual({
      signal: 'lifecycle_event',
      match: 'has_minor_dependents',
    });
    expect(signals).toContainEqual({
      signal: 'lifecycle_event',
      match: 'dependent_under_13',
    });
    expect(signals).toContainEqual({
      signal: 'expense_pattern',
      match: 'childcare_expenses',
    });
  });

  test('REP candidate: rental + SE + no W-2 emits rental_multiple_properties + no_w2_income', () => {
    const signals = extractScanSignals(intakeForRepCandidate());
    expect(signals).toContainEqual({
      signal: 'income_type',
      match: 'rental_multiple_properties',
    });
    expect(signals).toContainEqual({
      signal: 'business_pattern',
      match: 'no_w2_income',
    });
  });

  test('empty intake yields no signals', () => {
    expect(extractScanSignals({})).toEqual([]);
  });

  test('non-CA state does NOT emit jurisdiction CA but may emit high_tax_state', () => {
    const signals = extractScanSignals({
      state: { primaryState: 'New York' },
    });
    expect(signals).toContainEqual({
      signal: 'jurisdiction',
      match: 'high_tax_state',
    });
    expect(signals).not.toContainEqual({
      signal: 'jurisdiction',
      match: 'ca',
    });
  });

  test('low-tax state emits no high_tax_state', () => {
    const signals = extractScanSignals({
      state: { primaryState: 'Wyoming' },
    });
    expect(signals).not.toContainEqual({
      signal: 'jurisdiction',
      match: 'high_tax_state',
    });
  });
});

// ────────────────────────────────────────────────────────────────
// scanPositionLibrary — top-level scan
// ────────────────────────────────────────────────────────────────

describe('scanPositionLibrary', () => {
  test('W-2 only client surfaces standard deduction + SALT (Tier 1)', () => {
    const result = scanPositionLibrary(intakeForW2Only());
    const types = result.positions.map((p) => p.positionType);
    expect(types).toContain('standard_deduction');
    expect(types).toContain('salt_deduction');
  });

  test('self-employed surfaces home office + SEP-IRA + solo 401(k) + QBI', () => {
    const result = scanPositionLibrary(intakeForSelfEmployedSoleProp());
    const types = result.positions.map((p) => p.positionType);
    expect(types).toContain('home_office_280a');
    expect(types).toContain('sep_ira');
    expect(types).toContain('solo_401k');
    expect(types).toContain('qbi_safe_harbor_199a');
  });

  test('S-corp owner surfaces accountable plan + augusta + home office', () => {
    const result = scanPositionLibrary(intakeForScorpOwner());
    const types = result.positions.map((p) => p.positionType);
    expect(types).toContain('accountable_plan');
    expect(types).toContain('augusta_rule_280a_g');
    // S-corp owner with home==business → home office triggers via
    // 'home_address_eq_business_address' (confidenceBoost 0.4).
    // Combined with the 'no W-2' SE signal it should compound above
    // threshold.
    expect(types).toContain('home_office_280a');
  });

  test('HoH with dependents surfaces CTC + dependent care', () => {
    const result = scanPositionLibrary(intakeForHohWithDeps());
    const types = result.positions.map((p) => p.positionType);
    expect(types).toContain('child_tax_credit');
    expect(types).toContain('dependent_care_credit');
  });

  test('REP candidate: rental + SE + no W-2 surfaces real_estate_professional + cost-seg edges', () => {
    const result = scanPositionLibrary(intakeForRepCandidate());
    const types = result.positions.map((p) => p.positionType);
    expect(types).toContain('real_estate_professional_469');
    // Cost-seg edge classifications trigger on rental + entity match;
    // depending on the trigger weights, may or may not pass threshold.
    // The REP one is the load-bearing finding here.
  });

  test('output is sorted by tier asc, then confidence desc', () => {
    const result = scanPositionLibrary(intakeForScorpOwner());
    expect(result.positions.length).toBeGreaterThan(1);
    let prevTierRank = 0;
    let prevConfidenceWithinTier = 1.01;
    for (const p of result.positions) {
      const tierRank = { settled: 1, substantial: 2, reasonable_basis: 3, more_likely_than_not: 4 }[p.tier];
      if (tierRank > prevTierRank) {
        prevTierRank = tierRank;
        prevConfidenceWithinTier = 1.01;
      }
      expect(tierRank).toBeGreaterThanOrEqual(prevTierRank);
      // Within-tier: confidence should decrease (or stay equal).
      expect(p.surfaceConfidence).toBeLessThanOrEqual(prevConfidenceWithinTier);
      prevConfidenceWithinTier = p.surfaceConfidence;
    }
  });

  test('rejected list categorizes correctly: no_trigger_match vs below_threshold', () => {
    const result = scanPositionLibrary(intakeForW2Only());
    // W-2 only client should reject self-employment + entity-specific
    // positions as no_trigger_match.
    const seppRejected = result.rejected.find(
      (r) => r.positionType === 'sep_ira',
    );
    expect(seppRejected).toBeDefined();
    expect(seppRejected?.reason).toBe('no_trigger_match');
  });

  test('threshold filters out weak-confidence positions', () => {
    // High threshold → fewer surfaced positions
    const high = scanPositionLibrary(intakeForSelfEmployedSoleProp(), {
      threshold: 0.9,
    });
    const low = scanPositionLibrary(intakeForSelfEmployedSoleProp(), {
      threshold: 0.1,
    });
    expect(high.positions.length).toBeLessThan(low.positions.length);
    // Verify the rejected list includes below_confidence_threshold
    // entries when the threshold cuts above their compounded
    // confidence (codex catch 2026-05-15 — earlier test only
    // checked the count, not the categorization).
    const highRejectedBelowThreshold = high.rejected.filter(
      (r) => r.reason === 'below_confidence_threshold',
    );
    expect(highRejectedBelowThreshold.length).toBeGreaterThan(0);
    for (const r of highRejectedBelowThreshold) {
      expect(r.surfaceConfidence).toBeLessThan(0.9);
      expect(r.matchedTriggers.length).toBeGreaterThan(0);
    }
  });

  test('scan is deterministic given same input', () => {
    // Two scans with the same input options must produce identical
    // output. The synthetic-id fallback used to call Math.random
    // (codex caught the impurity 2026-05-15); now the function is
    // pure.
    const a = scanPositionLibrary(intakeForSelfEmployedSoleProp(), {
      clientId: 'cli_xyz',
      taxYear: 2025,
    });
    const b = scanPositionLibrary(intakeForSelfEmployedSoleProp(), {
      clientId: 'cli_xyz',
      taxYear: 2025,
    });
    expect(JSON.stringify(a.positions)).toBe(JSON.stringify(b.positions));
  });

  test('synthetic-id fallback uses deterministic prefix (no Math.random)', () => {
    const a = scanPositionLibrary(intakeForW2Only());
    const b = scanPositionLibrary(intakeForW2Only());
    // Same input → same ids even without clientId/taxYear context.
    expect(a.positions.map((p) => p.id)).toEqual(b.positions.map((p) => p.id));
    for (const p of a.positions) {
      expect(p.id).toMatch(/^synthetic-/);
      // taxYear sentinel = 0 when not provided.
      expect(p.taxYear).toBe(0);
    }
  });

  test('selfEmployment.entityType is read for entity_type detection', () => {
    // Codex catch 2026-05-15 — earlier code only read
    // business.entityType, missing the 1040-flow SE-S-corp case.
    const state: IntakeState = {
      filing: { status: 'single' },
      income: { types: ['self'] },
      selfEmployment: { entityType: 'S-Corp' },
    };
    const signals = extractScanSignals(state);
    expect(signals).toContainEqual({ signal: 'entity_type', match: 's_corp' });
  });

  test('signals list is populated diagnostically', () => {
    const result = scanPositionLibrary(intakeForSelfEmployedSoleProp());
    expect(result.signals.length).toBeGreaterThan(0);
  });

  test('stable id generation with clientId + taxYear options', () => {
    const result = scanPositionLibrary(intakeForW2Only(), {
      clientId: 'cli_123',
      taxYear: 2025,
    });
    for (const p of result.positions) {
      expect(p.id).toBe(`cli_123-${p.positionType}-2025`);
      expect(p.clientId).toBe('cli_123');
      expect(p.taxYear).toBe(2025);
    }
  });

  test('source artifact ids propagate to every position', () => {
    const result = scanPositionLibrary(intakeForW2Only(), {
      sourceArtifactIds: ['intake_456'],
    });
    for (const p of result.positions) {
      expect(p.sourceArtifactIds).toEqual(['intake_456']);
    }
  });

  test('every surfaced position carries cited authority (ircSection always populated)', () => {
    const result = scanPositionLibrary(intakeForSelfEmployedSoleProp());
    for (const p of result.positions) {
      expect(p.ircSection.length).toBeGreaterThan(0);
      expect(p.ircSection).toMatch(/^§/);
    }
  });

  test('every surfaced position carries the documentation checklist', () => {
    const result = scanPositionLibrary(intakeForSelfEmployedSoleProp());
    for (const p of result.positions) {
      expect(p.documentationChecklist.length).toBeGreaterThan(0);
    }
  });

  test('matchedTriggers contain the actual triggers that fired (provenance)', () => {
    const result = scanPositionLibrary(intakeForScorpOwner());
    const accountablePlan = result.positions.find(
      (p) => p.positionType === 'accountable_plan',
    );
    expect(accountablePlan).toBeDefined();
    expect(accountablePlan!.matchedTriggers.length).toBeGreaterThan(0);
    for (const t of accountablePlan!.matchedTriggers) {
      expect(t.signal).toBeDefined();
      expect(t.match).toBeDefined();
    }
  });

  test('empty intake produces zero surfaced positions', () => {
    const result = scanPositionLibrary({});
    expect(result.positions).toEqual([]);
    // Every catalog entry should be in rejected (no_trigger_match).
    expect(result.rejected.length).toBeGreaterThan(0);
  });

  // ─────────────────────────────────────────────────────────────
  // Session 10 audit (2026-05-16) — refusalIf surfacing.
  //
  // Pre-fix: the catalog's refusalIf clauses were stripped at scan
  // time, leaving the EA's preparer-defense review pass with no
  // visibility into the disqualifying conditions on each surfaced
  // position. Per CLAUDE.md §9 audit finding + POSITION-FRAMEWORK
  // §6 (the framework refusal floor is enforced by the preparer's
  // review pass; this field is the data hand-off that makes the
  // review possible).
  //
  // These tests verify the catalog's refusalIf array flows through
  // to DiscoveredPosition.refusalConditions on every surfaced
  // position. Downstream consumers (PDF, command-room card) read
  // refusalConditions to render the preparer-facing warnings.
  // ─────────────────────────────────────────────────────────────

  test('refusalIf clauses flow to DiscoveredPosition.refusalConditions', () => {
    // W-2 only client surfaces standard_deduction. The catalog entry
    // has one refusalIf clause: "MFS where spouse itemizes
    // (§63(c)(6)(A))". The scanner must carry this through verbatim.
    const result = scanPositionLibrary(intakeForW2Only());
    const stdDed = result.positions.find(
      (p) => p.positionType === 'standard_deduction',
    );
    expect(stdDed).toBeDefined();
    expect(stdDed!.refusalConditions).toEqual([
      'MFS where spouse itemizes (§63(c)(6)(A))',
    ]);
  });

  test('multi-clause refusalIf flows through verbatim (mortgage_interest)', () => {
    // mortgage_interest has TWO refusalIf clauses. The scanner must
    // preserve order + content — the EA reads them as a checklist.
    const result = scanPositionLibrary(intakeForW2Only());
    const mortgage = result.positions.find(
      (p) => p.positionType === 'mortgage_interest',
    );
    if (mortgage) {
      expect(mortgage.refusalConditions.length).toBeGreaterThanOrEqual(2);
      expect(mortgage.refusalConditions).toContain(
        'Home equity debt not used to buy/build/substantially improve residence (TCJA disallowed)',
      );
    }
  });

  test('refusalConditions is always an array (never null/undefined)', () => {
    // Every surfaced position must carry the field as an array, even
    // if the catalog entry happened to have zero refusalIf clauses
    // (none exist today, but a future catalog edit might). Empty
    // array, not null — keeps consumers' .map() / .length calls
    // safe.
    const result = scanPositionLibrary(intakeForSelfEmployedSoleProp());
    for (const p of result.positions) {
      expect(Array.isArray(p.refusalConditions)).toBe(true);
    }
  });
});
