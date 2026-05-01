'use client';

// Inner client wrapper for the (intake) layout. Owns:
//   - Page-transition direction (forward / back / jump)
//   - AskAntonioChat overlay
//   - Discreet sign-out button (top-right corner of every intake screen)
//
// Pulled out so the parent layout.tsx can be a Server Component that
// loads the IntakeState bundle and wraps in <IntakeProvider>.

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import { AskAntonioChat, buildTheme, IntakeRouteFrame } from '@docket/ui';

const NAV_KEY = 'docket:portal:nav-direction';

export function IntakeFrame({ children }: { children: React.ReactNode }) {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useClerk();
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
      // sessionStorage unavailable — fall back to jump
    }
  }, [pathname]);

  const handleSignOut = async () => {
    // Clerk clears session cookie + local auth state. Then bounce to
    // the public landing page.
    await signOut(() => router.push('/'));
  };

  return (
    <>
      <IntakeRouteFrame pathname={pathname} direction={direction}>
        {children}
      </IntakeRouteFrame>

      {/* Sign-out — top right, discreet. Important on shared devices. */}
      <button
        onClick={handleSignOut}
        aria-label="Sign out"
        style={{
          position: 'fixed',
          top: 'max(14px, env(safe-area-inset-top, 14px))',
          right: 'max(16px, env(safe-area-inset-right, 16px))',
          padding: '6px 10px',
          background: 'rgba(254, 253, 250, 0.8)',
          border: `1px solid ${t.borderSoft}`,
          borderRadius: 999,
          fontFamily: t.mono,
          fontSize: 9,
          letterSpacing: 1.1,
          textTransform: 'uppercase',
          color: t.muted,
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 50,
        }}
      >
        Sign out
      </button>

      <AskAntonioChat t={t} />
    </>
  );
}
