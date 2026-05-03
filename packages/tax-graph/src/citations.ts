// Citation formatters.
//
// Turn an Authority (+ optional chunk's sectionPath, + optional
// requested tax year) into the strings a preparer recognizes. Two
// shapes:
//
//   formatCitation(authority, opts)        → terse one-line citation
//   formatCitationWithStatus(authority, opts) → adds supersession status
//
// EFFECTIVE-DATE BEHAVIOR
//   - "in effect on tax year T" — authority is valid (effectiveDate <= T,
//     and either supersededDate is null or supersededDate > T)
//   - "superseded" — authority has a supersededDate that falls before
//     or during the requested tax year
//   - "not yet in effect" — effectiveDate is after the requested tax year
//   - if no requestedTaxYear is provided, status is computed against today
//
// PRESENTATION
//   The terse form is what gets embedded inline in agent output ("...
//   per IRS Pub 17 (2024) §5.1"). The status-bearing form is what hover
//   tooltips show + what visual citation chips render on the side. We
//   never silently render a superseded authority — the status badge is
//   load-bearing for trust.

import type { Authority, AuthorityChunk } from './types.js';

/**
 * Lifecycle state of an authority relative to a reference date or tax year.
 *
 *   in_effect      — currently applicable
 *   superseded     — replaced by a newer version
 *   not_yet_in_effect — effective date is in the future
 */
export type AuthorityStatus = 'in_effect' | 'superseded' | 'not_yet_in_effect';

export type FormatCitationOpts = {
  /**
   * Tax year of the user's question. When set, status is computed
   * "is this authority in effect for tax year T?". When unset, we
   * compare against `Date.now()`.
   */
  taxYear?: number;
  /**
   * If we're citing a specific chunk, append its section path
   * ("§5.1: Earned income"). Optional — terse single-line formats
   * may omit this.
   */
  chunk?: Pick<AuthorityChunk, 'sectionPath' | 'heading'> | null;
  /**
   * If true, append the section path (or heading) when a chunk is
   * provided. Default true.
   */
  withSection?: boolean;
};

/**
 * Returns the authority's lifecycle state relative to a tax year (or
 * today if tax year is unspecified).
 */
export function authorityStatus(
  authority: Pick<Authority, 'effectiveDate' | 'supersededDate'>,
  opts: { taxYear?: number; today?: Date } = {},
): AuthorityStatus {
  const reference = referenceDate(opts);
  if (authority.effectiveDate > reference) return 'not_yet_in_effect';
  if (authority.supersededDate != null && authority.supersededDate <= reference) {
    return 'superseded';
  }
  return 'in_effect';
}

/**
 * Build the inline citation string. Examples:
 *
 *   "IRS Pub 17 (2024)"
 *   "IRS Pub 17 (2024) §5.1"
 *   "IRC §61(a)(1)"
 *   "Vazant playbook: §83(b) elections"
 *
 * The `citation_label` column on the authority is the source of truth
 * for the leading part — this function appends section detail when a
 * chunk is provided + withSection isn't disabled.
 */
export function formatCitation(
  authority: Pick<Authority, 'citationLabel'>,
  opts: FormatCitationOpts = {},
): string {
  const base = authority.citationLabel;
  const withSection = opts.withSection !== false;
  if (!withSection || !opts.chunk) return base;

  const sectionLabel = sectionDisplayLabel(opts.chunk);
  if (!sectionLabel) return base;

  // If the citation_label already ends with a section reference (e.g.
  // "IRC §61(a)(1)"), don't double-append. Heuristic: if the label
  // ends with the same section_path leaf, skip.
  if (sectionLabel && base.endsWith(sectionLabel)) return base;

  return `${base} ${sectionLabel}`;
}

/**
 * Build a status-aware citation string. Adds the supersession state
 * inline when applicable. Examples:
 *
 *   "IRS Pub 17 (2024)"
 *   "IRS Pub 17 (2023) — superseded 2024-01-01"
 *   "Treas. Reg. §1.61-2(a)(1) — not yet in effect (eff. 2026-01-01)"
 *
 * Use this for hover tooltips, citation chip rendering, anywhere the
 * status is load-bearing for trust.
 */
export function formatCitationWithStatus(
  authority: Pick<Authority, 'citationLabel' | 'effectiveDate' | 'supersededDate'>,
  opts: FormatCitationOpts & { today?: Date } = {},
): string {
  const base = formatCitation(authority as Authority, opts);
  const status = authorityStatus(authority, opts);
  if (status === 'in_effect') return base;
  if (status === 'superseded') {
    return `${base} — superseded ${formatDate(authority.supersededDate!)}`;
  }
  // not_yet_in_effect
  return `${base} — not yet in effect (eff. ${formatDate(authority.effectiveDate)})`;
}

/**
 * Render the section path component of a citation. Strategy:
 *   1. Prefer the chunk's `heading` if set ("§5.1: Earned income")
 *   2. Otherwise, render the section_path as a dot-joined breadcrumb
 *      collapsing repeated tokens (["§61", "(a)", "(1)"] → "§61(a)(1)").
 */
export function sectionDisplayLabel(
  chunk: Pick<AuthorityChunk, 'sectionPath' | 'heading'> | null | undefined,
): string {
  if (!chunk) return '';
  if (chunk.heading && chunk.heading.trim()) return chunk.heading.trim();
  if (!chunk.sectionPath || chunk.sectionPath.length === 0) return '';
  return joinSectionPath(chunk.sectionPath);
}

/**
 * Join a section path. Heuristic: parts that start with a paren or
 * bracket concatenate without a separator (`§61` + `(a)` → `§61(a)`);
 * otherwise join with a middot separator. Handles both IRC-style
 * "§61(a)(1)" and IRS-pub-style "Part 2 · Chapter 5 · §5.1".
 *
 * §-prefixed parts are NOT tight-joined — they're their own breadcrumb
 * level (e.g., a Pub 17 chunk with section_path ["Part 2", "Chapter 5",
 * "§5.1"] should render as "Part 2 · Chapter 5 · §5.1", not
 * "Part 2 · Chapter 5§5.1").
 */
function joinSectionPath(parts: readonly string[]): string {
  let out = '';
  for (const part of parts) {
    if (!part) continue;
    if (out === '') {
      out = part;
    } else if (part.startsWith('(') || part.startsWith('[')) {
      // Tight join for sub-section markers (a) (1) [i].
      out = `${out}${part}`;
    } else {
      // Spaced join with middot for multi-level breadcrumbs.
      out = `${out} · ${part}`;
    }
  }
  return out;
}

/**
 * Pick the right reference date. Tax year takes priority when set —
 * we treat "tax year 2024" as "as of Dec 31, 2024" (end-of-year), so
 * an authority effective on Dec 1, 2024 IS in effect for TY2024.
 */
function referenceDate(opts: { taxYear?: number; today?: Date }): Date {
  if (opts.taxYear != null) {
    // End of the tax year — Dec 31. Tax law in effect at any point
    // during the year applies to that year.
    return new Date(Date.UTC(opts.taxYear, 11, 31));
  }
  return opts.today ?? new Date();
}

/** ISO date (YYYY-MM-DD) without time component. */
function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
