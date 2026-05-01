// Sentry server-side init. Loaded by instrumentation.ts on server boot.
//
// Graceful no-op when NEXT_PUBLIC_SENTRY_DSN is unset — the SDK simply
// doesn't ship events. Lets us land the integration before signing up
// for a Sentry account, and lets PR previews skip Sentry without
// adding their own DSN.

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,             // 10% of transactions captured
  // Defense-in-depth: never auto-attach PII (user IPs, headers, etc.).
  // We will explicitly attach scrubbed context inside server actions.
  sendDefaultPii: false,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
});
