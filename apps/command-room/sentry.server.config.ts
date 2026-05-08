// Sentry server-side init for the command-room (Antonio's surface).
// Same graceful-no-op pattern as client-portal — the SDK skips emission
// when DSN is unset.

import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from '@docket/shared';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  // PII scrubber — strips SSN/EIN/email/phone substrings + redacts
  // sensitive-keyed fields. Last gate before events leave Antonio's
  // surface. See @docket/shared/sentry-scrubber.
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  // Tag all events with the source app so we can filter command-room vs
  // portal in the dashboard. Both apps share one Sentry project but the
  // events come from different code paths, different user surfaces, and
  // (typically) need different alert thresholds.
  initialScope: {
    tags: {
      app: 'command-room',
      runtime: 'nodejs',
    },
  },
});
