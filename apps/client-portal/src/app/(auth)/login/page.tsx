'use client';

// DEMO BUILD — phone-OTP step 1 with no Clerk integration.
// Country picker + formatted phone input. Submit always advances to /otp
// regardless of phone validity (we just want a 10-digit number for the
// next page to display).

import { buildTheme } from '@docket/ui';
import type { Theme } from '@docket/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { usePortalState } from '@/lib/portal-state';

const COUNTRIES: Array<{ code: string; name: string; dial: string; flag: string }> = [
  { code: 'US', name: 'United States', dial: '+1', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦' },
  { code: 'MX', name: 'Mexico', dial: '+52', flag: '🇲🇽' },
  { code: 'KR', name: 'South Korea', dial: '+82', flag: '🇰🇷' },
  { code: 'CN', name: 'China', dial: '+86', flag: '🇨🇳' },
  { code: 'IN', name: 'India', dial: '+91', flag: '🇮🇳' },
  { code: 'PH', name: 'Philippines', dial: '+63', flag: '🇵🇭' },
  { code: 'VN', name: 'Vietnam', dial: '+84', flag: '🇻🇳' },
  { code: 'JP', name: 'Japan', dial: '+81', flag: '🇯🇵' },
  { code: 'BR', name: 'Brazil', dial: '+55', flag: '🇧🇷' },
  { code: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧' },
  { code: 'FR', name: 'France', dial: '+33', flag: '🇫🇷' },
  { code: 'DE', name: 'Germany', dial: '+49', flag: '🇩🇪' },
  { code: 'IT', name: 'Italy', dial: '+39', flag: '🇮🇹' },
  { code: 'ES', name: 'Spain', dial: '+34', flag: '🇪🇸' },
  { code: 'AU', name: 'Australia', dial: '+61', flag: '🇦🇺' },
  { code: 'CO', name: 'Colombia', dial: '+57', flag: '🇨🇴' },
  { code: 'PE', name: 'Peru', dial: '+51', flag: '🇵🇪' },
  { code: 'AR', name: 'Argentina', dial: '+54', flag: '🇦🇷' },
  { code: 'CL', name: 'Chile', dial: '+56', flag: '🇨🇱' },
];

type Country = (typeof COUNTRIES)[number];

function formatUSDisplay(digits: string): string {
  const d = digits.slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)})-${d.slice(3)}`;
  return `(${d.slice(0, 3)})-${d.slice(3, 6)}-${d.slice(6)}`;
}

export default function LoginPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const router = useRouter();
  const dropdownRef = React.useRef<HTMLDivElement | null>(null);

  const [country, setCountry] = usePortalState<Country>('login-country', COUNTRIES[0]!);
  const [digits, setDigits] = usePortalState<string>('login-digits', '');
  const [dropOpen, setDropOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Outside-click closes country dropdown.
  React.useEffect(() => {
    if (!dropOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    };
    // Defer one tick so the opening click doesn't immediately close.
    const id = window.setTimeout(() => document.addEventListener('mousedown', onDoc), 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [dropOpen]);

  const display = country.code === 'US' || country.code === 'CA'
    ? formatUSDisplay(digits)
    : digits;

  const canSubmit = digits.length >= 7 && !submitting;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    // No Clerk call — just advance with a faux delay so it feels real.
    window.setTimeout(() => {
      const params = new URLSearchParams({ phone: `${country.dial}${digits}` });
      router.push(`/otp?${params.toString()}`);
    }, 280);
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
        padding: '20px max(24px, env(safe-area-inset-left, 24px)) 28px max(24px, env(safe-area-inset-right, 24px))',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link
          href="/"
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
            Sign in
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
            What&apos;s your phone number?
          </h1>
          <p style={{ fontSize: 15, color: t.inkSoft, lineHeight: 1.55, margin: 0 }}>
            We&apos;ll text you a 6-digit code. No code arrives in demo mode — just type any 6 digits on the next screen.
          </p>
        </div>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, position: 'relative' }} ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropOpen((v) => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '14px 12px',
                background: t.bgElev,
                border: `1px solid ${t.border}`,
                borderRadius: 12,
                fontFamily: t.sans,
                fontSize: 15,
                color: t.ink,
                cursor: 'pointer',
                minWidth: 96,
              }}
            >
              <span style={{ fontSize: 18 }}>{country.flag}</span>
              <span style={{ fontWeight: 500 }}>{country.dial}</span>
              <svg width="10" height="10" viewBox="0 0 10 10" style={{ marginLeft: 'auto' }}>
                <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="(555)-123-4567"
              value={display}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/\D/g, '').slice(0, 15);
                setDigits(cleaned);
              }}
              style={{
                flex: 1,
                padding: '14px 14px',
                background: t.bgElev,
                border: `1px solid ${t.border}`,
                borderRadius: 12,
                fontFamily: t.sans,
                fontSize: 16,
                color: t.ink,
                outline: 'none',
              }}
            />

            {dropOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  background: t.bgElev,
                  border: `1px solid ${t.border}`,
                  borderRadius: 12,
                  boxShadow: '0 10px 28px rgba(40,30,20,0.12)',
                  overflow: 'auto',
                  maxHeight: 320,
                  width: 240,
                  zIndex: 10,
                }}
              >
                {COUNTRIES.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => {
                      setCountry(c);
                      setDropOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '11px 14px',
                      background: c.code === country.code ? t.bg : 'transparent',
                      border: 'none',
                      fontFamily: t.sans,
                      fontSize: 14,
                      color: t.ink,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: 17 }}>{c.flag}</span>
                    <span style={{ flex: 1 }}>{c.name}</span>
                    <span style={{ color: t.muted }}>{c.dial}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              display: 'block',
              width: '100%',
              padding: '15px 22px',
              fontSize: 15,
              fontFamily: t.sans,
              fontWeight: 500,
              background: canSubmit ? t.ink : t.muted,
              color: t.bgElev,
              border: `1px solid ${canSubmit ? t.ink : t.muted}`,
              borderRadius: 999,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              letterSpacing: -0.1,
              transition: 'background 160ms, opacity 160ms',
              boxSizing: 'border-box',
            }}
          >
            {submitting ? 'Sending…' : 'Send verification code'}
          </button>
        </form>

        <div style={{ fontFamily: t.mono, fontSize: 10, color: t.muted, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' }}>
          Secure · Encrypted · IRS-compliant
        </div>
      </div>
    </main>
  );
}

// keep the unused-Theme-import warning quiet (theme typing referenced for future variant work).
type _ = Theme;
