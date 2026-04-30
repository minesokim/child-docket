'use client';

// (intake) route group layout.
// Mounts AskAntonioChat globally as a fixed-position overlay (any intake screen
// can open it via window.dispatchEvent(new CustomEvent('ask-antonio:open'))).
// Wraps children in IntakeRouteFrame for the route-fwd / route-back / route-jump
// transition. Direction is read from sessionStorage (set by usePortalNav helper).

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AskAntonioChat, buildTheme, IntakeRouteFrame } from '@docket/ui';

const NAV_KEY = 'docket:portal:nav-direction';

export default function IntakeLayout({ children }: { children: React.ReactNode }) {
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
      // Reset to "jump" so manual back-button (browser) doesn't reuse stale direction
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
