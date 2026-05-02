// Icon + brand mark primitives:
//   - IncomeIcon: 5-variant stroke icon for ScreenIncomeSources.
//   - HandCheckmark: animated success mark for ScreenDone + post-8879 sign overlay.
//   - Wordmark: "Vazant Consulting" lockup used in portal headers.

import * as React from 'react';
import type { Theme } from '../tokens.js';

export type IncomeIconKind = 'w2' | 'self' | 'rental' | 'invest' | 'retire';

export function IncomeIcon({ kind, size = 20 }: { kind: IncomeIconKind; size?: number }) {
  const s = {
    width: size,
    height: size,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
  } as const;
  switch (kind) {
    case 'w2':
      return (
        <svg {...s} viewBox="0 0 20 20">
          <rect x="3" y="4" width="14" height="13" rx="1.5" />
          <path d="M6 8h8M6 11h8M6 14h5" strokeLinecap="round" />
        </svg>
      );
    case 'self':
      return (
        <svg {...s} viewBox="0 0 20 20">
          <circle cx="10" cy="6.5" r="2.5" />
          <path d="M4 17c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round" />
        </svg>
      );
    case 'rental':
      return (
        <svg {...s} viewBox="0 0 20 20">
          <path d="M3 9l7-5 7 5v8H3V9z" strokeLinejoin="round" />
          <path d="M8 17v-4h4v4" strokeLinejoin="round" />
        </svg>
      );
    case 'invest':
      return (
        <svg {...s} viewBox="0 0 20 20">
          <path d="M3 15l4-4 3 2 7-8" strokeLinejoin="round" strokeLinecap="round" />
          <path d="M13 5h4v4" strokeLinecap="round" />
        </svg>
      );
    case 'retire':
      return (
        <svg {...s} viewBox="0 0 20 20">
          <circle cx="10" cy="10" r="7" />
          <path d="M10 6v4l3 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

export function HandCheckmark({ t, size = 120 }: { t: Theme; size?: number }) {
  return (
    <>
      <style>{`
        @keyframes hc-pop {
          0%   { transform: scale(0);   opacity: 0; }
          60%  { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1);    opacity: 1; }
        }
        @keyframes hc-draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes hc-halo {
          0%   { transform: scale(0.4); opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
        }
      `}</style>
      <svg width={size} height={size} viewBox="0 0 120 120" style={{ display: 'block', overflow: 'visible' }}>
        <circle
          cx="60"
          cy="60"
          r="46"
          fill="none"
          stroke={t.rust}
          strokeWidth="1.5"
          opacity="0"
          style={{
            transformOrigin: '60px 60px',
            animation: 'hc-halo 1.1s ease-out 0.35s forwards',
          }}
        />
        <g
          style={{
            transformOrigin: '60px 60px',
            animation: 'hc-pop 0.55s cubic-bezier(.34,1.56,.64,1) both',
          }}
        >
          <circle cx="60" cy="60" r="46" fill={t.rust} />
        </g>
        <path
          d="M40 62 L54 76 L82 46"
          stroke="#fff"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          style={{
            strokeDasharray: 70,
            strokeDashoffset: 70,
            animation: 'hc-draw 0.5s cubic-bezier(.65,0,.35,1) 0.45s forwards',
          }}
        />
      </svg>
    </>
  );
}

export function Wordmark({ t }: { t: Theme }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: `radial-gradient(circle at 30% 30%, ${t.rustSoft}, ${t.card})`,
          border: `1px solid ${t.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: t.serif,
          fontSize: 12,
          color: t.rustInk,
        }}
      >
        V
      </div>
      <span
        style={{
          fontFamily: t.serif,
          fontSize: 14,
          letterSpacing: -0.2,
          color: t.ink,
        }}
      >
        Vazant Consulting
      </span>
    </div>
  );
}
