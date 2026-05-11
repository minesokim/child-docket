'use client';

// Intake-flow framing primitives — header, bottom bars, route transitions,
// and the SignOutProvider that connects the host app's sign-out handler
// to the IntakeHeader's logout pill.
//
// SignOutProvider lives here (not in layout.tsx) because the only consumer
// of the context inside the package is IntakeHeader, and they share a
// private React context that should not be re-exported beyond this file.
//
// 'use client' is REQUIRED at module top because this file calls
// React.createContext at module scope. Next 15 / React 19 RSC enforces
// that context creation must live in a client module — without this
// directive, every route that imports this package (the whole intake
// and portal trees) 500s with "createContext only works in a Client
// Component" at dev-server startup. Pre-existing breakage; the spawned
// task agents on commits faaa579 + 9975978 both flagged it as an
// out-of-scope blocker; this commit closes that gap.

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
    // Zero stroke. The progress bar below already separates the header
    // from the page body — no need for a border line on top of that.
  };

  // Logout — ease pattern: small icon + "Log out" text aligned RIGHT
  // (matches "Alex / Log out" in ease's ehr_client header). No pill,
  // no background, no border. Just text + icon in forestDark.
  const logoutLink = onSignOut ? (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
      <button
        type="button"
        onClick={onSignOut}
        aria-label="Log out"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: 4,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: t.sans,
          fontSize: 13,
          fontWeight: 400,
          color: t.ease.forestDark,
          lineHeight: 1,
        }}
      >
        {/* Door / arrow-right exit icon — same shape as ease's logout. */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5.5 2.5h-3a1 1 0 00-1 1v7a1 1 0 001 1h3" />
          <path d="M9 4.5l3 2.5-3 2.5" />
          <path d="M12 7H6" />
        </svg>
        Log out
      </button>
    </div>
  ) : null;

  if (!step) {
    return (
      <div style={wrapStyle}>
        {logoutLink}
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
      {logoutLink}
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
  sticky = true,
}: {
  t: Theme;
  children: React.ReactNode;
  /** Default true. Pass `sticky={false}` on long-form legal pages
   *  (engagement letter, §7216 consent) where the user expects to
   *  scroll the contract and reach the buttons at its natural bottom
   *  — pinning them on top of the contract reads as pressure. */
  sticky?: boolean;
}) {
  return (
    <div
      style={{
        position: sticky ? 'sticky' : 'static',
        bottom: sticky ? 0 : undefined,
        background: sticky
          ? `linear-gradient(to top, ${t.bg} 70%, transparent)`
          : 'transparent',
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
