// Docket design tokens — ported from designer's tokens.jsx and aligned
// with the ease.health design system (Refero-published).
//
// Three tone variants. Editorial cream is the lead.
// Forest green primary (oklch 150 hue). Fraunces serif + DM Sans body.
//
// EASE-ALIGNED LAYER (added May 2026)
//   The ease.* / text.* / spacing / radii constants exposed below mirror
//   the Refero spec at:
//     styles.refero.design/style/e9f5e976-53f7-42f5-a882-4e63b3c2f734
//   They coexist with the original tokens — existing screens keep working
//   while new primitives reach for the ease palette directly.

export type Tone = 'editorial' | 'minimal' | 'magazine';
export type FontPairing = 'classic' | 'instrument' | 'newsreader';
export type Density = 'comfortable' | 'cozy';

// ────────────────────────────────────────────────────────────────
// EASE PALETTE — exact hex values from the Refero design system.
// Used as a semantic accent layer on top of the editorial cream
// substrate. Apply via the new Card `accent` prop, StatusPill, etc.
// ────────────────────────────────────────────────────────────────
export const EASE = {
  // Brand
  forestDark: '#0f3e17',     // primary brand green; darker than oklch rust
  // Accent surfaces (semantic backgrounds for tile cards / status pills)
  mintGlaze: '#b1dbb8',      // mid sage — primary accent fill
  slateMist: '#b6ced5',      // powder blue — secondary category encoding
  keylimeWash: '#e1f4df',    // lightest mint per Refero spec — surfaces
  mintKiss: '#cfe7d3',       // medium mint — middle-emphasis surface
  mintWhisper: '#f4faf3',    // near-white with a green tinge — focus tint
  softNeutral: '#f5f4f1',    // warm off-white, no green tint — empty input bg
  // Neutrals
  inkText: '#222222',
  darkCharcoal: '#333333',
  borderGrey: '#e5e7eb',
  creamCanvas: '#fffefc',
} as const;

// ────────────────────────────────────────────────────────────────
// EASE TYPE SCALE — 8 named slots from caption to display-lg.
// Use for new components rather than ad-hoc font-size values.
// Weights: 400 for body/heading-sm, 300 for heading and above
// (the lighter weight at large sizes is the look of the system).
// ────────────────────────────────────────────────────────────────
export const TEXT = {
  caption:     { size: 12, weight: 400, lineHeight: 1.5,  tracking: -0.36 },
  body:        { size: 14, weight: 400, lineHeight: 1.5,  tracking: -0.42 },
  bodyLg:      { size: 18, weight: 400, lineHeight: 1.5,  tracking: -0.54 },
  subheading:  { size: 23, weight: 400, lineHeight: 1.3,  tracking: -0.69 },
  headingSm:   { size: 28, weight: 400, lineHeight: 1.3,  tracking: -0.84 },
  heading:     { size: 40, weight: 300, lineHeight: 1.35, tracking: -0.4 },
  display:     { size: 56, weight: 300, lineHeight: 1.0,  tracking: -1.68 },
  displayLg:   { size: 74, weight: 300, lineHeight: 1.05, tracking: -0.74 },
} as const;

// 7-point spacing grid from the Refero spec. Each step is multiples or
// near-multiples of 7. Use these instead of arbitrary 8/12/16 jumps so
// the rhythm matches the rest of the system.
export const SPACING = [4, 7, 9, 11, 14, 18, 21, 28, 35, 42, 49, 56, 70, 76, 99, 156] as const;

// Per-purpose radius tokens (no more guessing).
export const RADIUS = {
  nav: 7,
  cards: 14,
  buttons: 14,        // soft-corner rectangle, NOT full pill
  badges: 999,        // pills + status tags
  full: 999,
} as const;

export const DOCKET_TOKENS = {
  editorial: {
    bg: '#FEFDFA',
    bgElev: '#FFFFFE',
    ink: '#1A1612',
    inkSoft: '#4A4038',
    muted: '#8A7F72',
    border: '#E4DDCE',
    borderSoft: '#EDE7D9',
    card: '#FFFFFF',
    tintAccent: 'rgba(51, 94, 69, 0.06)',
    tintAccentStrong: 'rgba(51, 94, 69, 0.11)',
    // Font stacks — trial fonts first (only load when local files are
    // present — see styles.css), then ease's official free fallbacks
    // (Inter / Playfair Display), then the original Docket fonts
    // (DM Sans / Fraunces), then system. Each layer is a clean
    // visual fallback for the next.
    serif: '"FAIRE Octave Trial", "Playfair Display", "Fraunces", "Georgia", serif',
    sans: '"Suisse Int\'l Trial", "Inter", "DM Sans", -apple-system, system-ui, sans-serif',
    mono: '"Suisse Int\'l Trial", "Inter", "DM Sans", -apple-system, system-ui, sans-serif',
    radius: 14,
    radiusLg: 20,
  },
  minimal: {
    bg: '#FAFAF7',
    bgElev: '#FFFFFF',
    ink: '#111111',
    inkSoft: '#3A3A3A',
    muted: '#8A8A8A',
    border: '#ECECE8',
    borderSoft: '#F2F2EE',
    card: '#FFFFFF',
    tintAccent: 'rgba(51, 94, 69, 0.05)',
    tintAccentStrong: 'rgba(51, 94, 69, 0.09)',
    // Font stacks — trial fonts first (only load when local files are
    // present — see styles.css), then ease's official free fallbacks
    // (Inter / Playfair Display), then the original Docket fonts
    // (DM Sans / Fraunces), then system. Each layer is a clean
    // visual fallback for the next.
    serif: '"FAIRE Octave Trial", "Playfair Display", "Fraunces", "Georgia", serif',
    sans: '"Suisse Int\'l Trial", "Inter", "DM Sans", -apple-system, system-ui, sans-serif',
    mono: '"Suisse Int\'l Trial", "Inter", "DM Sans", -apple-system, system-ui, sans-serif',
    radius: 10,
    radiusLg: 14,
  },
  magazine: {
    bg: '#EFEAD8',
    bgElev: '#F8F4E6',
    ink: '#0E0A06',
    inkSoft: '#2B2319',
    muted: '#7A6D5A',
    border: '#1A1612',
    borderSoft: '#D9D0B8',
    card: '#FFFFFF',
    tintAccent: 'rgba(51, 94, 69, 0.08)',
    tintAccentStrong: 'rgba(51, 94, 69, 0.15)',
    // Font stacks — trial fonts first (only load when local files are
    // present — see styles.css), then ease's official free fallbacks
    // (Inter / Playfair Display), then the original Docket fonts
    // (DM Sans / Fraunces), then system. Each layer is a clean
    // visual fallback for the next.
    serif: '"FAIRE Octave Trial", "Playfair Display", "Fraunces", "Georgia", serif',
    sans: '"Suisse Int\'l Trial", "Inter", "DM Sans", -apple-system, system-ui, sans-serif',
    mono: '"Suisse Int\'l Trial", "Inter", "DM Sans", -apple-system, system-ui, sans-serif',
    radius: 6,
    radiusLg: 10,
  },
} as const;

export const FONT_PAIRINGS = {
  classic: {
    // Font stacks — trial fonts first (only load when local files are
    // present — see styles.css), then ease's official free fallbacks
    // (Inter / Playfair Display), then the original Docket fonts
    // (DM Sans / Fraunces), then system. Each layer is a clean
    // visual fallback for the next.
    serif: '"FAIRE Octave Trial", "Playfair Display", "Fraunces", "Georgia", serif',
    sans: '"Suisse Int\'l Trial", "Inter", "DM Sans", -apple-system, system-ui, sans-serif',
    mono: '"Suisse Int\'l Trial", "Inter", "DM Sans", -apple-system, system-ui, sans-serif',
    label: 'Octave / Suisse (trial) → Playfair / Inter → Fraunces / DM Sans',
  },
  instrument: {
    serif: '"Instrument Serif", "Georgia", serif',
    sans: '"Geist", -apple-system, system-ui, sans-serif',
    mono: '"Geist", -apple-system, system-ui, sans-serif',
    label: 'Instrument / Geist',
  },
  newsreader: {
    serif: '"Newsreader", "Georgia", serif',
    sans: '"Manrope", -apple-system, system-ui, sans-serif',
    mono: '"DM Sans", -apple-system, system-ui, sans-serif',
    label: 'Newsreader / Manrope',
  },
} as const;

export const DENSITY = {
  comfortable: { pad: 24, gap: 18, rowPad: 18, tight: 14 },
  cozy: { pad: 16, gap: 12, rowPad: 12, tight: 10 },
} as const;

export function accentColors(hue = 150) {
  return {
    rust: `oklch(42% 0.09 ${hue})`,
    rustDark: `oklch(32% 0.08 ${hue})`,
    rustSoft: `oklch(93% 0.03 ${hue})`,
    rustInk: `oklch(28% 0.07 ${hue})`,
    green: `oklch(50% 0.10 ${hue})`,
    greenSoft: `oklch(93% 0.03 ${hue})`,
    greenInk: `oklch(28% 0.07 ${hue})`,
  };
}

export type Theme = ReturnType<typeof buildTheme>;

export function buildTheme(opts: {
  tone?: Tone;
  fonts?: FontPairing;
  density?: Density;
  hue?: number;
} = {}) {
  const tone = opts.tone ?? 'editorial';
  const base = DOCKET_TOKENS[tone];
  const font = FONT_PAIRINGS[opts.fonts ?? 'classic'];
  const d = DENSITY[opts.density ?? 'comfortable'];
  const a = accentColors(opts.hue ?? 150);
  // Ease palette + scale exposed alongside the legacy tokens. New
  // components prefer `t.ease.*`, `t.text.*`, `t.radius.*` so the
  // intent is explicit; existing components keep their `t.rust` /
  // `t.serif` references untouched.
  return {
    ...base,
    ...font,
    ...d,
    ...a,
    tone,
    ease: EASE,
    text: TEXT,
    radius2: RADIUS,
    spacing: SPACING,
  };
}
