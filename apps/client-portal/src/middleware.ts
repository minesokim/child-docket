import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Public routes a client can hit without an active session:
//   - /login + /otp     → the auth flow itself
//   - /                 → root, redirects to /login
//   - /scan             → cold-traffic Discovery Scan landing
//   - /api/scan-intake-stub → form-submit endpoint for /scan; v0 stub
//     until C12b lands the prospects table + Resend flow
//   - root assets       → favicons etc.
//   - /api/sentry-test  → Sentry capture verification endpoint.
//     Deliberately throws; needs to be reachable via curl during
//     deploy verification. Self-guarded by query-flag. REMOVE before
//     public launch (PRODUCTION-READINESS §B).
// Everything else (intake forms, returning portal, /docs, etc.) requires
// an authed session.
const isPublicRoute = createRouteMatcher([
  '/',
  '/login(.*)',
  '/otp(.*)',
  // /scan is the cold-traffic Discovery Scan landing page. Anonymous
  // visitors land here from email, LinkedIn, and direct outreach.
  // The page itself is a marketing surface; the form-submit lives at
  // /api/scan-intake-stub (also public) and captures prospects.
  // Pattern matches both `/scan` and `/scan/` (trailing slash) —
  // middleware runs before Next.js URL normalization (codex C12 R6 P2).
  '/scan(.*)',
  '/api/scan-intake-stub',
  // /trust is the public Trust Center page (C22). Anonymous
  // prospects + investors read it pre-sale to verify our security
  // posture. Static page, no PII, no auth required. Source content
  // canonicalized at docs/security/trust-center-content.md.
  '/trust(.*)',
  '/api/sentry-test(.*)',
  // /api/health is the vendor-status probe polled by HealthStatusGate
  // (packages/ui). Public so the gate works for unauthenticated routes.
  // Returns only binary service-status booleans; no tenant data.
  // Exact path — descendants stay auth-gated.
  '/api/health',
  // /api/e2e-bypass — Playwright + automation OTP bypass. Protected
  // by FOUR independent env gates (see route.ts header). Public path
  // because the caller is unauthenticated by definition (the bypass
  // grants the auth). REMOVE BEFORE PUBLIC LAUNCH per
  // docs/PRODUCTION-READINESS.md launch-prep checklist.
  '/api/e2e-bypass',
]);

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return;

  const { userId } = await auth();
  if (userId) return;

  // No session: send to OUR /login page, not Clerk's hosted
  // accounts.dev sign-in. auth.protect() would redirect to the
  // hosted page; we want clients to stay on docket-portal.vercel.app.
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('redirect_url', request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
});

export const config = {
  matcher: [
    // Run on every route except Next internals + static assets
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run on API routes
    '/(api|trpc)(.*)',
  ],
};
