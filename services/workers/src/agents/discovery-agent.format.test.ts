// Discovery agent canonical alert format tests.
//
// Per CLAUDE.md §8 Canonical insight format. The formatter composes
// a TaxPosition into the `{ClientName}'s {situation} · {quantified
// impact}` form that the dashboard + Morning Brief consume.

import { describe, expect, it } from 'bun:test';
import {
  formatDiscoveryAlert,
  humanImpact,
  humanSituation,
  type TaxPosition,
} from './discovery-agent.js';

function makePosition(overrides: Partial<TaxPosition> = {}): TaxPosition {
  return {
    claim: 'Home-office deduction for 12% of square footage',
    tier: 2,
    authority: [
      {
        source: 'irc',
        cite: '§280A(c)(1)',
        summary: 'Home-office exclusivity rules',
      },
    ],
    estimatedImpact: { dollars: 14000, certainty: 'estimate' },
    auditRisk: 'low',
    disclosureRequired: false,
    rationale: 'Antonio reported a dedicated 12% room used exclusively',
    gapsToConfirm: [],
    ...overrides,
  };
}

describe('humanSituation', () => {
  it('takes the first 6 words and trims trailing punctuation', () => {
    expect(
      humanSituation('Home-office deduction for 12% of square footage used exclusively for business.'),
    ).toBe('home-office deduction for 12% of square');
  });

  it('strips leading articles', () => {
    expect(humanSituation('A home-office deduction for the rental')).toBe(
      'home-office deduction for the rental',
    );
    // "The Augusta-rule" strips the article + lowercases (single
    // hyphenated word can't be disambiguated as proper-noun
    // without a second capitalized word). The LLM is prompted to
    // emit "Augusta Rule rental" (two-word form) for proper-noun
    // tax terms; see Augusta-Rule case below.
    expect(humanSituation('The Augusta-rule rental income')).toBe(
      'augusta-rule rental income',
    );
  });

  it('preserves proper-noun-start patterns (Augusta Rule, two words)', () => {
    expect(humanSituation('Augusta Rule rental income')).toBe(
      'Augusta Rule rental income',
    );
    expect(humanSituation('Patel Family business deduction')).toBe(
      'Patel Family business deduction',
    );
  });

  it('lowercases first letter when not a proper noun', () => {
    expect(humanSituation('QBI aggregation across S-corps')).toBe('QBI aggregation across S-corps');
    // "Home-office" is a single capitalized word followed by lowercase
    expect(humanSituation('Home-office deduction')).toBe('home-office deduction');
  });

  it('drops trailing punctuation including ! and ?', () => {
    expect(humanSituation('Deduction for charity!')).toBe('deduction for charity');
    expect(humanSituation('Possible §179?')).toBe('possible §179');
  });
});

describe('humanImpact', () => {
  it('formats dollars >= 1000 as $XK', () => {
    expect(
      humanImpact(makePosition({ estimatedImpact: { dollars: 14000, certainty: 'estimate' } })),
    ).toBe('est. $14K savings, Tier 2, Substantial Authority');
  });

  it('formats < $10K with 1 decimal', () => {
    expect(
      humanImpact(makePosition({ estimatedImpact: { dollars: 4200, certainty: 'estimate' } })),
    ).toBe('est. $4.2K savings, Tier 2, Substantial Authority');
  });

  it('formats dollars < 1000 as $X', () => {
    expect(
      humanImpact(
        makePosition({
          estimatedImpact: { dollars: 480, certainty: 'estimate' },
          tier: 1,
        }),
      ),
    ).toBe('est. $480 savings');
  });

  it('omits "est." for precise certainty', () => {
    expect(
      humanImpact(
        makePosition({
          estimatedImpact: { dollars: 14000, certainty: 'precise' },
        }),
      ),
    ).toBe('$14K savings, Tier 2, Substantial Authority');
  });

  it('strips tier disclosure for Tier 1 (settled law)', () => {
    expect(humanImpact(makePosition({ tier: 1 }))).toBe('est. $14K savings');
  });

  it('adds 8275 callout when disclosure required (Tier 3)', () => {
    expect(
      humanImpact(makePosition({ tier: 3, disclosureRequired: true })),
    ).toBe('est. $14K savings, Tier 3, Reasonable Basis with 8275 (8275 required)');
  });
});

describe('formatDiscoveryAlert', () => {
  it('composes the canonical form for a Tier 2 position', () => {
    expect(formatDiscoveryAlert(makePosition(), 'Maria Ortega')).toBe(
      "Maria Ortega's home-office deduction for 12% of square · est. $14K savings, Tier 2, Substantial Authority",
    );
  });

  it('uses Tier 1 short form (no tier callout)', () => {
    expect(
      formatDiscoveryAlert(
        makePosition({ tier: 1, claim: 'Standard deduction (joint)' }),
        'Patel Family',
      ),
    ).toBe("Patel Family's standard deduction (joint) · est. $14K savings");
  });

  it('uses 8275 callout for Tier 3 disclosure-required position', () => {
    expect(
      formatDiscoveryAlert(
        makePosition({
          tier: 3,
          disclosureRequired: true,
          claim: 'QBI aggregation across two S-corps',
          estimatedImpact: { dollars: 8500, certainty: 'estimate' },
        }),
        'Doe Family',
      ),
    ).toBe(
      "Doe Family's QBI aggregation across two S-corps · est. $8.5K savings, Tier 3, Reasonable Basis with 8275 (8275 required)",
    );
  });

  it('returns null when impact is non-quantified (zero dollars)', () => {
    expect(
      formatDiscoveryAlert(
        makePosition({ estimatedImpact: { dollars: 0, certainty: 'estimate' } }),
        'Maria Ortega',
      ),
    ).toBeNull();
  });
});
