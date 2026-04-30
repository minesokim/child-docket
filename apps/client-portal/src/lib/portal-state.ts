'use client';

// Portal state — session-backed form data for the intake flow.
//
// v0: sessionStorage. Refreshing the page keeps progress; closing the tab clears it.
// v1: server-backed via POST to /api/intake/[engagementId] on each step. The
// session-storage path stays as an offline fallback.

import { useCallback, useEffect, useState } from 'react';

const PREFIX = 'docket:portal:';

function read<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // sessionStorage can throw in private browsing — silently fail.
  }
}

export function usePortalState<T>(
  key: string,
  initial: T,
): readonly [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    const stored = read<T>(key);
    if (stored !== null) setValue(stored);
  }, [key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const nextVal =
          typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        write(key, nextVal);
        return nextVal;
      });
    },
    [key],
  );

  return [value, update] as const;
}

export function clearPortalState(): void {
  if (typeof window === 'undefined') return;
  const keys: string[] = [];
  for (let i = 0; i < window.sessionStorage.length; i++) {
    const k = window.sessionStorage.key(i);
    if (k && k.startsWith(PREFIX)) keys.push(k);
  }
  for (const k of keys) window.sessionStorage.removeItem(k);
}
