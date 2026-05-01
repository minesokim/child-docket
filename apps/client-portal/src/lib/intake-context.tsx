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
//   - We do NOT replace local state with the server response — typing
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
import { revealIntakeField, saveIntakeField } from './intake-actions';

type SetFieldFn = (path: string, value: unknown) => void;

type IntakeContextValue = {
  answers: IntakeState;
  setField: SetFieldFn;
};

const IntakeContext = createContext<IntakeContextValue | null>(null);

// Debounce window per path. 400ms is the sweet spot — feels instant in
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

  // On unmount, flush any in-flight saves immediately.
  useEffect(() => {
    return () => {
      const timers = timersRef.current;
      const pending = pendingRef.current;
      timers.forEach((t) => clearTimeout(t));
      pending.forEach((value, path) => {
        // Best-effort flush — fire and forget.
        void saveIntakeField(path, value);
      });
      timers.clear();
      pending.clear();
    };
  }, []);

  const setField = useCallback<SetFieldFn>((path, value) => {
    // 1. Synchronous local update — UI feels instant.
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
        // We DON'T replace local state with result.answers here —
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

/** Get the full IntakeState. Use sparingly — most components want a single field. */
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
 * setValue is synchronous — local state updates instantly, server save
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
