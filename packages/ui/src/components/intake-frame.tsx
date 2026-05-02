// Intake-flow framing primitives — header, bottom bars, route transitions,
// and the SignOutProvider that connects the host app's sign-out handler
// to the IntakeHeader's logout pill.
//
// SignOutProvider lives here (not in layout.tsx) because the only consumer
// of the context inside the package is IntakeHeader, and they share a
// private React context that should not be re-exported beyond this file.

import * as React from 'react';
import type { Theme } from '../tokens.js';
import { Eyebrow } from './text.js';
import { Row } from './layout.js';
import { ProgressBar } from './indicators.js';

// ────────────────────────────────────────────────────────────────
// SignOutContext — lets IntakeHeader render a small Sign-out icon
// on the left when the host app provides a handler. Keeps the @docket/ui
// package framework-agnostic (no Clerk import here).
//
// Usage:
//   <SignOutProvider value={signOutHandler}>...</SignOutProvider>
// IntakeHeader reads via useContext and renders only when a handler is set.
// ────────────────────────────────────────────────────────────────

const SignOutContext = React.createContext<(() => void) | null>(null);

export function SignOutProvider({
  value,
  children,
}: {
  value: () => void;
  children: React.ReactNode;
}) {
  return <SignOutContext.Provider value={value}>{children}</SignOutContext.Provider>;
}

function useSignOutHandler(): (() => void) | null {
  return React.useContext(SignOutContext);
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
  const onSignOut = useSignOutHandler();
  const wrapStyle: React.CSSProperties = {
    position: 'sticky',
    top: 0,
    zIndex: 5,
    background: t.bg,
    padding: '14px 24px 12px',
    borderBottom: `1px solid ${t.borderSoft}`,
  };

  // Logout pill — 20% smaller than the original. Sits above the step
  // row in its own line. Only renders when SignOutProvider is upstream.
  const logoutPill = onSignOut ? (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8 }}>
      <button
        type="button"
        onClick={onSignOut}
        aria-label="Log out"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '5px 10px',
          background: t.bgElev,
          border: `1px solid ${t.border}`,
          borderRadius: 999,
          cursor: 'pointer',
          fontFamily: t.mono,
          fontSize: 9,
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: t.inkSoft,
          lineHeight: 1,
          transition: 'background 140ms cubic-bezier(.2,.8,.2,1), border-color 140ms cubic-bezier(.2,.8,.2,1)',
        }}
      >
        <svg
          width="8"
          height="8"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path d="M2.2 2.2l5.6 5.6M7.8 2.2l-5.6 5.6" strokeLinecap="round" />
        </svg>
        Logout
      </button>
    </div>
  ) : null;

  if (!step) {
    return (
      <div style={wrapStyle}>
        {logoutPill}
        <Row justify="space-between" align="center" style={{ marginBottom: 10 }}>
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
      {logoutPill}
      <Row justify="space-between" align="center" style={{ marginBottom: 10 }}>
        <Eyebrow t={t}>{stepLabel}</Eyebrow>
        <Eyebrow t={t}>{label}</Eyebrow>
      </Row>
      <ProgressBar t={t} value={progressValue} total={total} />
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
