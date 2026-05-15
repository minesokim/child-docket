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
} from '@docket/ui';
import * as React from 'react';
import { usePortalNav } from '@/lib/portal-nav';
import { useIntakeField, useIntakeStepNumber } from '@/lib/intake-context';
import { getNextStep, getPrevStep } from '@/lib/intake-flow';
import { IntakeContinueButton } from '@/components/intake-continue-button';
import { recordIntakeSignature } from '@/lib/intake/sign';

const TITLE = 'Engagement Letter - 2025 Tax Year';
const PARAS = [
  'This letter confirms the terms of the engagement between Antonio Vazquez, Enrolled Agent ("Preparer") and the undersigned client ("Client") for the preparation of the Client\'s 2025 federal and state income tax returns.',
  'Scope of services: Preparer will prepare the returns based solely on information provided by Client. Preparer will make reasonable inquiries where information appears incomplete or inconsistent, but is not obligated to audit or independently verify the data.',
  'Responsibilities: Client is responsible for providing all income, deduction, and credit information in a timely manner. Client understands that failure to disclose relevant information may result in incorrect returns and potential penalties.',
  'Fees and payment: Fees are based on the complexity of the return and are estimated in advance. A $50 deposit is required to secure an appointment and is credited against the final fee. Balance is due upon completion, before filing.',
  'Confidentiality: All information provided by Client will be held in strict confidence and used solely for the purpose of preparing the returns, except as otherwise authorized in writing.',
];

// The exact text the user is agreeing to. Frozen at component-eval
// time and sent to the server on signing. The server hashes it with
// SHA-256 into the signatures.audit_payload so a later edit to the
// engagement copy can't retroactively alter "what they signed".
const FULL_DOCUMENT_TEXT = `${TITLE}\n\n${PARAS.join('\n\n')}`;

export default function EngagementPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  const [checked, setChecked] = useIntakeField<boolean>('engagement.checked', false);
  const [signed, setSigned] = useIntakeField<boolean>('engagement.signed', false);
  const [fullName] = useIntakeField<string>('personal.fullName', '');
  const [signError, setSignError] = React.useState<string | null>(null);

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

          <Row gap={10} align="flex-start">
            <div
              onClick={() => setChecked(!checked)}
              style={{
                width: 22,
                height: 22,
                flexShrink: 0,
                borderRadius: 5,
                background: checked ? t.ease.forestMid : t.ease.keylimeWash,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 1,
              }}
            >
              {checked && (
                <svg width="12" height="10" viewBox="0 0 12 10">
                  <path
                    d="M1 5l3.5 3.5L11 1"
                    stroke="#fff"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
            <div
              onClick={() => setChecked(!checked)}
              style={{ fontSize: 14, color: t.inkSoft, cursor: 'pointer', lineHeight: 1.5 }}
            >
              I&apos;ve read and agree to the engagement letter
            </div>
          </Row>

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
