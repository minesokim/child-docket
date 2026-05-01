// Docket UI primitives — ported from the Vazant v4 prototype's tokens.jsx.
// Inline styles are PRESERVED on purpose: design fidelity is non-negotiable
// (per CLAUDE.md and the strategic anchor). Tailwind handles layout utilities
// elsewhere; visual style lives in these primitives.

import * as React from 'react';
import type { Theme } from './tokens.js';

type StyleProp = React.CSSProperties | undefined;

// ────────────────────────────────────────────────────────────────
// Layout primitives
// ────────────────────────────────────────────────────────────────

export function Screen({
  t,
  children,
  style,
}: {
  t: Theme;
  children: React.ReactNode;
  style?: StyleProp;
}) {
  return (
    <div
      style={{
        background: t.bg,
        color: t.ink,
        fontFamily: t.sans,
        // 100dvh = dynamic viewport height (Mobile Safari excludes the URL bar
        // when collapsed). This makes Screen the scroll container so sticky
        // header + sticky bottom bar both anchor reliably.
        height: '100dvh',
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitFontSmoothing: 'antialiased',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Stack({
  gap = 12,
  children,
  style,
}: {
  gap?: number;
  children: React.ReactNode;
  style?: StyleProp;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap, ...style }}>
      {children}
    </div>
  );
}

export function Row({
  gap = 8,
  align = 'center',
  justify = 'flex-start',
  children,
  style,
}: {
  gap?: number;
  align?: React.CSSProperties['alignItems'];
  justify?: React.CSSProperties['justifyContent'];
  children: React.ReactNode;
  style?: StyleProp;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: align,
        justifyContent: justify,
        gap,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Card
// ────────────────────────────────────────────────────────────────

export function Card({
  t,
  children,
  style,
  onClick,
  selected,
  tinted,
}: {
  t: Theme;
  children: React.ReactNode;
  style?: StyleProp;
  onClick?: () => void;
  selected?: boolean;
  tinted?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: tinted ? t.tintAccent : t.card,
        border: `1px solid ${selected ? t.rust : t.border}`,
        borderRadius: t.radius,
        padding: t.pad,
        transition: 'all 0.15s ease',
        cursor: onClick ? 'pointer' : 'default',
        ...(selected && t.tone === 'magazine' ? { borderWidth: 2 } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Button
// ────────────────────────────────────────────────────────────────

export function Button({
  t,
  variant = 'primary',
  children,
  onClick,
  disabled,
  style,
  icon,
  type = 'button',
}: {
  t: Theme;
  variant?: 'primary' | 'success' | 'ghost' | 'dark';
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  style?: StyleProp;
  icon?: React.ReactNode;
  type?: 'button' | 'submit';
}) {
  const variants = {
    primary: { bg: t.rust, fg: '#fff', border: t.rust },
    success: { bg: t.green, fg: '#fff', border: t.green },
    ghost: { bg: 'transparent', fg: t.ink, border: t.border },
    dark: { bg: t.ink, fg: t.bgElev, border: t.ink },
  };
  const base = variants[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? t.borderSoft : base.bg,
        color: disabled ? t.muted : base.fg,
        border: `1px solid ${disabled ? t.border : base.border}`,
        borderRadius: t.tone === 'magazine' ? 4 : 999,
        padding: '14px 22px',
        fontFamily: t.sans,
        fontSize: 16,
        fontWeight: 500,
        letterSpacing: -0.1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        ...style,
      }}
    >
      {children}
      {icon}
    </button>
  );
}

// ────────────────────────────────────────────────────────────────
// Typography
// ────────────────────────────────────────────────────────────────

export function Eyebrow({
  t,
  children,
  style,
}: {
  t: Theme;
  children: React.ReactNode;
  style?: StyleProp;
}) {
  return (
    <div
      style={{
        fontFamily: t.mono,
        fontSize: 10.5,
        fontWeight: 500,
        letterSpacing: 1.2,
        color: t.muted,
        textTransform: 'uppercase',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function H1({
  t,
  children,
  style,
}: {
  t: Theme;
  children: React.ReactNode;
  style?: StyleProp;
}) {
  return (
    <h1
      style={{
        fontFamily: t.serif,
        fontWeight: 400,
        fontSize: 34,
        lineHeight: 1.12,
        letterSpacing: -0.8,
        margin: 0,
        color: t.ink,
        textWrap: 'pretty' as React.CSSProperties['textWrap'],
        ...style,
      }}
    >
      {children}
    </h1>
  );
}

export function H2({
  t,
  children,
  style,
}: {
  t: Theme;
  children: React.ReactNode;
  style?: StyleProp;
}) {
  return (
    <h2
      style={{
        fontFamily: t.serif,
        fontWeight: 400,
        fontSize: 24,
        lineHeight: 1.2,
        letterSpacing: -0.4,
        margin: 0,
        color: t.ink,
        textWrap: 'pretty' as React.CSSProperties['textWrap'],
        ...style,
      }}
    >
      {children}
    </h2>
  );
}

export function Body({
  t,
  muted,
  mono,
  size = 15,
  children,
  style,
}: {
  t: Theme;
  muted?: boolean;
  mono?: boolean;
  size?: number;
  children: React.ReactNode;
  style?: StyleProp;
}) {
  return (
    <p
      style={{
        fontFamily: mono ? t.mono : t.sans,
        fontSize: size,
        lineHeight: 1.5,
        color: muted ? t.muted : t.inkSoft,
        margin: 0,
        textWrap: 'pretty' as React.CSSProperties['textWrap'],
        ...style,
      }}
    >
      {children}
    </p>
  );
}

// ────────────────────────────────────────────────────────────────
// ProgressBar — module-level memory so it animates across route changes.
// ────────────────────────────────────────────────────────────────

const __progressLast = { pct: 0, total: 0 };

export function ProgressBar({
  t,
  value,
  total = 100,
}: {
  t: Theme;
  value: number;
  total?: number;
}) {
  const target = Math.min(100, Math.max(0, (value / total) * 100));
  const [pct, setPct] = React.useState(() =>
    __progressLast.total === total ? __progressLast.pct : 0,
  );
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setPct(target));
    __progressLast.pct = target;
    __progressLast.total = total;
    return () => cancelAnimationFrame(id);
  }, [target, total]);
  return (
    <div
      style={{
        height: t.tone === 'magazine' ? 4 : 3,
        background: t.borderSoft,
        borderRadius: 999,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: t.rust,
          transition: 'width 720ms cubic-bezier(0.22, 0.61, 0.36, 1)',
        }}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Placeholder + AvatarSlot
// ────────────────────────────────────────────────────────────────

export function Placeholder({
  t,
  label,
  w = '100%',
  h = 60,
  style,
}: {
  t: Theme;
  label: string;
  w?: number | string;
  h?: number | string;
  style?: StyleProp;
}) {
  return (
    <div
      style={{
        width: w,
        height: h,
        border: `1px dashed ${t.border}`,
        borderRadius: t.radius,
        background: `repeating-linear-gradient(135deg, transparent, transparent 8px, ${t.borderSoft} 8px, ${t.borderSoft} 9px)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: t.mono,
        fontSize: 10,
        color: t.muted,
        letterSpacing: 0.5,
        ...style,
      }}
    >
      {label}
    </div>
  );
}

export function AvatarSlot({
  t,
  size = 56,
  src = '/antonio.webp',
  label = 'A',
  style,
}: {
  t: Theme;
  size?: number;
  src?: string;
  label?: string;
  style?: StyleProp;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        border: `1px solid ${t.border}`,
        flexShrink: 0,
        background: t.bgElev,
        ...style,
      }}
    >
      <img
        src={src}
        alt={label}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: '50% 22%',
          display: 'block',
        }}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// VideoPlaceholder — leafy green tinted "A message from Antonio"
// video tile shown on Welcome screen.
// ────────────────────────────────────────────────────────────────

export function VideoPlaceholder({ t }: { t: Theme }) {
  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '16 / 9',
        borderRadius: t.radius,
        overflow: 'hidden',
        position: 'relative',
        background: 'linear-gradient(135deg, #1a3a26 0%, #0c1f15 70%, #050a07 100%)',
        cursor: 'pointer',
        boxShadow: '0 8px 24px rgba(12, 31, 21, 0.18)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at 25% 20%, rgba(120, 180, 140, 0.12), transparent 55%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.015) 2px, rgba(255,255,255,0.015) 3px)',
          mixBlendMode: 'overlay',
        }}
      />

      <div style={{ position: 'absolute', top: 14, left: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#d94545',
            boxShadow: '0 0 0 3px rgba(217, 69, 69, 0.22)',
          }}
        />
        <span
          style={{
            fontFamily: t.mono,
            fontSize: 9.5,
            color: 'rgba(255,255,255,0.75)',
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          }}
        >
          REC · ANTONIO
        </span>
      </div>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
        }}
      >
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.15)',
            border: '1.5px solid rgba(255, 255, 255, 0.35)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
            transition: 'transform 0.15s',
          }}
        >
          <svg width="22" height="24" viewBox="0 0 22 24" fill="none" style={{ marginLeft: 4 }}>
            <path d="M2 2 L20 12 L2 22 Z" fill="#fff" />
          </svg>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: t.serif,
              fontSize: 17,
              color: '#fff',
              letterSpacing: -0.2,
              fontStyle: 'italic',
              marginBottom: 4,
            }}
          >
            A message from Antonio
          </div>
          <div
            style={{
              fontFamily: t.mono,
              fontSize: 10.5,
              color: 'rgba(255,255,255,0.6)',
              letterSpacing: 0.8,
            }}
          >
            1:12 · TAP TO PLAY
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 10,
          left: 14,
          right: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          style={{
            fontFamily: t.mono,
            fontSize: 9,
            color: 'rgba(255,255,255,0.55)',
            letterSpacing: 0.5,
          }}
        >
          0:00
        </span>
        <div style={{ flex: 1, height: 2, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
        <span
          style={{
            fontFamily: t.mono,
            fontSize: 9,
            color: 'rgba(255,255,255,0.55)',
            letterSpacing: 0.5,
          }}
        >
          1:12
        </span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// TrustPill — used on Welcome to display AES-256, EA, ~10 min badges.
// ────────────────────────────────────────────────────────────────

export function TrustPill({
  t,
  children,
  icon,
}: {
  t: Theme;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 11px',
        background: t.bgElev,
        border: `1px solid ${t.borderSoft}`,
        borderRadius: 999,
        fontFamily: t.sans,
        fontSize: 11,
        color: t.inkSoft,
        letterSpacing: 0.1,
      }}
    >
      {icon}
      {children}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// AskAntonioBar — sticky pill at the bottom of intake screens.
// Click → dispatches `ask-antonio:open` event → AskAntonioChat opens.
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
        background: t.card,
        border: `1px solid ${t.border}`,
        borderRadius: 999,
        padding: '6px 8px 6px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        boxShadow: '0 4px 12px rgba(60, 40, 28, 0.04)',
        cursor: 'pointer',
      }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <AvatarSlot t={t} size={30} />
        <div
          style={{
            position: 'absolute',
            bottom: -1,
            right: -1,
            width: 9,
            height: 9,
            borderRadius: '50%',
            background: '#4a8f5f',
            border: `2px solid ${t.card}`,
          }}
        />
      </div>
      <span style={{ flex: 1, fontSize: 12.5, color: t.inkSoft }}>
        Not sure? Ask Antonio
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleClick();
        }}
        style={{
          padding: '6px 14px',
          fontSize: 12,
          fontWeight: 500,
          background: t.rust,
          color: '#fff',
          border: 'none',
          borderRadius: 999,
          cursor: 'pointer',
          fontFamily: t.sans,
        }}
      >
        Message
      </button>
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
// Intake form primitives — FieldLabel, TextField, SSNField.
// Used across personal, spouse, state, dependents, business screens.
// ────────────────────────────────────────────────────────────────

export function FieldLabel({
  t,
  children,
  hint,
}: {
  t: Theme;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <Row justify="space-between" align="baseline" style={{ marginBottom: 6 }}>
      <span
        style={{
          fontFamily: t.sans,
          fontSize: 12,
          color: t.muted,
          fontWeight: 500,
          letterSpacing: 0,
        }}
      >
        {children}
      </span>
      {hint && (
        <span
          style={{
            fontFamily: t.mono,
            fontSize: 10,
            color: t.muted,
            letterSpacing: 0.4,
          }}
        >
          {hint}
        </span>
      )}
    </Row>
  );
}

export function TextField({
  t,
  value,
  onChange,
  placeholder,
  mono,
  inputMode,
  type = 'text',
  readOnly,
  style,
  autoComplete,
}: {
  t: Theme;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  type?: 'text' | 'email' | 'tel';
  readOnly?: boolean;
  style?: StyleProp;
  autoComplete?: string;
}) {
  return (
    <input
      type={type}
      inputMode={inputMode}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      autoComplete={autoComplete}
      style={{
        width: '100%',
        background: 'transparent',
        border: 'none',
        borderBottom: `1px solid ${t.border}`,
        padding: '10px 0 10px',
        fontSize: 16,
        color: t.ink,
        fontFamily: mono ? t.mono : t.sans,
        letterSpacing: mono ? 0.3 : 0,
        outline: 'none',
        ...style,
      }}
      onFocus={(e) => {
        e.target.style.borderBottomColor = t.rust;
      }}
      onBlur={(e) => {
        e.target.style.borderBottomColor = t.border;
      }}
    />
  );
}

// SSN field — masked display with last 4 visible + ENCRYPTED chip when complete.
// While typing (< 9 digits), shows a controlled input with auto-format XXX-XX-XXXX.
// On blur (when 9 digits), switches to the masked display from the JSX prototype.
export function SSNField({
  t,
  value,
  onChange,
}: {
  t: Theme;
  value: string;          // raw 9-digit string (no dashes), or ''
  onChange: (raw: string) => void;
}) {
  const [editing, setEditing] = React.useState(value.length < 9);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const formatted = formatSsn(value);
  const lastFour = value.length >= 4 ? value.slice(-4) : '••••';
  const complete = value.length === 9;

  React.useEffect(() => {
    if (!complete) setEditing(true);
  }, [complete]);

  if (editing) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 0 10px',
          borderBottom: `1px solid ${t.border}`,
        }}
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={formatted}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 9);
            onChange(digits);
          }}
          onBlur={() => {
            if (complete) setEditing(false);
          }}
          placeholder="•••–••–••••"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            padding: 0,
            fontFamily: t.mono,
            fontSize: 16,
            color: t.ink,
            letterSpacing: 1.5,
            outline: 'none',
          }}
        />
        <EncryptedPill t={t} />
      </div>
    );
  }

  return (
    <div
      onClick={() => {
        setEditing(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 0 10px',
        borderBottom: `1px solid ${t.border}`,
        cursor: 'text',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flex: 1 }}>
        <span
          style={{
            fontFamily: t.mono,
            fontSize: 14,
            color: t.muted,
            letterSpacing: 2,
            lineHeight: 1,
          }}
        >
          •••
        </span>
        <span style={{ fontFamily: t.mono, fontSize: 14, color: t.muted }}>–</span>
        <span
          style={{
            fontFamily: t.mono,
            fontSize: 14,
            color: t.muted,
            letterSpacing: 2,
            lineHeight: 1,
          }}
        >
          ••
        </span>
        <span style={{ fontFamily: t.mono, fontSize: 14, color: t.muted }}>–</span>
        <span
          style={{
            fontFamily: t.mono,
            fontSize: 19,
            color: t.ink,
            letterSpacing: 1.5,
            fontWeight: 500,
          }}
        >
          {lastFour}
        </span>
      </div>
      <EncryptedPill t={t} />
    </div>
  );
}

function formatSsn(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 9);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

function EncryptedPill({ t }: { t: Theme }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 9px',
        background: t.tintAccent,
        border: `1px solid ${t.rustSoft}`,
        borderRadius: 999,
        fontFamily: t.mono,
        fontSize: 9,
        color: t.rustInk,
        letterSpacing: 0.8,
      }}
    >
      <svg width="9" height="10" viewBox="0 0 9 10" fill="none" stroke="currentColor" strokeWidth="1.3">
        <rect x="1.5" y="4.5" width="6" height="5" rx="0.8" />
        <path d="M3 4.5V3a1.5 1.5 0 013 0v1.5" strokeLinecap="round" />
      </svg>
      ENCRYPTED
    </span>
  );
}

// ────────────────────────────────────────────────────────────────
// IntakeBackButton — small "← Back" link at the top of intake screens.
// Different from BackButton (which is the bigger one in OTP).
// ────────────────────────────────────────────────────────────────

export function IntakeBackButton({
  t,
  onClick,
}: {
  t: Theme;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        fontSize: 13,
        color: t.muted,
        fontFamily: t.sans,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M9 3l-4 4 4 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Back
    </button>
  );
}

// ────────────────────────────────────────────────────────────────
// RentalTypeCard / RadioRowCard — radio card pattern shared by
// state-and-prior-year, filing, and other single-select screens.
// ────────────────────────────────────────────────────────────────

export function RadioRowCard({
  t,
  selected,
  onClick,
  label,
  sub,
}: {
  t: Theme;
  selected: boolean;
  onClick: () => void;
  label: string;
  sub: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '14px 14px',
        background: selected ? t.tintAccent : t.card,
        border: `1px solid ${selected ? t.rust : t.border}`,
        borderRadius: t.radius,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: t.sans,
        transition: 'border-color 120ms, background 120ms',
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: `1.5px solid ${selected ? t.rust : t.border}`,
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {selected && <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.rust }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: t.ink, letterSpacing: -0.1 }}>
          {label}
        </div>
        <div style={{ fontSize: 12.5, color: t.muted, marginTop: 3, lineHeight: 1.4 }}>
          {sub}
        </div>
      </div>
    </button>
  );
}

// ────────────────────────────────────────────────────────────────
// DependentCountCard — count-icon radio card for ScreenDependentsCount.
// ────────────────────────────────────────────────────────────────

export function DependentCountCard({
  t,
  selected,
  onClick,
  label,
  sub,
  icon,
}: {
  t: Theme;
  selected: boolean;
  onClick: () => void;
  label: string;
  sub?: string;
  icon: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        width: '100%',
        padding: '18px 18px',
        background: selected ? t.tintAccent : t.card,
        border: `1px solid ${selected ? t.rust : t.border}`,
        borderRadius: t.radius,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: t.sans,
        transition: 'border-color 120ms, background 120ms',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: selected ? t.rust : t.bgElev,
          border: `1px solid ${selected ? t.rust : t.borderSoft}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontFamily: t.serif,
          fontSize: 20,
          fontWeight: 500,
          color: selected ? '#fff' : t.ink,
          letterSpacing: -0.4,
        }}
      >
        {icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 16,
            color: t.ink,
            fontWeight: 500,
            letterSpacing: -0.1,
            marginBottom: sub ? 2 : 0,
          }}
        >
          {label}
        </div>
        {sub && <div style={{ fontSize: 12.5, color: t.muted, lineHeight: 1.35 }}>{sub}</div>}
      </div>

      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          border: `1.5px solid ${selected ? t.rust : t.border}`,
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {selected && (
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: t.rust,
            }}
          />
        )}
      </div>
    </button>
  );
}

// ────────────────────────────────────────────────────────────────
// IntakeRouteFrame — wraps the intake screen in a div with the
// route-fwd / route-back / route-jump animation. Uses pathname
// as key so the wrapper re-mounts (and thus replays the animation)
// on every route change. Direction stored in sessionStorage by
// the navigation helper in the page (see usePortalState).
// ────────────────────────────────────────────────────────────────

export function IntakeRouteFrame({
  pathname,
  direction,
  children,
}: {
  pathname: string;
  direction: 'forward' | 'back' | 'jump';
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{`
        @keyframes docket-route-fwd {
          0%   { transform: translateX(22px); opacity: 0; }
          60%  { opacity: 1; }
          100% { transform: translateX(0);    opacity: 1; }
        }
        @keyframes docket-route-back {
          0%   { transform: translateX(-22px); opacity: 0; }
          60%  { opacity: 1; }
          100% { transform: translateX(0);     opacity: 1; }
        }
        @keyframes docket-route-jump {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
      `}</style>
      <div
        key={pathname}
        style={{
          minHeight: '100vh',
          animation:
            direction === 'forward'
              ? 'docket-route-fwd 280ms cubic-bezier(.2,.8,.2,1) both'
              : direction === 'back'
              ? 'docket-route-back 280ms cubic-bezier(.2,.8,.2,1) both'
              : 'docket-route-jump 180ms ease-out both',
          willChange: 'transform, opacity',
        }}
      >
        {children}
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────────
// IntakeHeader — sticky top bar with step counter + progress.
// ────────────────────────────────────────────────────────────────

export function IntakeHeader({
  t,
  step,
  subStep,
  label,
  total = 13,
}: {
  t: Theme;
  step?: number;
  subStep?: 'A' | 'B';
  label: string;
  total?: number;
}) {
  const wrapStyle: React.CSSProperties = {
    position: 'sticky',
    top: 0,
    zIndex: 5,
    background: t.bg,
    padding: '14px 24px 12px',
    borderBottom: `1px solid ${t.borderSoft}`,
  };
  if (!step) {
    return (
      <div style={wrapStyle}>
        <Row justify="space-between" style={{ marginBottom: 10 }}>
          <Eyebrow t={t}>Final step</Eyebrow>
          <Eyebrow t={t}>{label}</Eyebrow>
        </Row>
        <ProgressBar t={t} value={total} total={total} />
      </div>
    );
  }
  const stepLabel = subStep
    ? `${String(step).padStart(2, '0')}${subStep} of ${total}`
    : `${String(step).padStart(2, '0')} of ${total}`;
  const progressValue = subStep === 'B' ? step + 0.5 : step;
  return (
    <div style={wrapStyle}>
      <Row justify="space-between" style={{ marginBottom: 10 }}>
        <Eyebrow t={t}>{stepLabel}</Eyebrow>
        <Eyebrow t={t}>{label}</Eyebrow>
      </Row>
      <ProgressBar t={t} value={progressValue} total={total} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// AntonioNote — italic editorial margin-note with dateline attribution.
// Used on intake screens to inject Antonio's voice.
// ────────────────────────────────────────────────────────────────

export function AntonioNote({
  t,
  children,
  signature = 'Antonio',
  credentials = 'EA · Claremont',
}: {
  t: Theme;
  children: React.ReactNode;
  signature?: string;
  credentials?: string;
}) {
  return (
    <div
      style={{
        marginTop: 10,
        paddingLeft: 16,
        borderLeft: `1px solid ${t.rustSoft}`,
      }}
    >
      <div
        style={{
          fontFamily: t.serif,
          fontStyle: 'italic',
          fontSize: 15.5,
          lineHeight: 1.55,
          color: t.inkSoft,
          textWrap: 'pretty' as React.CSSProperties['textWrap'],
          letterSpacing: -0.1,
        }}
      >
        {children}
      </div>
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: t.serif, fontSize: 13, color: t.muted, lineHeight: 1 }}>—</span>
        <span
          style={{
            fontFamily: t.mono,
            fontSize: 10,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            color: t.rustInk,
          }}
        >
          {signature}
        </span>
        <span style={{ flex: 1, height: 1, background: t.borderSoft, maxWidth: 40 }} />
        <span
          style={{
            fontFamily: t.mono,
            fontSize: 9.5,
            letterSpacing: 1,
            color: t.muted,
            textTransform: 'uppercase',
          }}
        >
          {credentials}
        </span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// BottomBar — sticky footer for the next/back buttons on intake screens.
// ────────────────────────────────────────────────────────────────

export function BottomBar({
  t,
  children,
}: {
  t: Theme;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        background: `linear-gradient(to top, ${t.bg} 70%, transparent)`,
        padding: '24px 24px 32px',
        display: 'flex',
        gap: 10,
      }}
    >
      {children}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Footer — firm attribution at the bottom of intake screens.
// ────────────────────────────────────────────────────────────────

export function Footer({
  t,
  text = 'ANTONIO VAZQUEZ, ENROLLED AGENT · CLAREMONT, CA',
}: {
  t: Theme;
  text?: string;
}) {
  return (
    <div
      style={{
        padding: '20px 24px 28px',
        textAlign: 'center',
        fontFamily: t.mono,
        fontSize: 10,
        color: t.muted,
        letterSpacing: 0.5,
      }}
    >
      {text}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// BackButton — chevron + "Back" label, used on every intake screen
// after step 1.
// ────────────────────────────────────────────────────────────────

export function BackButton({
  t,
  onClick,
}: {
  t: Theme;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: t.inkSoft,
        fontSize: 14,
        padding: 8,
        marginLeft: -8,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: t.sans,
      }}
    >
      <svg width="8" height="13" viewBox="0 0 8 13" fill="none">
        <path d="M7 1L1 6.5L7 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      Back
    </button>
  );
}

// ────────────────────────────────────────────────────────────────
// ToggleCard — multi-select card with icon well + check square.
// Used by self-employment, tax-questions, deductions, life-events.
// `emphasis: true` switches selected accent from ink (default) to rust.
// ────────────────────────────────────────────────────────────────

export function ToggleCard({
  t,
  on,
  onClick,
  icon,
  label,
  sub,
  emphasis = false,
}: {
  t: Theme;
  on: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  sub?: string;
  emphasis?: boolean;
}) {
  const accent = emphasis ? t.rust : t.ink;
  const accentSoft = emphasis ? t.tintAccent : t.bgElev;
  const borderColor = on ? accent : t.border;
  const bg = on ? accentSoft : t.card;

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        width: '100%',
        padding: '14px 16px',
        background: bg,
        border: `1px solid ${borderColor}`,
        borderRadius: t.radius,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: t.sans,
        transition: 'border-color 120ms, background 120ms',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: on ? accent : t.bgElev,
          border: `1px solid ${on ? 'transparent' : t.borderSoft}`,
          color: on ? '#fff' : t.inkSoft,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            color: t.ink,
            fontWeight: 500,
            letterSpacing: -0.1,
            marginBottom: sub ? 2 : 0,
          }}
        >
          {label}
        </div>
        {sub && <div style={{ fontSize: 12, color: t.muted, lineHeight: 1.35 }}>{sub}</div>}
      </div>

      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          border: `1.5px solid ${on ? accent : t.border}`,
          background: on ? accent : '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {on && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2">
            <path d="M2.5 6.5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </button>
  );
}

// ────────────────────────────────────────────────────────────────
// IncomeIcon — 5-variant icon for ScreenIncomeSources.
// kind: w2 | self | rental | invest | retire
// ────────────────────────────────────────────────────────────────

export type IncomeIconKind = 'w2' | 'self' | 'rental' | 'invest' | 'retire';

export function IncomeIcon({ kind, size = 20 }: { kind: IncomeIconKind; size?: number }) {
  const s = {
    width: size,
    height: size,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
  } as const;
  switch (kind) {
    case 'w2':
      return (
        <svg {...s} viewBox="0 0 20 20">
          <rect x="3" y="4" width="14" height="13" rx="1.5" />
          <path d="M6 8h8M6 11h8M6 14h5" strokeLinecap="round" />
        </svg>
      );
    case 'self':
      return (
        <svg {...s} viewBox="0 0 20 20">
          <circle cx="10" cy="6.5" r="2.5" />
          <path d="M4 17c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round" />
        </svg>
      );
    case 'rental':
      return (
        <svg {...s} viewBox="0 0 20 20">
          <path d="M3 9l7-5 7 5v8H3V9z" strokeLinejoin="round" />
          <path d="M8 17v-4h4v4" strokeLinejoin="round" />
        </svg>
      );
    case 'invest':
      return (
        <svg {...s} viewBox="0 0 20 20">
          <path d="M3 15l4-4 3 2 7-8" strokeLinejoin="round" strokeLinecap="round" />
          <path d="M13 5h4v4" strokeLinecap="round" />
        </svg>
      );
    case 'retire':
      return (
        <svg {...s} viewBox="0 0 20 20">
          <circle cx="10" cy="10" r="7" />
          <path d="M10 6v4l3 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

// ────────────────────────────────────────────────────────────────
// LegalDoc — scrollable legal document viewer used by engagement
// letter and §7216 consent screens.
// ────────────────────────────────────────────────────────────────

export function LegalDoc({
  t,
  title,
  paras,
}: {
  t: Theme;
  title: string;
  paras: string[];
}) {
  return (
    <div
      style={{
        background: t.card,
        border: `1px solid ${t.border}`,
        borderRadius: t.radius,
        padding: '20px 20px 18px',
        maxHeight: 260,
        overflowY: 'auto',
        fontSize: 13,
        lineHeight: 1.55,
        color: t.inkSoft,
        fontFamily: t.serif,
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: t.ink,
          marginBottom: 10,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          fontFamily: t.sans,
        }}
      >
        {title}
      </div>
      {paras.map((p, i) => (
        <p key={i} style={{ margin: '0 0 10px' }}>
          {p}
        </p>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// SignaturePad — tap-to-sign component. Renders the signer's
// name in a script font + cryptographic-looking timestamp once
// signed.
// ────────────────────────────────────────────────────────────────

function formatNowTimestamp(): string {
  const now = new Date();
  const month = now.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const day = now.getDate();
  const year = now.getFullYear();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `SIGNED ${month} ${day}, ${year} · ${hours}:${minutes} ${ampm} PT`;
}

export function SignaturePad({
  t,
  signed,
  onSign,
  name,
  timestamp,
}: {
  t: Theme;
  signed: boolean;
  onSign: () => void;
  name: string;
  timestamp?: string;
}) {
  return (
    <div
      onClick={() => !signed && onSign()}
      style={{
        background: t.bgElev,
        border: `1.5px dashed ${signed ? t.rust : t.border}`,
        borderRadius: t.radius,
        padding: signed ? '14px 18px' : '28px 18px',
        cursor: signed ? 'default' : 'pointer',
        transition: 'all 0.2s',
      }}
    >
      {signed ? (
        <div>
          <div
            style={{
              fontFamily: '"Caveat", "Brush Script MT", cursive',
              fontSize: 28,
              color: t.ink,
              lineHeight: 1,
            }}
          >
            {name || 'Signature'}
          </div>
          <div
            style={{
              fontFamily: t.mono,
              fontSize: 10,
              color: t.muted,
              letterSpacing: 0.5,
              marginTop: 4,
            }}
          >
            {timestamp || formatNowTimestamp()}
          </div>
        </div>
      ) : (
        <Row justify="center" gap={8}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M2 12l3-1 8-8 1 1-8 8-1 3-3-3z"
              stroke={t.muted}
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>
          <span style={{ fontSize: 14, color: t.muted }}>Tap to sign</span>
        </Row>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// HandCheckmark — animated success mark used by ScreenDone and
// the post-8879 sign success overlay (Batch D).
// ────────────────────────────────────────────────────────────────

export function HandCheckmark({ t, size = 120 }: { t: Theme; size?: number }) {
  return (
    <>
      <style>{`
        @keyframes hc-pop {
          0%   { transform: scale(0);   opacity: 0; }
          60%  { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1);    opacity: 1; }
        }
        @keyframes hc-draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes hc-halo {
          0%   { transform: scale(0.4); opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
        }
      `}</style>
      <svg width={size} height={size} viewBox="0 0 120 120" style={{ display: 'block', overflow: 'visible' }}>
        <circle
          cx="60"
          cy="60"
          r="46"
          fill="none"
          stroke={t.rust}
          strokeWidth="1.5"
          opacity="0"
          style={{
            transformOrigin: '60px 60px',
            animation: 'hc-halo 1.1s ease-out 0.35s forwards',
          }}
        />
        <g
          style={{
            transformOrigin: '60px 60px',
            animation: 'hc-pop 0.55s cubic-bezier(.34,1.56,.64,1) both',
          }}
        >
          <circle cx="60" cy="60" r="46" fill={t.rust} />
        </g>
        <path
          d="M40 62 L54 76 L82 46"
          stroke="#fff"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          style={{
            strokeDasharray: 70,
            strokeDashoffset: 70,
            animation: 'hc-draw 0.5s cubic-bezier(.65,0,.35,1) 0.45s forwards',
          }}
        />
      </svg>
    </>
  );
}

// ────────────────────────────────────────────────────────────────
// IntakeBottomBar — sticky footer pattern shared by intake screens
// without the Ask Antonio bar (engagement, consent, done).
// ────────────────────────────────────────────────────────────────

export function IntakeBottomBar({
  t,
  children,
}: {
  t: Theme;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        background: `linear-gradient(to top, ${t.bg} 70%, transparent)`,
        padding: '24px 24px 32px',
        display: 'flex',
        gap: 10,
      }}
    >
      {children}
    </div>
  );
}
