// ReasoningTrail — collapsible per-step trace renderer used by every
// agent output that surfaces to a preparer.
//
// Per CLAUDE.md §9 Agent contract:
//   "Multi-step reasoning trail — collapsible per-step view of what
//    the agent did: which client facts it queried, which authorities
//    it looked up, which intermediate decisions it made, what it
//    considered and discarded. NOT a thinking-mode raw dump; a
//    *curated* trail emitted alongside the answer so the preparer
//    can audit 'why this answer landed here.'"
//
// AGENT JSON CONTRACT
//   Every reasoning-emitting agent extends its output schema with:
//     reasoning_trail: ReasoningStep[]
//   See packages/shared/src/reasoning-trail.ts for the canonical
//   ReasoningStep shape + type guard.
//
// SHAPE
//   <ReasoningTrail
//     steps={[
//       { kind: 'fact_query', label: 'Loaded client facts', detail: '12 fact rows' },
//       { kind: 'authority_lookup', label: 'Found §280A(g) — Augusta Rule', detail: 'IRC §280A(g), eff 2018' },
//       { kind: 'decision', label: 'Classified as Tier 2', detail: 'Substantial Authority — meets the 14-day + own-residence + arm\'s-length criteria' },
//     ]}
//     defaultOpen={false}
//   />
//
// VOICE
//   - Curated trail, not raw token stream. Each step has a kind tag
//     (fact_query / authority_lookup / decision / consideration / discard).
//   - Step labels are imperative-past ("Loaded client facts").
//   - Step details are concrete (counts, citations, criteria).
//
// USE WITH RESTRAINT
//   Default-closed so the answer is the noun and the trail is the
//   adjective. Preparer opens it when they want to audit. Don't
//   default-open — it buries the conclusion.

'use client';

import { useState } from 'react';

export type ReasoningStepKind =
  | 'fact_query'
  | 'authority_lookup'
  | 'decision'
  | 'consideration'
  | 'discard';

export type ReasoningStep = {
  kind: ReasoningStepKind;
  /** Imperative-past short label ("Loaded client facts"). */
  label: string;
  /** Concrete detail — counts, citations, criteria. */
  detail?: string;
};

type Props = {
  steps: ReasoningStep[];
  /** Default-closed; preparer opens to audit. */
  defaultOpen?: boolean;
};

const KIND_LABELS: Record<ReasoningStepKind, string> = {
  fact_query: 'Facts',
  authority_lookup: 'Authority',
  decision: 'Decision',
  consideration: 'Considered',
  discard: 'Discarded',
};

const KIND_COLOR: Record<ReasoningStepKind, string> = {
  fact_query: 'oklch(42% 0.09 150)', // forest
  authority_lookup: 'oklch(42% 0.10 240)', // ink-blue
  decision: 'oklch(30% 0.01 85)', // ink
  consideration: 'oklch(50% 0.01 85)', // mid-gray
  discard: 'oklch(58% 0.13 75)', // amber
};

export function ReasoningTrail({ steps, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  if (steps.length === 0) return null;

  return (
    <div
      style={{
        marginTop: 12,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          appearance: 'none',
          background: 'transparent',
          border: 'none',
          padding: '4px 0',
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 500,
          color: 'oklch(48% 0.01 85)',
          letterSpacing: 0.2,
          textTransform: 'uppercase',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
        aria-expanded={open}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: 0,
            height: 0,
            borderLeft: '4px solid oklch(48% 0.01 85)',
            borderTop: '4px solid transparent',
            borderBottom: '4px solid transparent',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 120ms ease',
          }}
        />
        {open ? 'Hide reasoning' : `Show reasoning (${steps.length} step${steps.length === 1 ? '' : 's'})`}
      </button>
      {open && (
        <ol
          style={{
            listStyle: 'none',
            margin: '8px 0 0 0',
            padding: '12px 14px',
            background: 'oklch(98% 0.005 85)',
            border: '1px solid oklch(92% 0.008 85)',
            borderRadius: 10,
          }}
        >
          {steps.map((step, i) => (
            <li
              key={`step-${i}`}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(80px, max-content) 1fr',
                gap: 12,
                padding: '6px 0',
                borderTop: i === 0 ? 'none' : '1px solid oklch(94% 0.008 85)',
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              <span
                style={{
                  fontWeight: 500,
                  color: KIND_COLOR[step.kind],
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: 0.3,
                  paddingTop: 2,
                }}
              >
                {KIND_LABELS[step.kind]}
              </span>
              <span style={{ color: 'oklch(25% 0.01 85)' }}>
                <span style={{ fontWeight: 500 }}>{step.label}</span>
                {step.detail && (
                  <span
                    style={{
                      display: 'block',
                      color: 'oklch(45% 0.01 85)',
                      fontSize: 11,
                      marginTop: 2,
                    }}
                  >
                    {step.detail}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
