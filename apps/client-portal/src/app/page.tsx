'use client';

// Pre-login brand landing. Single CTA → /login.
// Already-signed-in users auto-skip to /welcome.
//
// Glidey transition: tap "Continue with phone number" → button presses
// down briefly → page lifts up + fades → /login fades + drops in. The
// (auth) layout's fade-in handles the receiving side.

import { buildTheme } from '@docket/ui';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useGlideyNav, GLIDEY_KEYFRAMES } from '@/lib/use-glidey-nav';

export default function LandingPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const { exiting, glide } = useGlideyNav();
  const [pressed, setPressed] = useState(false);

  // If already authed, skip the marketing splash.
  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace('/welcome');
  }, [isLoaded, isSignedIn, router]);

  const handleStart = () => {
    glide('/login');
  };

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: t.bg,
        color: t.ink,
        fontFamily: t.sans,
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 20,
        paddingBottom: 28,
        paddingLeft: 'max(28px, env(safe-area-inset-left, 28px))',
        paddingRight: 'max(28px, env(safe-area-inset-right, 28px))',
        animation: exiting
          ? 'glidey-fade-out 360ms cubic-bezier(.2,.8,.2,1) both'
          : 'landing-fade-in 480ms cubic-bezier(.2,.8,.2,1) both',
        willChange: 'opacity, transform',
      }}
    >
      <style>{`
        @keyframes landing-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        ${GLIDEY_KEYFRAMES}
      `}</style>

      {/* Content column — vertically centered, ease aesthetic. */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 32,
          paddingBottom: 32,
        }}
      >
        {/* Hero logo. Soft drop shadow instead of a faux shadow div. */}
        <img
          src="/vazant-logo.png"
          alt="Vazant Consulting"
          style={{
            width: 124,
            height: 124,
            objectFit: 'contain',
            filter: 'drop-shadow(0 8px 16px rgba(15, 62, 23, 0.10))',
          }}
        />

        <div style={{ width: '100%', maxWidth: 340, textAlign: 'left' }}>
          <h1
            style={{
              fontFamily: t.serif,
              fontSize: 38,
              fontWeight: 300,
              color: t.ease.forestDark,
              letterSpacing: -1.2,
              lineHeight: 1.1,
              margin: 0,
              marginBottom: 16,
            }}
          >
            Vazant Consulting
          </h1>
          <p
            style={{
              fontFamily: t.sans,
              fontSize: 15,
              color: t.inkSoft,
              lineHeight: 1.55,
              letterSpacing: -0.45,
              margin: 0,
            }}
          >
            Personal service from Antonio Vazquez, Enrolled Agent. Walk through your intake in
            about 10 minutes and we&apos;ll handle the rest.
          </p>
        </div>

        <div style={{ width: '100%', maxWidth: 340 }}>
          <button
            type="button"
            onClick={handleStart}
            disabled={exiting}
            onMouseDown={() => setPressed(true)}
            onMouseUp={() => setPressed(false)}
            onMouseLeave={() => setPressed(false)}
            onTouchStart={() => setPressed(true)}
            onTouchEnd={() => setPressed(false)}
            style={{
              display: 'flex',
              width: '100%',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '15px 22px',
              fontSize: 15,
              fontFamily: t.sans,
              fontWeight: 400,
              background: t.ease.forestDark,
              color: '#fffefc',
              border: 'none',
              borderRadius: 999,
              cursor: exiting ? 'default' : 'pointer',
              letterSpacing: -0.45,
              transform: pressed && !exiting ? 'scale(0.97)' : 'scale(1)',
              transition: 'transform 140ms cubic-bezier(.2,.8,.2,1)',
              boxSizing: 'border-box',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            Continue with phone number
          </button>
          <div
            style={{
              fontFamily: t.sans,
              fontSize: 12,
              color: t.muted,
              letterSpacing: -0.36,
              textAlign: 'center',
              marginTop: 16,
            }}
          >
            Secure · Encrypted · IRS-compliant
          </div>
        </div>
      </div>
    </main>
  );
}
