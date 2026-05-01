'use client';

// Pre-login brand landing. Single CTA → /login. Already-signed-in users
// auto-skip to /welcome.

import { Button, buildTheme } from '@docket/ui';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LandingPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();

  // If already authed, skip the marketing splash.
  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace('/welcome');
  }, [isLoaded, isSignedIn, router]);

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: t.bg,
        color: t.ink,
        fontFamily: t.sans,
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 24px 36px',
      }}
    >
      {/* Top corner mark */}
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
        <img
          src="/vazant-logo.png"
          alt="Vazant"
          style={{
            width: 32,
            height: 32,
            objectFit: 'contain',
          }}
        />
      </div>

      {/* Hero */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 28,
        }}
      >
        <img
          src="/vazant-logo.png"
          alt="Vazant Consulting"
          style={{
            width: 132,
            height: 132,
            objectFit: 'contain',
          }}
        />

        {/* Soft shadow under logo */}
        <div
          style={{
            width: 140,
            height: 12,
            marginTop: -36,
            borderRadius: '50%',
            background: 'rgba(40, 30, 20, 0.10)',
            filter: 'blur(8px)',
          }}
        />

        <div style={{ textAlign: 'center', maxWidth: 360, padding: '0 8px' }}>
          <div
            style={{
              fontFamily: t.mono,
              fontSize: 11,
              color: t.muted,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              marginBottom: 14,
            }}
          >
            Welcome
          </div>
          <h1
            style={{
              fontFamily: t.serif,
              fontSize: 32,
              color: t.ink,
              letterSpacing: -0.6,
              lineHeight: 1.15,
              margin: 0,
              marginBottom: 14,
            }}
          >
            Vazant Consulting
            <br />
            <span style={{ fontStyle: 'italic' }}>tax filing</span>
          </h1>
          <p
            style={{
              fontSize: 15,
              color: t.inkSoft,
              lineHeight: 1.55,
              margin: 0,
              maxWidth: 320,
              marginInline: 'auto',
            }}
          >
            Personal service from Antonio Vazquez, Enrolled Agent. Walk through your intake in
            about 10 minutes and we&apos;ll handle the rest.
          </p>
        </div>
      </div>

      {/* CTA */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <Button
          t={t}
          variant="dark"
          onClick={() => router.push('/login')}
          style={{ width: '100%', maxWidth: 360, padding: '15px 22px', fontSize: 15 }}
        >
          Continue with phone number
        </Button>
        <div
          style={{
            fontFamily: t.mono,
            fontSize: 10,
            color: t.muted,
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          Secure · Encrypted · IRS-compliant
        </div>
      </div>
    </main>
  );
}
