'use client';

// Intake step 13/13 (legal A) - Engagement letter. Read + checkbox + tap-to-sign.
// 1-to-1 port of ScreenEngagement.

import {
  Body,
  Button,
  buildTheme,
  H1,
  IntakeBottomBar,
  IntakeHeader,
  LegalDoc,
  Row,
  Screen,
  SignaturePad,
  Stack,
  useFirmOwner,
} from '@docket/ui';
import * as React from 'react';
import { usePortalNav } from '@/lib/portal-nav';
import { useIntakeField, useIntakeStepNumber } from '@/lib/intake-context';
import { getNextStep, getPrevStep } from '@/lib/intake-flow';
import { IntakeContinueButton } from '@/components/intake-continue-button';
import { LegalCheckbox } from '@/components/legal-checkbox';
import { recordIntakeSignature } from '@/lib/intake/sign';

// Default preparer name when the TenantDisplayProvider hasn't mounted
// the firm-owner data yet (dev mode pre-seed, mid-migration). Matches
// the legacy hardcode that used to live in PARAS so a missing-context
// case never produces an empty preparer reference in the signed legal
// text. The audit (2026-05-15) caught the previous module-level
// hardcode being baked into the SHA-256 of signatures.audit_payload
// for EVERY tenant — onboarding tenant #2 (a CPA firm) under the
// prior code would have produced a legally-invalid engagement letter
// naming Antonio's firm. The component-scoped useMemo below derives
// the text from useFirmOwner() so the hash captures the actual firm's
// owner name at sign-time.
//
// Credential suffix ("Enrolled Agent" / "CPA" / "JD") is intentionally
// dropped in this commit because FirmOwner doesn't carry credential
// info yet. A future cleanup adds a `credential` field to FirmOwner
// + concatenates conditionally. For now "[Owner Name] (Preparer)" is
// strictly better than "[Owner Name], Enrolled Agent" applied to a
// non-EA firm — less specific, but correct rather than wrong.
const DEFAULT_OWNER_NAME = 'Antonio Vazquez';

export default function EngagementPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  const owner = useFirmOwner();
  const preparerName = owner?.name ?? DEFAULT_OWNER_NAME;
  const [checked, setChecked] = useIntakeField<boolean>('engagement.checked', false);
  // `engagement.signed = true` is the canonical "engagement letter
  // signed" flag, read by the portal Profile tab. The legacy mock
  // 8879 page used to also write this flag (overloaded meaning) —
  // that mock was removed 2026-05-15, so `engagement.signed` now
  // unambiguously means "engagement letter signed."
  const [signed, setSigned] = useIntakeField<boolean>('engagement.signed', false);
  const [fullName] = useIntakeField<string>('personal.fullName', '');
  const [signError, setSignError] = React.useState<string | null>(null);

  // The exact text the user is agreeing to. Built from tenant context
  // + memoized so the SHA-256 hash captures the version of the text
  // this client actually saw. The server hashes documentText into
  // signatures.audit_payload, so a later edit (or a tenant swap) can
  // never retroactively alter "what they signed."
  const { title: TITLE, paras: PARAS, fullText: FULL_DOCUMENT_TEXT } =
    React.useMemo(() => {
      const title = 'Engagement Letter - 2025 Tax Year';
      const paras = [
        `This letter confirms the terms of the engagement between ${preparerName} ("Preparer") and the undersigned client ("Client") for the preparation of the Client's 2025 federal and state income tax returns.`,
        'Scope of services: Preparer will prepare the returns based solely on information provided by Client. Preparer will make reasonable inquiries where information appears incomplete or inconsistent, but is not obligated to audit or independently verify the data.',
        'Responsibilities: Client is responsible for providing all income, deduction, and credit information in a timely manner. Client understands that failure to disclose relevant information may result in incorrect returns and potential penalties.',
        'Fees and payment: Fees are based on the complexity of the return and are estimated in advance. A $50 deposit is required to secure an appointment and is credited against the final fee. Balance is due upon completion, before filing.',
        'Confidentiality: All information provided by Client will be held in strict confidence and used solely for the purpose of preparing the returns, except as otherwise authorized in writing.',
      ];
      return {
        title,
        paras,
        fullText: `${title}\n\n${paras.join('\n\n')}`,
      };
    }, [preparerName]);

  const ready = checked && signed;

  // On signature, persist provenance to the signatures table + audit
  // log BEFORE flipping the local boolean. If the server action fails
  // we don't claim it succeeded — the user sees the same un-signed
  // signature pad and can retry. This is what "legally enforceable"
  // looks like vs the previous boolean-only flow.
  const onSign = async () => {
    if (signed) return;
    setSignError(null);
    const result = await recordIntakeSignature({
      type: 'engagement_letter',
      documentText: FULL_DOCUMENT_TEXT,
    });
    if (result.ok) {
      setSigned(true);
    } else {
      setSignError(result.error ?? 'Could not record signature. Please try again.');
    }
  };

  const handleNext = () => {
    const target = getNextStep('/engagement', {});
    if (target) nav.next(target);
  };
  const handleBack = () => {
    const target = getPrevStep('/engagement', {});
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
        <IntakeHeader t={t} {...useIntakeStepNumber('/engagement')} label="Engagement" />
        <div style={{ padding: '32px 24px 8px' }}>
          <Stack gap={10}>
            <H1 t={t}>Our engagement letter</H1>
            <Body t={t} size={15}>
              This is our formal agreement. Please read before signing.
            </Body>
          </Stack>
        </div>

        <Stack gap={16} style={{ padding: '20px 24px 16px', flex: 1 }}>
          <LegalDoc t={t} title={TITLE} paras={PARAS} />

          <LegalCheckbox
            t={t}
            checked={checked}
            onChange={() => setChecked(!checked)}
            label="I've read and agree to the engagement letter"
          />

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
              SIGNATURE
            </div>
            <SignaturePad
              t={t}
              signed={signed}
              onSign={onSign}
              name={fullName || 'Your signature'}
            />
            {signError && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 12.5,
                  color: '#a13d2c',
                  fontFamily: t.sans,
                }}
              >
                {signError}
              </div>
            )}
          </div>
        </Stack>

        <IntakeBottomBar t={t} sticky={false}>
          <Button
            t={t}
            variant="ghost"
            onClick={handleBack}
            style={{ flex: '0 0 auto' }}
          >
            Back
          </Button>
          <IntakeContinueButton
            t={t}
            route="/engagement"
            onClick={handleNext}
            pageGatePass={ready}
            style={{ flex: 1, opacity: ready ? 1 : 0.45 }}
          >
            Sign and continue
          </IntakeContinueButton>
        </IntakeBottomBar>
      </div>
    </Screen>
  );
}
