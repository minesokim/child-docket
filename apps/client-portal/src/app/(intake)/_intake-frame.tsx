'use client';

// Inner client wrapper for the (intake) layout. Owns the page-transition
// direction logic (forward / back / jump) and the AskAntonioChat overlay.
//
// Pulled out so the parent layout.tsx can be a Server Component that
// loads the IntakeState bundle and wraps in <IntakeProvider>.

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AskAntonioChat, buildTheme, IntakeRouteFrame } from '@docket/ui';

const NAV_KEY = 'docket:portal:nav-direction';

export function IntakeFrame({ children }: { children: React.ReactNode }) {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const pathname = usePathname();
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

  return (
    <>
      <IntakeRouteFrame pathname={pathname} direction={direction}>
        {children}
      </IntakeRouteFrame>
      <AskAntonioChat t={t} />
    </>
  );
}
