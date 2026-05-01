'use client';

// Pre-login brand landing. DEMO BUILD — no Clerk auth check. Single CTA → /login.

import { buildTheme } from '@docket/ui';
import Link from 'next/link';

export default function LandingPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: t.bg,
        color: t.ink,
        fontFamily: t.sans,
        display: 'flex',
        flexDirection: 'column',
        // Inline-safe horizontal padding: respects iOS notch + adds breathing
        // room so the dark pill CTA doesn't kiss the screen edge.
        paddingTop: 20,
        paddingBottom: 28,
        paddingLeft: 'max(28px, env(safe-area-inset-left, 28px))',
        paddingRight: 'max(28px, env(safe-area-inset-right, 28px))',
        animation: 'landing-fade-in 220ms cubic-bezier(.2,.8,.2,1) both',
        willChange: 'opacity, transform',
      }}
    >
      <style>{`
        @keyframes landing-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 30,
          paddingBottom: 32,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img
            src="/vazant-logo.png"
            alt="Vazant Consulting"
            style={{ width: 132, height: 132, objectFit: 'contain' }}
          />
          <div
            style={{
              width: 140,
              height: 12,
              marginTop: -10,
              borderRadius: '50%',
              background: 'rgba(40, 30, 20, 0.10)',
              filter: 'blur(8px)',
            }}
          />
        </div>

        <div style={{ width: '100%', maxWidth: 340, textAlign: 'left' }}>
          <div
            style={{
              fontFamily: t.mono,
              fontSize: 11,
              color: t.muted,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            Welcome
          </div>
          <h1
            style={{
              fontFamily: t.sans,
              fontSize: 30,
              fontWeight: 600,
              color: t.ink,
              letterSpacing: -0.6,
              lineHeight: 1.2,
              margin: 0,
              marginBottom: 14,
            }}
          >
            Vazant Consulting
            <br />
            tax filing
          </h1>
          <p
            style={{
              fontSize: 15,
              color: t.inkSoft,
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            Personal service from Antonio Vazquez, Enrolled Agent. Walk through your intake in
            about 10 minutes and we&apos;ll handle the rest.
          </p>
        </div>

        <div style={{ width: '100%', maxWidth: 340 }}>
          <Link
            href="/login"
            style={{
              display: 'flex',
              width: '100%',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '15px 22px',
              fontSize: 15,
              fontFamily: t.sans,
              fontWeight: 500,
              background: t.ink,
              color: t.bgElev,
              border: `1px solid ${t.ink}`,
              borderRadius: 999,
              textDecoration: 'none',
              letterSpacing: -0.1,
            }}
          >
            Continue with phone number
          </Link>
          <div
            style={{
              fontFamily: t.mono,
              fontSize: 10,
              color: t.muted,
              letterSpacing: 1,
              textTransform: 'uppercase',
              textAlign: 'center',
              marginTop: 14,
            }}
          >
            Demo · Walk-through · No data saved
          </div>
        </div>
      </div>
    </main>
  );
}
