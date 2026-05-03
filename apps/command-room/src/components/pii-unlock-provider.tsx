'use client';

// Per-session PII unlock state for the client detail page.
//
// Wraps the IntakeSummary (and any other surface displaying masked
// SSN/EIN/bank values for this client). Holds the plaintext map +
// auto-locks after PII_UNLOCK_DURATION_MS, on lock click, or on
// component unmount (page navigation).
//
// Children consume the context via usePIIUnlock(). MaskedPII reads
// the plaintext map; PIIUnlockButton reads/writes the unlock state.

import * as React from 'react';
import {
  PII_UNLOCK_DURATION_MS,
  unlockClientPII,
  type UnlockClientPIIResult,
} from '@/lib/intake/unlock';

export type PlaintextMap = ReadonlyMap<string, string>;

type ContextValue = {
  isUnlocked: boolean;
  plaintext: PlaintextMap | null;
  expiresAt: number | null;
  remainingMs: number;
  unlock: () => Promise<UnlockClientPIIResult>;
  lock: () => void;
};

const PIIUnlockContext = React.createContext<ContextValue | null>(null);

export function PIIUnlockProvider({
  clientId,
  children,
}: {
  clientId: string;
  children: React.ReactNode;
}) {
  const [plaintext, setPlaintext] = React.useState<PlaintextMap | null>(null);
  const [expiresAt, setExpiresAt] = React.useState<number | null>(null);
  const [remainingMs, setRemainingMs] = React.useState<number>(0);
  const lockTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const clearLockTimers = React.useCallback(() => {
    if (lockTimeoutRef.current) {
      clearTimeout(lockTimeoutRef.current);
      lockTimeoutRef.current = null;
    }
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
  }, []);

  const lock = React.useCallback(() => {
    clearLockTimers();
    setPlaintext(null);
    setExpiresAt(null);
    setRemainingMs(0);
  }, [clearLockTimers]);

  const unlock = React.useCallback(async (): Promise<UnlockClientPIIResult> => {
    const result = await unlockClientPII(clientId);
    if (!result.ok) return result;

    const map = new Map<string, string>(Object.entries(result.plaintext));
    setPlaintext(map);
    setExpiresAt(result.expiresAt);
    setRemainingMs(Math.max(0, result.expiresAt - Date.now()));

    clearLockTimers();
    // Hard auto-lock at the exact expiry. The tick interval handles
    // the visible countdown but isn't authoritative for clearing state.
    lockTimeoutRef.current = setTimeout(() => {
      setPlaintext(null);
      setExpiresAt(null);
      setRemainingMs(0);
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    }, PII_UNLOCK_DURATION_MS);

    tickIntervalRef.current = setInterval(() => {
      setRemainingMs((prev) => {
        const next = result.expiresAt - Date.now();
        return next > 0 ? next : 0;
      });
    }, 1_000);

    return result;
  }, [clientId, clearLockTimers]);

  // Cleanup on unmount (e.g., navigating away from the client detail
  // page). Plaintext is wiped from React state regardless.
  React.useEffect(() => clearLockTimers, [clearLockTimers]);

  const value = React.useMemo<ContextValue>(
    () => ({
      isUnlocked: plaintext !== null,
      plaintext,
      expiresAt,
      remainingMs,
      unlock,
      lock,
    }),
    [plaintext, expiresAt, remainingMs, unlock, lock],
  );

  return <PIIUnlockContext.Provider value={value}>{children}</PIIUnlockContext.Provider>;
}

export function usePIIUnlock(): ContextValue {
  const ctx = React.useContext(PIIUnlockContext);
  if (!ctx) {
    throw new Error('usePIIUnlock must be used within a PIIUnlockProvider');
  }
  return ctx;
}
