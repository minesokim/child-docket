// MetricStrip — aggregate count / dollar / percentage strip that opens
// every command-room page.
//
// Per CLAUDE.md §4: "Every page in the command room opens with an
// aggregate metric strip at the top — counts, totals, dollar amounts —
// so the preparer's eye lands on the number first, then the list."
// Inherited from the v3 Vazant dashboard IA, locked 2026-05-13.
//
// VOICE
//   - Operational-modern. Inter / Geist sans, soft 1px borders,
//     warm-near-white card. Not editorial-warm portal language.
//   - Numbers as headline, label as subhead. Numbers are the noun;
//     labels are the adjective.
//   - Hover-to-source is the contract: each metric should be clickable
//     when it has a meaningful drill-down (caller-supplied href).
//
// SHAPE
//   <MetricStrip metrics={[
//     { label: 'Active clients', value: 247, href: '/clients' },
//     { label: 'Past-due invoices', value: '$12.4K', tone: 'warning' },
//     { label: 'Need approval', value: 8, tone: 'critical', href: '/messages?filter=draft' },
//   ]} />
//
// TONE PALETTE
//   default      neutral ink
//   positive     forest green (revenue, completion, on-track)
//   warning      amber (overdue, approaching deadline)
//   critical     deep terra (past deadline, audit risk, urgent)
//
// USE WITH RESTRAINT
//   3-5 metrics is the sweet spot. >7 reads as a wall and the eye
//   stops landing. If you have more than 5, split into a primary
//   strip (here) plus a secondary "view all" link.

import Link from 'next/link';

type MetricTone = 'default' | 'positive' | 'warning' | 'critical';

export type Metric = {
  /** Short noun-phrase label rendered below the value. */
  label: string;
  /** Pre-formatted value. Caller decides "$12,400" vs "12.4K" vs "247". */
  value: string | number;
  /** Optional small caption rendered under the label (e.g., "this week"). */
  caption?: string;
  /** Color treatment. Default = neutral ink. */
  tone?: MetricTone;
  /** When supplied, the whole tile becomes a clickable link to drill in. */
  href?: string;
};

type Props = {
  metrics: Metric[];
  /** Optional title rendered above the strip ("This week" / "All clients"). */
  title?: string;
};

const TONE_COLORS: Record<MetricTone, string> = {
  default: 'oklch(20% 0.01 85)',
  positive: 'oklch(42% 0.09 150)',
  warning: 'oklch(58% 0.13 75)',
  critical: 'oklch(52% 0.18 28)',
};

export function MetricStrip({ metrics, title }: Props) {
  if (metrics.length === 0) return null;
  return (
    <section
      aria-label={title ?? 'Page metrics'}
      style={{
        marginBottom: 28,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      {title && (
        <h2
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'oklch(48% 0.01 85)',
            letterSpacing: 0.2,
            textTransform: 'uppercase',
            margin: '0 0 12px 0',
          }}
        >
          {title}
        </h2>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(metrics.length, 5)}, minmax(0, 1fr))`,
          gap: 12,
        }}
      >
        {metrics.map((m, i) => (
          <MetricTile key={`${m.label}-${i}`} metric={m} />
        ))}
      </div>
    </section>
  );
}

function MetricTile({ metric }: { metric: Metric }) {
  const tone = metric.tone ?? 'default';
  const tileInner = (
    <div
      style={{
        padding: '16px 18px',
        background: 'oklch(99% 0.005 85)',
        border: '1px solid oklch(92% 0.008 85)',
        borderRadius: 12,
        transition: 'border-color 120ms ease',
      }}
    >
      <div
        style={{
          fontSize: 28,
          fontWeight: 600,
          lineHeight: 1.1,
          color: TONE_COLORS[tone],
          letterSpacing: -0.4,
        }}
      >
        {metric.value}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 13,
          fontWeight: 500,
          color: 'oklch(30% 0.01 85)',
          letterSpacing: 0.1,
        }}
      >
        {metric.label}
      </div>
      {metric.caption && (
        <div
          style={{
            marginTop: 2,
            fontSize: 11,
            color: 'oklch(55% 0.01 85)',
            letterSpacing: 0.2,
          }}
        >
          {metric.caption}
        </div>
      )}
    </div>
  );
  if (metric.href) {
    return (
      <Link
        href={metric.href}
        style={{ textDecoration: 'none', display: 'block' }}
      >
        {tileInner}
      </Link>
    );
  }
  return tileInner;
}
