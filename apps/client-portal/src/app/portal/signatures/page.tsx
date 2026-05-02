'use client';

// Returning portal - Signatures tab. SigCard list. Awaiting + Completed groups.
// 1-to-1 port of ScreenSignatures.

import {
  Body,
  buildTheme,
  Card,
  Eyebrow,
  H1,
  Row,
  Stack,
  Wordmark,
} from '@docket/ui';
import type { Theme } from '@docket/ui';
import { useRouter } from 'next/navigation';
import { useIntakeField } from '@/lib/intake-context';

function SigCard({
  t,
  form,
  subtitle,
  status,
  date,
  locked,
  reason,
  onSign,
}: {
  t: Theme;
  form: string;
  subtitle: string;
  status: 'pending' | 'signed';
  date?: string;
  locked?: boolean;
  reason?: string;
  onSign?: () => void;
}) {
  return (
    <Card t={t} style={{ padding: 0, opacity: locked ? 0.7 : 1, overflow: 'hidden' }}>
      <div style={{ padding: '16px 18px' }}>
        <Row justify="space-between" align="flex-start" style={{ marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: t.serif,
                fontSize: 18,
                color: t.ink,
                letterSpacing: -0.2,
                marginBottom: 4,
              }}
            >
              {form}
            </div>
            <div style={{ fontSize: 13, color: t.muted, lineHeight: 1.4 }}>{subtitle}</div>
          </div>
          {status === 'signed' && (
            <svg
              width="22"
              height="22"
              viewBox="0 0 22 22"
              style={{ flexShrink: 0, marginLeft: 8 }}
            >
              <circle cx="11" cy="11" r="10" fill={t.green} />
              <path
                d="M6.5 11l3.5 3.5L15.5 9"
                stroke="#fff"
                strokeWidth="1.8"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {locked && (
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: t.bgElev,
                border: `1px solid ${t.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginLeft: 8,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="2.5" y="5" width="7" height="5.5" rx="1" stroke={t.muted} strokeWidth="1.2" />
                <path d="M3.8 5V3.5a2.2 2.2 0 014.4 0V5" stroke={t.muted} strokeWidth="1.2" />
              </svg>
            </div>
          )}
        </Row>
      </div>
      <div
        style={{
          padding: '12px 18px',
          background: t.bgElev,
          borderTop: `1px solid ${t.borderSoft}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            fontFamily: t.mono,
            fontSize: 11,
            color: t.muted,
            letterSpacing: 0.3,
          }}
        >
          {status === 'signed' && date && (
            <>
              <span style={{ color: t.green }}>● SIGNED</span> · {date}
            </>
          )}
          {locked && <span style={{ color: t.muted }}>● {reason || 'LOCKED'}</span>}
          {status === 'pending' && !locked && (
            <span style={{ color: t.rust }}>● AWAITING SIGNATURE</span>
          )}
        </div>
        {status === 'signed' && (
          <button
            style={{
              background: 'none',
              border: 'none',
              fontSize: 12,
              color: t.rust,
              cursor: 'pointer',
              fontFamily: t.sans,
              fontWeight: 500,
              padding: 0,
            }}
          >
            View signed document →
          </button>
        )}
        {status === 'pending' && !locked && (
          <button
            onClick={onSign}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 12,
              color: t.rust,
              cursor: 'pointer',
              fontFamily: t.sans,
              fontWeight: 500,
              padding: 0,
            }}
          >
            Sign now →
          </button>
        )}
      </div>
    </Card>
  );
}

export default function PortalSignaturesPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const router = useRouter();
  const [form8879Signed] = useIntakeField<boolean>('engagement.signed', false);
  const [depositPaid] = useIntakeField<boolean>('deposit.paid', false);

  return (
    <>
      <div
        style={{
          padding: '16px 20px 8px',
          borderBottom: `1px solid ${t.borderSoft}`,
        }}
      >
        <Row justify="space-between">
          <Wordmark t={t} />
          <div
            style={{
              fontFamily: t.mono,
              fontSize: 10,
              color: t.muted,
              letterSpacing: 1,
            }}
          >
            CLIENT PORTAL
          </div>
        </Row>
      </div>

      <div style={{ padding: '24px 20px 20px' }}>
        <Stack gap={18}>
          <Stack gap={10}>
            <H1 t={t}>Signatures</H1>
            <Body t={t} size={14}>
              Tax forms that need your signature. Each carries an independent timestamp for audit.
            </Body>
          </Stack>

          {!form8879Signed && (
            <div>
              <Eyebrow t={t} style={{ marginBottom: 12 }}>
                Awaiting you
              </Eyebrow>
              <SigCard
                t={t}
                form="Form 8879"
                subtitle="E-file authorization. Required before Antonio can transmit your return to the IRS."
                status="pending"
                locked={!depositPaid}
                reason="AVAILABLE AFTER PAYMENT"
                onSign={() => router.push('/portal/sign-8879')}
              />
            </div>
          )}

          <div>
            <Eyebrow t={t} style={{ marginBottom: 12 }}>
              Completed
            </Eyebrow>
            <Stack gap={12}>
              {form8879Signed && (
                <SigCard
                  t={t}
                  form="Form 8879"
                  subtitle="E-file authorization. Antonio can now transmit your return to the IRS."
                  status="signed"
                  date="APR 14, 2026 · 2:18 PM"
                />
              )}
              <SigCard
                t={t}
                form="Engagement Letter"
                subtitle="Your formal agreement for preparation of the 2025 return."
                status="signed"
                date="JAN 14, 2026 · 9:42 AM"
              />
              <SigCard
                t={t}
                form="§7216 Consent"
                subtitle="IRS-required separate permission to use your tax information."
                status="signed"
                date="JAN 14, 2026 · 9:44 AM"
              />
            </Stack>
          </div>

          <div
            style={{
              padding: '14px 16px',
              background: t.bgElev,
              border: `1px dashed ${t.border}`,
              borderRadius: t.radius,
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              style={{ flexShrink: 0, marginTop: 2 }}
            >
              <circle cx="8" cy="8" r="7" stroke={t.muted} strokeWidth="1.2" />
              <path d="M8 4v5M8 11v0.5" stroke={t.muted} strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <div style={{ fontSize: 12, color: t.muted, lineHeight: 1.5 }}>
              Every signature is cryptographically timestamped and stored with your return. Antonio
              receives an audit trail per IRS Circular 230.
            </div>
          </div>
        </Stack>
      </div>
    </>
  );
}
