import '@docket/ui/styles';
import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { HealthStatusGate } from '@docket/ui';

export const metadata: Metadata = {
  title: 'Docket · Command Room',
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
            href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Fraunces:opsz,wght@9..144,400;9..144,500&display=swap"
            rel="stylesheet"
          />
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
