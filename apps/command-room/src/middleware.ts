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
const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/api/inngest(.*)']);

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
