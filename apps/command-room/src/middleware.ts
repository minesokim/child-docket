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
//
// Sign-up is closed — Antonio is provisioned out of band via the seed
// script (no public registration on the admin side).
//
// REMOVED 2026-05-15 per audit + PRODUCTION-READINESS §D
// pre-public-launch checklist:
//   - /api/sentry-test (deliberate 500-thrower for Sentry pipeline
//     verification — verify Sentry via a real error path instead).
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/api/inngest(.*)',
  // /api/health is the vendor-status probe polled by HealthStatusGate
  // (packages/ui). Public so the gate works for unauthenticated routes
  // (e.g., the sign-in page itself can show a "DB is down" banner).
  // Returns only binary service-status booleans; no tenant data.
  // Exact path — descendants are NOT exempted (so a future
  // /api/health-evil stays auth-gated).
  '/api/health',
  // Twilio inbound webhook — Twilio doesn't carry user credentials.
  // The route verifies X-Twilio-Signature against the matched
  // tenant's auth token before any DB write. Spoofed POSTs without a
  // valid signature are rejected with 401.
  '/api/webhooks/twilio/(.*)',
  // DocuSign Connect webhook — DocuSign POSTs envelope-completed
  // events here when 8879 KBA passes + signature lands. The route
  // verifies X-DocuSign-Signature-1 (HMAC-SHA256 over the raw body)
  // against DOCUSIGN_CONNECT_HMAC_KEY. Unverified events are
  // dropped with 401 before any DB read or write.
  '/api/webhooks/docusign/(.*)',
  // Square webhook — Square POSTs payment + refund lifecycle events
  // here. The route verifies X-Square-HmacSha256-Signature against
  // SQUARE_WEBHOOK_SIGNATURE_KEY (hashed over notificationUrl + raw
  // body). Pairs with the manual refresh-payment-status server
  // action; either flow can flip payments status.
  '/api/webhooks/square',
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
