import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Public routes a client can hit without an active session:
//   - /login + /otp     → the auth flow itself
//   - /                 → root, redirects to /login
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
  '/api/sentry-test(.*)',
  // /api/health is the vendor-status probe polled by HealthStatusGate
  // (packages/ui). Public so the gate works for unauthenticated routes.
  // Returns only binary service-status booleans; no tenant data.
  // Exact path — descendants stay auth-gated.
  '/api/health',
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
