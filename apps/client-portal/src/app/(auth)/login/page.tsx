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
import { useGlideyNav } from '@/lib/use-glidey-nav';

type ClerkError = {
  errors?: Array<{ code?: string; message?: string; longMessage?: string }>;
  message?: string;
  longMessage?: string;
};

// Pull the most descriptive available message out of a Clerk error.
// Clerk's error shape varies by error type - sometimes errors[0], sometimes
// top-level. Try every known location in order.
function extractError(e: unknown): { code: string | undefined; message: string | undefined } {
  const err = e as ClerkError;
  const code = err.errors?.[0]?.code;
  const message =
    err.errors?.[0]?.longMessage ??
    err.errors?.[0]?.message ??
    err.longMessage ??
    err.message ??
    (e instanceof Error ? e.message : undefined);
  return { code, message };
}

// Most common countries in Antonio's market. Ordered by usage prior - US/CA top,
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

// Map raw Clerk error codes to user-readable messages where possible.
function friendlyError(code: string | undefined, fallback: string | undefined): string | null {
  switch (code) {
    case 'form_param_format_invalid':
      return 'That phone number doesn\'t look right. Check the country code and digits.';
    case 'form_identifier_exists':
      return 'This number is already in use by another account.';
    case 'too_many_requests':
    case 'lockout':
    case 'verification_attempts_exceeded':
      return 'Too many attempts. Wait 10–15 minutes and try again, or use a different phone number.';
    case 'phone_number_not_supported':
      return 'SMS isn\'t supported for this number.';
    case 'verification_failed':
      return 'That code didn\'t work. Try again or request a new one.';
  }
  // Fall back to message-content matching for codes I haven't enumerated.
  const m = (fallback ?? '').toLowerCase();
  if (m.includes('too many') || m.includes('rate limit') || m.includes('verification code requests')) {
    return 'Too many verification code requests for this number. Wait 10–15 minutes, then try again - or use a different phone.';
  }
  if (m.includes('captcha')) {
    return 'Verification challenge could not load. Refresh the page and try again.';
  }
  return fallback ?? null;
}

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
  // Most other countries - break into groups of 3 for readability.
  return digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}

export default function LoginPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const router = useRouter();
  const { exiting, glide } = useGlideyNav();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { signIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();

  // State persisted across page loads
  const [countryCode, setCountryCode] = usePortalState<string>('phone-country', 'US');
  const [phoneDigits, setPhoneDigits] = usePortalState<string>('phone-digits', '');

  // E2E ticket consumer. Playwright (or any automated client) calls
  // POST /api/e2e-bypass with phone + otp; on success, the response
  // contains a Clerk sign-in token. Playwright then navigates to
  // /login?ticket=<token> and we consume the ticket here. See
  // /api/e2e-bypass/route.ts for the gates that protect this path.
  // Tracked for removal in PRODUCTION-READINESS launch-prep.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const ticket = params.get('ticket');
    if (!ticket || !signInLoaded || !signIn) return;
    (async () => {
      try {
        const res = await signIn.create({ strategy: 'ticket', ticket });
        if (res.status === 'complete' && res.createdSessionId) {
          // Strip the ticket from the URL before activation so it
          // doesn't end up in browser history.
          window.history.replaceState({}, '', window.location.pathname);
          // setActive is on the useSignIn hook's setActive, not on
          // the result object — different from the OTP flow but the
          // legacy SDK exposes it the same way.
          // (We re-fetch from the hook on next render; for now
          // glide will handle the redirect after auth state updates.)
        }
      } catch (e) {
        console.error('[login] ticket consumption failed', e);
      }
    })();
    // signInLoaded gates re-runs; this fires once when both load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signInLoaded]);

  // Invite-link prefill: when a preparer sends a client a sign-in link
  // generated from /clients/new, the URL carries `?phone=...&country=...`.
  // Apply it once at mount, then strip the params from the URL so the
  // phone doesn't sit in the address bar (privacy: shoulder-surfing,
  // browser history, accidental re-share).
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const urlPhone = params.get('phone');
    const urlCountry = params.get('country');
    if (!urlPhone && !urlCountry) return;

    if (urlCountry) {
      const match = COUNTRIES.find((c) => c.code === urlCountry.toUpperCase());
      if (match) setCountryCode(match.code);
    }

    if (urlPhone) {
      // Phone arrives in E.164 (e.g., "+15622736682"). Strip the
      // country dial — the input field stores national digits only.
      const cc = urlCountry?.toUpperCase();
      const matched = cc ? COUNTRIES.find((c) => c.code === cc) : undefined;
      const country = matched ?? COUNTRIES[0]!;
      let digits = urlPhone.replace(/[^\d+]/g, '');
      if (digits.startsWith(country.dial)) {
        digits = digits.slice(country.dial.length);
      } else {
        digits = digits.replace(/\D/g, '');
      }
      setPhoneDigits(digits.slice(0, country.code === 'US' || country.code === 'CA' ? 10 : 15));
    }

    // Strip params from the visible URL without navigating.
    window.history.replaceState({}, '', window.location.pathname);
    // Mount-only — running this on every searchParams change would
    // clobber the user's typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setError('Auth still loading - try again in a sec');
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
      glide('/otp?mode=signin');
    } catch (e) {
      const { code, message } = extractError(e);

      // Expected recoverable cases - quiet path, no scary console.error.
      // 'form_identifier_not_found' = new user, fall through to signUp
      // 'session_exists'           = already signed in, route to /welcome
      // 'verification_already_*'   = re-using a pending verification
      const isRecoverable =
        code === 'form_identifier_not_found' ||
        code === 'session_exists' ||
        code === 'verification_already_sent' ||
        code === 'verification_already_verified';

      if (!isRecoverable) {
        // Real failure - log + surface to user. Drop the raw error
        // object: Clerk error payloads can include the phone number
        // being authenticated, and console output survives in
        // browser DevTools / shared screenshots / kiosk sessions.
        // Sentry events are scrubbed elsewhere; the browser console is not.
        console.error('[login] signIn error', { code, message });
      }

      if (code === 'form_identifier_not_found') {
        try {
          await signUp.create({ phoneNumber: e164 });
          await signUp.preparePhoneNumberVerification({ strategy: 'phone_code' });
          navigated = true;
          glide('/otp?mode=signup');
        } catch (signUpErr) {
          const { code: sCode, message: sMsg } = extractError(signUpErr);
          console.error('[login] signUp error', { code: sCode, message: sMsg });
          setError(friendlyError(sCode, sMsg) ?? `Could not start sign-up${sCode ? ` (${sCode})` : ''}`);
        }
      } else if (code === 'session_exists') {
        navigated = true;
        glide('/welcome');
      } else if (code === 'verification_already_sent' || code === 'verification_already_verified') {
        navigated = true;
        glide('/otp?mode=signin');
      } else {
        setError(friendlyError(code, message) ?? `Could not send code${code ? ` (${code})` : ''}`);
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
        animation: exiting
          ? 'glidey-fade-out 360ms cubic-bezier(.2,.8,.2,1) both'
          : undefined,
        willChange: 'opacity, transform',
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
        <h1
          style={{
            fontFamily: t.serif,
            fontSize: 38,
            fontWeight: 300,
            color: t.ease.forestDark,
            letterSpacing: -1.2,
            lineHeight: 1.1,
            margin: 0,
            marginBottom: 28,
          }}
        >
          Your phone number
        </h1>

        {/* Country picker + phone input row. Both surfaces stay white
            (#fffefc) in every state - empty, filled, focused, blurred.
            A soft drop shadow gives the field elevation so it reads
            against the cream page bg without needing a stroke or fill
            tint. Matches ease.health's white-card-with-shadow input
            pattern and the AskAntonioBar treatment. */}
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
                fontFamily: t.sans,
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
                background: '#fffefc',
                border: 'none',
                borderRadius: 12,
                color: t.ease.forestDark,
                outline: 'none',
                boxShadow: '0 2px 10px rgba(15, 62, 23, 0.06)',
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
            fontFamily: t.sans,
            fontSize: 13,
            color: t.muted,
            lineHeight: 1.5,
            letterSpacing: -0.39,
            margin: '14px 0 0',
          }}
        >
          To access your account, enter your mobile number. You&apos;ll receive a single message
          with a passcode. Message and data rates may apply.
        </p>

        {error && (
          <div
            role="alert"
            style={{
              marginTop: 16,
              padding: '12px 14px',
              background: '#FDF1EA',
              border: 'none',
              borderRadius: 12,
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              style={{ flexShrink: 0, marginTop: 1 }}
              fill="none"
              stroke="#9A4E22"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="9" cy="9" r="7.5" />
              <path d="M9 5.5v4M9 12v.5" />
            </svg>
            <div style={{ fontSize: 13.5, color: '#6E2B0C', lineHeight: 1.45 }}>{error}</div>
          </div>
        )}

        {/* Clerk CAPTCHA mount point. */}
        <div id="clerk-captcha" style={{ marginTop: 16 }} />

        {/* Next button - forestDark fill, full pill, no stroke. */}
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
              fontWeight: 400,
              letterSpacing: -0.45,
              background: t.ease.forestDark,
              color: '#fffefc',
              border: 'none',
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
        // White surface, soft shadow - matches the phone input next to
        // it. Text color is muted so the country code reads as a quiet
        // selector, not the focal element. The phone input on the right
        // is what the user is here to fill.
        background: '#fffefc',
        border: 'none',
        borderRadius: 12,
        padding: '0 14px',
        height: 52,
        fontSize: 15,
        fontFamily: t.sans,
        color: t.muted,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minWidth: 88,
        boxShadow: '0 2px 10px rgba(15, 62, 23, 0.06)',
      }}
      aria-haspopup="listbox"
      aria-expanded={open}
    >
      <span style={{ fontWeight: 400 }}>{country.code}</span>
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
        top: 60,
        left: 0,
        width: 320,
        maxWidth: '100%',
        maxHeight: 320,
        overflowY: 'auto',
        background: '#fffefc',
        border: 'none',
        borderRadius: 14,
        boxShadow: '0 12px 36px rgba(15, 62, 23, 0.14)',
        zIndex: 50,
        padding: 4,
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
              padding: '11px 12px',
              background: on ? t.ease.keylimeWash : 'transparent',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontFamily: t.sans,
              fontSize: 14,
              color: on ? t.ease.forestDark : t.ink,
              textAlign: 'left',
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: t.muted,
                letterSpacing: 0.5,
                minWidth: 30,
              }}
            >
              {c.code}
            </span>
            <span style={{ flex: 1 }}>{c.name}</span>
            <span style={{ fontSize: 12, color: t.inkSoft }}>{c.dial}</span>
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
  const { exiting, glide } = useGlideyNav();
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
        animation: exiting
          ? 'glidey-fade-out 360ms cubic-bezier(.2,.8,.2,1) both'
          : undefined,
        willChange: 'opacity, transform',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <img
          src="/vazant-logo.png"
          alt="Vazant"
          style={{ width: 48, height: 48, objectFit: 'contain' }}
        />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 360, marginInline: 'auto', textAlign: 'center' }}>
        <h1
          style={{
            fontFamily: t.serif,
            fontSize: 32,
            fontWeight: 300,
            color: t.ease.forestDark,
            letterSpacing: -0.96,
            lineHeight: 1.15,
            margin: 0,
            marginBottom: 14,
          }}
        >
          You have an active session
        </h1>
        <p style={{ fontFamily: t.sans, fontSize: 14, color: t.inkSoft, lineHeight: 1.55, letterSpacing: -0.42, margin: 0, marginBottom: 20 }}>
          Signed in as{' '}
          <span style={{ color: t.ease.forestDark, fontWeight: 500 }}>{identifier}</span>. Continue
          to your portal, or sign out to use a different number.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Button
            t={t}
            variant="dark"
            onClick={() => glide('/welcome')}
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
