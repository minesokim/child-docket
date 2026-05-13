// reasoning-trail — canonical shape every agent emits alongside its
// primary answer.
//
// Per CLAUDE.md §9 Agent contract:
//   "Multi-step reasoning trail — collapsible per-step view of what
//    the agent did: which client facts it queried, which authorities
//    it looked up, which intermediate decisions it made, what it
//    considered and discarded. NOT a thinking-mode raw dump; a
//    *curated* trail emitted alongside the answer so the preparer
//    can audit 'why this answer landed here.'"
//
// CONTRACT
//   Discovery, Strategy, Position, Pre-signature, Notice Response,
//   and Ask Docket (command palette) MUST emit `reasoning_trail` on
//   every output.
//   Triage Classifier + Inbox Drafter MAY emit (trivial cases — only
//   on `confidence < high`).
//
// SCHEMA
//   { kind: ReasoningStepKind, label: string, detail?: string }
//   - kind: one of five enumerated values (see ReasoningStepKind below)
//   - label: short imperative-past, ≤80 chars ("Loaded client facts")
//   - detail: concrete supporting info (counts, citations, criteria),
//     ≤500 chars
//
// The UI primitive that renders this lives at
// apps/command-room/src/components/reasoning-trail.tsx.

export type ReasoningStepKind =
  | 'fact_query'
  | 'authority_lookup'
  | 'decision'
  | 'consideration'
  | 'discard';

export interface ReasoningStep {
  /** Step kind. Drives UI label + color treatment. */
  kind: ReasoningStepKind;
  /** Imperative-past short label. ≤80 chars. */
  label: string;
  /** Concrete supporting detail. Optional. ≤500 chars. */
  detail?: string;
}

/**
 * Type guard for runtime validation of agent JSON output. Used by
 * the orchestrator audit hook to verify agents actually emit a
 * well-formed trail before persisting.
 */
export function isReasoningTrail(value: unknown): value is ReasoningStep[] {
  if (!Array.isArray(value)) return false;
  for (const step of value) {
    if (!step || typeof step !== 'object') return false;
    const s = step as Record<string, unknown>;
    if (typeof s.kind !== 'string') return false;
    if (
      !['fact_query', 'authority_lookup', 'decision', 'consideration', 'discard'].includes(
        s.kind,
      )
    ) {
      return false;
    }
    if (typeof s.label !== 'string' || s.label.length === 0) return false;
    if (s.label.length > 80) return false;
    if (s.detail !== undefined) {
      if (typeof s.detail !== 'string') return false;
      if (s.detail.length > 500) return false;
    }
  }
  return true;
}

/**
 * Truncate a reasoning trail to a maximum step count. Used by the
 * insight-surface filter to keep dashboard cards from overflowing
 * with verbose 30-step traces — the Audit Trail UI gets the full
 * trace; the dashboard card gets the first N steps.
 */
export function truncateTrail(
  trail: ReasoningStep[],
  maxSteps: number,
): ReasoningStep[] {
  if (trail.length <= maxSteps) return trail;
  const truncated = trail.slice(0, maxSteps - 1);
  truncated.push({
    kind: 'consideration',
    label: `${trail.length - (maxSteps - 1)} more reasoning steps`,
    detail: 'See Audit Trail for the complete chain.',
  });
  return truncated;
}
