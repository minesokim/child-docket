import '@docket/ui/styles';
import type { Metadata } from 'next';
import Script from 'next/script';
import { ClerkProvider } from '@clerk/nextjs';
import { HealthStatusGate } from '@docket/ui';

export const metadata: Metadata = {
  title: 'Petal · Command Room',
  description: 'The agentic operator for your tax practice.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link
            href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Fraunces:opsz,wght@9..144,400;9..144,500&family=Inter:wght@400;500;600;700&display=swap"
            rel="stylesheet"
          />
          {/*
            Million.dev dev-tooling triplet — gated on NODE_ENV at
            build time so Next.js dead-code-eliminates these <Script>
            tags entirely from the production bundle. See decisions-log
            [#37] for adoption rationale + ci.yml react-doctor as the
            sibling static-analysis surface.

            react-scan: highlights React components that re-render
              unnecessarily during dev. Especially useful here on the
              command-room data tables (Need You queue, clients list)
              once those land. Auto-loads via unpkg UMD bundle.
            react-grab: click any UI element in dev → copies source
              location + component stack + nearby code for paste into
              Claude/Cursor/Codex. Drives the AI-coding handoff loop.

            Both are dev-only by gate. Zero production footprint.
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
            HealthStatusGate polls /api/health every 30s and:
              - flips ReadOnlyProvider when DB is degraded/down
              - renders the neonReadOnlyBanner above children
            Wired at root so every authenticated route inherits it.
            See packages/ui/src/components/health-gate.tsx.
          */}
          <HealthStatusGate endpoint="/api/health">{children}</HealthStatusGate>
        </body>
      </html>
    </ClerkProvider>
  );
}
