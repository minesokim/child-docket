'use client';

// Form 8879 e-file authorization sign flow. Reached from /portal/home or
// /portal/signatures when the balance is paid. Submitting marks
// portal.signed8879 = true and routes back to /portal/home.

import {
  Body,
  Button,
  buildTheme,
  Eyebrow,
  H2,
  HandCheckmark,
  Row,
  Screen,
  SignaturePad,
  Stack,
} from '@docket/ui';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { usePortalState } from '@/lib/portal-state';

type PortalState = {
  paid: boolean;
  signed8879: boolean;
};

type PersonalInfo = { fullName: string };

const PORTAL_DEFAULT: PortalState = { paid: false, signed8879: false };

export default function Sign8879Page() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const router = useRouter();
  const [portal, setPortal] = usePortalState<PortalState>('portal-state', PORTAL_DEFAULT);
  const [personal] = usePortalState<PersonalInfo>('personal', { fullName: '' });
  const [signed, setSigned] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const fullName = personal.fullName || 'Maria Rodriguez';
  const firstName = fullName.split(' ')[0] || 'friend';

  const onSubmit = () => {
    if (!signed || submitting) return;
    setSubmitting(true);
    // Show the success animation, then commit and route home.
    setTimeout(() => {
      setPortal({ ...portal, signed8879: true });
      router.push('/portal/home');
    }, 2100);
  };

  return (
    <Screen t={t} style={{ position: 'relative' }}>
      <div
        style={{
          padding: '14px 18px 12px',
          borderBottom: `1px solid ${t.borderSoft}`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: t.bg,
        }}
      >
        <button
          onClick={() => router.back()}
          style={{
            background: 'none',
            border: 'none',
            padding: 4,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: t.inkSoft,
            fontFamily: t.sans,
            fontSize: 14,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M9 3L5 7l4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontFamily: t.mono, fontSize: 10, color: t.muted, letterSpacing: 1.2 }}>
            E-FILE AUTHORIZATION
          </div>
          <div style={{ fontFamily: t.serif, fontSize: 15, color: t.ink, marginTop: 2 }}>
            Form 8879
          </div>
        </div>
        <div style={{ width: 48 }} />
      </div>

      <div style={{ padding: '20px 20px 18px', flex: 1 }}>
        <Stack gap={14}>
          <div>
            <Eyebrow t={t}>Taxpayer</Eyebrow>
            <div
              style={{
                fontFamily: t.serif,
                fontSize: 19,
                color: t.ink,
                marginTop: 4,
              }}
            >
              {fullName}
            </div>
            <div
              style={{
                fontFamily: t.mono,
                fontSize: 11,
                color: t.muted,
                marginTop: 2,
                letterSpacing: 0.3,
              }}
            >
              SSN ···-··-4829 · Tax year 2025
            </div>
          </div>

          <div style={{ height: 1, background: t.borderSoft }} />

          <div>
            <Eyebrow t={t}>Return summary</Eyebrow>
            <div
              style={{
                marginTop: 10,
                background: t.bgElev,
                borderRadius: 10,
                padding: '14px 16px',
              }}
            >
              <Row justify="space-between" style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: t.inkSoft }}>Adjusted gross income</span>
                <span style={{ fontSize: 13, color: t.ink, fontFamily: t.mono }}>$84,320</span>
              </Row>
              <Row justify="space-between" style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: t.inkSoft }}>Total tax</span>
                <span style={{ fontSize: 13, color: t.ink, fontFamily: t.mono }}>$11,468</span>
              </Row>
              <Row justify="space-between" style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: t.inkSoft }}>Federal withholding</span>
                <span style={{ fontSize: 13, color: t.ink, fontFamily: t.mono }}>$13,260</span>
              </Row>
              <div style={{ height: 1, background: t.border, margin: '8px 0' }} />
              <Row justify="space-between">
                <span style={{ fontSize: 14, color: t.ink, fontWeight: 500 }}>Refund</span>
                <span
                  style={{
                    fontSize: 15,
                    color: '#2e6b42',
                    fontFamily: t.serif,
                    fontWeight: 500,
                  }}
                >
                  $1,792
                </span>
              </Row>
            </div>
          </div>

          <div>
            <Eyebrow t={t}>Declaration</Eyebrow>
            <div
              style={{
                fontFamily: t.serif,
                fontSize: 14,
                lineHeight: 1.6,
                color: t.inkSoft,
                marginTop: 8,
                textWrap: 'pretty' as React.CSSProperties['textWrap'],
              }}
            >
              Under penalties of perjury, I declare that I have examined a copy of my 2025 federal
              individual income tax return (Form 1040) and accompanying schedules, and to the best
              of my knowledge and belief, it is true, correct, and complete.
            </div>
            <div
              style={{
                fontFamily: t.serif,
                fontSize: 14,
                lineHeight: 1.6,
                color: t.inkSoft,
                marginTop: 10,
              }}
            >
              I consent to allow my Electronic Return Originator (Antonio Vazquez, EA — P00456789)
              to send my return to the IRS, to receive the acknowledgement of acceptance or reason
              for rejection, and if necessary, to transmit the corrected return.
            </div>
            <div
              style={{
                fontFamily: t.serif,
                fontSize: 14,
                lineHeight: 1.6,
                color: t.inkSoft,
                marginTop: 10,
              }}
            >
              I authorize the U.S. Treasury and its designated Financial Agent to initiate an ACH
              electronic funds deposit entry to the financial institution account indicated in my
              tax return for my refund.
            </div>
          </div>

          <div
            style={{
              background: t.bgElev,
              border: `1px solid ${t.border}`,
              borderRadius: 10,
              padding: '12px 14px',
            }}
          >
            <div
              style={{
                fontFamily: t.mono,
                fontSize: 10,
                color: t.rustInk,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Refund destination
            </div>
            <div style={{ fontFamily: t.serif, fontSize: 14, color: t.ink }}>
              Chase · Checking ····6291
            </div>
            <div
              style={{
                fontFamily: t.mono,
                fontSize: 11,
                color: t.muted,
                marginTop: 2,
              }}
            >
              Direct deposit · 1–3 weeks after acceptance
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <Eyebrow t={t}>Your signature</Eyebrow>
            <div style={{ marginTop: 10 }}>
              <SignaturePad t={t} signed={signed} onSign={() => setSigned(true)} name={fullName} />
            </div>
          </div>

          <div
            style={{
              fontFamily: t.mono,
              fontSize: 9.5,
              color: t.muted,
              letterSpacing: 0.6,
              marginTop: 4,
            }}
          >
            YOUR SIGNATURE IS CRYPTOGRAPHICALLY TIMESTAMPED PER IRS CIRCULAR 230.
          </div>
        </Stack>
      </div>

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          padding: '14px 18px 16px',
          borderTop: `1px solid ${t.borderSoft}`,
          background: t.bg,
        }}
      >
        <Button
          t={t}
          onClick={onSubmit}
          style={{
            width: '100%',
            opacity: signed && !submitting ? 1 : 0.55,
            cursor: signed && !submitting ? 'pointer' : 'not-allowed',
          }}
        >
          {submitting ? 'Submitting…' : signed ? 'Submit signature' : 'Sign to submit'}
        </Button>
      </div>

      {submitting && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 80,
            background: t.bg,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 22,
            padding: '0 32px',
          }}
        >
          <HandCheckmark t={t} size={112} />
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontFamily: t.serif,
                fontSize: 28,
                color: t.ink,
                letterSpacing: -0.6,
                marginBottom: 8,
              }}
            >
              You&apos;re all set, {firstName}
            </div>
            <div
              style={{
                fontSize: 14,
                color: t.inkSoft,
                lineHeight: 1.5,
                maxWidth: 280,
                margin: '0 auto',
              }}
            >
              Your return has been signed and sent to Antonio. He&apos;ll transmit it to the IRS
              within the hour.
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}
