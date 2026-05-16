'use client';

// Returning portal - Profile tab. Account, refund tracking, signed documents,
// firm info, actions. 1-to-1 port of ScreenProfile.

import {
  Body,
  buildTheme,
  Card,
  H1,
  Row,
  Stack,
  useFirmOwner,
  useTenantName,
  Wordmark,
} from '@docket/ui';
import type { Theme } from '@docket/ui';
import * as React from 'react';
import { useIntakeField } from '@/lib/intake-context';

// Tenant-fallback defaults used when the TenantDisplayProvider hasn't
// mounted yet (dev pre-seed). Same pattern as the engagement letter +
// §7216 consent pages — see `apps/client-portal/src/app/(intake)/
// engagement/page.tsx` for the original. The Session 11 audit closed
// the remaining hardcodes that previously baked "Antonio Vazquez,
// Enrolled Agent" + "VAZANT CONSULTING" verbatim into this surface.
const DEFAULT_OWNER_NAME = 'Antonio Vazquez';
const DEFAULT_TENANT_NAME = 'Vazant Consulting';

function ProfileIcon({
  kind,
  size = 14,
  color,
}: {
  kind: 'extlink' | 'edit' | 'chevron' | 'phone' | 'mail';
  size?: number;
  color?: string;
}) {
  const s = {
    width: size,
    height: size,
    fill: 'none',
    stroke: color || 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (kind) {
    case 'extlink':
      return (
        <svg {...s} viewBox="0 0 14 14">
          <path d="M6 3H3v8h8V8M9 3h2v2M9 3l4 4" />
        </svg>
      );
    case 'edit':
      return (
        <svg {...s} viewBox="0 0 14 14">
          <path d="M3 11l1-4 6-6 3 3-6 6zM9 2l3 3" />
        </svg>
      );
    case 'chevron':
      return (
        <svg {...s} viewBox="0 0 14 14">
          <path d="M5 3l4 4-4 4" />
        </svg>
      );
    case 'phone':
      return (
        <svg {...s} viewBox="0 0 14 14">
          <path d="M3 3h3l1 3-2 1a7 7 0 004 4l1-2 3 1v3a1 1 0 01-1 1A10 10 0 012 4a1 1 0 011-1z" />
        </svg>
      );
    case 'mail':
      return (
        <svg {...s} viewBox="0 0 14 14">
          <rect x="2" y="3" width="10" height="8" rx="1" />
          <path d="M2 4l5 4 5-4" />
        </svg>
      );
  }
}

function SectionEyebrow({ t, children }: { t: Theme; children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: t.sans,
        fontSize: 12,
        color: t.muted,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        margin: '0 0 10px',
      }}
    >
      {children}
    </div>
  );
}

function ExtLinkRow({
  t,
  label,
  host,
}: {
  t: Theme;
  label: string;
  host: string;
}) {
  return (
    <button
      style={{
        width: '100%',
        textAlign: 'left',
        background: 'none',
        border: 'none',
        padding: '14px 0',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: 'pointer',
        fontFamily: t.sans,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: t.ink, marginBottom: 2 }}>{label}</div>
        <div
          style={{
            fontFamily: t.mono,
            fontSize: 11,
            color: t.muted,
            letterSpacing: 0.3,
          }}
        >
          {host}
        </div>
      </div>
      <span style={{ color: t.rustInk, display: 'inline-flex' }}>
        <ProfileIcon kind="extlink" size={14} />
      </span>
    </button>
  );
}

export default function PortalProfilePage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  // Firm-owner + tenant display data come from TenantDisplayProvider
  // mounted by the portal layout (server-side resolution of the
  // tenant per the inbound Clerk session). Fall back to the legacy
  // Antonio + Vazant defaults if the provider hasn't mounted — same
  // failure mode as the intake engagement letter page (commit
  // b3a3cb0). Multi-tenant correctness: tenant #2 sees their own
  // firm name + owner name on the Profile tab post-onboarding.
  const owner = useFirmOwner();
  const tenantName = useTenantName();
  const preparerDisplayName = owner?.name ?? DEFAULT_OWNER_NAME;
  // The "Firm info" card has displayed credentials ("Enrolled Agent")
  // verbatim since v0. FirmOwner doesn't carry a credential field
  // yet, so we drop the suffix until that lands (v1.5). Strictly
  // less specific than the wrong-firm-credential case (e.g., showing
  // "CPA" suffix on an EA owner). Tenant-specific credentials come
  // back when FirmOwner gains a `credential` field.
  const firmDisplayName = tenantName ?? DEFAULT_TENANT_NAME;
  const [fullName] = useIntakeField<string>('personal.fullName', '');
  const [phone] = useIntakeField<string>('personal.phone', '');
  // Engagement letter signed during the intake flow at
  // apps/client-portal/src/app/(intake)/engagement/page.tsx. That
  // page writes `engagement.signed = true` after the user signs.
  // The legacy mock 8879 page ALSO wrote to `engagement.signed`
  // (overloaded meaning) — that mock was removed 2026-05-15, so
  // `engagement.signed` now unambiguously means "engagement letter
  // signed."
  const [letterSigned] = useIntakeField<boolean>('engagement.signed', false);
  // §7216 consent signed at apps/client-portal/src/app/(intake)/
  // consent/page.tsx, writes `consent.signed`.
  const [consent7216Signed] = useIntakeField<boolean>('consent.signed', false);

  // No persona-name fallback. If fullName is empty we render an empty
  // string rather than show a different person's name on the user's
  // own profile page.
  const initial = fullName.charAt(0).toUpperCase() || '·';

  // Signed-document list. Until Phase 2 wires a per-client `signatures`
  // table query (which carries the real signed-at timestamp + audit
  // chain row + envelope id for re-download), we show signed/pending
  // state from the intake boolean flags + a deliberately-vague "Signed
  // during onboarding" note instead of fabricated timestamps. The
  // prior hardcoded "Apr 17, 2026 · 2:14 PM PT" strings were the same
  // for every user regardless of when they signed — the audit caught
  // this as mock data leaking into a live surface.
  //
  // Form 8879 status is hardcoded "Pending signature" regardless of
  // intake state. The previous code read `engagement.signed` as 8879
  // status, but that field is set on engagement-letter signing too
  // (overloaded field name; pre-existing dual meaning). After the
  // mock 8879 removal (2026-05-15), nothing in the portal data layer
  // can flip an "8879 signed" flag — the real 8879 signing happens via
  // the DocuSign envelope flow at /portal/sign-8879/[id]/sign-iframe.tsx,
  // which writes to the `signatures` table. Until Profile queries that
  // table directly (V1.5), showing 8879 status from `engagement.signed`
  // would falsely claim 8879-signed for every user who signed the
  // engagement letter. Honest pending state until the real wire-up.
  const signedDocs = [
    {
      name: 'Engagement Letter',
      pending: !letterSigned,
      when: letterSigned ? 'Signed during onboarding' : null,
    },
    {
      name: '§7216 Consent',
      pending: !consent7216Signed,
      when: consent7216Signed ? 'Signed during onboarding' : null,
    },
    {
      name: 'Form 8879',
      pending: true,
      when: 'Available when your preparer sends the envelope',
    },
  ];

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

      <div style={{ padding: '24px 20px 32px' }}>
        <Stack gap={28}>
          <Stack gap={4}>
            <H1 t={t} style={{ fontSize: 30 }}>
              Profile
            </H1>
            <Body t={t} size={14} muted>
              Account, refund history, and signed documents.
            </Body>
          </Stack>

          <div>
            <SectionEyebrow t={t}>Your account</SectionEyebrow>
            <Card t={t} style={{ padding: 18 }}>
              <Row gap={14} align="center">
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: `radial-gradient(circle at 30% 30%, ${t.rustSoft}, ${t.bgElev})`,
                    border: `1px solid ${t.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: t.serif,
                    fontSize: 22,
                    color: t.rustInk,
                    flexShrink: 0,
                  }}
                >
                  {initial}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: t.serif,
                      fontSize: 18,
                      color: t.ink,
                      letterSpacing: -0.3,
                    }}
                  >
                    {fullName}
                  </div>
                  <div
                    style={{
                      fontFamily: t.mono,
                      fontSize: 12,
                      color: t.muted,
                      marginTop: 2,
                      letterSpacing: 0.3,
                    }}
                  >
                    {phone}
                  </div>
                </div>
                <button
                  style={{
                    background: 'none',
                    border: `1px solid ${t.border}`,
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: t.muted,
                  }}
                  aria-label="Edit profile"
                >
                  <ProfileIcon kind="edit" size={13} />
                </button>
              </Row>
            </Card>
          </div>

          <div>
            <SectionEyebrow t={t}>Track your refund</SectionEyebrow>
            <Card t={t} style={{ padding: '4px 18px' }}>
              <ExtLinkRow t={t} label="Federal refund" host="irs.gov/refunds - Where's My Refund" />
              <div style={{ height: 1, background: t.borderSoft }} />
              <ExtLinkRow
                t={t}
                label="State refund"
                host="ftb.ca.gov - California FTB Refund Tracker"
              />
            </Card>
          </div>

          <div>
            <SectionEyebrow t={t}>Signed documents</SectionEyebrow>
            <Card t={t} style={{ padding: '4px 18px' }}>
              {signedDocs.map((d, i) => (
                <React.Fragment key={d.name}>
                  <Row
                    align="center"
                    gap={10}
                    style={{
                      padding: '14px 0',
                      opacity: d.pending ? 0.55 : 1,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: t.serif,
                          fontSize: 16,
                          color: t.ink,
                          letterSpacing: -0.2,
                          marginBottom: 2,
                        }}
                      >
                        {d.name}
                      </div>
                      <div
                        style={{
                          fontFamily: t.mono,
                          fontSize: 11,
                          color: t.muted,
                          letterSpacing: 0.3,
                        }}
                      >
                        {d.pending ? d.when ?? 'Pending signature' : d.when ?? 'Signed'}
                      </div>
                    </div>
                    {d.pending ? (
                      <span
                        style={{
                          fontFamily: t.mono,
                          fontSize: 10,
                          color: t.muted,
                          letterSpacing: 0.8,
                        }}
                      >
                        -
                      </span>
                    ) : (
                      <button
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          fontSize: 13,
                          color: t.rustInk,
                          fontFamily: t.sans,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          textDecorationColor: t.rustSoft,
                          textUnderlineOffset: 3,
                        }}
                      >
                        View
                      </button>
                    )}
                  </Row>
                  {i < signedDocs.length - 1 && (
                    <div style={{ height: 1, background: t.borderSoft }} />
                  )}
                </React.Fragment>
              ))}
            </Card>
          </div>

          <div>
            <SectionEyebrow t={t}>Firm info</SectionEyebrow>
            <Card t={t} style={{ padding: 18 }}>
              <Stack gap={12}>
                <div>
                  <div
                    style={{
                      fontFamily: t.serif,
                      fontSize: 17,
                      color: t.ink,
                      letterSpacing: -0.2,
                    }}
                  >
                    {preparerDisplayName}
                  </div>
                  <div style={{ fontSize: 12.5, color: t.muted, marginTop: 2 }}>
                    Claremont, California
                  </div>
                </div>
                <div style={{ height: 1, background: t.borderSoft }} />
                <Stack gap={10}>
                  <Row gap={10} align="center">
                    <span style={{ color: t.muted, display: 'inline-flex' }}>
                      <ProfileIcon kind="phone" size={13} />
                    </span>
                    <a
                      href="tel:+19515550123"
                      style={{
                        fontFamily: t.mono,
                        fontSize: 13,
                        color: t.ink,
                        textDecoration: 'none',
                        letterSpacing: 0.3,
                      }}
                    >
                      (951) 555-0123
                    </a>
                  </Row>
                  <Row gap={10} align="center">
                    <span style={{ color: t.muted, display: 'inline-flex' }}>
                      <ProfileIcon kind="mail" size={13} />
                    </span>
                    <a
                      href="mailto:antonio@vazantconsulting.com"
                      style={{
                        fontFamily: t.sans,
                        fontSize: 13,
                        color: t.ink,
                        textDecoration: 'none',
                      }}
                    >
                      antonio@vazantconsulting.com
                    </a>
                  </Row>
                </Stack>
              </Stack>
            </Card>
          </div>

          <div>
            <Stack gap={0}>
              {[
                { label: 'Help center', accent: false },
                { label: 'Privacy & security', accent: false },
                { label: 'Sign out', accent: true },
              ].map((a, i, arr) => (
                <button
                  key={a.label}
                  style={{
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    padding: '16px 4px',
                    borderBottom: i < arr.length - 1 ? `1px solid ${t.borderSoft}` : 'none',
                    cursor: 'pointer',
                    fontFamily: t.sans,
                    fontSize: 14,
                    color: a.accent ? t.rustInk : t.inkSoft,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>{a.label}</span>
                  {!a.accent && (
                    <span style={{ color: t.muted, display: 'inline-flex' }}>
                      <ProfileIcon kind="chevron" size={12} />
                    </span>
                  )}
                </button>
              ))}
            </Stack>
          </div>

          <div
            style={{
              paddingTop: 20,
              marginTop: 8,
              borderTop: `1px solid ${t.borderSoft}`,
              textAlign: 'center',
              fontFamily: t.mono,
              fontSize: 10,
              color: t.muted,
              letterSpacing: 0.8,
            }}
          >
            {firmDisplayName.toUpperCase()} · v1.0.0
          </div>
        </Stack>
      </div>
    </>
  );
}
