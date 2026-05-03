'use client';

// Header control for the per-session PII unlock.
//
// States:
//   locked   → "Show SSN / EIN / bank" button. Click → fetches plaintext.
//   loading  → spinner-shaped affordance.
//   error    → red inline message; reverts to locked after 4s.
//   unlocked → "Locked in M:SS" countdown + small "Lock now" link.
//
// Sits directly above (or in the header of) the IntakeSummary panel
// so the lock state is always visible while sensitive values are.

import * as React from 'react';
import type { Theme } from '@docket/ui';
import { usePIIUnlock } from './pii-unlock-provider';

export function PIIUnlockButton({ t }: { t: Theme }) {
  const { isUnlocked, remainingMs, unlock, lock } = usePIIUnlock();
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const onUnlock = async () => {
    if (submitting || isUnlocked) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await unlock();
      if (!result.ok) {
        setError(result.error);
        setTimeout(() => setError(null), 4_000);
      }
    } catch (err) {
      // Provider already wraps the action in try/catch and returns a
      // synthetic error on throw, so this branch is defensive belt-
      // and-suspenders. Both layers ensure submitting state always
      // resets via the finally clause.
      console.error('[PIIUnlockButton] unlock threw:', err);
      setError('Unlock failed unexpectedly');
      setTimeout(() => setError(null), 4_000);
    } finally {
      setSubmitting(false);
    }
  };

  if (isUnlocked) {
    const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    const mm = Math.floor(totalSeconds / 60);
    const ss = String(totalSeconds % 60).padStart(2, '0');
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 12px 6px 14px',
          background: '#fff7e8',
          border: `1px solid ${t.tintAccent}`,
          borderRadius: 999,
          fontFamily: t.sans,
          fontSize: 12.5,
          color: t.rustInk,
        }}
      >
        <UnlockIcon />
        <span>
          Unlocked · auto-lock in{' '}
          <span style={{ fontFamily: t.mono, fontWeight: 500 }}>
            {mm}:{ss}
          </span>
        </span>
        <button
          type="button"
          onClick={lock}
          style={{
            background: 'transparent',
            border: 'none',
            color: t.rustInk,
            fontFamily: t.mono,
            fontSize: 9.5,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            cursor: 'pointer',
            padding: '2px 6px',
            borderRadius: 4,
          }}
        >
          Lock now
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <button
        type="button"
        onClick={onUnlock}
        disabled={submitting}
        title="Reveals SSN, EIN, bank routing + account values for 15 minutes. Auto-locks. Each unlock writes one audit row."
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          padding: '7px 14px',
          background: t.ink,
          color: '#fff',
          fontSize: 12.5,
          fontFamily: t.sans,
          fontWeight: 500,
          border: 'none',
          borderRadius: 999,
          cursor: submitting ? 'not-allowed' : 'pointer',
          opacity: submitting ? 0.7 : 1,
          transition: 'opacity 120ms',
        }}
      >
        <LockIcon />
        {submitting ? 'Unlocking…' : 'Show SSN, EIN, bank'}
      </button>
      {error && (
        <span
          style={{
            fontFamily: t.mono,
            fontSize: 11,
            color: t.rust,
            letterSpacing: 0.3,
          }}
        >
          {error.length > 40 ? `${error.slice(0, 40)}…` : error}
        </span>
      )}
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="6.5" width="8" height="6" rx="1.2" />
      <path d="M5 6.5V4.5a2 2 0 014 0v2" />
    </svg>
  );
}

function UnlockIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="6.5" width="8" height="6" rx="1.2" />
      <path d="M5 6.5V4.5a2 2 0 014 0" />
    </svg>
  );
}
