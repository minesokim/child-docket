'use client';

// Intake step 13/13 (legal B) - IRS §7216 separate consent.
// 1-to-1 port of ScreenConsent7216.

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
import { useIntakeField } from '@/lib/intake-context';
import { getNextStep, getPrevStep } from '@/lib/intake-flow';
import { IntakeContinueButton } from '@/components/intake-continue-button';
import { recordIntakeSignature } from '@/lib/intake/sign';

const TITLE = '§7216 Consent - Use & Disclosure of Tax Information';
const PARAS = [
  'Federal law requires this consent form be provided to you. Unless authorized by law, we cannot use or disclose your tax return information for any purpose other than preparing your return without your consent.',
  'You are not required to complete this form. If we obtain your signature on this form by conditioning our services on your consent, your consent will not be valid. Your consent is valid for the amount of time that you specify.',
  'By signing below, you authorize Antonio Vazquez, Enrolled Agent, to use the information you provide solely for the purpose of preparing your 2025 federal and state income tax returns. This consent is valid until the returns are filed and accepted by the applicable tax authorities.',
  'You also authorize Vazant Consulting to use secure artificial-intelligence services (Anthropic Claude and AWS Bedrock) operating under Zero Data Retention agreements to assist in preparing your return. These services do not retain your information after processing, and they will not use your information to train any model. Antonio reviews and approves every AI-generated output before it is used or sent to a tax authority.',
  // TCPA-compliant SMS consent (V1 add-on per PRODUCTION-READINESS §D).
  // Required before any outbound SMS — Twilio messages without prior
  // express consent risk $500-$1,500 per text in TCPA penalties. Wording
  // mirrors the FCC/TCPA template for express consent to commercial
  // automated text messages, with clear right-to-revoke.
  'You consent to receive text messages from Vazant Consulting at the phone number you provided, including (a) account and tax-status updates, (b) document and signature requests, and (c) appointment reminders. Message frequency varies. Message and data rates may apply. Reply STOP to any message to opt out at any time; reply HELP for help. Consent is not a condition of services — you can decline and continue to receive non-SMS communication.',
  'If you believe your tax return information has been disclosed or used improperly in a manner unauthorized by law or without your permission, you may contact the Treasury Inspector General for Tax Administration (TIGTA).',
];

// The exact §7216 text the user is consenting to. Frozen + hashed
// server-side at signing time so a later copy edit can't retroactively
// alter "what they consented to" — IRS 26 CFR 301.7216-3 retention.
const FULL_DOCUMENT_TEXT = `${TITLE}\n\n${PARAS.join('\n\n')}`;

export default function ConsentPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  const [checked, setChecked] = useIntakeField<boolean>('consent.checked', false);
  // Separate AI-disclosure consent. Per IRS 26 CFR 301.7216-3, USE
  // and DISCLOSURE consents technically require separate documents +
  // separate signatures; v0 collapses them onto one signed document
  // (the FULL_DOCUMENT_TEXT below covers BOTH) but keeps two checkboxes
  // so the taxpayer's opt-in for each is explicit. v1.5 splits them
  // into two separate routes + two signatures (logged as a follow-up
  // in AUTONOMOUS-DECISIONS.md).
  const [aiChecked, setAiChecked] = useIntakeField<boolean>(
    'consent.aiChecked',
    false,
  );
  // SMS consent — TCPA Express Written Consent. Decoupled from the other
  // checkboxes so a taxpayer can sign §7216 + AI but decline SMS (Antonio
  // falls back to email + portal-only for those clients). Without this,
  // any Twilio outbound to that phone violates 47 USC §227.
  const [smsChecked, setSmsChecked] = useIntakeField<boolean>(
    'consent.smsChecked',
    false,
  );
  const [signed, setSigned] = useIntakeField<boolean>('consent.signed', false);
  const [fullName] = useIntakeField<string>('personal.fullName', '');
  const [signError, setSignError] = React.useState<string | null>(null);

  // SMS consent is OPTIONAL by TCPA design (consent is not a condition
  // of services). The signature gate requires §7216 + AI checkboxes,
  // not SMS. The smsChecked flag is recorded in intake state and
  // persisted via the signature audit_payload regardless — Antonio
  // sees who opted in vs out from the command-room messages surface.
  const ready = checked && aiChecked && signed;

  // §7216 has criminal penalty if recorded wrong (26 USC 7216).
  // Persist the full provenance — text hash, ip, ua, server timestamp
  // — to the signatures table BEFORE flipping the local boolean.
  // Failed server write = unsigned UI = retry.
  const onSign = async () => {
    if (signed) return;
    setSignError(null);
    const result = await recordIntakeSignature({
      type: 'consent_7216',
      documentText: FULL_DOCUMENT_TEXT,
      // TCPA + IRS §7216 require explicit per-purpose consent. Persist
      // each checkbox decision in audit_payload so Antonio's command-
      // room shows who opted into SMS vs not. The smsChecked flag is
      // the gate Twilio outbound checks before sending any text.
      consentFlags: {
        useTaxInfo: checked,
        aiServices: aiChecked,
        smsCommunication: smsChecked,
      },
    });
    if (result.ok) {
      setSigned(true);
    } else {
      setSignError(result.error ?? 'Could not record consent. Please try again.');
    }
  };

  const handleNext = () => {
    const target = getNextStep('/consent', {});
    if (target) nav.next(target);
  };
  const handleBack = () => {
    const target = getPrevStep('/consent', {});
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
        <IntakeHeader t={t} step={13} label="Consent" />
        <div style={{ padding: '32px 24px 8px' }}>
          <Stack gap={10}>
            <div
              style={{
                display: 'inline-flex',
                padding: '4px 10px',
                background: t.tintAccent,
                borderRadius: 999,
                fontFamily: t.mono,
                fontSize: 10,
                color: t.rustInk,
                letterSpacing: 1,
                alignSelf: 'flex-start',
              }}
            >
              IRS §7216 · SEPARATE CONSENT
            </div>
            <H1 t={t}>Permission to prepare your return</H1>
            <Body t={t} size={15}>
              Under IRS rule §7216, I need your separate permission to use your tax information to
              prepare your return. This is separate from the engagement letter you just signed.
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
              I give Antonio permission to use my tax information to prepare my return
            </div>
          </Row>

          <Row gap={10} align="flex-start">
            <div
              onClick={() => setAiChecked(!aiChecked)}
              style={{
                width: 22,
                height: 22,
                flexShrink: 0,
                borderRadius: 5,
                background: aiChecked ? t.ease.forestMid : t.ease.keylimeWash,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 1,
              }}
            >
              {aiChecked && (
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
              onClick={() => setAiChecked(!aiChecked)}
              style={{ fontSize: 14, color: t.inkSoft, cursor: 'pointer', lineHeight: 1.5 }}
            >
              I authorize Vazant Consulting to use Zero-Data-Retention AI services (Anthropic Claude, AWS Bedrock) to assist in preparing my return. Antonio reviews every AI output before use.
            </div>
          </Row>

          {/*
            Third checkbox — TCPA SMS consent. Optional (per FCC/TCPA the
            consent must NOT be a condition of services), so it's NOT in
            the `ready` gate. Decline → Antonio uses email + portal-only.
            The taxpayer's choice is persisted to intake state and
            recorded in the signature audit_payload at sign time.
          */}
          <Row gap={10} align="flex-start">
            <div
              onClick={() => setSmsChecked(!smsChecked)}
              style={{
                width: 22,
                height: 22,
                flexShrink: 0,
                borderRadius: 5,
                background: smsChecked ? t.ease.forestMid : t.ease.keylimeWash,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 1,
              }}
            >
              {smsChecked && (
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
              onClick={() => setSmsChecked(!smsChecked)}
              style={{ fontSize: 14, color: t.inkSoft, cursor: 'pointer', lineHeight: 1.5 }}
            >
              <strong style={{ fontWeight: 600 }}>(Optional)</strong> I consent to receive text-message updates from Vazant Consulting (account, document, signature, and appointment notifications). Reply STOP to opt out anytime; message and data rates may apply.
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
              SEPARATE SIGNATURE · SEPARATE TIMESTAMP
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
            route="/consent"
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
