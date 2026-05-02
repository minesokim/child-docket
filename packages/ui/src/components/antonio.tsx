// Antonio's voice on screen — the three components that animate Antonio's
// presence in the client portal:
//   - AskAntonioBar: sticky pill at the bottom of intake screens, with
//     optional inline tip. Click → fires `ask-antonio:open` event.
//   - AskAntonioChat: global bottom-sheet modal that listens for that event.
//     Mount once at the (intake) layout level so any screen can trigger it.
//   - AntonioNote: sans-serif margin-note in Antonio's voice, with em-dash
//     signature line. Used inline in a screen, not as a sticky element.

import * as React from 'react';
import type { Theme } from '../tokens.js';
import { AvatarSlot } from './media.js';

// ────────────────────────────────────────────────────────────────
// AskAntonioBar — sticky pill at the bottom of intake screens.
// Click → dispatches `ask-antonio:open` event → AskAntonioChat opens.
// ────────────────────────────────────────────────────────────────

export function AskAntonioBar({
  t,
  onMessage,
  tip,
}: {
  t: Theme;
  onMessage?: () => void;
  /**
   * Optional contextual tip from Antonio. Renders INLINE at the top of
   * the bar (NOT a floating overlay). User-tested feedback: the floating
   * speech bubble blocked too much form content. Inline keeps the tip
   * always-visible without obscuring anything else on the page.
   *
   * Border + tint match the bar's rust-soft palette so the whole
   * component reads as one unified element.
   */
  tip?: string;
}) {
  const handleClick = () => {
    if (onMessage) onMessage();
    try {
      window.dispatchEvent(new CustomEvent('ask-antonio:open'));
    } catch {
      // SSR / missing window — no-op
    }
  };

  // When a tip is present the whole component becomes a rounded card with
  // two stacked rows (tip on top + ask on bottom). Without a tip it stays
  // the original pill shape.
  const hasTip = !!tip;

  // Visual posture: when there's a tip, the bar reads as a CARD with
  // soft elevation (Antonio is saying something useful). When there's
  // no tip, it shrinks to a calmer pill — no shadow, thinner border —
  // so it's there if you need it but not yelling at every screen.
  const elevated = hasTip;

  return (
    <div
      onClick={handleClick}
      style={{
        background: '#FFFFFF',
        border: `1px solid ${t.rustSoft}`,
        borderRadius: hasTip ? 18 : 999,
        boxShadow: elevated
          ? '0 6px 18px rgba(150, 60, 28, 0.10), 0 1px 2px rgba(60, 40, 28, 0.06)'
          : 'none',
        cursor: 'pointer',
        overflow: 'hidden',
        transition:
          'transform 160ms cubic-bezier(.2,.8,.2,1), box-shadow 160ms cubic-bezier(.2,.8,.2,1)',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
      }}
    >
      {/* Tip row — only renders when a tip is provided. Sits ABOVE the
          ask row, separated by a hairline divider in the same rust-soft
          tone as the outer border so the whole component reads as one.
          Avatar lives ONLY in the ask row below — the tip row uses the
          serif italic body + '— Antonio' signature line to signal whose
          voice this is. Two Antonio avatars stacked vertically read as
          duplication, so we keep just the one. */}
      {hasTip && (
        <div
          style={{
            padding: '12px 16px 13px',
            borderBottom: `1px solid ${t.rustSoft}`,
            background: t.tintAccent,
          }}
        >
          <div
            style={{
              fontFamily: t.serif,
              fontSize: 13.5,
              fontStyle: 'italic',
              lineHeight: 1.5,
              color: t.ink,
              letterSpacing: -0.1,
            }}
          >
            {tip}
          </div>
          <div
            style={{
              marginTop: 4,
              fontFamily: t.sans,
              fontSize: 11,
              color: t.muted,
              letterSpacing: 0.2,
            }}
          >
            — Antonio
          </div>
        </div>
      )}

      {/* Ask row — slim by default (avatar 24, smaller text, no shadow on
          button), elevates a touch when a tip is present (avatar 28). The
          calm sizing makes the bar a footer the user can ignore until
          they need it, instead of a status bar that always demands
          attention. */}
      <div
        style={{
          padding: hasTip ? '8px 10px 8px 12px' : '6px 8px 6px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: hasTip ? 11 : 9,
        }}
      >
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <AvatarSlot t={t} size={hasTip ? 28 : 24} />
          <div
            style={{
              position: 'absolute',
              bottom: -1,
              right: -1,
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#4a8f5f',
              border: `2px solid #FFFFFF`,
            }}
          />
        </div>
        <span
          style={{
            flex: 1,
            fontSize: hasTip ? 13 : 12.5,
            color: t.inkSoft,
            fontWeight: 400,
          }}
        >
          Not sure? Ask Antonio
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
          style={{
            padding: hasTip ? '6px 14px' : '5px 12px',
            fontSize: 12,
            fontWeight: 500,
            background: t.rust,
            color: '#fff',
            border: 'none',
            borderRadius: 999,
            cursor: 'pointer',
            fontFamily: t.sans,
            letterSpacing: -0.05,
          }}
        >
          Message
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// AskAntonioChat — global bottom-sheet modal. Listens for
// `ask-antonio:open` events. Renders chat thread + composer.
// Mount once at the (intake) layout level so any screen can trigger it.
// ────────────────────────────────────────────────────────────────

type ChatMsg = { from: 'a' | 'u'; text: string; time: string };

export function AskAntonioChat({ t }: { t: Theme }) {
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [messages, setMessages] = React.useState<ChatMsg[]>([
    { from: 'a', text: "Hey — I'm here. What can I help with?", time: '2:14 PM' },
  ]);
  const scrollerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('ask-antonio:open', onOpen);
    return () => window.removeEventListener('ask-antonio:open', onOpen);
  }, []);

  React.useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages, open]);

  const send = () => {
    if (!input.trim()) return;
    const msg = input.trim();
    const now = new Date();
    const time = `${((now.getHours() + 11) % 12) + 1}:${String(now.getMinutes()).padStart(2, '0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;
    setMessages((m) => [...m, { from: 'u', text: msg, time }]);
    setInput('');
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        { from: 'a', text: "Got it. Give me a few minutes — I'll come back with specifics.", time },
      ]);
    }, 1400);
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(32, 22, 16, 0.42)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'flex-end',
        backdropFilter: 'blur(2px)',
        animation: 'docket-fade-in 160ms ease-out',
      }}
      onClick={() => setOpen(false)}
    >
      <style>{`
        @keyframes docket-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes docket-slide-up { from { transform: translateY(100%) } to { transform: translateY(0) } }
      `}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          margin: '0 auto',
          height: '78%',
          background: t.bg,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          display: 'flex',
          flexDirection: 'column',
          animation: 'docket-slide-up 220ms cubic-bezier(.2,.8,.2,1)',
          overflow: 'hidden',
          boxShadow: '0 -12px 40px rgba(20,10,0,0.18)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 0' }}>
          <div style={{ width: 40, height: 4, background: t.border, borderRadius: 2 }} />
        </div>

        <div
          style={{
            padding: '14px 18px 14px',
            borderBottom: `1px solid ${t.borderSoft}`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ position: 'relative' }}>
            <AvatarSlot t={t} size={40} />
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 11,
                height: 11,
                borderRadius: '50%',
                background: '#4a8f5f',
                border: `2px solid ${t.bg}`,
              }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 500, color: t.ink, letterSpacing: -0.1 }}>
              Antonio Vazquez, EA
            </div>
            <div style={{ fontSize: 11.5, color: '#4a8f5f', fontFamily: t.mono, letterSpacing: 0.3 }}>
              ● Online · typically replies within an hour
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              border: 'none',
              background: t.bgElev,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke={t.inkSoft} strokeWidth="1.6" strokeLinecap="round">
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        </div>

        <div
          ref={scrollerRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 18px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: m.from === 'u' ? 'flex-end' : 'flex-start',
                gap: 3,
              }}
            >
              <div
                style={{
                  maxWidth: '80%',
                  padding: '10px 14px',
                  borderRadius: m.from === 'u' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: m.from === 'u' ? t.rust : t.card,
                  color: m.from === 'u' ? '#fff' : t.ink,
                  border: m.from === 'u' ? 'none' : `1px solid ${t.border}`,
                  fontSize: 14,
                  lineHeight: 1.4,
                  fontFamily: t.sans,
                }}
              >
                {m.text}
              </div>
              <div
                style={{
                  fontFamily: t.mono,
                  fontSize: 9.5,
                  color: t.muted,
                  letterSpacing: 0.4,
                  padding: '0 4px',
                }}
              >
                {m.time}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            padding: '12px 14px 18px',
            borderTop: `1px solid ${t.borderSoft}`,
            display: 'flex',
            alignItems: 'flex-end',
            gap: 8,
            background: t.bg,
          }}
        >
          <div
            style={{
              flex: 1,
              background: t.card,
              border: `1px solid ${t.border}`,
              borderRadius: 20,
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') send();
              }}
              placeholder="Type your question…"
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                // 16px+ prevents iOS Safari auto-zoom on focus
                fontSize: 16,
                fontFamily: t.sans,
                color: t.ink,
              }}
            />
          </div>
          <button
            onClick={send}
            disabled={!input.trim()}
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: input.trim() ? t.rust : t.border,
              border: 'none',
              cursor: input.trim() ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 120ms',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8l10-5-5 10-1.5-4.5L3 8z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// AntonioNote — sans-serif margin-note in Antonio's voice. Cream
// background, rust border, em-dash signature line. No credentials,
// no italics — clean and direct.
// ────────────────────────────────────────────────────────────────

export function AntonioNote({
  t,
  children,
  signature = 'Antonio',
}: {
  t: Theme;
  children: React.ReactNode;
  signature?: string;
}) {
  return (
    <div
      style={{
        marginTop: 10,
        background: t.tintAccent,
        border: `1px solid ${t.rustSoft}`,
        borderRadius: t.radius,
        padding: '16px 18px 14px',
      }}
    >
      <div
        style={{
          fontFamily: t.sans,
          fontSize: 14.5,
          lineHeight: 1.55,
          color: t.inkSoft,
          textWrap: 'pretty' as React.CSSProperties['textWrap'],
          letterSpacing: -0.05,
        }}
      >
        {children}
      </div>
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            fontFamily: t.sans,
            fontSize: 13,
            color: t.ink,
            lineHeight: 1,
            fontWeight: 500,
          }}
        >
          —{signature}
        </span>
      </div>
    </div>
  );
}
