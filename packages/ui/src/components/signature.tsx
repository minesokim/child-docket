// Legal-document + e-signature primitives:
//   - LegalDoc: scrollable doc viewer used by engagement letter and §7216 consent.
//   - SignaturePad: tap-to-sign component. Renders the signer's name in a
//     script font + a cryptographic-looking timestamp once signed.

import * as React from 'react';
import type { Theme } from '../tokens.js';
import { Row } from './layout.js';

export function LegalDoc({
  t,
  title,
  paras,
}: {
  t: Theme;
  title: string;
  paras: string[];
}) {
  return (
    <div
      style={{
        // Legal documents look like paper — white surface, no green.
        // Soft drop shadow gives elevation without an outline. Width
        // capped at 80% (centered) so the user has thumb space along
        // the right edge to scroll without occluding the text.
        background: '#fffefc',
        border: 'none',
        borderRadius: t.radius,
        padding: '24px 22px 22px',
        maxHeight: 420,
        overflowY: 'auto',
        fontSize: 14,
        lineHeight: 1.6,
        color: t.inkSoft,
        fontFamily: t.serif,
        boxShadow: '0 2px 12px rgba(15, 23, 12, 0.06)',
        width: '80%',
        marginInline: 'auto',
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: t.ink,
          marginBottom: 14,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          fontFamily: t.sans,
        }}
      >
        {title}
      </div>
      {paras.map((p, i) => (
        <p key={i} style={{ margin: '0 0 10px' }}>
          {p}
        </p>
      ))}
    </div>
  );
}

function formatNowTimestamp(): string {
  const now = new Date();
  const month = now.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const day = now.getDate();
  const year = now.getFullYear();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `SIGNED ${month} ${day}, ${year} · ${hours}:${minutes} ${ampm} PT`;
}

export function SignaturePad({
  t,
  signed,
  onSign,
  name,
  timestamp,
}: {
  t: Theme;
  signed: boolean;
  onSign: () => void;
  name: string;
  timestamp?: string;
}) {
  // White paper surface in both states — legal signing should feel
  // like a contract, not a celebration. The script-font signature
  // appearing on the white card is the visual signal of state.
  //
  // A11y: unsigned state is a <button> so keyboard users (Enter /
  // Space) can sign — this is a legal-binding action and must work
  // without a mouse for IRS Pub 1345 + ADA / WCAG 2.1 AA compliance.
  // Signed state renders as a plain div (no longer interactive).
  // react-doctor a11y fix 2026-05-14.
  const surfaceStyle: React.CSSProperties = {
    background: '#fffefc',
    border: 'none',
    borderRadius: t.radius,
    padding: signed ? '14px 18px' : '28px 18px',
    width: '80%',
    marginInline: 'auto',
    boxSizing: 'border-box',
    boxShadow: '0 2px 12px rgba(15, 23, 12, 0.06)',
  };

  if (signed) {
    // role="status" + aria-live="polite" announce the state change
    // to screen readers when the button unmounts post-sign (codex
    // catch 2026-05-14 — without this the focus handoff is silent
    // for keyboard + AT users).
    return (
      <div
        role="status"
        aria-live="polite"
        style={{ ...surfaceStyle, cursor: 'default' }}
      >
        <div
          style={{
            fontFamily: '"Caveat", "Brush Script MT", cursive',
            fontSize: 28,
            color: t.ink,
            lineHeight: 1,
          }}
        >
          {name || 'Signature'}
        </div>
        <div
          style={{
            fontFamily: t.mono,
            fontSize: 10,
            color: t.muted,
            letterSpacing: 0.5,
            marginTop: 4,
          }}
        >
          {timestamp || formatNowTimestamp()}
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSign}
      aria-label="Tap to sign this document"
      style={{
        ...surfaceStyle,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        color: 'inherit',
      }}
    >
      <Row justify="center" gap={8}>
        {/* Pen icon — decorative; "Tap to sign" text below carries
            the label. aria-hidden so screen readers don't read it. */}
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path
            d="M2 12l3-1 8-8 1 1-8 8-1 3-3-3z"
            stroke={t.muted}
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
        <span style={{ fontSize: 14, color: t.muted }}>Tap to sign</span>
      </Row>
    </button>
  );
}
