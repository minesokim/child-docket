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
        background: t.card,
        border: `1px solid ${t.border}`,
        borderRadius: t.radius,
        padding: '20px 20px 18px',
        maxHeight: 260,
        overflowY: 'auto',
        fontSize: 13,
        lineHeight: 1.55,
        color: t.inkSoft,
        fontFamily: t.serif,
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: t.ink,
          marginBottom: 10,
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
  return (
    <div
      onClick={() => !signed && onSign()}
      style={{
        background: t.card,
        border: `1.5px dashed ${signed ? t.rust : t.border}`,
        borderRadius: t.radius,
        padding: signed ? '14px 18px' : '28px 18px',
        cursor: signed ? 'default' : 'pointer',
        transition: 'all 0.2s',
      }}
    >
      {signed ? (
        <div>
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
      ) : (
        <Row justify="center" gap={8}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M2 12l3-1 8-8 1 1-8 8-1 3-3-3z"
              stroke={t.muted}
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>
          <span style={{ fontSize: 14, color: t.muted }}>Tap to sign</span>
        </Row>
      )}
    </div>
  );
}
