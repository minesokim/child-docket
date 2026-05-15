'use client';

// Intake step 11/13 - Refund preference.
//
// IRS discontinued paper refund checks in September 2025, so direct
// deposit is the ONLY option for federal refunds. There's no real
// choice to make here - the page is a bank-info form, not a picker.
// Antonio's note acknowledges that fact + frames the "what if you
// owe" case.

import {
  AntonioNote,
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
import { useRef } from 'react';
import { usePortalNav } from '@/lib/portal-nav';
import { useFieldReveal, useIntakeField } from '@/lib/intake-context';
import { formatDigits, lookupBankByRouting } from '@docket/shared';
import { getNextStep, getPrevStep } from '@/lib/intake-flow';
import { IntakeContinueButton } from '@/components/intake-continue-button';

export default function RefundPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();

  // Bank routing + account are sensitive - encrypted at rest server-side.
  const [bankName, setBankName] = useIntakeField<string>('refund.bankName', '');
  const [routingNumber, setRoutingNumber] = useIntakeField<string>('refund.bankRouting', '');
  const [accountNumber, setAccountNumber] = useIntakeField<string>('refund.bankAccount', '');
  const revealRouting = useFieldReveal('refund.bankRouting');
  const revealAccount = useFieldReveal('refund.bankAccount');

  // Antonio's intake feedback (2026-05-14): when a client types a
  // 9-digit routing number, autofill the bank name (OLT does this;
  // builds trust instantly). Local lookup, no network call.
  //
  // Only touch bankName when it's empty OR matches the prior autofill,
  // so we never trample a user-typed bank name. The ref tracks what
  // WE filled in — if the user edits that value, the ref no longer
  // equals bankName and subsequent routing changes leave it alone.
  //
  // Clear path (codex-flagged 2026-05-14): when digits drop below 9
  // AND the current bankName is still our prior autofill (user hasn't
  // edited it), clear bankName too. Otherwise a stale "Chase" lingers
  // after the user backspaces the routing.
  const autoFilledBankRef = useRef<string>('');
  const handleRoutingChange = (raw: string) => {
    const digits = formatDigits(raw, 9);
    void setRoutingNumber(digits);
    if (digits.length === 9) {
      const match = lookupBankByRouting(digits);
      if (match && (bankName === '' || bankName === autoFilledBankRef.current)) {
        autoFilledBankRef.current = match;
        void setBankName(match);
      }
    } else if (bankName !== '' && bankName === autoFilledBankRef.current) {
      autoFilledBankRef.current = '';
      void setBankName('');
    }
  };

  // Direct deposit is the only option (IRS retired paper checks
  // 9/2025). persistDefault: true writes 'direct_deposit' on mount
  // when the field is unset, so the per-step gate (`!!s.refund?.
  // preference`) advances without requiring an explicit user click.
  // Previously the default was visible-only — the user could fill
  // every bank field and Continue would still refuse because
  // refund.preference was never persisted.
  useIntakeField<'direct_deposit' | 'check' | 'apply_to_next_year'>(
    'refund.preference',
    'direct_deposit',
    { persistDefault: true },
  );

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
          <Stack gap={16}>
            <Stack gap={10}>
              <H1 t={t}>Where to send your refund</H1>
              <Body t={t} size={15}>
                Federal refunds go by direct deposit only - the IRS retired paper checks in September 2025.
              </Body>
            </Stack>
            <AntonioNote t={t}>
              Drop your bank info below and I&apos;ll route the refund straight there. If you end up owing instead, we&apos;ll handle the payment plan together on our call.
            </AntonioNote>
          </Stack>
        </div>

        {/* Bank info - the actual form. No fake "preselected" tile, no
            redundant advisory. The heading carries the IRS context. */}
        <Stack gap={16} style={{ padding: '22px 24px 32px', flex: 1 }}>
          <div>
            <FieldLabel t={t}>Bank name</FieldLabel>
            <TextField
              t={t}
              value={bankName}
              onChange={(v) => setBankName(v)}
              placeholder="e.g., Chase, Wells Fargo"
            />
          </div>

          <div>
            <FieldLabel t={t} hint="9 DIGITS">
              Routing number
            </FieldLabel>
            <EncryptedTextField
              t={t}
              value={routingNumber}
              onChange={handleRoutingChange}
              onReveal={revealRouting}
              placeholder="XXXXXXXXX"
              mono
              inputMode="numeric"
            />
          </div>

          <div style={{ paddingBottom: 16 }}>
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
          <Row gap={10}>
            <Button
              t={t}
              variant="ghost"
              onClick={handleBack}
              style={{ flex: '0 0 auto' }}
            >
              Back
            </Button>
            <IntakeContinueButton t={t} route="/refund" onClick={handleNext} style={{ flex: 1 }}>
              Continue
            </IntakeContinueButton>
          </Row>
        </div>
      </div>
    </Screen>
  );
}
