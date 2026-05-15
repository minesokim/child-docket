'use client';

// LegalCheckbox — a11y-compliant checkbox for engagement letter +
// §7216 consent + any other legal-doc agreement gate in the intake
// flow. Renders as <button role="checkbox" aria-checked> so keyboard
// users (Space + Enter) can activate, screen readers announce the
// state, and click bubbling works the same as the prior div pattern.
//
// Visual chrome preserved exactly from the original click-div code:
//   - 22×22 box
//   - forestMid filled / keylimeWash empty
//   - check SVG inside when checked
//   - inline label text at 14px on inkSoft
//
// Originally inlined in apps/client-portal/src/app/(intake)/consent/
// page.tsx — moved here when engagement/page.tsx needed the same
// pattern. react-doctor a11y cleanup 2026-05-15.

import * as React from 'react';
import type { buildTheme } from '@docket/ui';

type Theme = ReturnType<typeof buildTheme>;

export function LegalCheckbox({
  t,
  checked,
  onChange,
  label,
}: {
  t: Theme;
  checked: boolean;
  onChange: () => void;
  label: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left',
        fontFamily: 'inherit',
        color: 'inherit',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 22,
          height: 22,
          flexShrink: 0,
          borderRadius: 5,
          background: checked ? t.ease.forestMid : t.ease.keylimeWash,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 1,
        }}
      >
        {checked && (
          <svg width="12" height="10" viewBox="0 0 12 10">
            <path
              d="M1 5l3.5 3.5L11 1"
              stroke="#fff"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span style={{ fontSize: 14, color: t.inkSoft, lineHeight: 1.5 }}>
        {label}
      </span>
    </button>
  );
}
