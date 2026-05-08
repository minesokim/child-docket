import '@docket/ui/styles';
import type { Metadata, Viewport } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { HealthStatusGate } from '@docket/ui';

export const metadata: Metadata = {
  title: 'Docket · Client Portal',
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
