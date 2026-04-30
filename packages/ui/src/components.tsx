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
        height: '100%',
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
  src,
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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      {src ? (
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
      ) : (
        <span
          style={{
            fontFamily: t.serif,
            fontSize: size * 0.4,
            color: t.ink,
            letterSpacing: -0.4,
          }}
        >
          {label}
        </span>
      )}
    </div>
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
  text = 'ANTONIO RAMIREZ, ENROLLED AGENT · CLAREMONT, CA',
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
