'use client';

// Document-shaped skeleton components. Faithful port of the design
// handoff prototype's per-document templates
// (`docs/design_handoff_skeleton_loaders/Skeleton Loaders.html`).
//
// Each component renders the silhouette of the actual document so
// the loading state reads as "we're reading your driver's license"
// instead of a generic shimmer rectangle. The CSS for these shapes
// lives in packages/ui/src/skeleton-docs.css and is auto-imported by
// styles.css.
//
// USAGE
//   <DriversLicenseFrontSkeleton />     // wider than tall, photo + fields
//   <DriversLicenseBackSkeleton />      // barcode + magstripe + 2D code
//   <SocialSecurityCardSkeleton />      // navy banner + ornate columns + seal
//   <TaxFormSkeleton title="W-2" subtitle="Wage and Tax Statement" />
//
// All four wrap themselves in `.v-shimmer` so the shimmer engine in
// skeleton-docs.css runs without callers needing to add the variant
// class. The doc-card frame is included; drop them straight into a
// page (or into the per-slot reading hero) at full width.

import * as React from 'react';

// ─── DRIVER'S LICENSE — FRONT ──────────────────────────────────
//
// Layout (left → right):
//   • State header strip with country tag, doc-type, gold emblem
//   • Photo column (with face silhouette + signature line)
//   • Field column (DL #, EXP, last name, first name, address, DOB, RSTR)
//   • Right column (CLASS / END / mini-photo / iss number)
//   • Bottom row of mini fields (SEX/HGT, HAIR/WGT, EYES/ISS)
export function DriversLicenseFrontSkeleton() {
  return (
    <div className="v-shimmer" aria-busy="true" aria-label="Reading driver's license front">
      <div className="doc-card id-card">
        <div className="id-page id-front">
          <div className="id-header">
            <div className="id-state" />
            <div className="id-usa" />
            <div className="id-doctype" />
            <div className="id-emblem" />
          </div>
          <div className="id-body">
            <div className="id-photo-col">
              <div className="photo">
                <div className="silhouette">
                  <svg viewBox="0 0 80 100" preserveAspectRatio="xMidYMax meet" fill="currentColor" aria-hidden="true">
                    <path d="M40 18 C 49 18, 55 25, 55 34 C 55 41, 52 47, 48 50 L 48 56 C 48 58, 50 60, 53 61 C 64 64, 72 76, 74 100 L 6 100 C 8 76, 16 64, 27 61 C 30 60, 32 58, 32 56 L 32 50 C 28 47, 25 41, 25 34 C 25 25, 31 18, 40 18 Z" />
                  </svg>
                </div>
              </div>
              <div className="bar sigline" />
            </div>
            <div className="id-fields">
              <div className="id-row"><div className="id-label s" /><div className="bar id-value med" /></div>
              <div className="id-row"><div className="id-label s" /><div className="bar id-value med" /></div>
              <div className="id-row"><div className="id-label s" /><div className="bar id-value long" /></div>
              <div className="id-row"><div className="id-label s" /><div className="bar id-value short" /></div>
              <div className="id-row"><div className="bar id-value long" /></div>
              <div className="id-row"><div className="bar id-value med" /></div>
              <div className="id-row"><div className="id-label s" /><div className="bar id-value med" /></div>
              <div className="id-row"><div className="id-label s" /><div className="bar id-value tiny" /></div>
            </div>
            <div className="id-right-col">
              <div className="id-row"><div className="id-label m" /><div className="bar id-value tiny" /></div>
              <div className="id-row"><div className="id-label m" /><div className="bar id-value tiny" /></div>
              <div className="mini-photo" />
              <div className="bar id-value short" />
            </div>
          </div>
          <div className="id-bottom-row">
            <div className="id-row"><div className="id-label s" /><div className="bar id-value tiny" /></div>
            <div className="id-row"><div className="id-label s" /><div className="bar id-value short" /></div>
            <div className="id-row"><div className="id-label s" /><div className="bar id-value short" /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DRIVER'S LICENSE — BACK ───────────────────────────────────
//
// Layout (top → bottom):
//   • Thin top barcode strip
//   • Flat black magnetic stripe (intentionally NOT animated — moving
//     light on solid black reads as suspicious motion)
//   • Three content rows
//   • PDF417 2D barcode + four lines of fineprint side-by-side
export function DriversLicenseBackSkeleton() {
  return (
    <div className="v-shimmer" aria-busy="true" aria-label="Reading driver's license back">
      <div className="doc-card id-card">
        <div className="id-page id-back">
          <div className="top-barcode" />
          <div className="stripe" />
          <div className="id-content">
            <div className="id-rows">
              <div className="bar w-78" />
              <div className="bar w-50" />
              <div className="bar w-64" />
            </div>
            <div className="id-bottom">
              <div className="pdf417" />
              <div className="id-fineprint">
                <div className="bar w-92" />
                <div className="bar w-86" />
                <div className="bar w-78" />
                <div className="bar w-64" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SOCIAL SECURITY CARD ──────────────────────────────────────
//
// Modeled on the classic SSA card:
//   • Dark navy banner with arched "SOCIAL SECURITY" placeholder
//   • Ornate columns flanking the body (left + mirrored right)
//   • Circular seal behind the SSN number
//   • SSN bar with hint dashes for the dash positions
//   • "Established for" line + name bar + signature line
export function SocialSecurityCardSkeleton() {
  return (
    <div className="v-shimmer" aria-busy="true" aria-label="Reading Social Security card">
      <div className="doc-card ssn-card">
        <div className="ssn-page">
          <div className="ssn-banner">
            <div className="arched" />
          </div>
          <div className="ssn-body">
            <SsnColumn side="left" />
            <SsnColumn side="right" />
            <div className="ssn-seal" />
            <div className="ssn-num" />
            <div className="ssn-established" />
            <div className="ssn-name" />
          </div>
          <div className="ssn-sigrow">
            <div className="sigline" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Stylized capital-and-fluted-shaft column motif. Used on both flanks
// of the SSN body — the right side flips horizontally via CSS.
function SsnColumn({ side }: { side: 'left' | 'right' }) {
  return (
    <div className={`ssn-column ${side}`}>
      <svg viewBox="0 0 18 200" preserveAspectRatio="none" aria-hidden="true">
        <rect x="0" y="6" width="18" height="3" fill="currentColor" />
        <rect x="1" y="10" width="16" height="6" fill="currentColor" opacity="0.7" />
        <rect x="2" y="17" width="14" height="2" fill="currentColor" />
        <rect x="3" y="20" width="12" height="170" fill="none" stroke="currentColor" strokeWidth="0.7" />
        <line x1="6" y1="22" x2="6" y2="188" stroke="currentColor" strokeWidth="0.5" opacity="0.7" />
        <line x1="9" y1="22" x2="9" y2="188" stroke="currentColor" strokeWidth="0.5" opacity="0.7" />
        <line x1="12" y1="22" x2="12" y2="188" stroke="currentColor" strokeWidth="0.5" opacity="0.7" />
        <rect x="0" y="190" width="18" height="3" fill="currentColor" />
        <rect x="1" y="194" width="16" height="2" fill="currentColor" opacity="0.7" />
      </svg>
    </div>
  );
}

// ─── TAX FORM (generic, with title) ────────────────────────────
//
// Used for W-2, 1099-*, 1098-*, 1095-*, K-1, statements, prior
// returns — anything where the loading hint should be the FORM TYPE
// rather than a doc-specific silhouette. The title renders into the
// page header in Fraunces serif so the form is identifiable while
// the body bars shimmer.
//
// Default body widths follow the design's example (92 / 86 / 78 /
// 64 / 50 / 40 percent), giving an editorial paragraph feel.
export function TaxFormSkeleton({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle?: string;
  rows?: ReadonlyArray<'w-92' | 'w-86' | 'w-78' | 'w-64' | 'w-50' | 'w-40'>;
}) {
  const widths = rows ?? (['w-92', 'w-86', 'w-78', 'w-64', 'w-50', 'w-40'] as const);
  return (
    <div className="v-shimmer" aria-busy="true" aria-label={`Reading ${title}`}>
      <div className="doc-card taxform">
        <div className="doc-page">
          <div className="bar heading titled">
            {title}
            {subtitle ? <span className="doc-title-sub">{subtitle}</span> : null}
          </div>
          {widths.map((w, i) => (
            <div key={i} className={`bar ${w}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
