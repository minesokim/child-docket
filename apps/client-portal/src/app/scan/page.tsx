// /scan — Free Discovery Scan landing page.
//
// Primary cold-traffic conversion surface for the 100-by-8/1 push
// (L16 in CLAUDE.md). Copy is the locked text from
// docs/landing-pages/discovery-scan-landing-copy.md — DO NOT
// paraphrase without David's voice-pass. The numbers (§6695(g),
// §6694, founder pricing) are anchored to public sources cited in
// docs/MARKETING-FRAMES.md.
//
// SCOPE NOTE
//   v0 ships the static page + form-submit stub. The form action
//   (writes to prospects table + sends Resend confirmation + emits
//   presigned upload URL) lands in C12b alongside the prospects
//   migration. v0 form submit just acknowledges receipt; David
//   gets a Sentry breadcrumb to manually intake until the worker
//   wires up.
//
// VISUAL CONTRACT
//   - Editorial-warm tone: cream canvas + forest green primary +
//     Fraunces display + DM Sans body (matches the rest of
//     client-portal per CLAUDE.md §11).
//   - Mobile-first: single column under 768px; multi-column desktop.
//   - Inline styles per the design-locked-component convention (no
//     Tailwind utility classes on this page; tokens drive everything).
//   - All copy from the locked doc. Numbers carry IRS source links
//     where applicable.

import type { Metadata } from 'next';
import { ScanLandingClient } from './scan-landing-client.js';

// Canonical + Open Graph URL. Resolves at build time:
//   - PUBLIC_SCAN_URL (Vercel env) — explicit override, set this to
//     'https://docket.com/scan' once the brand-domain cutover lands.
//   - VERCEL_PROJECT_PRODUCTION_URL — Vercel-managed prod URL
//     (e.g. docket-portal.vercel.app). Use during pre-cutover.
//   - fallback: empty string → metadata omits absolute URLs entirely,
//     letting Next.js fall back to relative URLs.
// Codex C12 R7 P2: hard-coding `https://docket.com/scan` before the
// brand cutover sends crawlers + social previews to a dead origin.
const scanUrl = process.env.PUBLIC_SCAN_URL
  ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/scan`
    : undefined);

export const metadata: Metadata = {
  title: 'Free Discovery Scan — Docket',
  description:
    'Free 24-hour Position Framework scan on one of your returns. Every defensible deduction surfaced, cited authority attached, draft 8275 on every Tier 3 position. First 30 EAs and small-firm CPAs.',
  ...(scanUrl
    ? {
        alternates: { canonical: scanUrl },
        openGraph: {
          title: 'Free Discovery Scan — Docket',
          description:
            'The AI defense layer for tax practices. Every position cited. Every action audit-trailed.',
          type: 'website',
          url: scanUrl,
        },
      }
    : {
        openGraph: {
          title: 'Free Discovery Scan — Docket',
          description:
            'The AI defense layer for tax practices. Every position cited. Every action audit-trailed.',
          type: 'website',
        },
      }),
};

export default function ScanLandingPage() {
  return <ScanLandingClient />;
}
