// Solar-inspired Line Duotone icons — hand-drawn for Docket.
//
// Style: forestDark 1.5px stroke + mintGlaze accent fill at ~65%
// opacity. Icons live on transparent backgrounds at 32x32 nominal.
// Pair with the editorial cream + forest palette.
//
// These are the FIRST 5 SAMPLES — replacements for the lineart icons
// in ServiceIcon (personal/self/biz/consult) plus a sample mortgage
// icon for /deductions reference. The full ~30-icon rollout follows
// once the sample direction is approved.

import * as React from 'react';

type IconProps = { size?: number };

// ────────────────────────────────────────────────────────────────
// Shared palette — driven by tokens at runtime so a theme switch
// doesn't strand these. Hardcoded here for inline-SVG performance;
// change in tokens.ts and propagate via find/replace if the palette
// shifts.
// ────────────────────────────────────────────────────────────────

const STROKE = '#0f3e17';   // forestDark
const FILL = '#b1dbb8';     // mintGlaze
const FILL_OPACITY = 0.65;

// ────────────────────────────────────────────────────────────────
// /services — 4 path tiles
// ────────────────────────────────────────────────────────────────

/** Personal tax return — W-2 document with a small person silhouette. */
export function SolarPersonalReturn({ size = 32 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Mint accent blob behind the document */}
      <ellipse cx="22" cy="9" rx="7" ry="6" fill={FILL} opacity={FILL_OPACITY} />
      {/* Document outline */}
      <path
        d="M7 6a2 2 0 0 1 2-2h11l5 5v17a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6z"
        stroke={STROKE}
        strokeWidth="1.5"
        fill="white"
        strokeLinejoin="round"
      />
      <path
        d="M20 4v3a2 2 0 0 0 2 2h3"
        stroke={STROKE}
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Person silhouette on the document */}
      <circle cx="15" cy="15" r="2.5" stroke={STROKE} strokeWidth="1.5" fill="white" />
      <path
        d="M10.5 23c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5"
        stroke={STROKE}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Self-employed — hand offering a coin with $ */
export function SolarSelfEmployed({ size = 32 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Mint accent blob — the coin */}
      <circle cx="16" cy="11" r="6" fill={FILL} opacity={FILL_OPACITY} />
      {/* Coin outline + dollar sign */}
      <circle cx="16" cy="11" r="5.5" stroke={STROKE} strokeWidth="1.5" fill="white" />
      <path
        d="M14 9.5h3.2a1.3 1.3 0 0 1 0 2.6h-2.4a1.3 1.3 0 0 0 0 2.6H18M16 7.5v7"
        stroke={STROKE}
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
      {/* Hand cradling the coin */}
      <path
        d="M5 24c0-2 1.8-3.5 4-3.5h14c2.2 0 4 1.5 4 3.5v3H5v-3z"
        stroke={STROKE}
        strokeWidth="1.5"
        fill="white"
        strokeLinejoin="round"
      />
      <path d="M9 22.5l-2.5-2.5M23 22.5l2.5-2.5" stroke={STROKE} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** Business — storefront with awning */
export function SolarBusiness({ size = 32 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Mint awning */}
      <path
        d="M4 8h24l-2 5H6L4 8z"
        fill={FILL}
        opacity={FILL_OPACITY}
        stroke={STROKE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Building body */}
      <path d="M6 13v15h20V13" stroke={STROKE} strokeWidth="1.5" strokeLinejoin="round" />
      {/* Door */}
      <path
        d="M13 28v-7a3 3 0 0 1 6 0v7"
        stroke={STROKE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="17.5" cy="24.5" r="0.6" fill={STROKE} />
      {/* Window left */}
      <rect x="8" y="16" width="3.5" height="3.5" stroke={STROKE} strokeWidth="1.3" />
      {/* Window right */}
      <rect x="20.5" y="16" width="3.5" height="3.5" stroke={STROKE} strokeWidth="1.3" />
    </svg>
  );
}

/** Something else / consultation — speech bubble with three dots */
export function SolarConsultation({ size = 32 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Mint accent blob — small bubble at corner */}
      <circle cx="24" cy="22" r="5" fill={FILL} opacity={FILL_OPACITY} />
      {/* Main speech bubble */}
      <path
        d="M5 8a2 2 0 0 1 2-2h18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-9l-5 4v-4H7a2 2 0 0 1-2-2V8z"
        stroke={STROKE}
        strokeWidth="1.5"
        fill="white"
        strokeLinejoin="round"
      />
      {/* Three dots */}
      <circle cx="11" cy="14" r="1.3" fill={STROKE} />
      <circle cx="16" cy="14" r="1.3" fill={STROKE} />
      <circle cx="21" cy="14" r="1.3" fill={STROKE} />
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────
// /deductions — sample mortgage icon (preview of the next batch)
// ────────────────────────────────────────────────────────────────

/** Mortgage interest — house with a small key inside */
export function SolarMortgage({ size = 32 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Mint roof fill */}
      <path
        d="M16 4 3 15h26L16 4z"
        fill={FILL}
        opacity={FILL_OPACITY}
        stroke={STROKE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* House body */}
      <path d="M6 15v13h20V15" stroke={STROKE} strokeWidth="1.5" strokeLinejoin="round" />
      {/* Key inside (small, centered) */}
      <circle cx="14" cy="22" r="2.2" stroke={STROKE} strokeWidth="1.4" fill="white" />
      <path
        d="M16.2 22h4.5M19 22v1.5M20.5 22v1.8"
        stroke={STROKE}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
