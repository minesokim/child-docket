// Sentry server-side init. Loaded by instrumentation.ts on server boot.
//
// Graceful no-op when NEXT_PUBLIC_SENTRY_DSN is unset — the SDK simply
// doesn't ship events. Lets us land the integration before signing up
// for a Sentry account, and lets PR previews skip Sentry without
// adding their own DSN.

import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from '@docket/shared';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,             // 10% of transactions captured
  // Defense-in-depth: never auto-attach PII (user IPs, headers, etc.).
  // We will explicitly attach scrubbed context inside server actions.
  sendDefaultPii: false,
  // Last-line PII scrubber. Runs on every event before it leaves our
  // server — strips SSN/EIN/email/phone substrings and any field whose
  // KEY name suggests sensitive (ssn, password, token, etc.). Even if a
  // bug accidentally puts a real SSN into an exception message, it
  // never reaches Sentry's storage. See lib/sentry-scrubber.ts.
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  // Tag events with the source app so we can filter `app:portal` vs
  // `app:command-room` in Sentry's dashboard. Both apps share one
  // Sentry project (`docket` org / `javascript-nextjs` project) but
  // emit distinct tags so issues route correctly.
  initialScope: {
    tags: {
      app: 'portal',
      runtime: 'nodejs',
    },
  },
});
