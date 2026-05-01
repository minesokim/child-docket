// Next.js instrumentation entry point.
// Loaded once on server boot, dispatches to the correct Sentry config
// based on which runtime is starting up.

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Re-export Sentry's request-error capture so Next.js auto-reports
// thrown errors in server components, route handlers, and server actions.
export { captureRequestError as onRequestError } from '@sentry/nextjs';
