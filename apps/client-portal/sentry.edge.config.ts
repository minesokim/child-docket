// Sentry edge-runtime init (middleware, edge route handlers).
// Same graceful-no-op pattern as the server config.

import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from '@docket/shared';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  // PII scrubber — same as server config, see lib/sentry-scrubber.ts.
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
});
