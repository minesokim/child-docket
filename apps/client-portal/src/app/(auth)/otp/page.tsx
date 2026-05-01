'use client';

// DEMO BUILD — phone-OTP step 2 with no Clerk integration.
// Single 6-digit input. Verify always advances to /welcome regardless of code.

import { Suspense, useEffect, useState } from 'react';
import { buildTheme } from '@docket/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

function formatUSDisplay(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(-10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export default function OtpPage() {
  return (
    <Suspense fallback={null}>
      <OtpFlow />
    </Suspense>
  );
}

function OtpFlow() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const router = useRouter();
  const searchParams = useSearchParams();
  const phoneRaw = searchParams.get('phone') ?? '';
  const phoneDisplay = formatUSDisplay(phoneRaw) || phoneRaw;

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resentVisible, setResentVisible] = useState(false);

  const canVerify = code.length === 6 && !verifying;

  const onVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canVerify) return;
    setVerifying(true);
    // No Clerk verify call — just advance.
    window.setTimeout(() => router.push('/welcome'), 320);
  };

  const onResend = () => {
    setResentVisible(true);
    window.setTimeout(() => setResentVisible(false), 2400);
  };

  // Auto-submit when 6 digits typed.
  useEffect(() => {
    if (code.length === 6 && !verifying) {
      const id = window.setTimeout(() => router.push('/welcome'), 360);
      return () => window.clearTimeout(id);
    }
  }, [code, verifying, router]);

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: t.bg,
        color: t.ink,
        fontFamily: t.sans,
        display: 'flex',
        flexDirection: 'column',
        padding: '20px max(24px, env(safe-area-inset-left, 24px)) 28px max(24px, env(safe-area-inset-right, 24px))',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link
          href="/login"
          aria-label="Back"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: 999,
            border: `1px solid ${t.border}`,
            color: t.ink,
            textDecoration: 'none',
            background: t.bgElev,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <span style={{ fontFamily: t.mono, fontSize: 11, color: t.muted, letterSpacing: 1, textTransform: 'uppercase' }}>
          Demo
        </span>
        <div style={{ width: 40 }} />
      </header>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28, maxWidth: 360, width: '100%', margin: '0 auto' }}>
        <div>
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
            Verify
          </div>
          <h1
            style={{
              fontFamily: t.sans,
              fontSize: 28,
              fontWeight: 600,
              color: t.ink,
              letterSpacing: -0.6,
              lineHeight: 1.2,
              margin: 0,
              marginBottom: 14,
            }}
          >
            Enter the 6-digit code
          </h1>
          <p style={{ fontSize: 15, color: t.inkSoft, lineHeight: 1.55, margin: 0 }}>
            {phoneDisplay
              ? <>We sent it to <span style={{ color: t.ink, fontWeight: 500 }}>{phoneDisplay}</span>. (Demo: type any 6 digits.)</>
              : <>Demo: type any 6 digits to continue.</>}
          </p>
        </div>

        <form onSubmit={onVerify} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            autoComplete="one-time-code"
            placeholder="– – – – – –"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            style={{
              width: '100%',
              padding: '20px 14px',
              background: t.bgElev,
              border: `1px solid ${t.border}`,
              borderRadius: 14,
              fontFamily: t.sans,
              fontSize: 26,
              fontWeight: 500,
              color: t.ink,
              outline: 'none',
              textAlign: 'center',
              letterSpacing: 6,
              fontVariantNumeric: 'tabular-nums lining-nums',
              boxSizing: 'border-box',
            }}
          />

          <button
            type="submit"
            disabled={!canVerify}
            style={{
              display: 'block',
              width: '100%',
              padding: '15px 22px',
              fontSize: 15,
              fontFamily: t.sans,
              fontWeight: 500,
              background: canVerify ? t.ink : t.muted,
              color: t.bgElev,
              border: `1px solid ${canVerify ? t.ink : t.muted}`,
              borderRadius: 999,
              cursor: canVerify ? 'pointer' : 'not-allowed',
              letterSpacing: -0.1,
              transition: 'background 160ms, opacity 160ms',
              boxSizing: 'border-box',
            }}
          >
            {verifying ? 'Verifying…' : 'Verify'}
          </button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, position: 'relative', minHeight: 28 }}>
          <button
            type="button"
            onClick={onResend}
            style={{
              background: 'transparent',
              border: 'none',
              fontFamily: t.sans,
              fontSize: 13,
              color: t.inkSoft,
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 4,
            }}
          >
            Resend code
          </button>
          {resentVisible && (
            <div
              style={{
                position: 'absolute',
                top: 28,
                fontFamily: t.mono,
                fontSize: 11,
                color: t.muted,
                letterSpacing: 1,
                textTransform: 'uppercase',
                animation: 'resent-toast 2400ms cubic-bezier(.2,.8,.2,1) both',
              }}
            >
              Code resent
            </div>
          )}
        </div>

        <style>{`
          @keyframes resent-toast {
            0%   { opacity: 0; transform: translateY(-32px); }
            18%  { opacity: 1; transform: translateY(0);     }
            82%  { opacity: 1; transform: translateY(0);     }
            100% { opacity: 0; transform: translateY(14px);  }
          }
        `}</style>
      </div>
    </main>
  );
}
