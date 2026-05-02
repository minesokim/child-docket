import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

// Security response headers applied to every route. Mirrors the
// client-portal config — see apps/client-portal/next.config.ts for
// the rationale on each header. The command-room is the preparer
// surface: Antonio + staff reviewing client tax data. Same threat
// model as the portal (clickjacking, mixed content, plaintext PII
// in browser cache).
const SECURITY_HEADERS = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: blob:",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@docket/ui', '@docket/shared', '@docket/db'],
  // @docket/db uses ESM-style imports with .js extensions (Node strict ESM
  // requirement). Tell Next.js webpack to resolve .js to .ts so workspace
  // packages can be transpiled from source.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts', '.tsx'],
      '.jsx': ['.jsx', '.tsx'],
    };
    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
      {
        // The command-room renders client SSN suffix, financial
        // figures, and signed-document state. Never let a browser
        // back-button replay them from disk cache without a fresh
        // session check.
        source: '/clients/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
    ];
  },
};

export default withSentryConfig(config, {
  silent: !process.env.CI,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  hideSourceMaps: true,
  disableLogger: true,
});
