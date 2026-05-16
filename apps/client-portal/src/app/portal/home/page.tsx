'use client';

// Returning portal - Home tab. Hero status, balance, sign 8879, appointment,
// progress timeline, Antonio's message. 1-to-1 port of ScreenHome.
//
// Hero status card driven by the canonical 5-state portal-stage map
// from @docket/shared (CLAUDE.md §4 Client Portal). State detection
// uses the IntakeState flags currently available; Phase-2 sub-milestone
// flips the inputs to read engagement.status + signatures + filings
// via a portal server query (the COPY contract stays stable).

import {
  AvatarSlot,
  Body,
  Button,
  buildTheme,
  Card,
  Eyebrow,
  H1,
  H2,
  Row,
  Stack,
  Wordmark,
} from '@docket/ui';
import type { Theme } from '@docket/ui';
import { useRouter } from 'next/navigation';
import { detectPortalStage, getStageCopy } from '@docket/shared';
import { useIntakeField } from '@/lib/intake-context';

export default function PortalHomePage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const router = useRouter();

  // Pull display data from the same Postgres-backed IntakeState the
  // intake flow writes to. The portal layout's IntakeProvider hydrates
  // it on every page load (one round trip, request-scoped cache).
  const [fullName] = useIntakeField<string>('personal.fullName', '');
  const [docsList] = useIntakeField<unknown[]>('docs.uploaded', []);
  const [depositPaid, setDepositPaid] = useIntakeField<boolean>('deposit.paid', false);
  const [signed8879, setSigned8879] = useIntakeField<boolean>(
    'engagement.signed',
    false,
  );

  // Greeting fallback: 'there' instead of a hardcoded persona name. Real
  // clients with phone-only signups don't have fullName populated yet on
  // their first portal visit; we'd rather say 'Good afternoon, there'
  // than show them somebody else's name.
  const firstName = (fullName ?? '').split(' ')[0] || 'there';
  const needsPayment = !depositPaid;
  // needsSign was historically `depositPaid && !signed8879`. The mock
  // 8879 route at /portal/sign-8879/page.tsx flipped the flag without a
  // real DocuSign envelope; that mock was removed 2026-05-15 per the
  // audit, and there's no replacement webhook handler yet that flips
  // `engagement.signed` from a real envelope-completed event. Until
  // the envelope flow lands, the home SigCard renders in the inactive
  // "pending" visual state (padlock icon, "Available when envelope
  // sent" copy) instead of looping the user to a dead-end placeholder.
  const needsSign = false;
  const allDone = depositPaid && signed8879;

  // Compute the canonical portal stage. v0 inputs come from IntakeState;
  // Phase 2 will swap in engagement/signature/filing queries.
  const docsUploaded = Array.isArray(docsList) && docsList.length > 0;
  const portalStage = detectPortalStage({
    intakeComplete: Boolean(fullName),
    docsUploaded,
    depositPaid,
    // 8879 envelope-sent gate. Historically tied to depositPaid (the
    // mock-only path). With the mock removed (audit, 2026-05-15) and
    // no DocuSign envelope-tracking wired into the portal yet, this
    // stays false so the portal stage stays in `docs_received` instead
    // of advancing to `review_ready` (which would render a Sign CTA
    // that loops to a dead-end placeholder).
    eightyseventynineSent: false,
    eightyseventynineSigned: signed8879,
    filed: allDone,
    filingAcknowledged: allDone,
    daysSinceFiling: 0,
  });
  const stageCopy = getStageCopy(portalStage, {
    firstName,
    firmName: 'Vazant Consulting',
    ownerName: 'Antonio',
    taxYear: '2025',
    filedDate: allDone ? '2026-04-14' : undefined,
  });

  // Optimistic local-only flip until Square integration ships (Day 8-9).
  // Triggers a server save via useIntakeField; the user's deposit.paid
  // gets persisted under their tenant DEK.
  const onPay = () => void setDepositPaid(true);
  // onSign is a defensive no-op until the DocuSign envelope flow is
  // wired. With needsSign=false above, the SigCard's onClick is gated
  // off this handler via the parent's `onClick={needsSign ? onSign : undefined}`
  // — so this never fires today. Kept as a named handler so the
  // function signature stays stable for the future wire-up; replace
  // with `router.push(\`/portal/sign-8879/\${envelopeId}\`)` once the
  // envelope-id is queryable from the portal layout context.
  const onSign = () => {};
  void setSigned8879; // intentionally unused locally; the real setter
                      // will be the DocuSign envelope-completed webhook
                      // (apps/command-room/src/app/api/webhooks/docusign/connect)
                      // once it's hooked up to flip engagement.signed.

  return (
    <>
      <div style={{ padding: '16px 20px 8px', borderBottom: `1px solid ${t.borderSoft}` }}>
        <Row justify="space-between">
          <Wordmark t={t} />
          <div style={{ fontFamily: t.mono, fontSize: 10, color: t.muted, letterSpacing: 1 }}>
            CLIENT PORTAL
          </div>
        </Row>
      </div>

      <div style={{ padding: '24px 20px 24px' }}>
        <Stack gap={20}>
          <Stack gap={4}>
            <H1 t={t} style={{ fontSize: 30 }}>
              Good afternoon, {firstName}
            </H1>
            <Body t={t} size={14} muted>
              Tuesday, April 14
            </Body>
          </Stack>

          {/* Hero status — driven by canonical 5-state portal-stage map.
              Eyebrow tone determines accent color; copy comes from
              @docket/shared/portal-stage. */}
          <div
            style={{
              background: t.card,
              border: `1px solid ${t.border}`,
              borderRadius: t.radiusLg,
              padding: 22,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: -30,
                right: -30,
                width: 120,
                height: 120,
                borderRadius: '50%',
                background:
                  stageCopy.tone === 'success'
                    ? 'rgba(74, 143, 95, 0.15)'
                    : stageCopy.tone === 'neutral'
                      ? t.bgElev
                      : t.tintAccent,
                opacity: 0.8,
              }}
            />
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  display: 'inline-flex',
                  padding: '4px 10px',
                  background:
                    stageCopy.tone === 'success'
                      ? 'rgba(74, 143, 95, 0.15)'
                      : stageCopy.tone === 'neutral'
                        ? t.bgElev
                        : t.tintAccentStrong,
                  borderRadius: 999,
                  fontFamily: t.mono,
                  fontSize: 10,
                  color:
                    stageCopy.tone === 'success'
                      ? '#2e6b42'
                      : stageCopy.tone === 'neutral'
                        ? t.muted
                        : t.rustInk,
                  letterSpacing: 1,
                  marginBottom: 14,
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background:
                      stageCopy.tone === 'success'
                        ? '#4a8f5f'
                        : stageCopy.tone === 'neutral'
                          ? t.muted
                          : t.rust,
                    marginRight: 6,
                  }}
                />
                {stageCopy.eyebrow.toUpperCase()}
              </div>
              <H2 t={t} style={{ marginBottom: 10 }}>
                {stageCopy.title}
              </H2>
              <Body t={t} size={14} style={{ marginBottom: 12 }}>
                {stageCopy.body}
              </Body>
              <div
                style={{
                  fontFamily: t.mono,
                  fontSize: 11,
                  color: t.muted,
                  letterSpacing: 0.3,
                  paddingTop: 10,
                  borderTop: `1px solid ${t.borderSoft}`,
                }}
              >
                {/* Subline kept human-authored — the 5-state copy
                    doesn't carry timing detail; the portal does. */}
                {portalStage === 'filed_refund'
                  ? 'Filed Apr 14 · Awaiting IRS acknowledgement'
                  : portalStage === 'review_ready'
                    ? 'Sign by Apr 18 · E-file authorization'
                    : portalStage === 'docs_received'
                      ? 'Estimated processing: 3-5 business days after filing'
                      : portalStage === 'off_season'
                        ? 'Tax year complete · Year-round support active'
                        : 'About 12 minutes to complete'}
              </div>
            </div>
          </div>

          {/* Balance */}
          <Card t={t} style={{ padding: 18 }}>
            <Row justify="space-between" align="flex-start" style={{ marginBottom: 14 }}>
              <div>
                <Eyebrow t={t} style={{ marginBottom: 4 }}>
                  {depositPaid ? 'Balance' : 'Balance due'}
                </Eyebrow>
                <div
                  style={{
                    fontFamily: t.serif,
                    fontSize: 32,
                    color: depositPaid ? t.muted : t.ink,
                    textDecoration: depositPaid ? 'line-through' : 'none',
                    letterSpacing: -0.8,
                    lineHeight: 1,
                  }}
                >
                  $250
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: t.muted,
                    marginTop: 4,
                    fontFamily: t.mono,
                  }}
                >
                  {depositPaid ? 'Paid in full · $500 total' : 'of $500 total · $250 deposit paid'}
                </div>
              </div>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: depositPaid ? 'rgba(74, 143, 95, 0.15)' : t.bgElev,
                  border: `1px solid ${depositPaid ? 'rgba(74, 143, 95, 0.3)' : t.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {depositPaid ? (
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <path
                      d="M5 11l4 4 8-9"
                      stroke="#4a8f5f"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <rect
                      x="3"
                      y="6"
                      width="18"
                      height="13"
                      rx="2"
                      stroke={t.rustInk}
                      strokeWidth="1.5"
                    />
                    <path d="M3 10h18" stroke={t.rustInk} strokeWidth="1.5" />
                  </svg>
                )}
              </div>
            </Row>
            {!depositPaid && (
              <Button t={t} onClick={onPay} style={{ width: '100%' }}>
                Pay remaining balance
              </Button>
            )}
            {depositPaid && (
              <div
                style={{
                  fontFamily: t.mono,
                  fontSize: 10,
                  color: t.muted,
                  letterSpacing: 1,
                  paddingTop: 10,
                  borderTop: `1px solid ${t.borderSoft}`,
                }}
              >
                ● PAID APR 14 · VISA ···· 4242
              </div>
            )}
          </Card>

          {/* 8879 sign card */}
          <SignRow
            t={t}
            paid={depositPaid}
            signed8879={signed8879}
            onClick={needsSign ? onSign : undefined}
            needsPayment={needsPayment}
            needsSign={needsSign}
          />

          {/* Appointment */}
          <Card t={t} style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: '14px 18px 10px',
                borderBottom: `1px solid ${t.borderSoft}`,
              }}
            >
              <Row justify="space-between">
                <Eyebrow t={t}>Upcoming appointment</Eyebrow>
                <div style={{ fontFamily: t.mono, fontSize: 10, color: t.green }}>
                  ● CONFIRMED
                </div>
              </Row>
            </div>
            <div style={{ padding: 18 }}>
              <Row gap={16} align="flex-start">
                <div
                  style={{
                    textAlign: 'center',
                    flexShrink: 0,
                    background: t.bgElev,
                    border: `1px solid ${t.border}`,
                    borderRadius: t.radius,
                    padding: '8px 12px',
                    minWidth: 56,
                  }}
                >
                  <div
                    style={{
                      fontFamily: t.mono,
                      fontSize: 10,
                      color: t.rust,
                      letterSpacing: 1,
                    }}
                  >
                    APR
                  </div>
                  <div
                    style={{
                      fontFamily: t.serif,
                      fontSize: 22,
                      color: t.ink,
                      lineHeight: 1,
                    }}
                  >
                    09
                  </div>
                  <div style={{ fontSize: 10, color: t.muted, marginTop: 2 }}>Wed</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, color: t.ink, fontWeight: 500 }}>3:00 PM PT</div>
                  <div style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>
                    Google Meet · 45 min review
                  </div>
                </div>
              </Row>
              <Row gap={6} style={{ marginTop: 14, flexWrap: 'wrap' }}>
                <Button t={t} variant="ghost" style={{ padding: '8px 12px', fontSize: 12 }}>
                  Join
                </Button>
                <Button t={t} variant="ghost" style={{ padding: '8px 12px', fontSize: 12 }}>
                  Add to calendar
                </Button>
                <Button t={t} variant="ghost" style={{ padding: '8px 12px', fontSize: 12 }}>
                  Reschedule
                </Button>
              </Row>
            </div>
          </Card>

          {/* Progress tracker */}
          <ProgressTracker t={t} />

          {/* Antonio's message */}
          <Card t={t} style={{ padding: 18 }}>
            <Row gap={12} style={{ marginBottom: 12 }}>
              <AvatarSlot t={t} size={40} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: t.ink, fontWeight: 500 }}>
                  Antonio Vazquez
                </div>
                <div
                  style={{
                    fontFamily: t.mono,
                    fontSize: 10,
                    color: t.muted,
                    marginTop: 2,
                    letterSpacing: 0.3,
                  }}
                >
                  YESTERDAY · 4:32 PM
                </div>
              </div>
            </Row>
            <div
              style={{
                fontFamily: t.sans,
                fontSize: 14.5,
                color: t.inkSoft,
                lineHeight: 1.55,
              }}
            >
              Hi {firstName} - your return looks good. Refund estimate is in line with last year.
              Once you pay the balance, I&apos;ll send the 8879 for your signature and file the
              same day. Any questions, text me.
            </div>
          </Card>
        </Stack>
      </div>
    </>
  );
}

function SignRow({
  t,
  paid,
  signed8879,
  onClick,
  needsPayment,
  needsSign,
}: {
  t: Theme;
  paid: boolean;
  signed8879: boolean;
  onClick?: () => void;
  needsPayment: boolean;
  needsSign: boolean;
}) {
  return (
    <Card
      t={t}
      onClick={onClick}
      style={{
        padding: 16,
        background: signed8879 ? t.card : needsSign ? t.card : t.bgElev,
        opacity: needsPayment ? 0.7 : 1,
        border: `1px solid ${needsSign ? t.rust : t.border}`,
        cursor: needsSign ? 'pointer' : 'default',
      }}
    >
      <Row gap={14} align="center">
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: signed8879
              ? 'rgba(74, 143, 95, 0.15)'
              : needsSign
                ? t.tintAccent
                : t.borderSoft,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {signed8879 ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M4 9l3 3 7-7"
                stroke="#4a8f5f"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : needsSign ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M3 14c3-4 6-2 8-4M11 10l3-5 2 2-5 3"
                stroke={t.rustInk}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="4" y="8" width="10" height="7" rx="1" stroke={t.muted} strokeWidth="1.5" />
              <path d="M6 8V5a3 3 0 016 0v3" stroke={t.muted} strokeWidth="1.5" />
            </svg>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 15,
              color: signed8879 || needsSign ? t.ink : t.inkSoft,
              fontWeight: 500,
            }}
          >
            {signed8879 ? 'Form 8879 - signed' : 'Sign Form 8879'}
          </div>
          <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>
            {signed8879
              ? 'Signed Apr 14 · 2:38 PM PT'
              : needsSign
                ? 'Ready to sign · E-file authorization'
                : needsPayment
                  ? 'Available after payment'
                  : 'Available when your preparer sends the envelope'}
          </div>
        </div>
        {needsSign && (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke={t.rust}
            strokeWidth="1.5"
          >
            <path d="M5 3l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </Row>
    </Card>
  );
}

function ProgressTracker({ t }: { t: Theme }) {
  const steps = [
    { label: 'Intake submitted', date: 'Jan 14', done: true },
    { label: 'Documents uploaded', date: 'Feb 3', done: true },
    { label: 'Review call with Antonio', date: 'Feb 18', done: true },
    { label: 'Return prepared', date: 'Mar 28', done: true },
    { label: 'Pay & sign', date: 'Current step', done: false, current: true },
    { label: 'E-filed with IRS', date: 'Pending', done: false },
    { label: 'Filing accepted', date: 'Pending', done: false },
  ];

  return (
    <div>
      <Row justify="space-between" style={{ marginBottom: 16 }}>
        <Eyebrow t={t}>Your return</Eyebrow>
        <div style={{ fontFamily: t.mono, fontSize: 11, color: t.muted }}>5 of 7</div>
      </Row>
      <div
        style={{
          background: t.card,
          border: `1px solid ${t.border}`,
          borderRadius: t.radiusLg,
          padding: '18px 20px',
        }}
      >
        {steps.map((s, i) => (
          <Row key={i} gap={14} align="flex-start">
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: s.done ? t.green : s.current ? t.rust : 'transparent',
                  border: `1.5px solid ${s.done ? t.green : s.current ? t.rust : t.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  boxShadow: s.current ? `0 0 0 4px ${t.tintAccentStrong}` : 'none',
                }}
              >
                {s.done && (
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
                {s.current && (
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
                )}
              </div>
              {i < steps.length - 1 && (
                <div
                  style={{
                    width: 1.5,
                    flex: 1,
                    background: s.done ? t.green : t.border,
                    minHeight: 28,
                    margin: '3px 0',
                  }}
                />
              )}
            </div>
            <div style={{ paddingBottom: i < steps.length - 1 ? 16 : 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 14,
                  color: s.current ? t.ink : s.done ? t.inkSoft : t.muted,
                  fontWeight: s.current ? 500 : 400,
                }}
              >
                {s.label}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: t.muted,
                  marginTop: 2,
                  fontFamily: t.mono,
                  letterSpacing: 0.3,
                }}
              >
                {s.date}
              </div>
            </div>
          </Row>
        ))}
      </div>
    </div>
  );
}
