'use client';

// Client component for /deposit. Receives the server-resolved deposit
// config and renders one of three modes:
//   - charge: Square SDK card form (DepositForm)
//   - waived: success card + auto-advance
//   - unconfigured: hold message; not chargeable yet
//
// The editorial-warm presentation matches the rest of the intake flow
// (appointment recap, line-item summary, sticky bottom CTA).

import * as React from 'react';
import {
  AntonioNote,
  AskAntonioBar,
  Body,
  Button,
  buildTheme,
  H1,
  IntakeBackButton,
  IntakeHeader,
  Row,
  Screen,
  Stack,
} from '@docket/ui';
import { usePortalNav } from '@/lib/portal-nav';
import { useIntakeField } from '@/lib/intake-context';
import { getNextStep, getPrevStep } from '@/lib/intake-flow';
import { DepositForm } from '@/components/deposit-form';
import type { GetDepositConfigResult } from '@/lib/square/get-deposit-config';

type ApptFormat = 'phone' | 'video' | 'inperson';

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
const FORMAT_LABELS: Record<ApptFormat, string> = {
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

export function DepositPageInner({ config }: { config: GetDepositConfigResult }) {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();

  const [format] = useIntakeField<ApptFormat>('appointment.format', 'video');
  const [dateIdx] = useIntakeField<number>('appointment.dateIdx', 2);
  const [timeIdx] = useIntakeField<number>('appointment.timeIdx', 1);
  const [, setPaid] = useIntakeField<boolean>('deposit.paid', false);
  const [, setAmount] = useIntakeField<number>('deposit.amountCents', 0);

  const selDate = DATES[dateIdx] ?? DATES[0]!;
  const selTime = TIMES[timeIdx] ?? TIMES[0]!;

  const handleBack = () => {
    const target = getPrevStep('/deposit', {});
    if (target) nav.back(target);
  };

  const advance = React.useCallback(() => {
    const target = getNextStep('/deposit', {});
    if (target) nav.next(target);
  }, [nav]);

  const onChargeSuccess = React.useCallback(() => {
    if (config.ok && config.mode === 'charge') {
      setPaid(true);
      setAmount(config.amountCents);
    }
    advance();
  }, [config, setPaid, setAmount, advance]);

  // Waived: short-circuit. The intake flow's gate (deposit.paid) is
  // flipped immediately + the client lands on /done.
  React.useEffect(() => {
    if (config.ok && config.mode === 'waived') {
      setPaid(true);
      setAmount(0);
      // Use a small timeout so the user sees the "waived" message
      // briefly before the auto-advance — feels less abrupt.
      const id = setTimeout(advance, 1200);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [config, setPaid, setAmount, advance]);

  if (!config.ok) {
    return (
      <Screen t={t}>
        <Stack gap={16} style={{ padding: '40px 24px' }}>
          <H1 t={t}>Couldn't load deposit info</H1>
          <Body t={t} size={14}>
            {config.message}
          </Body>
          <Button t={t} onClick={handleBack} variant="ghost">
            Back
          </Button>
        </Stack>
      </Screen>
    );
  }

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
          <IntakeBackButton t={t} onClick={handleBack} />
        </div>

        <div style={{ padding: '18px 24px 8px' }}>
          <Stack gap={16}>
            <Stack gap={10}>
              <H1 t={t}>
                {config.mode === 'waived'
                  ? 'Deposit waived'
                  : config.mode === 'charge'
                    ? `Secure your appointment with a $${(config.amountCents / 100).toFixed(2)} deposit`
                    : 'Deposit not yet ready'}
              </H1>
              <Body t={t} size={15}>
                {config.mode === 'waived'
                  ? 'Your preparer waived the deposit for this engagement. Continuing in a moment…'
                  : config.mode === 'charge'
                    ? 'Goes toward your final bill. Refundable up to 48 hours before your appointment.'
                    : "We're still setting up payment processing. Reach out to your preparer — they'll send you a deposit link separately."}
              </Body>
            </Stack>
            {config.mode === 'charge' && (
              <AntonioNote t={t}>
                This ${(config.amountCents / 100).toFixed(2)} goes toward your final bill. Cancel
                48 hours ahead and you get it back. This is just to protect my time.
              </AntonioNote>
            )}
          </Stack>
        </div>

        <Stack gap={22} style={{ padding: '22px 24px 16px', flex: 1 }}>
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
                fontFamily: t.sans,
                fontSize: 11,
                color: 'rgba(255,255,255,0.55)',
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Your appointment
            </div>
            <div
              style={{
                fontFamily: t.sans,
                fontSize: 18,
                fontWeight: 500,
                letterSpacing: -0.3,
                lineHeight: 1.2,
                marginBottom: 4,
              }}
            >
              {selDate.d}, {selDate.m} {selDate.n} · {selTime}
            </div>
            <div
              style={{
                fontFamily: t.sans,
                fontSize: 12.5,
                color: 'rgba(255,255,255,0.7)',
                marginBottom: 12,
              }}
            >
              {FORMAT_LABELS[format]} · 30 min
            </div>
            <div
              style={{
                fontFamily: t.sans,
                fontSize: 13,
                color: 'rgba(255,255,255,0.85)',
                paddingTop: 10,
              }}
            >
              with{' '}
              <span style={{ color: '#fff', fontWeight: 500 }}>Antonio Vazquez, EA</span>
            </div>
          </div>

          {config.mode === 'charge' && (
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
              </Row>
              <DepositForm
                applicationId={config.square.applicationId}
                locationId={config.square.locationId}
                environment={config.square.environment}
                amountCents={config.amountCents}
                taxYear={config.taxYear}
                engagementId={config.engagementId}
                onSuccess={onChargeSuccess}
              />
            </div>
          )}

          {config.mode === 'charge' && (
            <div
              style={{
                padding: '16px 18px 18px',
                background: t.ease.keylimeWash,
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
                  ${(config.amountCents / 100).toFixed(2)}
                </div>
              </div>
              <div
                style={{
                  marginTop: 14,
                  paddingTop: 14,
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
                    fontFamily: t.sans,
                    fontSize: 28,
                    color: t.ink,
                    letterSpacing: -0.8,
                    fontWeight: 500,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  ${(config.amountCents / 100).toFixed(2)}
                </div>
              </div>
            </div>
          )}

          {config.mode === 'waived' && (
            <div
              style={{
                padding: '20px 22px',
                background: '#e1f4df',
                color: '#1f4621',
                borderRadius: t.radius,
                textAlign: 'center',
                fontFamily: t.sans,
                fontSize: 14,
              }}
            >
              ✓ Deposit waived — continuing to the final step.
            </div>
          )}

          {config.mode === 'unconfigured' && (
            <div
              style={{
                padding: '20px 22px',
                background: '#fde9c2',
                color: '#7a4a08',
                borderRadius: t.radius,
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              Payment processing isn't set up yet for your preparer. Continue without paying
              today; your preparer will send a deposit link separately.
            </div>
          )}
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
            {config.mode === 'unconfigured' && (
              <Row gap={10}>
                <Button t={t} variant="ghost" onClick={handleBack} style={{ flex: '0 0 auto' }}>
                  Back
                </Button>
                <Button
                  t={t}
                  onClick={() => {
                    setPaid(true);
                    setAmount(0);
                    advance();
                  }}
                  style={{ flex: 1 }}
                >
                  Continue without paying
                </Button>
              </Row>
            )}
            {config.mode === 'charge' && (
              // The Pay button is INSIDE DepositForm above. Nothing
              // to render at the bottom for the charge path.
              null
            )}
            {config.mode !== 'unconfigured' && config.mode !== 'charge' && (
              <Row>
                <Button t={t} variant="ghost" onClick={handleBack} style={{ flex: '0 0 auto' }}>
                  Back
                </Button>
              </Row>
            )}
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
              <IconLockTiny size={10} /> Your card is encrypted by Square — never stored on Docket
            </div>
          </Stack>
        </div>
      </div>
    </Screen>
  );
}
