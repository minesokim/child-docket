// Sentry server-side init for the command-room (Antonio's surface).
// Same graceful-no-op pattern as client-portal — the SDK skips emission
// when DSN is unset.

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
});
