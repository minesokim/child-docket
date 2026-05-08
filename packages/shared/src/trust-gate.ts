// Trust gate enforcement helper.
//
// Per docs/POSITION-FRAMEWORK.md §6 + CLAUDE.md §8 trust escalation.
// The four firm-trust levels gate two orthogonal axes:
//
//   1. Position tier (compliance-first deduction surfacing)
//      Tier 1 = settled law            (>=95% sustainability)
//      Tier 2 = substantial authority  (~40% sustainability)
//      Tier 3 = reasonable basis       (~20%, requires Form 8275)
//      Tier 4 = more likely than not   (>50% required for shelters)
//      Below floor = REFUSE (no AI execution; no fact-bring; record only)
//
//   2. Action class (what the AI is being asked to do)
//      'read' / 'classify' / 'draft'   never gated (no side effect)
//      'send-internal' / 'mutate-intake' rarely gated (in-system writes
//                                                       follow the same
//                                                       RLS as user writes)
//      'send-external'                 gated by trust level (auto only at L4)
//      'mutate-tax-software'           always EA-decides regardless of level
//      'file'                          always EA-decides regardless of level
//                                       (form 8879 / 2848 / 8821 / 2848 etc.)
//
// THE GATE
//
//   assertTrustGate({trustLevel, positionTier?, actionClass}) returns
//   { allowed: true } if the firm's trust level permits the action.
//   Otherwise { allowed: false, requires: 'human-approval' | 'refusal',
//   reason }.
//
//   The orchestrator's runDocketAgent calls this BEFORE every external-
//   side-effect action. If allowed=false, the agent emits a "needs-
//   approval" status to the issues queue instead of executing.
//
// USE FROM AGENT CODE
//
//   const decision = assertTrustGate({
//     trustLevel: tenant.defaultTrustLevel,
//     actionClass: 'send-external',
//     positionTier: tier,                    // optional; required for
//                                            //   tier-bound action classes
//   });
//   if (!decision.allowed) {
//     await markPendingApproval({ ... });
//     return;
//   }
//   // ... execute the action
//
// PURE FUNCTION — no I/O, no state. Safe to call from server actions,
// Inngest steps, agent code. Same shape as scrubPII / pii-scrubber.

import type { ActionClass, TrustLevel } from './index.js';

/** Position-framework tier classification. Tier 5 = below the refusal floor. */
export type PositionTier = 1 | 2 | 3 | 4 | 5;

export interface TrustGateInput {
  /** Firm's currently-configured trust level (per tenants.defaultTrustLevel). */
  trustLevel: TrustLevel;
  /**
   * Optional. Required when actionClass involves a tax-position emission
   * (e.g., send-external for a position-bearing email; file for a return
   * containing positions). Omit for actions that aren't position-bearing.
   */
  positionTier?: PositionTier;
  /** What the AI is asking to do. */
  actionClass: ActionClass;
}

export type TrustGateDecision =
  | { allowed: true }
  | {
      allowed: false;
      /**
       * 'human-approval' — action is blocked but legitimate; queue for EA
       *                    review. Most common decision for v1 firms (L1).
       * 'refusal'        — action is below the framework's refusal floor;
       *                    do NOT queue, do NOT execute, just log + return.
       */
      requires: 'human-approval' | 'refusal';
      reason: string;
    };

// ────────────────────────────────────────────────────────────────
// Decision table — distilled from POSITION-FRAMEWORK §6.
//
// Position-tier × trust-level grid:
//
//   Level    | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Below floor
//   ---------|--------|--------|--------|--------|------------
//   L1       | EA     | EA     | EA     | EA     | REFUSE
//   L2       | auto   | EA     | EA     | EA     | REFUSE
//   L3       | auto   | auto   | EA     | EA     | REFUSE
//   L4       | auto   | auto   | flag   | EA     | REFUSE
//
// Where:
//   auto   = AI may execute without human-approval gate
//   flag   = auto-execute BUT with default 8275 disclosure attached
//   EA     = blocked; human-approval gate
//   REFUSE = NEVER execute regardless of level; framework refusal floor
// ────────────────────────────────────────────────────────────────

function tierGateForLevel(
  level: TrustLevel,
  tier: PositionTier,
): 'auto' | 'flag' | 'EA' | 'REFUSE' {
  if (tier === 5) return 'REFUSE';
  // Position tier 1-4 against trust level 1-4:
  //   L1 → all EA
  //   L2 → tier 1 auto, rest EA
  //   L3 → tier 1-2 auto, rest EA
  //   L4 → tier 1-2 auto, tier 3 flag, tier 4 EA
  if (level === 1) return 'EA';
  if (level === 2) return tier === 1 ? 'auto' : 'EA';
  if (level === 3) return tier <= 2 ? 'auto' : 'EA';
  // level === 4
  if (tier <= 2) return 'auto';
  if (tier === 3) return 'flag';
  return 'EA';
}

/**
 * Some action classes are universally gated regardless of trust level
 * or position tier. These are operations that touch external systems
 * + cannot be undone by deleting a row in our DB.
 */
const ALWAYS_EA: ReadonlySet<ActionClass> = new Set<ActionClass>([
  'mutate-tax-software', // OLT prefill, IRS Solutions writes
  'file', // 8879, 2848, 8821, return submission
]);

/**
 * Action classes that NEVER require gating. Pure observation /
 * categorization / internal-only side effects.
 */
const NEVER_GATED: ReadonlySet<ActionClass> = new Set<ActionClass>([
  'read',
  'classify',
  'draft', // drafts await preparer approval at the next step anyway
  'send-internal',
  'mutate-intake', // taxpayer-initiated; gated upstream by phone OTP + RLS
]);

/**
 * Returns a gate decision. Pure function; no I/O. Safe to call from
 * server actions, Inngest steps, agent code, browser bundles.
 *
 * @example
 *   const d = assertTrustGate({
 *     trustLevel: tenant.defaultTrustLevel,
 *     actionClass: 'send-external',
 *     positionTier: 2,
 *   });
 *   if (!d.allowed) {
 *     // queue for EA approval (or refuse, per d.requires)
 *   }
 */
export function assertTrustGate(input: TrustGateInput): TrustGateDecision {
  // Always-EA action classes ignore tier and trust level.
  if (ALWAYS_EA.has(input.actionClass)) {
    return {
      allowed: false,
      requires: 'human-approval',
      reason: `action class "${input.actionClass}" always requires explicit EA approval`,
    };
  }

  // Never-gated action classes pass through.
  if (NEVER_GATED.has(input.actionClass)) {
    return { allowed: true };
  }

  // Remaining: 'send-external'. Position-tier-aware.
  if (input.actionClass === 'send-external') {
    if (input.positionTier === undefined) {
      // External send WITHOUT a position tier — this is a generic
      // outbound communication (e.g., "your docs are ready"). At L1
      // every send-external requires EA approval (the inbox-drafter
      // pattern). At L2+ auto-send when the issue is non-position-
      // bearing.
      if (input.trustLevel === 1) {
        return {
          allowed: false,
          requires: 'human-approval',
          reason: 'send-external at trust level 1 requires EA approval',
        };
      }
      return { allowed: true };
    }

    const gate = tierGateForLevel(input.trustLevel, input.positionTier);
    if (gate === 'auto' || gate === 'flag') {
      return { allowed: true };
    }
    if (gate === 'REFUSE') {
      return {
        allowed: false,
        requires: 'refusal',
        reason: 'position tier below framework refusal floor (no defensible authority)',
      };
    }
    // 'EA'
    return {
      allowed: false,
      requires: 'human-approval',
      reason: `tier ${input.positionTier} position at trust level ${input.trustLevel} requires EA approval`,
    };
  }

  // Defensive: any new ActionClass added to @docket/shared without
  // updating this gate falls through to EA approval. Fail-closed.
  return {
    allowed: false,
    requires: 'human-approval',
    reason: `unknown actionClass "${input.actionClass}" — failing closed pending gate update`,
  };
}

/**
 * Convenience: returns true if the gate would allow the action.
 * Useful for UI-state queries where the caller doesn't need the
 * structured decision.
 */
export function isAllowedByTrustGate(input: TrustGateInput): boolean {
  return assertTrustGate(input).allowed;
}
