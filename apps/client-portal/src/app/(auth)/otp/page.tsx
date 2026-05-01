'use client';

// Real Clerk phone-OTP verification.
// Continues the flow started on /login. Supports both new sign-up and
// returning sign-in modes via ?mode=signup or ?mode=signin URL param.
//
// On 6-digit code entry → calls signIn.attemptFirstFactor or
// signUp.attemptPhoneNumberVerification, activates session via setActive,
// redirects to /welcome.

import { Suspense, useEffect, useRef, useState } from 'react';
import {
  BackButton,
  Body,
  buildTheme,
  Footer,
  H1,
  Row,
  Screen,
  Stack,
} from '@docket/ui';
import { useSignIn, useSignUp } from '@clerk/nextjs/legacy';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePortalState } from '@/lib/portal-state';

type ClerkError = {
  errors?: Array<{ code?: string; message?: string }>;
};

// useSearchParams forces this page to dynamic rendering. Wrap in Suspense
// so Next 15 doesn't bail prerender (would error at build time otherwise).
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

  const [phone] = usePortalState<string>('phone', '');
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(47);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  // Mask the last 4 digits of the phone number for display
  const phoneDigits = phone.replace(/\D/g, '');
  const lastFour = phoneDigits.slice(-4);
  const areaCode = phoneDigits.slice(0, 3);
  const maskedPhone = phone ? `(${areaCode}) •••-${lastFour}` : '(•••) •••-••••';

  const verify = async (fullCode: string) => {
    if (!signInLoaded || !signUpLoaded || !signIn || !signUp) return;
    setVerifying(true);
    setError(null);
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
        throw new Error(`Unexpected sign-up status: ${result.status}`);
      }
    } catch (e) {
      const err = e as ClerkError;
      setError(err.errors?.[0]?.message ?? 'Code did not verify');
      setDigits(['', '', '', '', '', '']);
      setVerifying(false);
      inputRefs.current[0]?.focus();
    }
  };

  const set = (i: number, v: string) => {
    const clean = v.replace(/\D/g, '');
    if (clean.length === 0) {
      const next = [...digits];
      next[i] = '';
      setDigits(next);
      return;
    }

    const next = [...digits];
    for (let k = 0; k < clean.length && i + k < 6; k++) {
      next[i + k] = clean[k] ?? '';
    }
    setDigits(next);

    const nextIdx = Math.min(i + clean.length, 5);
    inputRefs.current[nextIdx]?.focus();
    if (nextIdx < 5) inputRefs.current[nextIdx]?.select?.();

    if (next.every((x) => x)) {
      inputRefs.current[5]?.blur();
      verify(next.join(''));
    }
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[i]) {
        const next = [...digits];
        next[i] = '';
        setDigits(next);
      } else if (i > 0) {
        const next = [...digits];
        next[i - 1] = '';
        setDigits(next);
        inputRefs.current[i - 1]?.focus();
      }
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && i > 0) {
      inputRefs.current[i - 1]?.focus();
      e.preventDefault();
    } else if (e.key === 'ArrowRight' && i < 5) {
      inputRefs.current[i + 1]?.focus();
      e.preventDefault();
    }
  };

  return (
    <Screen t={t}>
      <div
        style={{
          padding: '24px 24px 40px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100%',
        }}
      >
        <BackButton t={t} onClick={() => router.back()} />

        <Stack gap={32} style={{ flex: 1, marginTop: 24 }}>
          <Stack gap={10}>
            <H1 t={t}>Enter verification code</H1>
            <Body t={t} size={15}>
              We sent a 6-digit code to{' '}
              <span style={{ fontFamily: t.mono, color: t.ink, whiteSpace: 'nowrap' }}>{maskedPhone}</span>
            </Body>
          </Stack>

          <Row gap={6} justify="center">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                value={d}
                onChange={(e) => set(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
                onFocus={(e) => e.target.select()}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                disabled={verifying}
                style={{
                  width: 48,
                  height: 62,
                  textAlign: 'center',
                  fontSize: 26,
                  fontFamily: t.mono,
                  fontWeight: 500,
                  background: d ? t.tintAccent : t.card,
                  border: `1.5px solid ${error ? t.rust : d ? t.rust : t.border}`,
                  borderRadius: t.radius,
                  color: t.ink,
                  outline: 'none',
                  transition: 'all 0.15s',
                  caretColor: t.rust,
                }}
              />
            ))}
          </Row>

          {error && (
            <Row justify="center">
              <Body t={t} size={13} style={{ color: t.rust }}>
                {error}
              </Body>
            </Row>
          )}

          {verifying ? (
            <Row gap={10} justify="center">
              <div
                style={{
                  width: 16,
                  height: 16,
                  border: `2px solid ${t.border}`,
                  borderTopColor: t.rust,
                  borderRadius: '50%',
                  animation: 'spin 0.9s linear infinite',
                }}
              />
              <Body t={t} size={14} muted>
                Verifying…
              </Body>
            </Row>
          ) : (
            <Row justify="center">
              <Body t={t} size={13} muted>
                Didn&apos;t get it?{' '}
                {countdown > 0 ? (
                  <span style={{ fontFamily: t.mono, color: t.muted }}>
                    Resend in 0:{String(countdown).padStart(2, '0')}
                  </span>
                ) : (
                  <span style={{ color: t.rust, cursor: 'pointer', fontWeight: 500 }}>
                    Resend
                  </span>
                )}
              </Body>
            </Row>
          )}
        </Stack>

        <Footer t={t} />
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </Screen>
  );
}
