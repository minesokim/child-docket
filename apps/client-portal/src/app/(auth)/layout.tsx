// (auth) route group layout. Wraps /login + /otp in a subtle fade-in
// transition on every navigation. Pairs with the equivalent transition
// on the landing page so back/forward both feel intentional.

'use client';

import { usePathname } from 'next/navigation';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <>
      <style>{`
        @keyframes auth-fade-in {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      <div
        key={pathname}
        style={{
          minHeight: '100dvh',
          animation: 'auth-fade-in 220ms cubic-bezier(.2,.8,.2,1) both',
          willChange: 'opacity, transform',
        }}
      >
        {children}
      </div>
    </>
  );
}
