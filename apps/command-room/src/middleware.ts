import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Antonio's admin surface. Everything is auth-required except the
// sign-in route itself. Sign-up is closed — Antonio is provisioned
// out of band via the seed script (no public registration on the
// admin side).
const isPublicRoute = createRouteMatcher(['/sign-in(.*)']);

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
