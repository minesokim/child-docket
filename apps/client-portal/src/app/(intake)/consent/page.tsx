'use client';

// Intake step 13/13 (legal B) — IRS §7216 separate consent.
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
import { usePortalNav } from '@/lib/portal-nav';
import { useIntakeField } from '@/lib/intake-context';
import { getNextStep, getPrevStep } from '@/lib/intake-flow';

const PARAS = [
  'Federal law requires this consent form be provided to you. Unless authorized by law, we cannot use your tax return information for any purpose other than preparing your return without your consent.',
  'You are not required to complete this form. If we obtain your signature on this form by conditioning our services on your consent, your consent will not be valid. Your consent is valid for the amount of time that you specify.',
  'By signing below, you authorize Antonio Vazquez, Enrolled Agent, to use the information you provide solely for the purpose of preparing your 2025 federal and state income tax returns. This consent is valid until the returns are filed and accepted by the applicable tax authorities.',
  'If you believe your tax return information has been disclosed or used improperly in a manner unauthorized by law or without your permission, you may contact the Treasury Inspector General for Tax Administration (TIGTA).',
];

export default function ConsentPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  const [checked, setChecked] = useIntakeField<boolean>('consent.checked', false);
  const [signed, setSigned] = useIntakeField<boolean>('consent.signed', false);
  const [fullName] = useIntakeField<string>('personal.fullName', '');

  const ready = checked && signed;

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
          <LegalDoc t={t} title="§7216 Consent — Use of Tax Information" paras={PARAS} />

          <Row gap={10} align="flex-start">
            <div
              onClick={() => setChecked(!checked)}
              style={{
                width: 22,
                height: 22,
                flexShrink: 0,
                borderRadius: 5,
                background: checked ? t.ease.forestDark : t.ease.keylimeWash,
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
              onSign={() => setSigned(true)}
              name={fullName || 'Your signature'}
            />
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
          <Button
            t={t}
            onClick={handleNext}
            disabled={!ready}
            style={{ flex: 1, opacity: ready ? 1 : 0.45 }}
          >
            Sign and continue
          </Button>
        </IntakeBottomBar>
      </div>
    </Screen>
  );
}
