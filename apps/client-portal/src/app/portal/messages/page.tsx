'use client';

// Returning portal — Messages tab.
//
// Audit (2026-05-15) caught this page rendering a hardcoded conversation
// between "Maria" and Antonio about a Stripe 1099-K to EVERY real
// client — mock data leaking to live users. The replacement: a clean
// empty state that's honest about the feature's wire-up status, plus
// the existing header so visual identity carries through.
//
// The full Messages surface (DB-backed thread between client + Antonio,
// AI-system "answer" cards driven by the triage-classifier, attach-
// photo flow) is queued for Phase 2. Until that ships, this page
// shows nothing rather than something fake.
//
// Removed in this commit (was mock-only):
//   - Hardcoded chat bubbles ("Hey Maria - I'm finishing up your return"
//     etc., the FRIDAY/APRIL 4 date header, the 1099-K Stripe attachment
//     reference, the "11 of 12 documents" system card, the "Antonio
//     uploaded your return for review" system card, the TODAY date
//     header with the 8879-ready message)
//   - The sticky send-input bar at the bottom (had no submit handler;
//     would have misled users into thinking messages got delivered).
//
// What still renders (intentional):
//   - The header strip with Antonio's avatar + name + the ENCRYPTED
//     · PORTAL MESSAGES sub-line. Tenant-hardcoded "Antonio Vazquez"
//     string here is the same hardcode the engagement-letter +
//     §7216-consent pages carry, and it's all getting fixed together
//     in the Vazant-hardcoding commit (audit punch-list Task 10).
//     Leaving in this commit so the diff stays scoped to the
//     mock-data removal.

import { AvatarSlot, buildTheme, Row } from '@docket/ui';

export default function PortalMessagesPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div
        style={{
          padding: '16px 20px 12px',
          borderBottom: `1px solid ${t.borderSoft}`,
        }}
      >
        <Row gap={12}>
          <AvatarSlot t={t} size={40} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: t.serif, fontSize: 17, color: t.ink }}>
              Antonio Vazquez
            </div>
            <Row gap={5}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <rect x="2" y="4.5" width="6" height="4" rx="0.5" stroke={t.muted} strokeWidth="0.9" />
                <path d="M3.5 4.5V3.5a1.5 1.5 0 013 0v1" stroke={t.muted} strokeWidth="0.9" />
              </svg>
              <div
                style={{
                  fontFamily: t.mono,
                  fontSize: 10,
                  color: t.muted,
                  letterSpacing: 0.4,
                }}
              >
                ENCRYPTED · PORTAL MESSAGES
              </div>
            </Row>
          </div>
        </Row>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 32px',
        }}
      >
        <div style={{ maxWidth: 320, textAlign: 'center' }}>
          <div
            style={{
              width: 56,
              height: 56,
              margin: '0 auto 20px',
              borderRadius: 14,
              background: t.bgElev,
              border: `1px solid ${t.borderSoft}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path
                d="M4 8a3 3 0 013-3h8a3 3 0 013 3v5a3 3 0 01-3 3H9l-4 3v-3a3 3 0 01-1-2V8z"
                stroke={t.muted}
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div
            style={{
              fontFamily: t.serif,
              fontSize: 19,
              color: t.ink,
              marginBottom: 8,
            }}
          >
            No messages yet
          </div>
          <div
            style={{
              fontSize: 14,
              color: t.inkSoft,
              lineHeight: 1.5,
              marginBottom: 14,
            }}
          >
            When Antonio sends you an update or needs something for your
            return, the conversation will appear here. We&apos;ll also
            text you so you don&apos;t have to keep checking back.
          </div>
          <div
            style={{
              fontFamily: t.mono,
              fontSize: 10,
              color: t.muted,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            Two-way messaging is wired up in Phase 2
          </div>
        </div>
      </div>
    </div>
  );
}
