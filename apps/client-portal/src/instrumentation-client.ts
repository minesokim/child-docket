// Sentry client-side init. Next.js 15 auto-loads this file on the browser
// boot path — no manual import needed.
//
// Sample rates: 10% tracing for now; bump if dashboards stay quiet but
// users report issues. PII off by default.

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  // Replay is great for client-side error debugging but adds bundle size.
  // Off for v0; enable post-cohort if we hit visibility gaps.
  replaysOnErrorSampleRate: 0,
  replaysSessionSampleRate: 0,
  sendDefaultPii: false,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
