// Antonio's voice on screen — three components that together feel like
// ONE continuous conversation between the client and Antonio:
//
//   - AntonioNote: a per-page message Antonio drops at the top of the
//     screen, framing the question before the client answers (NEW
//     visual — see component-level header). One note per page.
//   - AskAntonioBar: a sticky rail at the bottom of every page. Reads
//     as the conversation continuing — tap it to open the full thread
//     and reply. The label is "Continue with Antonio," not "ask
//     question," because the user isn't filing a help ticket — they're
//     keeping a thread alive.
//   - AskAntonioChat: bottom-sheet modal that opens when the rail is
//     tapped. Holds the full scrollback + composer. Mount once at the
//     (intake) layout so any page can dispatch the open event.
//
// Conceptual shift from v0: the page-level note + the bottom rail are
// not two separate features. They're message + read-receipt-rail of
// the same chat. Future work (deferred): wire AskAntonioChat to render
// the full scrollback of every AntonioNote across the intake instead
// of just its own internal message list.

import * as React from 'react';
import type { Theme } from '../tokens.js';
import { AvatarSlot } from './media.js';

// ────────────────────────────────────────────────────────────────
// AskAntonioBar — sticky bottom rail.
//
// Behavior: tap anywhere on the rail (or the explicit "Open chat"
// button) to dispatch `ask-antonio:open`. AskAntonioChat is mounted
// once in the intake layout and listens for that event.
//
// Design intent: the rail is the conversation affordance — the same
// thread the page-level AntonioNote at the top is part of. Label is
// "Ask Antonio" because that's the simple, direct ask the client
// would actually say out loud. Avatar carries the same green online-
// dot as in the chat-modal header so the rail and the chat feel like
// one surface.
// ────────────────────────────────────────────────────────────────

export function AskAntonioBar({
  t,
  onMessage,
}: {
  t: Theme;
  onMessage?: () => void;
}) {
  const handleClick = () => {
    if (onMessage) onMessage();
    try {
      window.dispatchEvent(new CustomEvent('ask-antonio:open'));
    } catch {
      // SSR / missing window — no-op
    }
  };

  return (
    <div
      onClick={handleClick}
      style={{
        background: '#FFFFFF',
        // Zero stroke. Soft drop shadow carries elevation instead of an
        // outline — matches ease's white-card-with-shadow pattern (e.g.,
        // the "Call with Daniel" tile in CRM).
        border: 'none',
        borderRadius: 999,
        boxShadow: '0 2px 10px rgba(15, 62, 23, 0.08)',
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'transform 160ms cubic-bezier(.2,.8,.2,1), box-shadow 160ms cubic-bezier(.2,.8,.2,1)',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(-1px)';
        el.style.boxShadow = '0 4px 14px rgba(15, 62, 23, 0.12)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(0)';
        el.style.boxShadow = '0 2px 10px rgba(15, 62, 23, 0.08)';
      }}
    >
      <div
        style={{
          // ~15% bump from the previous 6/8/6/10 padding + 24px avatar.
          // Bigger feels less hesitant — the rail is the conversation
          // affordance, not a footnote.
          padding: '7px 10px 7px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 11,
        }}
      >
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <AvatarSlot t={t} size={28} />
          <div
            style={{
              position: 'absolute',
              bottom: -1,
              right: -1,
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: '#4a8f5f',
              border: `2px solid #FFFFFF`,
            }}
          />
        </div>
        <span
          style={{
            flex: 1,
            fontSize: 14,
            color: t.inkSoft,
            fontWeight: 400,
          }}
        >
          Ask Antonio
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
          style={{
            padding: '6px 14px',
            fontSize: 13,
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
          Open chat
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// AskAntonioChat — global bottom-sheet modal. Listens for
// `ask-antonio:open` events. Renders chat thread + composer.
// Mount once at the (intake) layout level so any screen can trigger it.
//
// Visual: ease.health conversation pattern. Zero strokes. Top of the
// thread carries a sage notification banner (bell icon in a white
// circle + a system status line), then message bubbles in soft mint:
//   - Antonio (incoming): keylimeWash fill, left-aligned
//   - Client (outgoing):  mintGlaze fill, right-aligned
// Sender name + timestamp live INSIDE each bubble at the bottom — name
// in forestDark medium, timestamp muted forestDark right-aligned.
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
          height: '82%',
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
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 0' }}>
          <div style={{ width: 40, height: 4, background: t.ease.keylimeWash, borderRadius: 2 }} />
        </div>

        {/* Header — avatar + name + close. No bottom stroke. */}
        <div
          style={{
            padding: '14px 18px 14px',
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
                boxShadow: `0 0 0 2px ${t.bg}`,
              }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: t.ease.forestDark, letterSpacing: -0.45 }}>
              Antonio Vazquez, EA
            </div>
            {/* No bullet — the green dot on the avatar already carries the
                online signal. A second indicator next to "Online" was
                redundant. */}
            <div style={{ fontSize: 12, color: '#4a8f5f', letterSpacing: -0.36, marginTop: 1 }}>
              Online · typically replies within an hour
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: 'none',
              background: t.ease.keylimeWash,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: t.ease.forestDark,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        </div>

        {/* Thread scroller */}
        <div
          ref={scrollerRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 18px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* System notification banner — like ease's "Your clinical
              documentation has been completed for review" tile. Pinned
              at the top of the scrollback. */}
          <div
            style={{
              background: t.ease.mintGlaze,
              borderRadius: 14,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              marginBottom: 4,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: '#fffefc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: t.ease.forestDark,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3.5 11.5h9l-1-1.5V7a3.5 3.5 0 00-7 0v3l-1 1.5z" />
                <path d="M6.5 13.5a1.5 1.5 0 003 0" />
              </svg>
            </div>
            <div
              style={{
                flex: 1,
                fontFamily: t.sans,
                fontSize: 14,
                lineHeight: 1.5,
                color: t.ease.forestDark,
                letterSpacing: -0.42,
              }}
            >
              Antonio is reviewing your intake. He&apos;ll reach out within 24 hours.
            </div>
          </div>

          {messages.map((m, i) => {
            const isUser = m.from === 'u';
            const senderName = isUser ? 'You' : 'Antonio';
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isUser ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '82%',
                    padding: '14px 16px 12px',
                    borderRadius: 16,
                    // Antonio (incoming): warm tan bubble — feels like
                    // a letter from the firm. Client (outgoing): light
                    // mint, the same palette the inputs use. Keeps the
                    // "you = mint, Antonio = warm" reading consistent.
                    background: isUser ? t.ease.keylimeWash : t.ease.warmTan,
                    color: t.ease.forestDark,
                    fontFamily: t.sans,
                  }}
                >
                  <div style={{ fontSize: 15, lineHeight: 1.5, letterSpacing: -0.45, marginBottom: 8 }}>
                    {m.text}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      fontSize: 12,
                      letterSpacing: -0.36,
                    }}
                  >
                    <span style={{ fontWeight: 500, color: t.ease.forestDark }}>{senderName}</span>
                    <span style={{ color: t.ease.forestDark, opacity: 0.5 }}>{m.time}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Composer — strokeless. Input pill is neutral (softNeutral)
            so it doesn't compete with the bubble palette above. */}
        <div
          style={{
            padding: '12px 14px 18px',
            display: 'flex',
            alignItems: 'flex-end',
            gap: 8,
            background: t.bg,
          }}
        >
          <div
            style={{
              flex: 1,
              background: t.ease.softNeutral,
              borderRadius: 20,
              padding: '10px 16px',
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
                color: t.ease.forestDark,
                letterSpacing: -0.48,
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
              // Active: forestDark fill (clear forest green, no orange
              // cast). Inactive: keylimeWash with muted icon — sits
              // calmly in the soft palette without an "orange-tan disabled"
              // look.
              background: input.trim() ? t.ease.forestDark : t.ease.keylimeWash,
              border: 'none',
              cursor: input.trim() ? 'pointer' : 'not-allowed',
              color: input.trim() ? '#fffefc' : t.ease.forestDark,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 120ms, color 120ms',
              opacity: input.trim() ? 1 : 0.4,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8l10-5-5 10-1.5-4.5L3 8z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// AntonioNote — Antonio's voice as a near-message at the top of an
// intake page. Lives directly under the H1+Body subheading and above
// the first form section, where it can frame the question before the
// client commits to an answer.
//
// Visual: 26px avatar + plain Fraunces body, sitting on the cream
// page background. NO container, NO italic, NO "— Antonio" signoff.
// The avatar IS the signature. Italics are a quotation convention
// and Antonio isn't quoting anyone — he's talking. Stripping the
// chrome makes the note feel like a person saying something, not a
// magazine pull-quote.
//
// Pair with `<AskAntonioBar t={t} />` at the bottom of the page —
// together they're the same conversation: Antonio's framing message
// up top, the rail to continue the thread below.
// ────────────────────────────────────────────────────────────────

export function AntonioNote({
  t,
  children,
  avatarSize = 26,
}: {
  t: Theme;
  children: React.ReactNode;
  /** Override avatar diameter. Defaults to 26px — small enough to
   *  read as a signature next to the text, large enough to recognize. */
  avatarSize?: number;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        // Lives directly under the H1+Body block. Vertical breathing
        // room is set by the caller via the Stack gap, not by margin
        // here — keeps the primitive composable.
      }}
    >
      <AvatarSlot t={t} size={avatarSize} />
      <div
        style={{
          flex: 1,
          paddingTop: Math.max(0, (avatarSize - 22) / 2),
          fontFamily: t.serif,
          fontSize: 15.5,
          lineHeight: 1.5,
          color: t.inkSoft,
          letterSpacing: -0.15,
          textWrap: 'pretty' as React.CSSProperties['textWrap'],
        }}
      >
        {children}
      </div>
    </div>
  );
}

