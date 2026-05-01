'use client';

// Phone-OTP step 2: enter the 6-digit code Clerk just SMS'd.
// Layout copied from Arcade Coffee Roasters reference: single big input with
// dash placeholder, "Resend code" inline (no countdown), dark Verify button.

import { Suspense, useEffect, useRef, useState } from 'react';
import { buildTheme } from '@docket/ui';
import { useSignIn, useSignUp } from '@clerk/nextjs/legacy';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePortalState } from '@/lib/portal-state';

type ClerkError = {
  errors?: Array<{ code?: string; message?: string }>;
};

const COUNTRY_DIALS: Record<string, string> = {
  US: '+1',
  CA: '+1',
  MX: '+52',
  KR: '+82',
  CN: '+86',
  IN: '+91',
  PH: '+63',
  VN: '+84',
  JP: '+81',
  BR: '+55',
  GB: '+44',
  FR: '+33',
  DE: '+49',
  IT: '+39',
  ES: '+34',
  AU: '+61',
  CO: '+57',
  PE: '+51',
  AR: '+54',
  CL: '+56',
  EC: '+593',
  GT: '+502',
  HN: '+504',
  SV: '+503',
};

function formatUSDisplay(digits: string): string {
  const d = digits.slice(0, 10);
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
  const mode = (searchParams.get('mode') ?? 'signin') as 'signin' | 'signup';

  const { signIn, setActive: setActiveSignIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setActiveSignUp, isLoaded: signUpLoaded } = useSignUp();

  const [countryCode] = usePortalState<string>('phone-country', 'US');
  const [phoneDigits] = usePortalState<string>('phone-digits', '');

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resentToast, setResentToast] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Phone display: reveal full number — no masking. Matches Arcade reference.
  const dial = COUNTRY_DIALS[countryCode] ?? '+1';
  const display =
    countryCode === 'US' || countryCode === 'CA'
      ? formatUSDisplay(phoneDigits)
      : `${dial} ${phoneDigits}`;

  const verify = async (fullCode: string) => {
    if (!signInLoaded || !signUpLoaded || !signIn || !signUp) return;
    setVerifying(true);
    setError(null);

    // If we landed here with the signUp already complete (e.g. user verified
    // earlier but the page errored before activating the session), just
    // activate now and route forward — don't re-attempt verification.
    if (mode === 'signup' && signUp.status === 'complete' && signUp.createdSessionId) {
      try {
        await setActiveSignUp({ session: signUp.createdSessionId });
        router.push('/welcome');
        return;
      } catch (e) {
        console.error('[otp] setActive on complete signup failed', e);
      }
    }
    if (mode === 'signin' && signIn.status === 'complete' && signIn.createdSessionId) {
      try {
        await setActiveSignIn({ session: signIn.createdSessionId });
        router.push('/welcome');
        return;
      } catch (e) {
        console.error('[otp] setActive on complete signin failed', e);
      }
    }

    try {
      if (mode === 'signin') {
        const result = await signIn.attemptFirstFactor({
          strategy: 'phone_code',
          code: fullCode,
        });
        if (result.status === 'complete' && result.createdSessionId) {
          await setActiveSignIn({ session: result.createdSessionId });
          router.push('/welcome');
          return;
        }
        throw new Error(`Unexpected sign-in status: ${result.status}`);
      } else {
        const result = await signUp.attemptPhoneNumberVerification({ code: fullCode });

        if (result.status === 'complete' && result.createdSessionId) {
          await setActiveSignUp({ session: result.createdSessionId });
          router.push('/welcome');
          return;
        }

        // Phone verified but signUp still has open requirements (extra
        // required fields, CAPTCHA, etc.). Surface them so we can debug.
        if (result.status === 'missing_requirements') {
          const missing = [
            ...(result.missingFields ?? []),
            ...(result.unverifiedFields ?? []),
          ];
          console.error('[otp] signup missing_requirements', {
            missingFields: result.missingFields,
            unverifiedFields: result.unverifiedFields,
          });
          setError(
            `Sign-up needs more info: ${missing.length ? missing.join(', ') : 'unknown requirement'}. ` +
              `Check Clerk dashboard → User & authentication — make sure phone is the only required field.`,
          );
          setVerifying(false);
          return;
        }

        throw new Error(`Unexpected sign-up status: ${result.status}`);
      }
    } catch (e) {
      const err = e as ClerkError;
      const code = err.errors?.[0]?.code;
      const message = err.errors?.[0]?.message;
      console.error('[otp] verify error', { code, message, raw: err });

      // Verification already happened in a prior attempt. Try to activate
      // whatever session is on the signUp/signIn object.
      if (code === 'verification_already_verified') {
        const session = mode === 'signup' ? signUp.createdSessionId : signIn.createdSessionId;
        if (session) {
          try {
            if (mode === 'signup') {
              await setActiveSignUp({ session });
            } else {
              await setActiveSignIn({ session });
            }
            router.push('/welcome');
            return;
          } catch (activateErr) {
            console.error('[otp] activate after already-verified failed', activateErr);
          }
        }
        setError(
          'You\'re already verified but sign-up didn\'t finish. Open Clerk dashboard → Users → delete this user, then sign up again.',
        );
        setVerifying(false);
        return;
      }

      setError(message ?? 'Code did not verify');
      setCode('');
      setVerifying(false);
      inputRef.current?.focus();
    }
  };

  const onCodeChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    setError(null);
    if (digits.length === 6) {
      verify(digits);
    }
  };

  const resend = async () => {
    if (resending || !signInLoaded || !signUpLoaded || !signIn || !signUp) return;
    setResending(true);
    setError(null);
    try {
      if (mode === 'signin') {
        const phoneFactor = signIn.supportedFirstFactors?.find(
          (f): f is typeof f & { strategy: 'phone_code'; phoneNumberId: string } =>
            f.strategy === 'phone_code',
        );
        if (phoneFactor) {
          await signIn.prepareFirstFactor({
            strategy: 'phone_code',
            phoneNumberId: phoneFactor.phoneNumberId,
          });
        }
      } else {
        await signUp.preparePhoneNumberVerification({ strategy: 'phone_code' });
      }
      setResentToast(true);
      setTimeout(() => setResentToast(false), 2400);
    } catch (e) {
      const err = e as ClerkError;
      console.error('[otp] resend error', err);
      setError(err.errors?.[0]?.message ?? 'Could not resend code');
    } finally {
      setResending(false);
    }
  };

  const canVerify = code.length === 6 && !verifying;

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
      }}
    >
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        <Link
          href="/login"
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

        {/* Resend toast — appears center-top after Resend click */}
        {resentToast && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 0,
              transform: 'translate(-50%, 0)',
              background: t.card,
              border: `1px solid ${t.borderSoft}`,
              borderRadius: 999,
              padding: '6px 14px 6px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 6px 18px rgba(40,30,20,0.10)',
              fontSize: 13,
              color: t.ink,
              fontFamily: t.sans,
              animation: 'toast-cycle 2400ms cubic-bezier(.2,.8,.2,1) forwards',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14">
              <circle cx="7" cy="7" r="7" fill="#4a8f5f" />
              <path d="M4 7l2 2 4-5" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Code resent
          </div>
        )}

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
          Step 2 of 2
        </div>
        <h1
          style={{
            fontFamily: t.sans,
            fontSize: 28,
            fontWeight: 600,
            color: t.ink,
            letterSpacing: -0.6,
            lineHeight: 1.25,
            margin: 0,
            marginBottom: 24,
          }}
        >
          Enter the 6 digit code sent to{' '}
          <span style={{ whiteSpace: 'nowrap' }}>{display || 'your phone'}</span>
        </h1>

        {/* Label row + Resend */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 8,
          }}
        >
          <label
            htmlFor="otp-code"
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: t.ink,
              fontFamily: t.sans,
            }}
          >
            6-digit verification code
          </label>
          <button
            type="button"
            onClick={resend}
            disabled={resending}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: 13,
              color: t.muted,
              cursor: resending ? 'not-allowed' : 'pointer',
              fontFamily: t.sans,
              opacity: resending ? 0.5 : 1,
            }}
          >
            {resending ? 'Resending…' : 'Resend code'}
          </button>
        </div>

        {/* Code input — sans-serif, modern, like Arcade */}
        <input
          ref={inputRef}
          id="otp-code"
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="------"
          disabled={verifying}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '16px 18px',
            fontSize: 22,
            fontFamily: t.sans,
            fontWeight: 500,
            fontFeatureSettings: '"tnum" 1, "lnum" 1',
            letterSpacing: code ? 6 : 1,
            background: t.card,
            border: `1px solid ${error ? t.rust : t.border}`,
            borderRadius: 10,
            color: t.ink,
            outline: 'none',
            textAlign: 'center',
          }}
        />

        {/* Clerk CAPTCHA mount point (in case verification triggers it) */}
        <div id="clerk-captcha" style={{ marginTop: 12 }} />

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

        {/* Verify button */}
        <div style={{ marginTop: 28, width: '100%' }}>
          <button
            type="button"
            onClick={() => code.length === 6 && verify(code)}
            disabled={!canVerify}
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
              cursor: canVerify ? 'pointer' : 'not-allowed',
              opacity: verifying ? 0.6 : code.length === 6 ? 1 : 0.5,
              transition: 'opacity 0.15s',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {verifying ? 'Verifying…' : 'Verify'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes toast-cycle {
          /* Slide down from above with fade in */
          0%   { opacity: 0; transform: translate(-50%, -32px); }
          12%  { opacity: 1; transform: translate(-50%, 0);     }
          /* Hold */
          80%  { opacity: 1; transform: translate(-50%, 0);     }
          /* Slide down further with fade out */
          100% { opacity: 0; transform: translate(-50%, 14px);  }
        }
      `}</style>
    </main>
  );
}
