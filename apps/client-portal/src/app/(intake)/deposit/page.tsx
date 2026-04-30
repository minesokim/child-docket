'use client';

// Final intake step (post-13) — $50 deposit. Stripe placeholder form.
// 1-to-1 port of ScreenDeposit. Card fields ship empty (privacy: never
// pre-fill financial fields).

import {
  AntonioNote,
  AskAntonioBar,
  Body,
  Button,
  buildTheme,
  FieldLabel,
  H1,
  IntakeBackButton,
  IntakeHeader,
  Row,
  Screen,
  Stack,
  TextField,
} from '@docket/ui';
import { usePortalNav } from '@/lib/portal-nav';
import { usePortalState } from '@/lib/portal-state';

type ApptInfo = {
  format: 'phone' | 'video' | 'inperson';
  dateIdx: number;
  timeIdx: number;
};

type DepositInfo = {
  cardNumber: string;
  expiry: string;
  cvc: string;
  zip: string;
  cardholder: string;
};

const DEFAULT: DepositInfo = {
  cardNumber: '',
  expiry: '',
  cvc: '',
  zip: '',
  cardholder: '',
};

const DATES = [
  { d: 'Mon', n: 3, m: 'Mar' },
  { d: 'Tue', n: 4, m: 'Mar' },
  { d: 'Wed', n: 5, m: 'Mar' },
  { d: 'Thu', n: 6, m: 'Mar' },
  { d: 'Fri', n: 7, m: 'Mar' },
  { d: 'Sat', n: 8, m: 'Mar' },
  { d: 'Mon', n: 10, m: 'Mar' },
];
const TIMES = ['9:00 AM', '10:30 AM', '1:00 PM', '2:30 PM', '4:00 PM'];
const FORMAT_LABELS: Record<ApptInfo['format'], string> = {
  phone: 'Phone call',
  video: 'Video call (Google Meet)',
  inperson: 'In person · Claremont',
};

function IconLockTiny({ size = 11 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 11 11"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="4.5" width="7" height="5" rx="0.8" />
      <path d="M3.5 4.5V3a2 2 0 014 0v1.5" />
    </svg>
  );
}

function IconCard({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="1.5" y="4" width="13" height="9" rx="1.5" />
      <path d="M1.5 7.5h13M4 11h3" />
    </svg>
  );
}

export default function DepositPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  const [info, setInfo] = usePortalState<DepositInfo>('deposit', DEFAULT);
  const [appt] = usePortalState<ApptInfo>('appt', { format: 'video', dateIdx: 2, timeIdx: 1 });

  const update = <K extends keyof DepositInfo>(k: K, v: DepositInfo[K]) =>
    setInfo({ ...info, [k]: v });

  const selDate = DATES[appt.dateIdx] ?? DATES[0]!;
  const selTime = TIMES[appt.timeIdx] ?? TIMES[0]!;

  return (
    <Screen t={t}>
      <div
        style={{
          padding: '24px 0 0',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100%',
        }}
      >
        <IntakeHeader t={t} label="Deposit" total={13} />

        <div style={{ padding: '22px 24px 0' }}>
          <IntakeBackButton t={t} onClick={() => nav.back('/appt')} />
        </div>

        <div style={{ padding: '18px 24px 8px' }}>
          <Stack gap={10}>
            <H1 t={t}>Secure your appointment with a $50 deposit</H1>
            <Body t={t} size={15}>
              Goes toward your final bill. Refundable up to 48 hours before your appointment.
            </Body>
          </Stack>
        </div>

        <Stack gap={22} style={{ padding: '22px 24px 16px', flex: 1 }}>
          {/* Appointment recap */}
          <div
            style={{
              padding: '16px 18px',
              background: t.ink,
              borderRadius: t.radius,
              color: '#fff',
            }}
          >
            <div
              style={{
                fontFamily: t.serif,
                fontStyle: 'italic',
                fontSize: 13,
                color: 'rgba(255,255,255,0.6)',
                marginBottom: 8,
              }}
            >
              Your appointment
            </div>
            <div
              style={{
                fontFamily: t.serif,
                fontSize: 20,
                letterSpacing: -0.3,
                lineHeight: 1.15,
                marginBottom: 6,
              }}
            >
              {selDate.d}, {selDate.m} {selDate.n} · {selTime}
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'rgba(255,255,255,0.7)',
                marginBottom: 12,
              }}
            >
              {FORMAT_LABELS[appt.format]} · 30 min
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                paddingTop: 12,
                borderTop: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: t.rust,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: t.serif,
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                AV
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
                with{' '}
                <span style={{ color: '#fff', fontWeight: 500 }}>Antonio Vazquez, EA</span>
              </div>
            </div>
          </div>

          {/* Payment method form */}
          <div>
            <Row justify="space-between" align="baseline" style={{ marginBottom: 14 }}>
              <span
                style={{
                  fontFamily: t.serif,
                  fontSize: 17,
                  color: t.ink,
                  letterSpacing: -0.2,
                }}
              >
                Payment method
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontFamily: t.sans,
                  fontSize: 12,
                  color: t.muted,
                  letterSpacing: 0,
                }}
              >
                <IconLockTiny size={11} /> Stripe
              </span>
            </Row>

            <Stack gap={16}>
              <div>
                <FieldLabel t={t}>Card number</FieldLabel>
                <div style={{ position: 'relative' }}>
                  <TextField
                    t={t}
                    value={info.cardNumber}
                    onChange={(v) => update('cardNumber', v)}
                    mono
                    inputMode="numeric"
                    placeholder="1234 1234 1234 1234"
                    style={{ paddingLeft: 26 }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: t.muted,
                      pointerEvents: 'none',
                    }}
                  >
                    <IconCard size={16} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <FieldLabel t={t}>Expiry</FieldLabel>
                  <TextField
                    t={t}
                    value={info.expiry}
                    onChange={(v) => update('expiry', v)}
                    mono
                    inputMode="numeric"
                    placeholder="MM / YY"
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <FieldLabel t={t}>CVC</FieldLabel>
                  <TextField
                    t={t}
                    value={info.cvc}
                    onChange={(v) => update('cvc', v.replace(/\D/g, '').slice(0, 4))}
                    mono
                    inputMode="numeric"
                    placeholder="•••"
                  />
                </div>
              </div>

              <div>
                <FieldLabel t={t}>ZIP</FieldLabel>
                <TextField
                  t={t}
                  value={info.zip}
                  onChange={(v) => update('zip', v.replace(/\D/g, '').slice(0, 5))}
                  mono
                  inputMode="numeric"
                  placeholder="ZIP"
                />
              </div>

              <div>
                <FieldLabel t={t}>Cardholder name</FieldLabel>
                <TextField
                  t={t}
                  value={info.cardholder}
                  onChange={(v) => update('cardholder', v)}
                  placeholder="Name on card"
                />
              </div>
            </Stack>
          </div>

          {/* Line-item summary */}
          <div
            style={{
              padding: '16px 18px 18px',
              background: t.bgElev,
              border: `1px solid ${t.borderSoft}`,
              borderRadius: t.radius,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 8,
              }}
            >
              <div>
                <div style={{ fontSize: 14.5, color: t.ink, fontWeight: 500 }}>Deposit</div>
                <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>
                  Applied to final bill
                </div>
              </div>
              <div
                style={{
                  fontFamily: t.mono,
                  fontSize: 14,
                  color: t.ink,
                }}
              >
                $50.00
              </div>
            </div>
            <div
              style={{
                marginTop: 14,
                paddingTop: 14,
                borderTop: `1px solid ${t.border}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              <div
                style={{
                  fontFamily: t.serif,
                  fontSize: 15,
                  color: t.inkSoft,
                  letterSpacing: -0.1,
                }}
              >
                Total today
              </div>
              <div
                style={{
                  fontFamily: t.serif,
                  fontSize: 28,
                  color: t.ink,
                  letterSpacing: -0.8,
                  fontWeight: 500,
                }}
              >
                $50.00
              </div>
            </div>
          </div>

          <AntonioNote t={t}>
            This $50 goes toward your final bill. Cancel 48 hours ahead and you get it back. This is
            just to protect my time — I used to have people book and never show up.
          </AntonioNote>
        </Stack>

        <div
          style={{
            position: 'sticky',
            bottom: 0,
            background: `linear-gradient(to top, ${t.bg} 75%, transparent)`,
            padding: '20px 24px 28px',
            marginTop: 12,
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <AskAntonioBar t={t} />
          </div>
          <Stack gap={8}>
            <Row gap={10}>
              <Button
                t={t}
                variant="ghost"
                onClick={() => nav.back('/appt')}
                style={{ flex: '0 0 auto' }}
              >
                Back
              </Button>
              <Button t={t} onClick={() => nav.next('/done')} style={{ flex: 1 }}>
                Pay $50 and continue
              </Button>
            </Row>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontFamily: t.sans,
                fontSize: 11.5,
                color: t.muted,
                marginTop: 2,
              }}
            >
              <IconLockTiny size={10} /> Secured by Stripe · Your card is encrypted
            </div>
          </Stack>
        </div>
      </div>
    </Screen>
  );
}
