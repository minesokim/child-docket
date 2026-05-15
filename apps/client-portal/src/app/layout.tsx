import '@docket/ui/styles';
import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { ClerkProvider } from '@clerk/nextjs';
import { HealthStatusGate } from '@docket/ui';

export const metadata: Metadata = {
  title: 'Petal · Client Portal',
  description: 'Your tax filing, in your pocket.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#FFFEFC',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      // Route auth flows to our own pages, NOT Clerk's hosted
      // accounts.dev domain. Without these, a session timeout sends
      // the user to https://lucky-crane-50.accounts.dev/sign-in?...
      // which is the dev account host - confusing for clients.
      signInUrl="/login"
      signUpUrl="/login"
      signInFallbackRedirectUrl="/welcome"
      signUpFallbackRedirectUrl="/welcome"
      afterSignOutUrl="/login"
    >
      <html lang="en">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          {/* Font stack:
              1. Trial: Suisse Int'l + FAIRE Octave - local files, gitignored,
                 only loaded in dev (when the trial folder is populated).
              2. Free production fallbacks: Inter + Playfair Display, both
                 Refero-listed as the official ease fallbacks.
              3. Legacy fallbacks: DM Sans + Fraunces, what the app shipped
                 with originally. Kept so existing screens still render
                 correctly while the type system migrates.
              4. System fonts after that.
              See packages/ui/src/styles.css for the trial @font-face decls. */}
          <link
            href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,300..700;1,300..700&family=DM+Sans:wght@400;500;600&family=Fraunces:opsz,wght@9..144,400;9..144,500&display=swap"
            rel="stylesheet"
          />
          {/*
            Million.dev dev-tooling triplet — gated on NODE_ENV at
            build time so Next.js dead-code-eliminates these <Script>
            tags entirely from the production bundle. See decisions-log
            [#37] for adoption rationale + ci.yml react-doctor as the
            sibling static-analysis surface.

            react-scan: highlights React components that re-render
              unnecessarily during dev. Visual heatmap overlay on the
              live app. Auto-loads via unpkg UMD bundle.
            react-grab: click any UI element in dev → copies source
              location + component stack + nearby code for paste into
              Claude/Cursor/Codex. Drives the AI-coding handoff loop.

            Both are dev-only by gate. Both have zero production
            footprint (CSP `default-src 'self' ... https:` allows
            unpkg in case anyone forces NODE_ENV=development in prod,
            but prod build never renders these <Script> tags).
          */}
          {process.env.NODE_ENV === 'development' && (
            <>
              {/* Explicit https:// (NOT scheme-relative //) — Next.js
                  dev server runs on http://localhost:3000, and our
                  CSP `default-src ... https:` blocks http: script
                  sources. Forcing https here lets the script load
                  even from an http origin (modern browsers permit
                  the https-upgrade direction). `beforeInteractive`
                  per react-scan's docs: the scanner needs to
                  instrument React before the first component
                  renders, or it misses the initial paint's
                  render telemetry. */}
              <Script
                src="https://unpkg.com/react-scan/dist/auto.global.js"
                crossOrigin="anonymous"
                strategy="beforeInteractive"
              />
              <Script
                src="https://unpkg.com/react-grab/dist/index.global.js"
                crossOrigin="anonymous"
                strategy="beforeInteractive"
              />
            </>
          )}
        </head>
        <body>
          {/*
            HealthStatusGate polls /api/health every 30s and wires
            ReadOnlyProvider + status banner when DB is degraded/down.
            See packages/ui/src/components/health-gate.tsx.
          */}
          <HealthStatusGate endpoint="/api/health">{children}</HealthStatusGate>
        </body>
      </html>
    </ClerkProvider>
  );
}
