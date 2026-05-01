import '@docket/ui/styles';
import type { Metadata, Viewport } from 'next';

// DEMO BUILD — no ClerkProvider. Matches the production layout but with the
// auth provider stripped so the demo URL builds without Clerk env vars.

export const metadata: Metadata = {
  title: 'Docket · Client Portal (Demo)',
  description: 'Your tax filing, in your pocket.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#FEFDFA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Fraunces:opsz,wght@9..144,400;9..144,500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
