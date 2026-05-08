import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Antonio's admin surface. Everything is auth-required except:
//   - /sign-in — public for the obvious reason
//   - /api/inngest — Inngest's platform hits this endpoint to discover
//     + invoke functions. It authenticates via INNGEST_SIGNING_KEY
//     inside the inngest/next serve handler itself, NOT Clerk. If
//     Clerk middleware protects it, all incoming Inngest events 404
//     (or redirect to sign-in, which 404s through deployment
//     protection). The serve handler does its own signature
//     verification — the route is safe to expose.
//   - /api/sentry-test — Sentry capture verification endpoint. The
//     route deliberately throws to confirm Sentry receives events.
//     Auth-gating it would defeat the test (curl can't send Clerk
//     cookies). The route guards itself with a query-flag so a
//     random visitor / search crawler doesn't pollute the dashboard.
//     REMOVE this matcher entry along with the route before public
//     launch (PRODUCTION-READINESS §B).
//
// Sign-up is closed — Antonio is provisioned out of band via the seed
// script (no public registration on the admin side).
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/api/inngest(.*)',
  '/api/sentry-test(.*)',
  // /api/health is the vendor-status probe polled by HealthStatusGate
  // (packages/ui). Public so the gate works for unauthenticated routes
  // (e.g., the sign-in page itself can show a "DB is down" banner).
  // Returns only binary service-status booleans; no tenant data.
  // Exact path — descendants are NOT exempted (so a future
  // /api/health-evil stays auth-gated).
  '/api/health',
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Run on every route except Next internals + static assets
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run on API routes
    '/(api|trpc)(.*)',
  ],
};
