import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Public routes a client can hit without an active session:
//   - /login + /otp     → the auth flow itself
//   - /                 → root, redirects to /login
//   - root assets       → favicons etc.
// Everything else (intake forms, returning portal, /docs, etc.) requires
// an authed session.
const isPublicRoute = createRouteMatcher([
  '/',
  '/login(.*)',
  '/otp(.*)',
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
