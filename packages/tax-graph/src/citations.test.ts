// Citation formatter tests.
//
// Coverage shape:
//   - terse formatCitation with/without chunk
//   - section path joining (IRC-style tight, IRS-pub-style breadcrumb)
//   - authorityStatus across tax-year boundaries
//   - formatCitationWithStatus produces correct supersession messaging
//
// The formatter is the load-bearing piece of trust display. Bugs here
// surface as outdated law shown without warning.

import { describe, it, expect } from 'bun:test';
import {
  formatCitation,
  formatCitationWithStatus,
  authorityStatus,
  sectionDisplayLabel,
} from './citations.js';
import type { Authority, AuthorityChunk } from './types.js';

// ────────────────────────────────────────────────────────────────
// Fixtures.
// ────────────────────────────────────────────────────────────────

function pub17(year: number, supersededDate?: Date): Pick<Authority, 'citationLabel' | 'effectiveDate' | 'supersededDate'> {
  return {
    citationLabel: `IRS Pub 17 (${year})`,
    effectiveDate: new Date(Date.UTC(year, 0, 1)),
    supersededDate: supersededDate ?? null,
  };
}

function chunk(
  sectionPath: string[],
  heading?: string,
): Pick<AuthorityChunk, 'sectionPath' | 'heading'> {
  return { sectionPath, heading: heading ?? null };
}

// ────────────────────────────────────────────────────────────────
// formatCitation — terse, no status.
// ────────────────────────────────────────────────────────────────
describe('formatCitation', () => {
  it('returns the citation label alone when no chunk is provided', () => {
    expect(formatCitation(pub17(2024))).toBe('IRS Pub 17 (2024)');
  });

  it('appends section heading when provided', () => {
    const c = chunk(['Part 2', '§5.1'], '§5.1: Earned income');
    expect(formatCitation(pub17(2024), { chunk: c })).toBe(
      'IRS Pub 17 (2024) §5.1: Earned income',
    );
  });

  it('falls back to section_path when heading is empty', () => {
    const c = chunk(['Part 2', 'Chapter 5', '§5.1']);
    expect(formatCitation(pub17(2024), { chunk: c })).toBe(
      'IRS Pub 17 (2024) Part 2 · Chapter 5 · §5.1',
    );
  });

  it('joins IRC-style sub-section markers tight (no separator)', () => {
    const c = chunk(['§61', '(a)', '(1)']);
    expect(sectionDisplayLabel(c)).toBe('§61(a)(1)');
  });

  it('respects withSection=false even when chunk is set', () => {
    const c = chunk([], '§5.1');
    expect(formatCitation(pub17(2024), { chunk: c, withSection: false })).toBe(
      'IRS Pub 17 (2024)',
    );
  });

  it('does not double-append when label already contains the section', () => {
    const auth = { citationLabel: 'IRC §61(a)(1)' };
    const c = chunk(['§61', '(a)', '(1)']);
    expect(formatCitation(auth, { chunk: c })).toBe('IRC §61(a)(1)');
  });

  it('handles empty chunk gracefully', () => {
    const c = chunk([]);
    expect(formatCitation(pub17(2024), { chunk: c })).toBe('IRS Pub 17 (2024)');
  });

  it('handles null chunk', () => {
    expect(formatCitation(pub17(2024), { chunk: null })).toBe('IRS Pub 17 (2024)');
  });
});

// ────────────────────────────────────────────────────────────────
// authorityStatus — lifecycle relative to a tax year.
// ────────────────────────────────────────────────────────────────
describe('authorityStatus', () => {
  it('returns in_effect for current authority within its tax year', () => {
    expect(authorityStatus(pub17(2024), { taxYear: 2024 })).toBe('in_effect');
  });

  it('returns in_effect when superseded date is after the tax year end', () => {
    // Pub 17 (2024) effective 2024-01-01, superseded 2025-01-01.
    // For TY2024 (reference Dec 31 2024), it's still in effect.
    const auth = pub17(2024, new Date(Date.UTC(2025, 0, 1)));
    expect(authorityStatus(auth, { taxYear: 2024 })).toBe('in_effect');
  });

  it('returns superseded when superseded date is at or before tax year end', () => {
    // Pub 17 (2023) effective 2023-01-01, superseded 2024-01-01.
    // For TY2024 (reference Dec 31 2024), it's superseded.
    const auth = pub17(2023, new Date(Date.UTC(2024, 0, 1)));
    expect(authorityStatus(auth, { taxYear: 2024 })).toBe('superseded');
  });

  it('returns not_yet_in_effect when effective_date is after tax year end', () => {
    // Pub 17 (2026) effective 2026-01-01.
    // For TY2024, it's not yet in effect.
    expect(authorityStatus(pub17(2026), { taxYear: 2024 })).toBe('not_yet_in_effect');
  });

  it('uses today as reference when no tax year is provided', () => {
    const today = new Date(Date.UTC(2024, 5, 15)); // Jun 15 2024
    // Pub 17 (2024) effective Jan 1 2024 — in effect on Jun 15.
    expect(authorityStatus(pub17(2024), { today })).toBe('in_effect');
    // Pub 17 (2025) effective Jan 1 2025 — not yet in effect on Jun 15 2024.
    expect(authorityStatus(pub17(2025), { today })).toBe('not_yet_in_effect');
  });

  it('correctly handles a same-day superseded boundary', () => {
    // An authority superseded ON its effective date (edge case — same-day
    // replacement). Treated as superseded.
    const sameDay = new Date(Date.UTC(2024, 0, 1));
    const auth = {
      citationLabel: 'edge',
      effectiveDate: sameDay,
      supersededDate: sameDay,
    };
    expect(authorityStatus(auth, { today: new Date(Date.UTC(2024, 0, 2)) })).toBe(
      'superseded',
    );
  });
});

// ────────────────────────────────────────────────────────────────
// formatCitationWithStatus — full hover-tooltip form.
// ────────────────────────────────────────────────────────────────
describe('formatCitationWithStatus', () => {
  it('returns the bare label when authority is in effect', () => {
    expect(formatCitationWithStatus(pub17(2024), { taxYear: 2024 })).toBe(
      'IRS Pub 17 (2024)',
    );
  });

  it('appends supersession date when superseded', () => {
    const auth = pub17(2023, new Date(Date.UTC(2024, 0, 1)));
    expect(formatCitationWithStatus(auth, { taxYear: 2024 })).toBe(
      'IRS Pub 17 (2023) — superseded 2024-01-01',
    );
  });

  it('appends effective date when not yet in effect', () => {
    expect(formatCitationWithStatus(pub17(2026), { taxYear: 2024 })).toBe(
      'IRS Pub 17 (2026) — not yet in effect (eff. 2026-01-01)',
    );
  });

  it('combines section detail with status', () => {
    const auth = pub17(2023, new Date(Date.UTC(2024, 0, 1)));
    const c = chunk([], '§5.1: Earned income');
    expect(formatCitationWithStatus(auth, { taxYear: 2024, chunk: c })).toBe(
      'IRS Pub 17 (2023) §5.1: Earned income — superseded 2024-01-01',
    );
  });
});
