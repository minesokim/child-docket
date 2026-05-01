// (auth) route group layout. Wraps /login + /otp in a smooth fade-in
// that complements the landing page's exit animation. The receiving
// page drops in from above (translateY(-12px) → 0) which mirrors the
// landing's exit (translateY(0) → -12px).
//
// Total perceived transition: ~840ms (360ms exit + 480ms fade-in).
// Feels intentional without being sluggish.

'use client';

import { usePathname } from 'next/navigation';
import { GLIDEY_KEYFRAMES } from '@/lib/use-glidey-nav';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <>
      <style>{`
        @keyframes auth-fade-in {
          from {
            opacity: 0;
            transform: translateY(-12px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        ${GLIDEY_KEYFRAMES}
      `}</style>
      <div
        key={pathname}
        style={{
          minHeight: '100dvh',
          animation: 'auth-fade-in 480ms cubic-bezier(.2,.8,.2,1) both',
          willChange: 'opacity, transform',
        }}
      >
        {children}
      </div>
    </>
  );
}
