'use client';

// Returning portal — Messages tab. Chat thread w/ Antonio + system "answer"
// cards (the AI auto-responder for factual questions). 1-to-1 port of
// ScreenMessages.

import { AvatarSlot, buildTheme, Row } from '@docket/ui';
import type { Theme } from '@docket/ui';
import * as React from 'react';

function Bubble({
  t,
  from,
  time,
  attachment,
  children,
}: {
  t: Theme;
  from: 'me' | 'them';
  time?: string;
  attachment?: string;
  children?: React.ReactNode;
}) {
  const mine = from === 'me';
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: mine ? 'flex-end' : 'flex-start',
        marginBottom: 4,
      }}
    >
      <div style={{ maxWidth: '78%' }}>
        <div
          style={{
            background: mine ? t.rust : t.card,
            color: mine ? '#fff' : t.ink,
            border: mine ? 'none' : `1px solid ${t.border}`,
            borderRadius: 18,
            borderBottomRightRadius: mine ? 4 : 18,
            borderBottomLeftRadius: mine ? 18 : 4,
            padding: attachment ? '8px 8px 10px' : '10px 14px',
            fontSize: 14.5,
            lineHeight: 1.45,
          }}
        >
          {attachment && (
            <div
              style={{
                background: mine ? 'rgba(255,255,255,0.12)' : t.bgElev,
                border: mine ? '1px solid rgba(255,255,255,0.16)' : `1px solid ${t.borderSoft}`,
                padding: '8px 10px',
                borderRadius: 10,
                fontSize: 12.5,
                color: mine ? 'rgba(255,255,255,0.95)' : t.ink,
                fontFamily: t.mono,
                letterSpacing: 0.2,
                marginBottom: children ? 8 : 0,
              }}
            >
              📎 {attachment}
            </div>
          )}
          {children && <div style={{ padding: attachment ? '0 6px' : 0 }}>{children}</div>}
        </div>
        {time && (
          <div
            style={{
              textAlign: mine ? 'right' : 'left',
              fontSize: 10,
              color: t.muted,
              fontFamily: t.mono,
              letterSpacing: 0.3,
              marginTop: 4,
              padding: '0 8px',
            }}
          >
            {time}
          </div>
        )}
      </div>
    </div>
  );
}

function SystemCard({
  t,
  time,
  title = 'Status',
  kind = 'info',
  children,
}: {
  t: Theme;
  time?: string;
  title?: string;
  kind?: 'info' | 'answer';
  children: React.ReactNode;
}) {
  const isAnswer = kind === 'answer';
  return (
    <div style={{ margin: '14px 0', display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          width: '100%',
          maxWidth: '92%',
          background: t.card,
          border: `1px solid ${t.border}`,
          borderLeft: `3px solid ${isAnswer ? t.rust : t.inkSoft}`,
          borderRadius: t.radius,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px 6px',
            borderBottom: `1px solid ${t.borderSoft}`,
            background: t.bgElev,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <rect
              x="1"
              y="1"
              width="4"
              height="4"
              rx="0.5"
              fill="none"
              stroke={isAnswer ? t.rust : t.inkSoft}
              strokeWidth="1"
            />
            <rect x="7" y="1" width="4" height="4" rx="0.5" fill={isAnswer ? t.rust : t.inkSoft} />
            <rect x="1" y="7" width="4" height="4" rx="0.5" fill={isAnswer ? t.rust : t.inkSoft} />
            <rect
              x="7"
              y="7"
              width="4"
              height="4"
              rx="0.5"
              fill="none"
              stroke={isAnswer ? t.rust : t.inkSoft}
              strokeWidth="1"
            />
          </svg>
          <span
            style={{
              fontFamily: t.serif,
              fontStyle: 'italic',
              fontSize: 13,
              color: isAnswer ? t.rustInk : t.inkSoft,
              flex: 1,
            }}
          >
            {title}
          </span>
          {time && (
            <span
              style={{
                fontFamily: t.mono,
                fontSize: 9,
                color: t.muted,
                letterSpacing: 0.4,
              }}
            >
              {time}
            </span>
          )}
        </div>

        <div
          style={{
            padding: '10px 14px 12px',
            fontSize: 13.5,
            color: t.inkSoft,
            lineHeight: 1.45,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default function PortalMessagesPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const [draft, setDraft] = React.useState('');

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
            <div style={{ fontFamily: t.serif, fontSize: 17, color: t.ink }}>Antonio Vazquez</div>
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

      <div style={{ padding: '16px 20px', flex: 1 }}>
        <div
          style={{
            textAlign: 'center',
            fontFamily: t.mono,
            fontSize: 10,
            color: t.muted,
            letterSpacing: 0.5,
            marginBottom: 14,
          }}
        >
          FRIDAY, APRIL 4
        </div>

        <Bubble t={t} from="them" time="10:24 AM">
          Hey Maria — I&apos;m finishing up your return. Could you send a photo of your 1099-K from
          Stripe when you get a moment?
        </Bubble>

        <Bubble t={t} from="me" time="11:02 AM" attachment="1099-K_Stripe_2025.jpg · 1.2MB" />

        <Bubble t={t} from="me" time="11:02 AM">
          Here it is! Let me know if you need anything else.
        </Bubble>

        <Bubble t={t} from="them" time="11:08 AM">
          Got it, thanks. Already reading cleanly — I&apos;ll flag if anything else comes up.
        </Bubble>

        <Bubble t={t} from="me" time="4:31 PM">
          How many documents am I still missing?
        </Bubble>

        <SystemCard t={t} time="4:31 PM" title="Status · Document check" kind="answer">
          <div style={{ marginBottom: 8 }}>
            You&apos;ve uploaded{' '}
            <span style={{ color: t.rustInk, fontFamily: t.mono, fontWeight: 500 }}>
              11 of 12
            </span>{' '}
            required documents.
          </div>
          <div
            style={{
              fontFamily: t.mono,
              fontSize: 10,
              color: t.muted,
              letterSpacing: 1,
              marginBottom: 6,
              textTransform: 'uppercase',
            }}
          >
            Still needed
          </div>
          <div
            style={{
              padding: '8px 10px',
              background: t.bgElev,
              border: `1px solid ${t.borderSoft}`,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 5,
                background: t.tintAccent,
                border: `1px solid ${t.rustSoft}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: t.mono,
                fontSize: 9,
                color: t.rustInk,
                fontWeight: 600,
                letterSpacing: 0.3,
                flexShrink: 0,
              }}
            >
              DIV
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: t.ink }}>Form 1099-DIV</div>
              <div style={{ fontSize: 11, color: t.muted }}>
                From Fidelity · any dividends received
              </div>
            </div>
          </div>
          <div
            style={{
              marginTop: 10,
              paddingTop: 8,
              borderTop: `1px dashed ${t.borderSoft}`,
              fontSize: 11.5,
              color: t.muted,
              fontStyle: 'italic',
            }}
          >
            Need something more specific? Just keep typing and Antonio will get back to you.
          </div>
        </SystemCard>

        <SystemCard t={t} time="APR 8 · 2:10 PM" kind="info">
          Antonio uploaded your return for review.
        </SystemCard>

        <div
          style={{
            textAlign: 'center',
            fontFamily: t.mono,
            fontSize: 10,
            color: t.muted,
            letterSpacing: 0.5,
            margin: '14px 0',
          }}
        >
          TODAY
        </div>

        <Bubble t={t} from="them" time="1:45 PM">
          Return&apos;s ready. You can view it in the portal. Once you pay the balance, I&apos;ll
          send the 8879.
        </Bubble>
      </div>

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          padding: '10px 14px 14px',
          background: t.bgElev,
          borderTop: `1px solid ${t.borderSoft}`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          zIndex: 5,
        }}
      >
        <button
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: t.card,
            border: `1px solid ${t.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            cursor: 'pointer',
          }}
          aria-label="Attach photo"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1.5" y="3" width="13" height="10" rx="1.5" stroke={t.inkSoft} strokeWidth="1.3" />
            <circle cx="8" cy="8" r="2.5" stroke={t.inkSoft} strokeWidth="1.3" />
          </svg>
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message Antonio…"
          style={{
            flex: 1,
            padding: '10px 14px',
            background: t.card,
            border: `1px solid ${t.border}`,
            borderRadius: 999,
            fontSize: 16,
            color: t.ink,
            outline: 'none',
            fontFamily: t.sans,
          }}
        />
        <button
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: draft.trim() ? t.rust : t.borderSoft,
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            cursor: draft.trim() ? 'pointer' : 'default',
          }}
          aria-label="Send message"
          disabled={!draft.trim()}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M2 7h10M8 3l4 4-4 4"
              stroke={draft.trim() ? '#fff' : t.muted}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
