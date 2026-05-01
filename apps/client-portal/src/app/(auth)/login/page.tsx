'use client';

// Real Clerk phone-OTP sign-in (custom UI, not Clerk's drop-in).
// Flow:
//   1. User types phone → submit
//   2. Try signIn.create({ identifier: phone })
//      → if user exists, prepareFirstFactor sends SMS, advance to /otp?mode=signin
//      → if 'form_identifier_not_found', fall back to signUp.create({ phoneNumber })
//        + preparePhoneNumberVerification, advance to /otp?mode=signup
//   3. /otp page handles code verification + activates session.

import {
  AvatarSlot,
  Body,
  Button,
  buildTheme,
  Footer,
  H1,
  Row,
  Screen,
  Stack,
} from '@docket/ui';
import { useSignIn, useSignUp } from '@clerk/nextjs/legacy';
import { useAuth, useClerk, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { usePortalState } from '@/lib/portal-state';

type ClerkError = {
  errors?: Array<{ code?: string; message?: string }>;
};

function toE164(formatted: string): string {
  const digits = formatted.replace(/\D/g, '');
  // Default to US country code if 10 digits and no leading 1.
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  // Anything else → assume already-prefixed international format.
  return `+${digits}`;
}

export default function LoginPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const router = useRouter();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { signIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
  const [phone, setPhone] = usePortalState<string>('phone', '');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // If user already has an active session (e.g. signed into command-room
  // earlier — both apps share the same Clerk app/cookie), surface a
  // "continue or switch account" prompt instead of failing on session_exists.
  if (authLoaded && isSignedIn) {
    return <AlreadySignedIn t={t} user={user} signOut={signOut} router={router} />;
  }

  const format = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 10);
    if (d.length < 4) return d;
    if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  };

  const onSubmit = async () => {
    if (!signInLoaded || !signUpLoaded || !signIn || !signUp) return;
    if (submitting) return;

    const e164 = toE164(phone);
    if (e164.replace(/\D/g, '').length < 7) {
      setError('Enter a valid phone number');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      // Try sign-in first.
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
      router.push('/otp?mode=signin');
    } catch (e) {
      const err = e as ClerkError;
      const code = err.errors?.[0]?.code;
      if (code === 'form_identifier_not_found') {
        // No existing user — create account via sign-up.
        try {
          await signUp.create({ phoneNumber: e164 });
          await signUp.preparePhoneNumberVerification({ strategy: 'phone_code' });
          router.push('/otp?mode=signup');
        } catch (signUpErr) {
          const sErr = signUpErr as ClerkError;
          setError(sErr.errors?.[0]?.message ?? 'Could not start sign-up');
          setSubmitting(false);
        }
      } else if (code === 'session_exists') {
        // Edge case: race between auth-loaded check and submit.
        router.push('/welcome');
      } else {
        setError(err.errors?.[0]?.message ?? 'Could not send code');
        setSubmitting(false);
      }
    }
  };

  const ready = authLoaded && signInLoaded && signUpLoaded;

  return (
    <Screen t={t}>
      <div style={{ padding: '60px 24px 40px', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        <Stack gap={28} style={{ flex: 1 }}>
          <AvatarSlot t={t} size={72} />
          <Stack gap={10}>
            <H1 t={t}>
              Welcome to
              <br />
              Vazant Consulting
            </H1>
            <Body t={t} size={16}>
              Antonio will personally handle your return. Enter your phone number to get started.
            </Body>
          </Stack>

          <Stack gap={14}>
            <div>
              <div
                style={{
                  fontFamily: t.mono,
                  fontSize: 10,
                  color: t.muted,
                  letterSpacing: 1.2,
                  marginBottom: 8,
                }}
              >
                PHONE NUMBER
              </div>
              <input
                value={phone}
                onChange={(e) => setPhone(format(e.target.value))}
                placeholder="(555) 555-5555"
                inputMode="tel"
                type="tel"
                autoComplete="tel"
                disabled={submitting}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '16px 18px',
                  fontSize: 18,
                  fontFamily: t.sans,
                  background: t.card,
                  border: `1px solid ${error ? t.rust : t.border}`,
                  borderRadius: t.radius,
                  color: t.ink,
                  outline: 'none',
                  letterSpacing: 0.2,
                }}
              />
              {error && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12.5,
                    color: t.rust,
                    fontFamily: t.sans,
                  }}
                >
                  {error}
                </div>
              )}
            </div>
            <Button
              t={t}
              onClick={onSubmit}
              disabled={!ready || submitting}
              style={{ width: '100%', padding: '16px 22px', fontSize: 16 }}
            >
              {submitting ? 'Sending…' : 'Send verification code'}
            </Button>
            <Row justify="center" gap={10}>
              <span
                style={{
                  fontFamily: t.mono,
                  fontSize: 10,
                  color: t.muted,
                  letterSpacing: 1,
                }}
              >
                SECURE · ENCRYPTED · IRS-COMPLIANT
              </span>
            </Row>
          </Stack>
        </Stack>

        <div style={{ marginTop: 40 }}>
          <div
            style={{
              padding: '14px 16px',
              background: t.bgElev,
              borderRadius: t.radius,
              border: `1px solid ${t.borderSoft}`,
              fontSize: 13,
              color: t.inkSoft,
              textAlign: 'center',
              lineHeight: 1.5,
            }}
          >
            Need help? Text Antonio directly at
            <br />
            <span style={{ color: t.rust, fontWeight: 500 }}>(951) 555-0234</span>
          </div>
          <Footer t={t} />
        </div>
      </div>
    </Screen>
  );
}

function AlreadySignedIn({
  t,
  user,
  signOut,
  router,
}: {
  t: ReturnType<typeof buildTheme>;
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
    <Screen t={t}>
      <div
        style={{
          padding: '60px 24px 40px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100%',
          gap: 24,
        }}
      >
        <Stack gap={28} style={{ flex: 1 }}>
          <AvatarSlot t={t} size={72} />
          <Stack gap={10}>
            <H1 t={t}>You&apos;re already signed in</H1>
            <Body t={t} size={15}>
              Active session for{' '}
              <span style={{ fontFamily: t.mono, color: t.ink }}>{identifier}</span>. Continue to
              your portal, or sign out to use a different number.
            </Body>
          </Stack>

          <Stack gap={10}>
            <Button
              t={t}
              onClick={() => router.push('/welcome')}
              style={{ width: '100%', padding: '16px 22px', fontSize: 16 }}
            >
              Continue to portal
            </Button>
            <Button
              t={t}
              variant="ghost"
              onClick={() => signOut().then(() => router.refresh())}
              style={{ width: '100%', padding: '14px 22px', fontSize: 14 }}
            >
              Sign out and use a different number
            </Button>
          </Stack>
        </Stack>
        <Footer t={t} />
      </div>
    </Screen>
  );
}
