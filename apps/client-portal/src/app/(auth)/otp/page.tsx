'use client';

import { useEffect, useRef, useState } from 'react';
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
import { usePortalState } from '@/lib/portal-state';
import { usePortalNav } from '@/lib/portal-nav';

export default function OtpPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  const [phone] = usePortalState<string>('phone', '');
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(47);
  const [verifying, setVerifying] = useState(false);
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
      setVerifying(true);
      inputRefs.current[5]?.blur();
      setTimeout(() => {
        // TODO(week-2): POST to /api/auth/verify-otp via Clerk before advancing.
        nav.next('/welcome');
      }, 1200);
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
        <BackButton t={t} onClick={() => nav.back('/login')} />

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
                style={{
                  width: 48,
                  height: 62,
                  textAlign: 'center',
                  fontSize: 26,
                  fontFamily: t.mono,
                  fontWeight: 500,
                  background: d ? t.tintAccent : t.card,
                  border: `1.5px solid ${d ? t.rust : t.border}`,
                  borderRadius: t.radius,
                  color: t.ink,
                  outline: 'none',
                  transition: 'all 0.15s',
                  caretColor: t.rust,
                }}
              />
            ))}
          </Row>

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
