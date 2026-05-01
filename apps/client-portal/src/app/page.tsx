'use client';

// Pre-login brand landing. Single CTA → /login. Already-signed-in users
// auto-skip to /welcome.

import { buildTheme } from '@docket/ui';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
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
        padding: '20px 24px 28px',
      }}
    >
      {/* Content column — vertically centered-ish, text left-aligned */}
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
        {/* Hero logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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
              marginTop: -10,
              borderRadius: '50%',
              background: 'rgba(40, 30, 20, 0.10)',
              filter: 'blur(8px)',
            }}
          />
        </div>

        {/* Text block — left aligned within column */}
        <div style={{ width: '100%', maxWidth: 360, textAlign: 'left' }}>
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
            }}
          >
            Personal service from Antonio Vazquez, Enrolled Agent. Walk through your intake in
            about 10 minutes and we&apos;ll handle the rest.
          </p>
        </div>

        {/* CTA — right below copy, not page-bottom */}
        <div style={{ width: '100%', maxWidth: 360 }}>
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
            Secure · Encrypted · IRS-compliant
          </div>
        </div>
      </div>
    </main>
  );
}
