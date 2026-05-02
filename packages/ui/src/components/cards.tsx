// Card patterns — ZERO-STROKE pass.
//
// Per design call (May 2026): no box borders anywhere. ease.health
// uses solid fills + soft shadows + color contrast for affordance.
// Selected states are signaled by SOLID FILL color, not by a darker
// stroke. Unselected items sit on a soft tinted base.
//
//   - Card: base container — accepts `accent` (ease palette) for tile
//     variants. No border. Subtle shadow on click-affordance variants.
//   - ToggleCard: multi-select. Unselected = pale keylimeWash fill.
//     Selected = forestDark fill + white text + filled check square.
//   - RadioRowCard: single-select. Same logic as ToggleCard.
//   - DependentCountCard: count-icon variant for the dependents-count
//     screen. Number rendered in SANS now (was serif) per design call.

import * as React from 'react';
import type { Theme } from '../tokens.js';
import type { StyleProp } from './_types.js';

/** Card accent variants — map directly onto the ease palette. The
 *  `forestDark` variant flips the foreground to white because it's the
 *  only dark surface; everything else keeps ink text. */
export type CardAccent =
  | 'mintGlaze'
  | 'slateMist'
  | 'keylimeWash'
  | 'mintKiss'
  | 'forestDark';

const ACCENT_FILL: Record<CardAccent, { bg: string; fg: string }> = {
  mintGlaze:    { bg: '#b1dbb8', fg: '#0f3e17' },
  slateMist:    { bg: '#b6ced5', fg: '#0f3e17' },
  keylimeWash:  { bg: '#e1f4df', fg: '#0f3e17' },
  mintKiss:     { bg: '#cfe7d3', fg: '#0f3e17' },
  forestDark:   { bg: '#0f3e17', fg: '#fffefc' },
};

export function Card({
  t,
  children,
  style,
  onClick,
  selected,
  tinted,
  accent,
}: {
  t: Theme;
  children: React.ReactNode;
  style?: StyleProp;
  onClick?: () => void;
  selected?: boolean;
  tinted?: boolean;
  /** ease-palette tinted variant. Pairs with `tile` density at the
   *  caller (e.g. portal home action grid). Mutually exclusive with
   *  `tinted`; if both set, `accent` wins. */
  accent?: CardAccent;
}) {
  // Resolve the surface. `accent` (ease palette) > `tinted` (legacy
  // rust-soft tint) > selected ease.mintKiss > default white.
  const accentFill = accent ? ACCENT_FILL[accent] : null;
  const background =
    accentFill?.bg ??
    (selected ? t.ease.mintKiss : tinted ? t.tintAccent : t.card);
  const color = accentFill?.fg ?? (selected ? t.ease.forestDark : t.ink);

  return (
    <div
      onClick={onClick}
      style={{
        background,
        color,
        // Zero box stroke. Affordance from fill + shadow only.
        border: 'none',
        borderRadius: t.radius,
        padding: t.pad,
        transition: 'all 0.15s ease',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// ToggleCard — multi-select with check square. Zero-stroke.
//
// Unselected: white surface, plain icon well in pale keylimeWash, ink
//             label, empty rounded check square (filled white, no border).
// Selected:   soft mintGlaze fill, forestDark icon well + white icon,
//             forestDark label, filled forestDark check square with
//             white check.
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
  // Match services-page selection convention: mintKiss card bg
  // (lighter) + forestMid icon well + check.
  const bg = on ? t.ease.mintKiss : '#fffefc';
  const labelColor = on ? t.ease.forestDark : t.ink;
  const subColor = on ? t.ease.forestDark : t.muted;
  const iconWellBg = on ? t.ease.forestMid : t.ease.keylimeWash;
  const iconColor = on ? '#fffefc' : t.ease.forestDark;
  const checkBg = on ? t.ease.forestMid : '#fffefc';

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
        border: 'none',
        borderRadius: t.radius,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: t.sans,
        // Shadow lift matches /income card pattern — selected gets a
        // stronger lift so the row feels picked-up off the page.
        boxShadow: on
          ? '0 4px 16px rgba(15, 62, 23, 0.08)'
          : '0 1px 4px rgba(15, 62, 23, 0.04)',
        transition: 'background 720ms cubic-bezier(.19, 1, .22, 1), box-shadow 540ms cubic-bezier(.19, 1, .22, 1)',
      }}
    >
      <div
        style={{
          // No box around the icon — let the icon's own duotone palette
          // sit on the row. iconColor still applies to currentColor-driven
          // legacy icons (IconHome, IconCar, etc.) for unselected
          // contrast, but Solar Line Duotone icons use their own fixed
          // colors and ignore it.
          color: iconColor,
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
            color: labelColor,
            fontWeight: 400,
            letterSpacing: -0.1,
            marginBottom: sub ? 2 : 0,
          }}
        >
          {label}
        </div>
        {sub && (
          <div style={{ fontSize: 12, color: subColor, opacity: on ? 0.7 : 1, lineHeight: 1.35 }}>
            {sub}
          </div>
        )}
      </div>

      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          background: checkBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'background 160ms cubic-bezier(.2,.8,.2,1)',
        }}
      >
        {on && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#fffefc" strokeWidth="2">
            <path d="M2.5 6.5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </button>
  );
}

// ────────────────────────────────────────────────────────────────
// RadioRowCard — single-select. Zero-stroke.
// Unselected: white. Selected: mintGlaze fill, forestDark text + dot.
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
  // Match the services-page selection convention: mintKiss card bg
  // (lighter than mintGlaze) + forestMid dot (lighter than forestDark).
  const bg = selected ? t.ease.mintKiss : '#fffefc';
  const labelColor = selected ? t.ease.forestDark : t.ink;
  const subColor = selected ? t.ease.forestDark : t.muted;
  const dotWellBg = selected ? t.ease.forestMid : t.ease.keylimeWash;

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '14px 14px',
        background: bg,
        border: 'none',
        borderRadius: t.radius,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: t.sans,
        transition: 'background 160ms cubic-bezier(.2,.8,.2,1)',
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: dotWellBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 1,
          transition: 'background 160ms cubic-bezier(.2,.8,.2,1)',
        }}
      >
        {selected && (
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fffefc' }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 400, color: labelColor, letterSpacing: -0.1 }}>
          {label}
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: subColor,
            opacity: selected ? 0.7 : 1,
            marginTop: 3,
            lineHeight: 1.4,
          }}
        >
          {sub}
        </div>
      </div>
    </button>
  );
}

// ────────────────────────────────────────────────────────────────
// DependentCountCard — count-icon radio card. Zero-stroke.
//
// Number in the icon well now uses SANS (was serif) per design call —
// matches ease's preference for sans on operational numbers.
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
  const bg = selected ? t.ease.mintGlaze : '#fffefc';
  const labelColor = selected ? t.ease.forestDark : t.ink;
  const subColor = selected ? t.ease.forestDark : t.muted;
  const iconWellBg = selected ? t.ease.forestDark : t.ease.keylimeWash;
  const iconColor = selected ? '#fffefc' : t.ease.forestDark;
  const dotWellBg = selected ? t.ease.forestDark : t.ease.keylimeWash;

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        width: '100%',
        padding: '18px 18px',
        background: bg,
        border: 'none',
        borderRadius: t.radius,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: t.sans,
        transition: 'background 160ms cubic-bezier(.2,.8,.2,1)',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: iconWellBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontFamily: t.sans,
          fontSize: 20,
          fontWeight: 500,
          color: iconColor,
          letterSpacing: -0.4,
          fontFeatureSettings: '"tnum" 1, "lnum" 1',
          transition: 'background 160ms cubic-bezier(.2,.8,.2,1)',
        }}
      >
        {icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 16,
            color: labelColor,
            fontWeight: 400,
            letterSpacing: -0.1,
            marginBottom: sub ? 2 : 0,
          }}
        >
          {label}
        </div>
        {sub && (
          <div
            style={{
              fontSize: 12.5,
              color: subColor,
              opacity: selected ? 0.7 : 1,
              lineHeight: 1.35,
            }}
          >
            {sub}
          </div>
        )}
      </div>

      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: dotWellBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'background 160ms cubic-bezier(.2,.8,.2,1)',
        }}
      >
        {selected && (
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fffefc' }} />
        )}
      </div>
    </button>
  );
}
