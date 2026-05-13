// Canonical nudge rule metadata.
//
// Lives in a non-`'use server'` file because Next.js Server Actions
// require every export from a `'use server'` module to be an async
// function. The canonical-rule descriptions are pure data shared
// between the seeder action (./actions.ts) and the settings/nudges
// page — they aren't server actions, so they belong in a plain
// module.
//
// Codex round 4 (C24) caught the build-break this fixes: previously
// CANONICAL_RULES + getCanonicalRuleMetadata lived in actions.ts
// alongside seedNudgeDefaults, which made the Next.js build reject
// the non-async metadata export.

export type NudgeTriggerClass =
  | 'life_event'
  | 'time_window'
  | 'drift'
  | 'milestone'
  | 'drift_from_prior'
  | 'compliance_risk';

export interface CanonicalNudgeRule {
  triggerClass: NudgeTriggerClass;
  triggerKey: string;
  /** Human label rendered on Settings → Nudges UI. */
  label: string;
  /** One-line description for the firm owner. */
  description: string;
  enabled: boolean;
  /** Per-rule confidence floor; nudges below this aren't surfaced. */
  confidenceFloor: number;
  /** Max nudges per client per N days. */
  maxPerClientPerDays: number;
  /** Compliance-risk + 8879 type triggers honor quiet hours less aggressively. */
  respectQuietHours: boolean;
}

/**
 * Canonical rule catalog. ~13 rules covering the high-leverage
 * triggers across the 6 trigger classes. Firms enable / disable /
 * tune per their voice + segment.
 *
 * Defaults: rules with broad applicability (Q3 estimates, S-corp
 * threshold, SoI overdue, BOI deadline) start enabled. Noisier
 * rules (charitable giving doubled, 1099 income tripled) start
 * disabled and firms opt-in.
 */
export const CANONICAL_NUDGE_RULES: CanonicalNudgeRule[] = [
  // Life event
  {
    triggerClass: 'life_event',
    triggerKey: 'child_starts_college',
    label: 'Child starts college',
    description:
      "When a client's dependent turns 17-18 with a likely fall enrollment, surface AOTC eligibility + 529 windowing conversation.",
    enabled: true,
    confidenceFloor: 0.75,
    maxPerClientPerDays: 90,
    respectQuietHours: true,
  },
  {
    triggerClass: 'life_event',
    triggerKey: 'marriage',
    label: 'Marriage',
    description:
      'New marriage detected from name change or filing status indication. Surface MFJ vs MFS decision + community property analysis.',
    enabled: true,
    confidenceFloor: 0.8,
    maxPerClientPerDays: 60,
    respectQuietHours: true,
  },
  {
    triggerClass: 'life_event',
    triggerKey: 'spouse_death',
    label: 'Spouse death',
    description:
      'Surfaced from notice / message indication. Surface QW filing status options + step-up basis review + estate-tax conversation.',
    enabled: true,
    confidenceFloor: 0.85,
    maxPerClientPerDays: 30,
    respectQuietHours: true,
  },

  // Time window
  {
    triggerClass: 'time_window',
    triggerKey: 'q3_estimated_payment_due',
    label: 'Q3 estimated payment due (Sept 15)',
    description:
      'Fires Aug 15 for clients with prior-year tax > $1,000 or current-year withholding underpayment. Pre-drafted reminder with calculated amount.',
    enabled: true,
    confidenceFloor: 0.7,
    maxPerClientPerDays: 30,
    respectQuietHours: true,
  },
  {
    triggerClass: 'time_window',
    triggerKey: 'roth_conversion_window',
    label: 'Q4 Roth conversion window',
    description:
      'Fires Oct 1 - Dec 15 for clients with current-year income drop, IRA balance, and headroom in current marginal bracket. Surface conversion scenarios.',
    enabled: false,
    confidenceFloor: 0.8,
    maxPerClientPerDays: 60,
    respectQuietHours: true,
  },
  {
    triggerClass: 'time_window',
    triggerKey: 'q4_year_end_planning',
    label: 'Q4 year-end planning touchpoint',
    description:
      'Fires Nov 1 for all active clients. Charitable bunching, retirement contribution, capital loss harvesting check-in.',
    enabled: false,
    confidenceFloor: 0.6,
    maxPerClientPerDays: 365,
    respectQuietHours: true,
  },

  // Drift
  {
    triggerClass: 'drift',
    triggerKey: 'w2_jump_40pct',
    label: 'W-2 jumped 40%+ YoY',
    description:
      'Current-year W-2 income up significantly. Surface Roth conversion + bracket-management + additional withholding conversation.',
    enabled: true,
    confidenceFloor: 0.75,
    maxPerClientPerDays: 90,
    respectQuietHours: true,
  },

  // Milestone
  {
    triggerClass: 'milestone',
    triggerKey: 'business_revenue_250k',
    label: 'Business revenue crosses $250K',
    description:
      "When a Schedule C or LLC client's revenue first crosses $250K, surface S-corp election conversation (reasonable comp + AAA + Form 2553 deadline).",
    enabled: true,
    confidenceFloor: 0.85,
    maxPerClientPerDays: 365,
    respectQuietHours: true,
  },
  {
    triggerClass: 'milestone',
    triggerKey: 'qbi_phaseout_edge',
    label: '§199A QBI phaseout edge',
    description:
      'Client approaching the §199A QBI phaseout threshold ($241,950 single / $483,900 MFJ 2026). Surface planning conversation before year-end.',
    enabled: true,
    confidenceFloor: 0.8,
    maxPerClientPerDays: 180,
    respectQuietHours: true,
  },
  {
    triggerClass: 'milestone',
    triggerKey: 'llc_formed',
    label: 'New LLC formed (BOI deadline)',
    description:
      'New entity formation detected. Surface 90-day BOI filing deadline ($500/day penalty risk).',
    enabled: true,
    confidenceFloor: 0.9,
    maxPerClientPerDays: 30,
    respectQuietHours: false,
  },

  // Drift from prior
  {
    triggerClass: 'drift_from_prior',
    triggerKey: 'refund_dropped_60pct',
    label: 'Refund dropped 60%+ YoY',
    description:
      "When a client's filed return shows a significant refund drop vs prior year. Surface YoY explainer + withholding adjustment conversation.",
    enabled: false,
    confidenceFloor: 0.7,
    maxPerClientPerDays: 365,
    respectQuietHours: true,
  },

  // Compliance risk
  {
    triggerClass: 'compliance_risk',
    triggerKey: 'soi_overdue',
    label: 'CA Statement of Information overdue',
    description:
      'CA SoS API shows Statement of Information past due. Suspension risk in 60 days. Surface filing offer + $25 service fee.',
    enabled: true,
    confidenceFloor: 0.95,
    maxPerClientPerDays: 14,
    respectQuietHours: false,
  },
  {
    triggerClass: 'compliance_risk',
    triggerKey: 'entity_out_of_standing',
    label: 'Entity out of state standing',
    description:
      'CA SoS or FTB API shows entity in Suspended / Forfeited status. Surface reinstatement workflow.',
    enabled: true,
    confidenceFloor: 0.95,
    maxPerClientPerDays: 14,
    respectQuietHours: false,
  },
];

/**
 * Export canonical rule labels for the UI (so the settings page
 * can render meaningful labels for rules that exist in the DB).
 */
export function getCanonicalRuleMetadata(): Record<
  string,
  { label: string; description: string }
> {
  const map: Record<string, { label: string; description: string }> = {};
  for (const r of CANONICAL_NUDGE_RULES) {
    const key = `${r.triggerClass}:${r.triggerKey}`;
    map[key] = { label: r.label, description: r.description };
  }
  return map;
}
