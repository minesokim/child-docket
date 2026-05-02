'use client';

// Inner client wrapper for the (intake) layout. Owns:
//   - Page-transition direction (forward / back / jump)
//   - AskAntonioChat overlay
//   - SignOut handler - provided via SignOutProvider so IntakeHeader
//     can render its own discreet "Logout" pill above the progress bar.
//     The /welcome page doesn't render IntakeHeader, so no logout button
//     shows there (intentional).
//   - Last-visited-route tracking - saves pathname to IntakeState so
//     /welcome can resume to the exact page on next visit.

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import { AskAntonioChat, buildTheme, IntakeRouteFrame, SignOutProvider } from '@docket/ui';
import { useSetIntakeField } from '@/lib/intake-context';

const NAV_KEY = 'docket:portal:nav-direction';

// Routes we don't track as "last visited" (welcome is the resume
// landing point, not a destination).
const SKIP_TRACKING = new Set<string>(['/welcome']);

export function IntakeFrame({ children }: { children: React.ReactNode }) {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useClerk();
  const setField = useSetIntakeField();
  const [direction, setDirection] = useState<'forward' | 'back' | 'jump'>('jump');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const dir = window.sessionStorage.getItem(NAV_KEY) as
        | 'forward'
        | 'back'
        | 'jump'
        | null;
      setDirection(dir ?? 'jump');
      // Reset so manual back-button (browser) doesn't reuse stale direction.
      window.sessionStorage.removeItem(NAV_KEY);
    } catch {
      // sessionStorage unavailable - fall back to jump
    }
  }, [pathname]);

  // Track the last-visited intake route so resume sends the user back
  // to where they actually were, not just the first incomplete step.
  useEffect(() => {
    if (!pathname || SKIP_TRACKING.has(pathname)) return;
    setField('_meta.lastVisitedRoute', pathname);
  }, [pathname, setField]);

  const handleSignOut = useCallback(() => {
    // signOut() returns a promise; we don't need to await - the redirect
    // callback fires after Clerk clears the session cookie.
    void signOut(() => router.push('/'));
  }, [signOut, router]);

  return (
    <SignOutProvider value={handleSignOut}>
      <IntakeRouteFrame pathname={pathname} direction={direction}>
        {children}
      </IntakeRouteFrame>
      <AskAntonioChat t={t} />
    </SignOutProvider>
  );
}
