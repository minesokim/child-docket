import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from '@docket/shared';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  initialScope: {
    tags: {
      app: 'command-room',
      runtime: 'edge',
    },
  },
});
