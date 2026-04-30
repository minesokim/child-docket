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
import { usePortalState } from '@/lib/portal-state';

type ConsentState = {
  checked: boolean;
  signed: boolean;
};

const DEFAULT: ConsentState = { checked: false, signed: false };

const PARAS = [
  'Federal law requires this consent form be provided to you. Unless authorized by law, we cannot use your tax return information for any purpose other than preparing your return without your consent.',
  'You are not required to complete this form. If we obtain your signature on this form by conditioning our services on your consent, your consent will not be valid. Your consent is valid for the amount of time that you specify.',
  'By signing below, you authorize Antonio Vazquez, Enrolled Agent, to use the information you provide solely for the purpose of preparing your 2025 federal and state income tax returns. This consent is valid until the returns are filed and accepted by the applicable tax authorities.',
  'If you believe your tax return information has been disclosed or used improperly in a manner unauthorized by law or without your permission, you may contact the Treasury Inspector General for Tax Administration (TIGTA).',
];

type PersonalInfo = { fullName: string };

export default function ConsentPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  const [state, setState] = usePortalState<ConsentState>('consent-7216', DEFAULT);
  const [personal] = usePortalState<PersonalInfo>('personal', { fullName: '' });
  const ready = state.checked && state.signed;

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
              onClick={() => setState({ ...state, checked: !state.checked })}
              style={{
                width: 22,
                height: 22,
                flexShrink: 0,
                borderRadius: 5,
                border: `1.5px solid ${state.checked ? t.rust : t.border}`,
                background: state.checked ? t.rust : t.card,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 1,
              }}
            >
              {state.checked && (
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
              onClick={() => setState({ ...state, checked: !state.checked })}
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
              signed={state.signed}
              onSign={() => setState({ ...state, signed: true })}
              name={personal.fullName || 'Your signature'}
            />
          </div>
        </Stack>

        <IntakeBottomBar t={t}>
          <Button
            t={t}
            variant="ghost"
            onClick={() => nav.back('/engagement')}
            style={{ flex: '0 0 auto' }}
          >
            Back
          </Button>
          <Button
            t={t}
            onClick={() => nav.next('/appt')}
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
