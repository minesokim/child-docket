// Citation chip — visual rendering of a cited authority.
//
// Decoupled from @docket/tax-graph on purpose: this component takes a
// pre-formatted label + status. Consumers convert from Authority using
// the formatters in @docket/tax-graph (formatCitation, authorityStatus)
// and pass the strings here. Keeps @docket/ui dependency-free of the
// domain types, and @docket/tax-graph dependency-free of React.
//
// Visual states:
//   in_effect          — neutral chip, no badge
//   superseded         — rust badge ("superseded")
//   not_yet_in_effect  — amber/dashed badge ("not yet in effect")
//
// Use inline within agent output:
//   "Per <Citation t={t} label='IRS Pub 17 (2024) §5.1' status='in_effect' />"
//
// Or as a list of cited authorities under an agent answer.

import * as React from 'react';
import type { Theme } from '../tokens.js';

export type CitationStatus = 'in_effect' | 'superseded' | 'not_yet_in_effect';

export type CitationProps = {
  t: Theme;
  /** Pre-formatted citation label (e.g., "IRS Pub 17 (2024) §5.1"). */
  label: string;
  /** Lifecycle status of the cited authority. Default: in_effect. */
  status?: CitationStatus;
  /**
   * Long-form tooltip shown on hover (e.g., "IRS Pub 17 (2023) —
   * superseded 2024-01-01"). Optional. When absent, the label itself
   * is the tooltip.
   */
  tooltip?: string;
  /**
   * If set, the chip is a link. Use for routing to an authority detail
   * page inside Docket OR to the canonical external URL.
   */
  href?: string;
  /** Visual size — "sm" inline, "md" standalone. Default sm. */
  size?: 'sm' | 'md';
};

export function Citation({
  t,
  label,
  status = 'in_effect',
  tooltip,
  href,
  size = 'sm',
}: CitationProps) {
  const isSm = size === 'sm';
  const padding = isSm ? '2px 8px' : '4px 10px';
  const fontSize = isSm ? 11 : 12.5;

  const { bg, border, color, badge } = stylesForStatus(t, status);

  const inner = (
    <span
      title={tooltip ?? label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding,
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 4,
        fontFamily: t.mono,
        fontSize,
        letterSpacing: 0.2,
        color,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        verticalAlign: 'baseline',
      }}
    >
      <span>{label}</span>
      {badge && (
        <span
          style={{
            display: 'inline-flex',
            padding: '1px 6px',
            background: badge.bg,
            color: badge.fg,
            fontSize: 9,
            fontFamily: t.mono,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            borderRadius: 2,
          }}
        >
          {badge.text}
        </span>
      )}
    </span>
  );

  if (href) {
    return (
      <a
        href={href}
        target={href.startsWith('http') ? '_blank' : undefined}
        rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
        style={{ textDecoration: 'none' }}
      >
        {inner}
      </a>
    );
  }
  return inner;
}

/**
 * Stack of citations, one per line, used at the bottom of an agent's
 * answer or beside a workflow recommendation. "Sources" eyebrow header
 * + chips below.
 */
export function CitationList({
  t,
  citations,
  heading = 'Sources',
}: {
  t: Theme;
  citations: ReadonlyArray<Omit<CitationProps, 't'>>;
  /** Eyebrow heading. Default "Sources". Pass empty string for no heading. */
  heading?: string;
}) {
  if (citations.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {heading && (
        <div
          style={{
            fontFamily: t.mono,
            fontSize: 9.5,
            color: t.muted,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            marginBottom: 2,
          }}
        >
          {heading}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {/* Composite key — label + status + tooltip + href. Distinct
            citations have distinct labels in practice (the formatter
            includes section / part / subsection in the label string).
            react-doctor array-index fix 2026-05-14. */}
        {citations.map((c) => (
          <Citation
            key={`${c.label}|${c.status ?? 'in_effect'}|${c.href ?? ''}`}
            t={t}
            {...c}
          />
        ))}
      </div>
    </div>
  );
}

function stylesForStatus(
  t: Theme,
  status: CitationStatus,
): {
  bg: string;
  border: string;
  color: string;
  badge: { text: string; bg: string; fg: string } | null;
} {
  switch (status) {
    case 'in_effect':
      return {
        bg: t.bgElev,
        border: t.borderSoft,
        color: t.ink,
        badge: null,
      };
    case 'superseded':
      return {
        bg: '#fff0eb',
        border: t.rust,
        color: t.rustInk,
        badge: { text: 'superseded', bg: t.rust, fg: '#fff' },
      };
    case 'not_yet_in_effect':
      return {
        bg: '#fff7e8',
        border: t.tintAccent,
        color: t.rustInk,
        badge: { text: 'pending', bg: t.tintAccent, fg: t.rustInk },
      };
  }
}
