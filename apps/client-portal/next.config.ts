import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

// Security response headers applied to every route. Set per the
// pre-launch hardening pass (see docs/SECURITY.md and the May 2026
// Codex+Claude security audits).
//
// CSP is intentionally permissive in this first pass — Clerk and
// Sentry both inject inline scripts + connect to multiple CDNs, and a
// strict CSP without an enumerated allow-list risks breaking auth on
// production. This baseline blocks frame embedding and mixed content;
// a second pass with reporting will lock down script-src and
// connect-src once we've observed actual traffic.
const SECURITY_HEADERS = [
  // 2 years, include subdomains, eligible for browser preload list.
  // Vercel terminates TLS — HSTS is honored in production only.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Stop browsers from MIME-sniffing responses into a different
  // content-type than the server set. Mitigates a class of XSS-via-
  // mistaken-content-type bugs on doc / image uploads.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // No iframes. Clickjacking defense for sensitive flows like
  // /portal/sign-8879 and /intake/* pages displaying decrypted PII.
  { key: 'X-Frame-Options', value: 'DENY' },
  // Don't leak full URL paths (which include intake-step names) to
  // third-party domains via the Referer header on outbound clicks.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Disable powerful browser APIs we never use. Prevents a future
  // dependency or compromised script from reading the camera/mic.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
  // Permissive CSP — frame-ancestors enforces clickjacking defense
  // alongside X-Frame-Options (the modern equivalent), no http:
  // (no mixed content), no plugins. Tighten in a follow-up after
  // observing Clerk + Sentry domain footprint.
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
  // @docket/db uses ESM .js extensions in internal imports (Node strict ESM
  // requirement). Tell webpack to resolve .js to .ts so transpilePackages
  // can compile from source.
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
        // Apply to every route. Next.js converts this to a regex
        // matching all paths.
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
      {
        // Plaintext SSN / EIN / bank fields are revealed (one leaf
        // at a time, audit-logged) inside /intake/*. Never let the
        // browser cache a decrypted response — back-button restore
        // would replay it from disk cache without a fresh auth check.
        source: '/intake/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
      {
        source: '/portal/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
    ];
  },
};

// Wrap with Sentry's build-time instrumentation. Source map upload + auto
// route instrumentation. Uploads only run when SENTRY_AUTH_TOKEN is set,
// so PR previews without the secret silently skip.
export default withSentryConfig(config, {
  silent: !process.env.CI,
  // Source map upload is gated on auth token presence — gracefully skips
  // when not provided.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Hide source maps from being publicly accessible after upload.
  hideSourceMaps: true,
  disableLogger: true,
});
