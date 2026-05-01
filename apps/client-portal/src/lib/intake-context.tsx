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
// Reads come from React state (no per-component fetch). Writes go through
// the saveIntakeField server action — local state updates optimistically
// for instant UI feedback, then reconciles with the server's canonical
// (validated, encrypted-at-rest) response.
// ────────────────────────────────────────────────────────────────

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { getAtPath, setAtPath, type IntakeState } from '@docket/shared';
import { saveIntakeField, type SaveIntakeFieldResult } from './intake-actions';

type SetFieldFn = (path: string, value: unknown) => Promise<SaveIntakeFieldResult>;

type IntakeContextValue = {
  answers: IntakeState;
  setField: SetFieldFn;
};

const IntakeContext = createContext<IntakeContextValue | null>(null);

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

  const setField = useCallback<SetFieldFn>(async (path, value) => {
    // Optimistic: update local state immediately. UI feels instant.
    setAnswers((prev) => setAtPath(prev, path, value));

    // Server save happens in the background. The server's response is
    // canonical (validated, possibly coerced) — replace local with it
    // so any normalization (whitespace, casing, etc.) flows back.
    const result = await saveIntakeField(path, value);

    if (result.ok) {
      setAnswers(result.answers);
      return result;
    }

    // Save failed. Local state has the optimistic value, but the server
    // has the prior. We keep optimistic on screen so the user can retry
    // (correcting their input), and surface the error to the caller.
    return result;
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
 * Drop-in replacement for usePortalState. Reads from the IntakeState in
 * context; writes go through the saveIntakeField server action.
 *
 *   const [value, setValue] = useIntakeField<string>('personal.firstName', '');
 *
 *   <input onChange={(e) => void setValue(e.target.value)} value={value} />
 *
 * setValue returns a Promise so callers CAN await error info, but most
 * UI flows fire-and-forget with `void setValue(...)`.
 */
export function useIntakeField<T>(
  path: string,
  defaultValue: T,
): readonly [T, (next: T) => Promise<SaveIntakeFieldResult>] {
  const { answers, setField } = useIntakeContext();

  const raw = getAtPath(answers, path);
  const value = (raw === undefined ? defaultValue : raw) as T;

  const setValue = useCallback(
    (next: T) => setField(path, next),
    [setField, path],
  );

  return [value, setValue] as const;
}
