'use client';

// ────────────────────────────────────────────────────────────────
// Intake context + useIntakeField hook.
//
// The (intake) layout loads the canonical IntakeState once at page boot
// (server-side via getOrCreateIntakeAnswers), then wraps children in
// <IntakeProvider>. Page components consume state via useIntakeField,
// which is a drop-in replacement for the old usePortalState hook:
//
//   const [firstName, setFirstName] = useIntakeField('personal.firstName', '');
//
// Performance model:
//   - Local state updates are SYNCHRONOUS on every keystroke. No await.
//   - Server saves are DEBOUNCED (400ms after typing stops, per path).
//     Typing "David" is one server request, not five.
//   - We do NOT replace local state with the server response - typing
//     never gets clobbered by a stale-response race. The server is
//     validating + encrypting + writing; we trust it to do so reliably,
//     and surface errors via console + Sentry rather than reverting
//     the user's input.
// ────────────────────────────────────────────────────────────────

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { getAtPath, setAtPath, type IntakeState } from '@docket/shared';
import { revealIntakeField, saveIntakeField } from './intake';

type SetFieldFn = (path: string, value: unknown) => void;

type IntakeContextValue = {
  answers: IntakeState;
  setField: SetFieldFn;
};

const IntakeContext = createContext<IntakeContextValue | null>(null);

// Tenant display context (firm owner name, avatar, tenant name) lives
// in @docket/ui so the AskAntonioBar / AskAntonioChat / AntonioNote /
// AvatarSlot components can consume it without prop-drilling. Re-export
// here for consumer convenience — pages importing from
// '@/lib/intake-context' get useFirmOwner / useTenantName / FirmOwner.
export {
  useFirmOwner,
  useTenantName,
  TenantDisplayProvider,
  type FirmOwner,
} from '@docket/ui';

// Debounce window per path. 400ms is the sweet spot - feels instant in
// the UI but coalesces rapid typing into one server round-trip.
const SAVE_DEBOUNCE_MS = 400;

// ────────────────────────────────────────────────────────────────
// Provider
// ────────────────────────────────────────────────────────────────

export function IntakeProvider({
  initialAnswers,
  children,
}: {
  initialAnswers: IntakeState;
  children: ReactNode;
}) {
  const [answers, setAnswers] = useState<IntakeState>(initialAnswers);

  // Debounce timers + latest-value buffer per path. Map keys are the
  // dotted paths; we hold one timer per field so typing in two fields
  // doesn't cancel each other.
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingRef = useRef<Map<string, unknown>>(new Map());

  // Flush every pending debounced write to the server. Used by THREE
  // triggers (registered in the effect below):
  //
  //   1. React unmount  - user navigates AWAY from the (intake) layout
  //      via Next.js client-side nav. The cleanup runs synchronously
  //      and we have no reliable way to await server actions, so we
  //      use sendBeacon for guaranteed delivery during nav teardown.
  //
  //   2. beforeunload   - user closes the tab / hard refreshes / closes
  //      the browser. Browsers cancel pending fetches but sendBeacon is
  //      explicitly carved out to survive unload.
  //
  //   3. visibilitychange (hidden) - mobile-specific. iOS Safari often
  //      doesn't fire beforeunload at all; the user navigating to home
  //      screen or switching apps fires visibilitychange instead. This
  //      catches the data-loss case the other two miss.
  //
  // The flush hits /api/intake/flush which runs each pending write
  // through the same saveIntakeField pipeline (auth + validation +
  // per-tenant encryption + audit log). Failures land in Sentry - the
  // tab is closing so a toast wouldn't help anyone.
  const flushPending = useCallback(() => {
    const pending = pendingRef.current;
    if (pending.size === 0) return;

    const writes = Array.from(pending.entries()).map(([path, value]) => ({
      path,
      value,
    }));

    if (typeof window === 'undefined') return;

    const url = '/api/intake/flush';
    const payload = JSON.stringify({ writes });

    // Prefer sendBeacon - explicitly designed for unload-time delivery,
    // browser-managed queue, no response handling needed.
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      try {
        const blob = new Blob([payload], { type: 'application/json' });
        const ok = navigator.sendBeacon(url, blob);
        if (ok) {
          timersRef.current.forEach((t) => clearTimeout(t));
          timersRef.current.clear();
          pendingRef.current.clear();
          return;
        }
      } catch {
        // sendBeacon failed (e.g., payload too large) - fall through to
        // keepalive fetch.
      }
    }

    // Fallback: fetch with keepalive: true. Works the same way (browser
    // commits to delivering) but lets us see a response if there's still
    // a context to receive it.
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {});

    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current.clear();
    pendingRef.current.clear();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onBeforeUnload = () => flushPending();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushPending();
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      // React-level navigation away from the (intake) layout. Flush here
      // too in case neither beforeunload nor visibilitychange fired.
      flushPending();
    };
  }, [flushPending]);

  const setField = useCallback<SetFieldFn>((path, value) => {
    // 1. Synchronous local update - UI feels instant.
    setAnswers((prev) => setAtPath(prev, path, value));

    // 2. Debounce the server save. If the user is still typing, we
    // reset the timer; the actual save fires SAVE_DEBOUNCE_MS after
    // the LAST keystroke for this path.
    pendingRef.current.set(path, value);
    const existing = timersRef.current.get(path);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      const latestValue = pendingRef.current.get(path);
      pendingRef.current.delete(path);
      timersRef.current.delete(path);

      // Save the latest value (not the value at debounce-start).
      void saveIntakeField(path, latestValue).then((result) => {
        if (!result.ok) {
          // Visible failure surface comes via console.error + Sentry
          // (server-side capture). v1+ adds a toast.
          console.error('[saveIntakeField] failed', {
            path: result.path,
            error: result.error,
          });
        }
        // We DON'T replace local state with result.answers here -
        // doing so causes typing-clobber races where a stale response
        // overwrites whatever the user has typed since the save fired.
        // Server is canonical for storage; React state is canonical for
        // what the user sees while typing.
      });
    }, SAVE_DEBOUNCE_MS);

    timersRef.current.set(path, timer);
  }, []);

  return (
    <IntakeContext.Provider value={{ answers, setField }}>
      {children}
    </IntakeContext.Provider>
  );
}

// ────────────────────────────────────────────────────────────────
// Hooks
// ────────────────────────────────────────────────────────────────

function useIntakeContext(): IntakeContextValue {
  const ctx = useContext(IntakeContext);
  if (!ctx) {
    throw new Error(
      'useIntakeField / useIntakeAnswers must be used inside <IntakeProvider> ' +
        '(rendered by the (intake) route group layout).',
    );
  }
  return ctx;
}

/** Get the full IntakeState. Use sparingly - most components want a single field. */
export function useIntakeAnswers(): IntakeState {
  return useIntakeContext().answers;
}

/**
 * Get the generic setField function. Useful for pages with dynamic
 * field iteration (tax-questions, life-events, etc.) where binding
 * each field to its own useIntakeField call would be excessive.
 */
export function useSetIntakeField(): SetFieldFn {
  return useIntakeContext().setField;
}

/**
 * Drop-in replacement for usePortalState. Reads from the IntakeState in
 * context; writes are debounced (400ms) before hitting the server.
 *
 *   const [value, setValue] = useIntakeField<string>('personal.firstName', '');
 *   <input onChange={(e) => setValue(e.target.value)} value={value} />
 *
 * setValue is synchronous - local state updates instantly, server save
 * fires after typing stops. No await needed; errors are logged.
 */
export function useIntakeField<T>(
  path: string,
  defaultValue: T,
): readonly [T, (next: T) => void] {
  const { answers, setField } = useIntakeContext();

  const raw = getAtPath(answers, path);
  const value = (raw === undefined ? defaultValue : raw) as T;

  const setValue = useCallback(
    (next: T) => setField(path, next),
    [setField, path],
  );

  return [value, setValue] as const;
}

/**
 * Returns a stable async function that reveals the plaintext for ONE
 * sensitive field at the given path. Wraps the revealIntakeField server
 * action with sane error-fallback (returns '' on failure rather than
 * throwing, since the caller is usually a UI event handler).
 *
 * Pair with the `onReveal` prop on SSNField / EncryptedTextField:
 *
 *   const revealSsn = useFieldReveal('personal.ssn');
 *   <SSNField ... onReveal={revealSsn} />
 *
 * Every reveal is audit-logged server-side as a 'read' action with
 * the path. SOC 2 evidence: who saw what plaintext, when.
 */
export function useFieldReveal(path: string): () => Promise<string> {
  return useCallback(async () => {
    const result = await revealIntakeField(path);
    if (!result.ok) {
      console.error('[revealIntakeField] failed', { path, error: result.error });
      return '';
    }
    return result.value;
  }, [path]);
}
