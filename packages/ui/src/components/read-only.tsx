// Read-only mode primitive.
//
// Per docs/PRODUCTION-READINESS.md §A vendor resilience posture +
// §I bulletproofness — when the database is briefly unavailable
// (Neon outage / read-replica only / write-failure mode), the UI
// degrades gracefully rather than letting users click buttons that
// silently lose their work.
//
// PROVIDED:
//   - ReadOnlyContext         React context carrying the boolean.
//   - ReadOnlyProvider        wraps the app subtree.
//   - useIsReadOnly()         hook returning the current value.
//   - WriteAction             component wrapper that disables its
//                             children + signals to the user when
//                             read-only is active.
//
// IMPORTANT: this is a UX hint, NOT a security boundary. Server
// actions still need to check the read-only state independently —
// the client can lie. See `apps/*/src/lib/read-only-mode.ts` for
// the server-side check (TBD; this component pair is the UI piece).

import * as React from 'react';
import type { Theme } from '../tokens.js';

// ────────────────────────────────────────────────────────────────
// Context.
//
// Default value is FALSE so that a component rendered outside of any
// Provider behaves normally. This is the safe default — components
// don't accidentally render disabled when ReadOnlyProvider is missing.
// ────────────────────────────────────────────────────────────────

const ReadOnlyContext = React.createContext<boolean>(false);

export interface ReadOnlyProviderProps {
  /** Current read-only state. Toggle from a parent that polls /api/health. */
  value: boolean;
  children: React.ReactNode;
}

export function ReadOnlyProvider({ value, children }: ReadOnlyProviderProps) {
  return <ReadOnlyContext.Provider value={value}>{children}</ReadOnlyContext.Provider>;
}

/** Returns true when the surrounding ReadOnlyProvider has value=true. */
export function useIsReadOnly(): boolean {
  return React.useContext(ReadOnlyContext);
}

// ────────────────────────────────────────────────────────────────
// WriteAction — wraps a clickable subtree. When read-only is active,
// the wrapper:
//   1. Sets `inert` on the container → ALL interaction blocked
//      (pointer + keyboard + focus). React 19 native attribute.
//      Browser support: Chrome 102+, Safari 15.5+, Firefox 112+.
//      Children become un-tabbable, un-clickable, un-keyboard-
//      activatable. This is what `pointerEvents: 'none'` alone
//      didn't give us — keyboard still fired through the latter.
//   2. Reduces opacity (visual signal).
//   3. Adds aria-disabled (semantic signal for AT users).
//   4. Renders a small label explaining why.
//
// When NOT read-only, children render unchanged.
//
// IMPORTANT: this does NOT replace server-side validation. A
// determined user can DOM-inspect to remove the inert attribute.
// The server action must independently check the read-only flag.
//
// NO ESCAPE HATCH: there is intentionally no `forceReadOnly={false}`
// prop. To exempt a subtree from the parent read-only state (rare;
// example: a "go to status page" link inside a degraded shell),
// wrap that subtree in a child `<ReadOnlyProvider value={false}>`.
// That keeps the override explicit at the boundary, not on every
// WriteAction call site.
// ────────────────────────────────────────────────────────────────

export interface WriteActionProps {
  t: Theme;
  /** Override for the disabled-state hint shown below children. */
  hint?: string;
  children: React.ReactNode;
}

export function WriteAction({
  t,
  hint = 'Saves paused — read-only mode',
  children,
}: WriteActionProps) {
  const readOnly = useIsReadOnly();

  if (!readOnly) return <>{children}</>;

  return (
    <div
      // `inert` is the canonical "this subtree is uninteractable" signal.
      // React 19 passes it through to the DOM as a boolean attribute;
      // @types/react in this workspace accepts `boolean`, so we set
      // it to true (presence-of-attribute is what the browser checks).
      inert
      aria-disabled
      title={hint}
      style={{
        position: 'relative',
        opacity: 0.55,
      }}
    >
      {children}
      <div
        aria-hidden
        style={{
          marginTop: 6,
          fontFamily: t.sans,
          fontSize: 11,
          color: t.muted,
          fontStyle: 'italic',
        }}
      >
        {hint}
      </div>
    </div>
  );
}
