'use client';

// Intake step 11/13 — Refund preference. Direct deposit only (paper checks
// discontinued Sept 2025). 1-to-1 port of ScreenRefundPreference.
//
// Bank info is taxpayer-entered for their own refund. Fields ship empty;
// we never pre-fill financial fields.

import {
  AskAntonioBar,
  Body,
  Button,
  buildTheme,
  EncryptedTextField,
  FieldLabel,
  H1,
  IntakeBackButton,
  IntakeHeader,
  Row,
  Screen,
  Stack,
  TextField,
} from '@docket/ui';
import { useEffect } from 'react';
import { usePortalNav } from '@/lib/portal-nav';
import { useFieldReveal, useIntakeField } from '@/lib/intake-context';
import { formatDigits } from '@docket/shared';
import { getNextStep, getPrevStep } from '@/lib/intake-flow';

export default function RefundPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();

  // Bank routing + account are sensitive — encrypted at rest server-side.
  const [bankName, setBankName] = useIntakeField<string>('refund.bankName', '');
  const [routingNumber, setRoutingNumber] = useIntakeField<string>('refund.bankRouting', '');
  const [accountNumber, setAccountNumber] = useIntakeField<string>('refund.bankAccount', '');
  const revealRouting = useFieldReveal('refund.bankRouting');
  const revealAccount = useFieldReveal('refund.bankAccount');
  const [preference, setPreference] = useIntakeField<
    'direct_deposit' | 'check' | 'apply_to_next_year'
  >('refund.preference', 'direct_deposit');

  // Default to direct deposit on mount if not yet set (page UI assumes
  // this — IRS discontinued paper checks Sept 2025).
  useEffect(() => {
    if (!preference) setPreference('direct_deposit');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNext = () => {
    const target = getNextStep('/refund', {});
    if (target) nav.next(target);
  };
  const handleBack = () => {
    const target = getPrevStep('/refund', {});
    if (target) nav.back(target);
  };

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
        <IntakeHeader t={t} step={11} label="Refund" />

        <div style={{ padding: '22px 24px 0' }}>
          <IntakeBackButton t={t} onClick={handleBack} />
        </div>

        <div style={{ padding: '18px 24px 8px' }}>
          <Stack gap={10}>
            <H1 t={t}>Refund preference</H1>
            <Body t={t} size={15}>
              If you&apos;re owed a refund, how would you like to receive it?
            </Body>
          </Stack>
        </div>

        <Stack gap={16} style={{ padding: '22px 24px 16px', flex: 1 }}>
          {/* Locked-selected direct deposit card */}
          <div
            style={{
              padding: '18px 18px',
              background: t.tintAccent,
              border: `1px solid ${t.rust}`,
              borderRadius: t.radius,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: t.rust,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: '#fff',
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 7h14l-2-3H5L3 7z" />
                <path d="M3 7v8a2 2 0 002 2h10a2 2 0 002-2V7" />
                <path d="M7 11h6" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 16,
                  color: t.ink,
                  fontWeight: 500,
                  letterSpacing: -0.1,
                  marginBottom: 2,
                }}
              >
                Direct deposit
              </div>
              <div style={{ fontSize: 12.5, color: t.muted, lineHeight: 1.35 }}>
                Refund arrives in 10–21 days after IRS acceptance
              </div>
            </div>
            <div
              style={{
                flexShrink: 0,
                color: t.rust,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 22,
                height: 22,
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 22 22"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 11l4 4 8-8" />
              </svg>
            </div>
          </div>

          {/* Amber IRS advisory */}
          <div
            style={{
              padding: '14px 14px',
              background: '#FBF3DF',
              border: '1px solid #E9D69A',
              borderRadius: t.radius,
              display: 'flex',
              gap: 12,
            }}
          >
            <div style={{ flexShrink: 0, color: '#8B6A14', marginTop: 1 }}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 1.5L1.5 15h15L9 1.5z" />
                <path d="M9 7v3.5M9 12.5h.01" />
              </svg>
            </div>
            <div
              style={{
                fontSize: 13.5,
                color: '#5C4810',
                lineHeight: 1.5,
              }}
            >
              The IRS discontinued paper refund checks in September 2025. Direct deposit is now the
              only option for federal refunds.
            </div>
          </div>

          {/* Bank info */}
          <div
            style={{
              marginTop: 6,
              padding: '20px 18px 4px',
              background: t.bgElev,
              border: `1px solid ${t.borderSoft}`,
              borderRadius: t.radius,
            }}
          >
            <div
              style={{
                fontFamily: t.serif,
                fontSize: 15,
                color: t.ink,
                letterSpacing: -0.2,
                marginBottom: 4,
              }}
            >
              Deposit account
            </div>
            <div
              style={{
                fontSize: 12,
                color: t.muted,
                marginBottom: 16,
              }}
            >
              Where to send your refund
            </div>

            <div>
              <FieldLabel t={t}>Bank name</FieldLabel>
              <TextField
                t={t}
                value={bankName}
                onChange={(v) => setBankName(v)}
                placeholder="e.g., Chase, Wells Fargo"
              />
            </div>

            <div style={{ marginTop: 16 }}>
              <FieldLabel t={t} hint="9 DIGITS">
                Routing number
              </FieldLabel>
              <EncryptedTextField
                t={t}
                value={routingNumber}
                onChange={(v) => setRoutingNumber(formatDigits(v, 9))}
                onReveal={revealRouting}
                placeholder="XXXXXXXXX"
                mono
                inputMode="numeric"
              />
            </div>

            <div style={{ marginTop: 16 }}>
              <FieldLabel t={t}>Account number</FieldLabel>
              <EncryptedTextField
                t={t}
                value={accountNumber}
                onChange={(v) => setAccountNumber(formatDigits(v, 17))}
                onReveal={revealAccount}
                placeholder="Your account number"
                mono
                inputMode="numeric"
              />
            </div>
          </div>

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
            <AskAntonioBar
              t={t}
              tip="Direct deposit is always faster. If you owe instead of getting a refund, we'll figure out the best payment plan during our call."
            />
          </div>
          <Row gap={10}>
            <Button
              t={t}
              variant="ghost"
              onClick={handleBack}
              style={{ flex: '0 0 auto' }}
            >
              Back
            </Button>
            <Button t={t} onClick={handleNext} style={{ flex: 1 }}>
              Continue
            </Button>
          </Row>
        </div>
      </div>
    </Screen>
  );
}
