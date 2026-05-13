// Design tokens for the Discovery Scan PDF.
//
// Mirrors @docket/ui's editorial-warm tone (CLAUDE.md §11): cream
// canvas, forest green primary, Fraunces display + DM Sans body.
// Replicated here rather than imported because @docket/ui ships
// browser-aware components (uses CSS-in-JS via inline styles) and
// react-pdf renders to PDF using its own StyleSheet primitive — the
// two style systems are incompatible. The token VALUES are kept in
// sync intentionally; if @docket/ui retunes the palette, mirror
// here.
//
// Color values use sRGB hex equivalents of the oklch tokens in
// @docket/ui (computed once and stored here so react-pdf can consume
// them — PDF doesn't support oklch).

export const colors = {
  // Cream canvas — equivalent of oklch(98% 0.01 85)
  canvas: '#FAF7F1',
  // Forest green primary — equivalent of oklch(42% 0.09 150)
  primary: '#1F5E3D',
  primarySoft: '#E8F0EA',
  // Ink — body text, equivalent of oklch(20% 0.01 240)
  ink: '#1A1E2A',
  inkSoft: '#4A5363',
  // Muted text for labels, captions
  muted: '#6B7280',
  // Subtle borders
  border: '#E3DED4',
  // Tier accent colors — chosen for legibility on cream canvas
  tier1: '#1F5E3D', // forest green — settled law
  tier2: '#1F4B7E', // navy — substantial authority
  tier3: '#A36A1A', // amber — reasonable basis (disclosure required)
  tier4: '#8B2A1E', // rust — MLTN (preparer judgment)
  // Refusal block — neutral gray, not red (refusals aren't errors)
  refusal: '#4A5363',
} as const;

export const fonts = {
  // v0 ships with react-pdf's built-in PDF font set (Times-Roman +
  // Helvetica) for zero font-registration overhead. The editorial-
  // warm tone of @docket/ui uses Fraunces (display) + DM Sans (body);
  // matching those requires registering TTF/OTF files with
  // Font.register() at module load. That's a polish pass tracked as
  // a followup — Antonio's reference scan target 6/15 ships with
  // Times + Helvetica.
  //
  // Trial fonts in apps/client-portal/public/fonts/trial are NOT an
  // option: license forbids commercial use and expires 2026-05-14
  // (CLAUDE.md §18). Future: register Fraunces + DM Sans from
  // Google Fonts (both free for commercial use).
  display: 'Times-Roman',
  body: 'Helvetica',
} as const;

export const sizes = {
  // Page size in points (1pt = 1/72 in). Letter is 612 x 792.
  page: { width: 612, height: 792 },
  // Margins follow Faber & Faber editorial convention — 1in = 72pt
  margin: 72,
  // Type scale (in points)
  display: { xl: 36, lg: 28, md: 22 },
  body: { lg: 14, md: 11, sm: 9 },
  // Vertical rhythm
  paragraphGap: 10,
  sectionGap: 24,
} as const;

export const radii = {
  card: 6,
  badge: 10,
} as const;

/**
 * Map a position tier to its accent color. Used by tier badges +
 * row highlights in the executive summary table.
 */
export function tierColor(tier: 1 | 2 | 3 | 4): string {
  switch (tier) {
    case 1:
      return colors.tier1;
    case 2:
      return colors.tier2;
    case 3:
      return colors.tier3;
    case 4:
      return colors.tier4;
  }
}

/**
 * Human-readable label for each tier per CLAUDE.md §13
 * Position Framework four-tier confidence classification.
 */
export function tierLabel(tier: 1 | 2 | 3 | 4): string {
  switch (tier) {
    case 1:
      return 'Settled law';
    case 2:
      return 'Substantial authority';
    case 3:
      return 'Reasonable basis + 8275';
    case 4:
      return 'MLTN — preparer judgment';
  }
}

/**
 * Audit-risk label color. Tied to the position framework's risk
 * scale (low / moderate / high). Distinct from tier color — a Tier
 * 1 position can still carry high audit risk if it touches a
 * historically-litigated area.
 */
export function auditRiskColor(risk: 'low' | 'moderate' | 'high'): string {
  switch (risk) {
    case 'low':
      return colors.tier1;
    case 'moderate':
      return colors.tier3;
    case 'high':
      return colors.tier4;
  }
}
