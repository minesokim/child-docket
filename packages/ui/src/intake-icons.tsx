// Inline SVG icons for intake screens (self-employment, tax-questions,
// deductions, life-events). Each is a small named component with optional
// `size` prop. Identical to the JSX prototype.

import * as React from 'react';

type IconProps = { size?: number };

const stroke = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

// ── Self-employment ────────────────────────────────────────────

export function IconHome({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...stroke}>
      <path d="M2.5 7L8 2.5 13.5 7v6.5H2.5V7z" />
      <path d="M6.5 13.5v-4h3v4" />
    </svg>
  );
}

export function IconCar({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...stroke}>
      <path d="M2 10.5v-2l1.5-3.5h9L14 8.5v2" />
      <path d="M2 10.5h12v2H2z" />
      <circle cx="5" cy="12.5" r="1" />
      <circle cx="11" cy="12.5" r="1" />
    </svg>
  );
}

export function IconCash({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...stroke}>
      <rect x="1.5" y="4" width="13" height="8" rx="1" />
      <circle cx="8" cy="8" r="1.8" />
      <path d="M4 8h.5M11.5 8h.5" />
    </svg>
  );
}

// ── Tax questions ──────────────────────────────────────────────

export function IconCrypto({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...stroke}>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M6.5 5.5v5M9.5 5.5v5M5.5 7H10a1.25 1.25 0 010 2.5H5.5M5.5 9.5h4.8a1.25 1.25 0 010 2.5H5.5" />
    </svg>
  );
}

export function IconReceipt({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...stroke}>
      <path d="M3.5 2h9v12l-1.5-1-1.5 1-1.5-1-1.5 1-1.5-1-1.5 1V2z" />
      <path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" />
    </svg>
  );
}

export function IconHeart({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...stroke}>
      <path d="M8 13.5S2.5 10 2.5 6a3 3 0 015.5-1.7A3 3 0 0113.5 6c0 4-5.5 7.5-5.5 7.5z" />
    </svg>
  );
}

export function IconPiggy({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...stroke}>
      <rect x="2" y="5" width="12" height="7" rx="2" />
      <path d="M5 5V3.5h6V5M4 12v1.5M12 12v1.5M11 8h.5" />
    </svg>
  );
}

export function IconGlobe({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...stroke}>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M2.5 8h11M8 2.5c1.8 2 1.8 9 0 11M8 2.5c-1.8 2-1.8 9 0 11" />
    </svg>
  );
}

export function IconClock({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...stroke}>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5v3.2l2 1.3" />
    </svg>
  );
}

export function IconTip({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...stroke}>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5v6M9.8 6.3c-.3-.5-1-.8-1.8-.8-1 0-1.8.5-1.8 1.3 0 1.8 3.6 1 3.6 2.6 0 .8-.8 1.3-1.8 1.3-.8 0-1.5-.3-1.8-.8" />
    </svg>
  );
}

// ── Deductions ─────────────────────────────────────────────────

export function IconCap({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...stroke}>
      <path d="M1.5 6L8 3l6.5 3L8 9 1.5 6z" />
      <path d="M4 7v3c0 1 1.8 2 4 2s4-1 4-2V7" />
    </svg>
  );
}

export function IconChild({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...stroke}>
      <circle cx="8" cy="4.5" r="2" />
      <path d="M3.5 14c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5" />
    </svg>
  );
}

export function IconMed({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...stroke}>
      <path d="M6 3h4v3h3v4h-3v3H6v-3H3V6h3V3z" />
    </svg>
  );
}

export function IconBook({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...stroke}>
      <path d="M3 3h4.5c1 0 1.5.5 1.5 1.5V13c0-.8-.5-1.3-1.5-1.3H3V3zM13 3H8.5C7.5 3 7 3.5 7 4.5V13c0-.8.5-1.3 1.5-1.3H13V3z" />
    </svg>
  );
}

export function IconApple({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...stroke}>
      <path d="M8 5c-1.5-1.8-5-1.3-5 2 0 3 2.5 6 5 6s5-3 5-6c0-3.3-3.5-3.8-5-2z" />
      <path d="M8 5V3.5M8 3.5s1 0 1.5-1" />
    </svg>
  );
}

export function IconMinus({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...stroke}>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M5 8h6" />
    </svg>
  );
}

// ── Life events ────────────────────────────────────────────────

export function IconRings({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...stroke}>
      <circle cx="6" cy="10" r="3.5" />
      <circle cx="10" cy="10" r="3.5" />
    </svg>
  );
}

export function IconStroller({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...stroke}>
      <path d="M3 3l3 3v4h7" />
      <path d="M13 10a4 4 0 00-7-3" />
      <circle cx="6" cy="13" r="1" />
      <circle cx="12" cy="13" r="1" />
    </svg>
  );
}

export function IconKey({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...stroke}>
      <circle cx="5" cy="11" r="2.5" />
      <path d="M7 10l6-6M11 5l1.5 1.5M9.5 6.5L11 8" />
    </svg>
  );
}

export function IconBriefcase({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...stroke}>
      <rect x="2" y="5" width="12" height="8" rx="1" />
      <path d="M6 5V3.5a1 1 0 011-1h2a1 1 0 011 1V5M2 8.5h12" />
    </svg>
  );
}

export function IconGift({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...stroke}>
      <rect x="2" y="6" width="12" height="7" rx="1" />
      <path d="M2 9h12M8 6v7M5.5 6c-1.5 0-1.5-2.5 0-2.5C7 3.5 8 6 8 6S9 3.5 10.5 3.5c1.5 0 1.5 2.5 0 2.5" />
    </svg>
  );
}

export function IconBeach({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...stroke}>
      <path d="M8 2v12M2 10c2 0 4-1 6-1s4 1 6 1" />
      <path d="M3 6a5 5 0 0110 0" />
    </svg>
  );
}
