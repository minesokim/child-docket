// Button primitives — ZERO-STROKE pass.
//
//   - Button: 4 variants (primary/success/ghost/dark). Pill in editorial
//     (full-round 999) per design call. Square in magazine tone.
//     ALL variants are now strokeless — ghost gets a soft keylimeWash
//     fill instead of an outline.
//   - BackButton: chevron + label, every intake screen after step 1.
//   - IntakeBackButton: smaller "← Back" link at the top of intake screens.

import * as React from 'react';
import type { Theme } from '../tokens.js';
import type { StyleProp } from './_types.js';

export function Button({
  t,
  variant = 'primary',
  children,
  onClick,
  disabled,
  style,
  icon,
  type = 'button',
}: {
  t: Theme;
  variant?: 'primary' | 'success' | 'ghost' | 'dark';
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  style?: StyleProp;
  icon?: React.ReactNode;
  type?: 'button' | 'submit';
}) {
  const variants = {
    primary: { bg: t.rust, fg: '#fff' },
    success: { bg: t.green, fg: '#fff' },
    // Ghost was outlined-on-card. Now: pale keylimeWash fill, forestDark
    // text. Reads as a secondary action without an outline.
    ghost:   { bg: t.ease.keylimeWash, fg: t.ease.forestDark },
    dark:    { bg: t.ink, fg: t.bgElev },
  };
  const base = variants[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? t.borderSoft : base.bg,
        color: disabled ? t.muted : base.fg,
        border: 'none',
        borderRadius: t.tone === 'magazine' ? 4 : 999,
        padding: '14px 22px',
        fontFamily: t.sans,
        fontSize: 16,
        fontWeight: 400,
        letterSpacing: -0.1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        ...style,
      }}
    >
      {children}
      {icon}
    </button>
  );
}

export function BackButton({
  t,
  onClick,
}: {
  t: Theme;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: t.inkSoft,
        fontSize: 14,
        padding: 8,
        marginLeft: -8,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: t.sans,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <svg width="8" height="13" viewBox="0 0 8 13" fill="none">
        <path d="M7 1L1 6.5L7 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      Back
    </button>
  );
}

export function IntakeBackButton({
  t,
  onClick,
}: {
  t: Theme;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        fontSize: 13,
        color: t.muted,
        fontFamily: t.sans,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M9 3l-4 4 4 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Back
    </button>
  );
}
