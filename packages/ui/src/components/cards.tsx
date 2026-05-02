// Card patterns:
//   - Card: the base container — bordered tile with optional click + selected states.
//   - ToggleCard: multi-select with icon well + check square.
//   - RadioRowCard: single-select with circle indicator.
//   - DependentCountCard: count-icon variant for the dependents-count screen.

import * as React from 'react';
import type { Theme } from '../tokens.js';
import type { StyleProp } from './_types.js';

export function Card({
  t,
  children,
  style,
  onClick,
  selected,
  tinted,
}: {
  t: Theme;
  children: React.ReactNode;
  style?: StyleProp;
  onClick?: () => void;
  selected?: boolean;
  tinted?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: tinted ? t.tintAccent : t.card,
        border: `1px solid ${selected ? t.rust : t.border}`,
        borderRadius: t.radius,
        padding: t.pad,
        transition: 'all 0.15s ease',
        cursor: onClick ? 'pointer' : 'default',
        ...(selected && t.tone === 'magazine' ? { borderWidth: 2 } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// ToggleCard — multi-select card with icon well + check square.
// Used by self-employment, tax-questions, deductions, life-events.
//
// Selected toggles are always ink-on-card (consistent black). The
// previous `emphasis` prop tinted some toggles green for "important"
// items (foreign accounts, cash businesses) — pulled because the
// inconsistency read as a UI bug, not a hint. If we want to call
// attention to specific items later we'll do it with a small
// 'IMPORTANT' label on the row, not a different selected color.
// ────────────────────────────────────────────────────────────────

export function ToggleCard({
  t,
  on,
  onClick,
  icon,
  label,
  sub,
}: {
  t: Theme;
  on: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  sub?: string;
}) {
  const accent = t.ink;
  const accentSoft = t.bgElev;
  const borderColor = on ? accent : t.border;
  const bg = on ? accentSoft : t.card;

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        width: '100%',
        padding: '14px 16px',
        background: bg,
        border: `1px solid ${borderColor}`,
        borderRadius: t.radius,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: t.sans,
        transition: 'border-color 120ms, background 120ms',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: on ? accent : t.bgElev,
          border: `1px solid ${on ? 'transparent' : t.borderSoft}`,
          color: on ? '#fff' : t.inkSoft,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            color: t.ink,
            fontWeight: 500,
            letterSpacing: -0.1,
            marginBottom: sub ? 2 : 0,
          }}
        >
          {label}
        </div>
        {sub && <div style={{ fontSize: 12, color: t.muted, lineHeight: 1.35 }}>{sub}</div>}
      </div>

      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          border: `1.5px solid ${on ? accent : t.border}`,
          background: on ? accent : '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {on && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2">
            <path d="M2.5 6.5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </button>
  );
}

// ────────────────────────────────────────────────────────────────
// RadioRowCard — radio card pattern shared by state-and-prior-year,
// filing, and other single-select screens.
// ────────────────────────────────────────────────────────────────

export function RadioRowCard({
  t,
  selected,
  onClick,
  label,
  sub,
}: {
  t: Theme;
  selected: boolean;
  onClick: () => void;
  label: string;
  sub: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '14px 14px',
        background: selected ? t.tintAccent : t.card,
        border: `1px solid ${selected ? t.rust : t.border}`,
        borderRadius: t.radius,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: t.sans,
        transition: 'border-color 120ms, background 120ms',
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: `1.5px solid ${selected ? t.rust : t.border}`,
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {selected && <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.rust }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: t.ink, letterSpacing: -0.1 }}>
          {label}
        </div>
        <div style={{ fontSize: 12.5, color: t.muted, marginTop: 3, lineHeight: 1.4 }}>
          {sub}
        </div>
      </div>
    </button>
  );
}

// ────────────────────────────────────────────────────────────────
// DependentCountCard — count-icon radio card for ScreenDependentsCount.
// ────────────────────────────────────────────────────────────────

export function DependentCountCard({
  t,
  selected,
  onClick,
  label,
  sub,
  icon,
}: {
  t: Theme;
  selected: boolean;
  onClick: () => void;
  label: string;
  sub?: string;
  icon: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        width: '100%',
        padding: '18px 18px',
        background: selected ? t.tintAccent : t.card,
        border: `1px solid ${selected ? t.rust : t.border}`,
        borderRadius: t.radius,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: t.sans,
        transition: 'border-color 120ms, background 120ms',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: selected ? t.rust : t.bgElev,
          border: `1px solid ${selected ? t.rust : t.borderSoft}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontFamily: t.serif,
          fontSize: 20,
          fontWeight: 500,
          color: selected ? '#fff' : t.ink,
          letterSpacing: -0.4,
        }}
      >
        {icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 16,
            color: t.ink,
            fontWeight: 500,
            letterSpacing: -0.1,
            marginBottom: sub ? 2 : 0,
          }}
        >
          {label}
        </div>
        {sub && <div style={{ fontSize: 12.5, color: t.muted, lineHeight: 1.35 }}>{sub}</div>}
      </div>

      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          border: `1.5px solid ${selected ? t.rust : t.border}`,
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {selected && (
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: t.rust,
            }}
          />
        )}
      </div>
    </button>
  );
}
