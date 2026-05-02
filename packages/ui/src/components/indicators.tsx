// Status / decoration primitives:
//   - ProgressBar: rust fill, animates between route changes via module-level memo.
//   - Placeholder: dashed outline + diagonal stripes for layout scaffolding.
//   - TrustPill: small "AES-256 / EA / ~10 min" badge on Welcome.

import * as React from 'react';
import type { Theme } from '../tokens.js';

// Module-level memory so ProgressBar animates ACROSS route changes
// (each route mounts a fresh component, but the bar should look like
// a single continuous control).
const __progressLast = { pct: 0, total: 0 };

export function ProgressBar({
  t,
  value,
  total = 100,
}: {
  t: Theme;
  value: number;
  total?: number;
}) {
  const target = Math.min(100, Math.max(0, (value / total) * 100));
  const [pct, setPct] = React.useState(() =>
    __progressLast.total === total ? __progressLast.pct : 0,
  );
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setPct(target));
    __progressLast.pct = target;
    __progressLast.total = total;
    return () => cancelAnimationFrame(id);
  }, [target, total]);
  return (
    <div
      style={{
        height: t.tone === 'magazine' ? 4 : 3,
        background: t.borderSoft,
        borderRadius: 999,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: t.rust,
          transition: 'width 720ms cubic-bezier(0.22, 0.61, 0.36, 1)',
        }}
      />
    </div>
  );
}

export function Placeholder({
  t,
  label,
  w = '100%',
  h = 60,
  style,
}: {
  t: Theme;
  label: string;
  w?: number | string;
  h?: number | string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        width: w,
        height: h,
        border: `1px dashed ${t.border}`,
        borderRadius: t.radius,
        background: `repeating-linear-gradient(135deg, transparent, transparent 8px, ${t.borderSoft} 8px, ${t.borderSoft} 9px)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: t.mono,
        fontSize: 10,
        color: t.muted,
        letterSpacing: 0.5,
        ...style,
      }}
    >
      {label}
    </div>
  );
}

export function TrustPill({
  t,
  children,
  icon,
}: {
  t: Theme;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 11px',
        background: t.bgElev,
        border: `1px solid ${t.borderSoft}`,
        borderRadius: 999,
        fontFamily: t.sans,
        fontSize: 11,
        color: t.inkSoft,
        letterSpacing: 0.1,
      }}
    >
      {icon}
      {children}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// StatusPill — compact status tag in the ease palette. Pill-rounded,
// solid sage / mint / slate / amber fill. Use for: pipeline stage tags,
// issue severity, "Weekly" / "New" / "Pending" labels, etc.
//
// Five named tones map onto ease's accent palette plus a neutral and
// an amber for warning. All have ink text on light fill so contrast
// stays high without needing white-on-color.
// ────────────────────────────────────────────────────────────────

export type StatusTone = 'mint' | 'sage' | 'slate' | 'amber' | 'neutral';

const STATUS_FILL: Record<StatusTone, { bg: string; fg: string }> = {
  mint:    { bg: '#cfe7d3', fg: '#0f3e17' },
  sage:    { bg: '#b1dbb8', fg: '#0f3e17' },
  slate:   { bg: '#b6ced5', fg: '#0f3e17' },
  amber:   { bg: '#f4e9b8', fg: '#5a4a0a' },
  neutral: { bg: '#e5e7eb', fg: '#333333' },
};

export function StatusPill({
  t,
  tone = 'mint',
  children,
}: {
  t: Theme;
  tone?: StatusTone;
  children: React.ReactNode;
}) {
  const fill = STATUS_FILL[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        background: fill.bg,
        color: fill.fg,
        borderRadius: 999,
        fontFamily: t.sans,
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: -0.36,
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────
// StatNumber — confident large numerical headline. Fraunces serif at
// the ease `display` size with a light weight. Optional StatusPill
// caption underneath plus a tight sans label.
//
// Pattern lifted from ease's CRM hero: a card with one big number, a
// small status pill, and a sans label. Use for morning-brief tiles,
// pipeline stat cards, dashboards.
// ────────────────────────────────────────────────────────────────

export function StatNumber({
  t,
  value,
  label,
  pill,
  pillTone = 'mint',
}: {
  t: Theme;
  value: number | string;
  label?: string;
  pill?: string;
  pillTone?: StatusTone;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          fontFamily: t.serif,
          fontSize: 56,
          fontWeight: 300,
          lineHeight: 1.0,
          letterSpacing: -1.68,
          color: '#0f3e17',
          fontFeatureSettings: '"tnum" 1, "lnum" 1',
        }}
      >
        {value}
      </div>
      {pill && (
        <div>
          <StatusPill t={t} tone={pillTone}>
            {pill}
          </StatusPill>
        </div>
      )}
      {label && (
        <div
          style={{
            fontFamily: t.sans,
            fontSize: 14,
            fontWeight: 400,
            lineHeight: 1.5,
            letterSpacing: -0.42,
            color: t.inkSoft,
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}
