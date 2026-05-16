// from-scan adapter tests — Tier 0 refusalIf surfacing (Session 10
// audit, 2026-05-16).
//
// The adapter at from-scan.ts maps a DiscoveredPosition (scanner
// output) into a PdfPosition (PDF renderer input). Pre-Session-10
// it dropped the catalog's refusalIf clauses on the floor.
// Post-fix, refusalConditions get PREPENDED to gapsToConfirm with
// a "Verify NOT applicable:" prefix so the EA's review pass sees
// the disqualifying-condition checklist FIRST, ahead of the
// affirmative documentation list.
//
// These tests guard the data hand-off so a future edit can't
// silently drop the refusal surfacing again.

import { describe, expect, test } from 'bun:test';
import { POSITION_LIBRARY_V0, scanPositionLibrary } from '@docket/tax-graph';
import type { IntakeState } from '@docket/shared';
import { discoveredToPdfPosition } from './from-scan.js';

// Minimal W-2 only intake — surfaces standard_deduction +
// salt_deduction reliably. Mirrors the fixture pattern used by
// discovery-scan.test.ts (which is the canonical reference for what
// fields the scanner actually reads via extractScanSignals).
function intakeForW2Only(): IntakeState {
  return {
    filing: { status: 'single' },
    income: { types: ['w2'] },
    state: { primaryState: 'California' },
  } as unknown as IntakeState;
}

describe('discoveredToPdfPosition — refusalIf surfacing', () => {
  test('refusalConditions prepend to gapsToConfirm with "Verify NOT applicable:" prefix', () => {
    const scan = scanPositionLibrary(intakeForW2Only());
    const stdDed = scan.positions.find(
      (p) => p.positionType === 'standard_deduction',
    );
    expect(stdDed).toBeDefined();
    const pdf = discoveredToPdfPosition(stdDed!);

    // The standard_deduction entry has exactly one refusalIf clause
    // ("MFS where spouse itemizes (§63(c)(6)(A))"). It must appear
    // FIRST in gapsToConfirm with the documented prefix.
    expect(pdf.gapsToConfirm[0]).toBe(
      'Verify NOT applicable: MFS where spouse itemizes (§63(c)(6)(A))',
    );
  });

  test('documentationChecklist follows refusal notes in gapsToConfirm', () => {
    const scan = scanPositionLibrary(intakeForW2Only());
    const stdDed = scan.positions.find(
      (p) => p.positionType === 'standard_deduction',
    );
    const pdf = discoveredToPdfPosition(stdDed!);

    // Catalog has 1 refusalIf + 1 documentationChecklist item for
    // standard_deduction. gapsToConfirm = [refusal, docs] in that
    // order. Total length = 2.
    expect(pdf.gapsToConfirm.length).toBe(2);
    expect(pdf.gapsToConfirm[1]).toBe('Filing status confirmation');
  });

  test('multi-clause refusalIf produces multiple prefixed entries', () => {
    // mortgage_interest has 2 refusalIf clauses. Both must surface
    // verbatim with the "Verify NOT applicable:" prefix, in catalog
    // order. The scanner only surfaces mortgage_interest when the
    // 1098 trigger fires, so we synthesize a minimal DiscoveredPosition
    // by reading the catalog entry directly — same shape the scanner
    // would produce.
    const entry = POSITION_LIBRARY_V0.find(
      (e) => e.positionType === 'mortgage_interest',
    );
    expect(entry).toBeDefined();
    const dp = {
      id: 'test-mortgage',
      clientId: '',
      taxYear: 2025,
      positionType: entry!.positionType,
      displayName: entry!.displayName,
      shortDescription: entry!.shortDescription,
      tier: entry!.tier,
      ircSection: entry!.ircSection,
      treasReg: entry!.treasReg,
      controllingCase: entry!.controllingCase,
      revRuling: entry!.revRuling,
      irsPub: entry!.irsPub,
      disclosureRequired: entry!.disclosureRequired,
      surfaceConfidence: 0.8,
      sustainabilityEstimatePct: entry!.baselineSustainabilityPct,
      estimatedSavingsLow: entry!.estimatedSavingsLow,
      estimatedSavingsHigh: entry!.estimatedSavingsHigh,
      documentationChecklist: entry!.documentationChecklist,
      matchedTriggers: [],
      sourceArtifactIds: [],
      refusalConditions: entry!.refusalIf,
    };
    const pdf = discoveredToPdfPosition(dp);

    const prefixed = pdf.gapsToConfirm.filter((g) =>
      g.startsWith('Verify NOT applicable:'),
    );
    expect(prefixed.length).toBe(entry!.refusalIf.length);
    // First refusal must match catalog order verbatim.
    expect(prefixed[0]).toBe(
      `Verify NOT applicable: ${entry!.refusalIf[0]}`,
    );
  });

  test('empty refusalConditions produces gapsToConfirm = documentationChecklist (no prefix entries)', () => {
    // Synthesize a position with empty refusalConditions to confirm
    // the prepend logic doesn't add a stray "Verify NOT applicable:"
    // marker when there's nothing to verify-against. A future
    // catalog entry with no refusalIf clauses should round-trip
    // cleanly.
    const dp = {
      id: 'test-empty',
      clientId: '',
      taxYear: 2025,
      positionType: 'synthetic_empty',
      displayName: 'Synthetic Empty',
      shortDescription: 'No refusalIf clauses for this test fixture',
      tier: 'settled' as const,
      ircSection: '§1',
      treasReg: null,
      controllingCase: null,
      revRuling: null,
      irsPub: null,
      disclosureRequired: false,
      surfaceConfidence: 0.8,
      sustainabilityEstimatePct: 95,
      estimatedSavingsLow: 0,
      estimatedSavingsHigh: 0,
      documentationChecklist: ['only doc item'],
      matchedTriggers: [],
      sourceArtifactIds: [],
      refusalConditions: [],
    };
    const pdf = discoveredToPdfPosition(dp);
    expect(pdf.gapsToConfirm).toEqual(['only doc item']);
    // No "Verify NOT applicable:" entries at all.
    for (const g of pdf.gapsToConfirm) {
      expect(g).not.toContain('Verify NOT applicable:');
    }
  });
});
