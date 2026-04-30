'use client';

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
import { usePortalState } from '@/lib/portal-state';
import { usePortalNav } from '@/lib/portal-nav';

export default function LoginPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  const [phone, setPhone] = usePortalState<string>('phone', '');

  const format = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 10);
    if (d.length < 4) return d;
    if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  };

  const onSubmit = () => {
    // TODO(week-2): POST to /api/auth/send-otp via Clerk. For v0, advance optimistically.
    nav.next('/otp');
  };

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
                autoComplete="tel"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '16px 18px',
                  fontSize: 18,
                  fontFamily: t.sans,
                  background: t.card,
                  border: `1px solid ${t.border}`,
                  borderRadius: t.radius,
                  color: t.ink,
                  outline: 'none',
                  letterSpacing: 0.2,
                }}
              />
            </div>
            <Button
              t={t}
              onClick={onSubmit}
              disabled={phone.length < 14}
              style={{ width: '100%', padding: '16px 22px', fontSize: 16 }}
            >
              Send verification code
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
