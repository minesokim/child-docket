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
