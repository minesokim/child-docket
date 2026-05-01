'use client';

// Phone-OTP step 1: enter phone number with country selector.
// Uses Clerk's useSignIn / useSignUp (legacy hooks for the .create + .prepareFirstFactor
// pattern). Tries sign-in first; falls back to sign-up on identifier-not-found.

import {
  Button,
  buildTheme,
} from '@docket/ui';
import type { Theme } from '@docket/ui';
import { useSignIn, useSignUp } from '@clerk/nextjs/legacy';
import { useAuth, useClerk, useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { usePortalState } from '@/lib/portal-state';

type ClerkError = {
  errors?: Array<{ code?: string; message?: string }>;
};

// Most common countries in Antonio's market. Ordered by usage prior — US/CA top,
// then Latino markets, then APAC. Full international list can land later.
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
  { code: 'EC', name: 'Ecuador', dial: '+593', flag: '🇪🇨' },
  { code: 'GT', name: 'Guatemala', dial: '+502', flag: '🇬🇹' },
  { code: 'HN', name: 'Honduras', dial: '+504', flag: '🇭🇳' },
  { code: 'SV', name: 'El Salvador', dial: '+503', flag: '🇸🇻' },
];

type Country = (typeof COUNTRIES)[number];

// Format a US/Canada 10-digit phone for display.
function formatUS(digits: string): string {
  const d = digits.slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)})-${d.slice(3)}`;
  return `(${d.slice(0, 3)})-${d.slice(3, 6)}-${d.slice(6)}`;
}

// Strip non-digits + cap length per country.
function normalizeDigits(raw: string, country: Country): string {
  const cap = country.code === 'US' || country.code === 'CA' ? 10 : 15;
  return raw.replace(/\D/g, '').slice(0, cap);
}

// Display value for the input field.
function formatForCountry(digits: string, country: Country): string {
  if (country.code === 'US' || country.code === 'CA') return formatUS(digits);
  // Most other countries — break into groups of 3 for readability.
  return digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}

export default function LoginPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const router = useRouter();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { signIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();

  // State persisted across page loads
  const [countryCode, setCountryCode] = usePortalState<string>('phone-country', 'US');
  const [phoneDigits, setPhoneDigits] = usePortalState<string>('phone-digits', '');

  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  if (authLoaded && isSignedIn) {
    return <AlreadySignedIn t={t} user={user} signOut={signOut} router={router} />;
  }

  const country = COUNTRIES.find((c) => c.code === countryCode) ?? COUNTRIES[0]!;
  const display = formatForCountry(phoneDigits, country);
  const e164 = `${country.dial}${phoneDigits}`;
  const phoneLooksValid = phoneDigits.length >= 7;

  const onSubmit = async () => {
    if (submitting) return;
    if (!signInLoaded || !signUpLoaded) {
      setError('Auth still loading — try again in a sec');
      return;
    }
    if (!signIn || !signUp) {
      setError('Sign-in service unavailable');
      return;
    }
    if (!phoneLooksValid) {
      setError('Enter your phone number');
      return;
    }

    setError(null);
    setSubmitting(true);
    let navigated = false;

    try {
      const attempt = await signIn.create({ identifier: e164 });
      const phoneFactor = attempt.supportedFirstFactors?.find(
        (f): f is typeof f & { strategy: 'phone_code'; phoneNumberId: string } =>
          f.strategy === 'phone_code',
      );
      if (!phoneFactor) {
        throw new Error('Phone OTP not enabled on this account');
      }
      await signIn.prepareFirstFactor({
        strategy: 'phone_code',
        phoneNumberId: phoneFactor.phoneNumberId,
      });
      navigated = true;
      router.push('/otp?mode=signin');
    } catch (e) {
      const err = e as ClerkError;
      const code = err.errors?.[0]?.code;
      console.error('[login] signIn error', { code, raw: err });

      if (code === 'form_identifier_not_found') {
        try {
          await signUp.create({ phoneNumber: e164 });
          await signUp.preparePhoneNumberVerification({ strategy: 'phone_code' });
          navigated = true;
          router.push('/otp?mode=signup');
        } catch (signUpErr) {
          const sErr = signUpErr as ClerkError;
          console.error('[login] signUp error', sErr);
          setError(sErr.errors?.[0]?.message ?? 'Could not start sign-up');
        }
      } else if (code === 'session_exists') {
        navigated = true;
        router.push('/welcome');
      } else {
        setError(err.errors?.[0]?.message ?? `Could not send code${code ? ` (${code})` : ''}`);
      }
    } finally {
      if (!navigated) setSubmitting(false);
    }
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
        padding: '20px 24px 28px',
      }}
    >
      {/* Top bar with back button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link
          href="/"
          aria-label="Back"
          style={{
            padding: 8,
            marginLeft: -8,
            color: t.inkSoft,
            display: 'flex',
            alignItems: 'center',
            textDecoration: 'none',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M12 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <img
          src="/vazant-logo.png"
          alt="Vazant"
          style={{ width: 36, height: 36, objectFit: 'contain' }}
        />
        <div style={{ width: 36 }} />
      </div>

      <div style={{ flex: 1, paddingTop: 28, maxWidth: 420, marginInline: 'auto', width: '100%' }}>
        <div
          style={{
            fontFamily: t.mono,
            fontSize: 10.5,
            color: t.muted,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          Step 1 of 2
        </div>
        <h1
          style={{
            fontFamily: t.serif,
            fontSize: 30,
            color: t.ink,
            letterSpacing: -0.5,
            margin: 0,
            marginBottom: 24,
          }}
        >
          Your phone number
        </h1>

        {/* Country picker + phone input row */}
        <div style={{ display: 'flex', gap: 10, position: 'relative' }}>
          <CountryPickerButton
            t={t}
            country={country}
            open={pickerOpen}
            onClick={() => setPickerOpen((v) => !v)}
            disabled={submitting}
          />
          <div style={{ flex: 1, position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                fontFamily: t.mono,
                fontSize: 16,
                color: t.muted,
                pointerEvents: 'none',
              }}
            >
              {country.dial}
            </span>
            <input
              value={display}
              onChange={(e) => setPhoneDigits(normalizeDigits(e.target.value, country))}
              placeholder={
                country.code === 'US' || country.code === 'CA'
                  ? '(234)-567-8900'
                  : '234 567 8900'
              }
              inputMode="tel"
              type="tel"
              autoComplete="tel-national"
              disabled={submitting}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '14px 16px 14px',
                paddingLeft: country.dial.length === 2 ? 38 : country.dial.length === 3 ? 46 : 52,
                fontSize: 16,
                fontFamily: t.sans,
                background: t.card,
                border: `1px solid ${error ? t.rust : t.border}`,
                borderRadius: 10,
                color: t.ink,
                outline: 'none',
              }}
            />
          </div>

          {pickerOpen && (
            <CountryPicker
              t={t}
              selected={countryCode}
              onSelect={(code) => {
                setCountryCode(code);
                setPickerOpen(false);
              }}
              onClose={() => setPickerOpen(false)}
            />
          )}
        </div>

        {/* Help text */}
        <p
          style={{
            fontSize: 13,
            color: t.muted,
            lineHeight: 1.5,
            margin: '14px 0 0',
          }}
        >
          To access your account, enter your mobile number. You&apos;ll receive a single message
          with a passcode. Message and data rates may apply.
        </p>

        {error && (
          <p
            style={{
              fontSize: 13,
              color: t.rust,
              margin: '10px 0 0',
            }}
          >
            {error}
          </p>
        )}

        {/* Next button — plain <button> for full width control on iOS Safari.
            (Button component's inline-flex default was rendering as content-width
            in some viewports.) */}
        <div style={{ marginTop: 28, width: '100%' }}>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            style={{
              display: 'block',
              width: '100%',
              boxSizing: 'border-box',
              padding: '14px 22px',
              fontSize: 15,
              fontFamily: t.sans,
              fontWeight: 500,
              letterSpacing: -0.1,
              background: t.ink,
              color: t.bgElev,
              border: `1px solid ${t.ink}`,
              borderRadius: 999,
              textAlign: 'center',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.6 : phoneLooksValid ? 1 : 0.5,
              transition: 'opacity 0.15s',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {submitting ? 'Sending…' : 'Next'}
          </button>
        </div>
      </div>
    </main>
  );
}

// ─── Country picker button ─────────────────────────────────────

function CountryPickerButton({
  t,
  country,
  open,
  onClick,
  disabled,
}: {
  t: Theme;
  country: Country;
  open: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: t.card,
        border: `1px solid ${t.border}`,
        borderRadius: 10,
        padding: '0 14px',
        height: 50,
        fontSize: 15,
        fontFamily: t.sans,
        color: t.ink,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minWidth: 88,
      }}
      aria-haspopup="listbox"
      aria-expanded={open}
    >
      <span style={{ fontWeight: 500 }}>{country.code}</span>
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        stroke={t.muted}
        strokeWidth="1.6"
        style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 120ms' }}
      >
        <path d="M2 3.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

// ─── Country picker dropdown ───────────────────────────────────

function CountryPicker({
  t,
  selected,
  onSelect,
  onClose,
}: {
  t: Theme;
  selected: string;
  onSelect: (code: string) => void;
  onClose: () => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    // Defer attachment by one tick: the click that opened this dropdown
    // would otherwise fire mousedown immediately, see "outside" target,
    // and close it on the very same click.
    const id = setTimeout(() => document.addEventListener('mousedown', onDocClick), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', onDocClick);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="listbox"
      style={{
        position: 'absolute',
        top: 58,
        left: 0,
        width: 320,
        maxWidth: '100%',
        maxHeight: 320,
        overflowY: 'auto',
        background: t.card,
        border: `1px solid ${t.border}`,
        borderRadius: 12,
        boxShadow: '0 12px 36px rgba(40, 30, 20, 0.18)',
        zIndex: 50,
      }}
    >
      {COUNTRIES.map((c) => {
        const on = c.code === selected;
        return (
          <button
            key={c.code}
            onClick={() => onSelect(c.code)}
            role="option"
            aria-selected={on}
            style={{
              display: 'flex',
              width: '100%',
              alignItems: 'center',
              gap: 12,
              padding: '11px 14px',
              background: on ? t.tintAccent : 'transparent',
              border: 'none',
              borderBottom: `1px solid ${t.borderSoft}`,
              cursor: 'pointer',
              fontFamily: t.sans,
              fontSize: 14,
              color: t.ink,
              textAlign: 'left',
            }}
          >
            <span
              style={{
                fontFamily: t.mono,
                fontSize: 11,
                color: t.muted,
                letterSpacing: 0.5,
                minWidth: 30,
              }}
            >
              {c.code}
            </span>
            <span style={{ flex: 1 }}>{c.name}</span>
            <span style={{ fontFamily: t.mono, fontSize: 12, color: t.inkSoft }}>{c.dial}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Already-signed-in fallback ────────────────────────────────

function AlreadySignedIn({
  t,
  user,
  signOut,
  router,
}: {
  t: Theme;
  user: ReturnType<typeof useUser>['user'];
  signOut: ReturnType<typeof useClerk>['signOut'];
  router: ReturnType<typeof useRouter>;
}) {
  const identifier =
    user?.primaryPhoneNumber?.phoneNumber ??
    user?.primaryEmailAddress?.emailAddress ??
    user?.id ??
    'your existing account';

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
        gap: 24,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <img src="/vazant-logo.png" alt="Vazant" style={{ width: 48, height: 48 }} />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 360, marginInline: 'auto', textAlign: 'center' }}>
        <div
          style={{
            fontFamily: t.mono,
            fontSize: 10.5,
            color: t.muted,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          Already signed in
        </div>
        <h1
          style={{
            fontFamily: t.serif,
            fontSize: 26,
            color: t.ink,
            letterSpacing: -0.5,
            margin: 0,
            marginBottom: 14,
          }}
        >
          You have an active session
        </h1>
        <p style={{ fontSize: 14, color: t.inkSoft, lineHeight: 1.5, margin: 0, marginBottom: 20 }}>
          Active session for{' '}
          <span style={{ fontFamily: t.mono, color: t.ink }}>{identifier}</span>. Continue to your
          portal, or sign out to use a different number.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Button
            t={t}
            variant="dark"
            onClick={() => router.push('/welcome')}
            style={{ width: '100%', padding: '14px 22px', fontSize: 15 }}
          >
            Continue to portal
          </Button>
          <Button
            t={t}
            variant="ghost"
            onClick={() => signOut().then(() => router.refresh())}
            style={{ width: '100%', padding: '12px 22px', fontSize: 14 }}
          >
            Sign out and use a different number
          </Button>
        </div>
      </div>
    </main>
  );
}
