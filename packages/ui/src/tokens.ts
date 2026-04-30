// Docket design tokens — ported from designer's tokens.jsx.
// Three tone variants. Editorial cream is the lead.
// Forest green primary (oklch 150 hue). Fraunces serif + DM Sans body.

export type Tone = 'editorial' | 'minimal' | 'magazine';
export type FontPairing = 'classic' | 'instrument' | 'newsreader';
export type Density = 'comfortable' | 'cozy';

export const DOCKET_TOKENS = {
  editorial: {
    bg: '#F5F2EA',
    bgElev: '#FBF9F3',
    ink: '#1A1612',
    inkSoft: '#4A4038',
    muted: '#8A7F72',
    border: '#E4DDCE',
    borderSoft: '#EDE7D9',
    card: '#FFFFFF',
    tintAccent: 'rgba(51, 94, 69, 0.06)',
    tintAccentStrong: 'rgba(51, 94, 69, 0.11)',
    serif: '"Fraunces", "Georgia", serif',
    sans: '"DM Sans", -apple-system, system-ui, sans-serif',
    mono: '"DM Sans", -apple-system, system-ui, sans-serif',
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
    serif: '"Fraunces", "Georgia", serif',
    sans: '"DM Sans", -apple-system, system-ui, sans-serif',
    mono: '"DM Sans", -apple-system, system-ui, sans-serif',
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
    serif: '"Fraunces", "Georgia", serif',
    sans: '"DM Sans", -apple-system, system-ui, sans-serif',
    mono: '"DM Sans", -apple-system, system-ui, sans-serif',
    radius: 6,
    radiusLg: 10,
  },
} as const;

export const FONT_PAIRINGS = {
  classic: {
    serif: '"Fraunces", "Georgia", serif',
    sans: '"DM Sans", -apple-system, system-ui, sans-serif',
    mono: '"DM Sans", -apple-system, system-ui, sans-serif',
    label: 'Fraunces / DM Sans',
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
  return { ...base, ...font, ...d, ...a, tone };
}
