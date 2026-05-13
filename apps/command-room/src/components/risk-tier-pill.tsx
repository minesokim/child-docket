// RiskTierPill — green / amber / red classifier rendered on every
// client list row.
//
// Per CLAUDE.md §4 Command Room Clients page:
//   "Each row carries a risk-tier pill (green/amber/red) the firm's
//    AI Preferences settings drive."
//
// And §8 Practice intelligence:
//   "Per-client risk tier (green/amber/red) summarizes the AI's
//    confidence in the firm-client fit (compliance posture, payment
//    history, communication friction, scope drift)."
//
// HEURISTIC v0 (the formula behind the tier — caller computes)
//   - GREEN  no open compliance issues + no overdue invoices + ≤3 days
//            avg response time + no scope-creep flags
//   - AMBER  exactly one of those is broken OR firm AI Preferences
//            sets a conservative posture (downgrades borderline cases)
//   - RED    two+ broken OR active audit OR past-deadline filing
//
// v0 PRESENTATION
//   - 8px circle + tier name (small caption-style font)
//   - Color drives the signal; the label is for accessibility
//   - Tooltip on hover surfaces the reason chain (top 3 contributing
//     factors) so the preparer knows WHY before they click in

type Tier = 'green' | 'amber' | 'red';

type Props = {
  tier: Tier;
  /** When provided, hover tooltip shows these reason strings. */
  reasons?: string[];
  /**
   * Compact variant for dense tables (no label, just the dot).
   * Default = false (full pill with text).
   */
  compact?: boolean;
};

const TIER_LABELS: Record<Tier, string> = {
  green: 'On track',
  amber: 'Watch',
  red: 'At risk',
};

const TIER_FILL: Record<Tier, string> = {
  green: 'oklch(42% 0.09 150)',
  amber: 'oklch(58% 0.13 75)',
  red: 'oklch(52% 0.18 28)',
};

const TIER_FILL_SOFT: Record<Tier, string> = {
  green: 'oklch(92% 0.05 150)',
  amber: 'oklch(94% 0.06 75)',
  red: 'oklch(94% 0.07 28)',
};

export function RiskTierPill({ tier, reasons, compact = false }: Props) {
  const label = TIER_LABELS[tier];
  const tooltipTitle =
    reasons && reasons.length > 0
      ? `${label} — ${reasons.slice(0, 3).join('; ')}`
      : label;

  if (compact) {
    return (
      <span
        title={tooltipTitle}
        aria-label={tooltipTitle}
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: 999,
          background: TIER_FILL[tier],
        }}
      />
    );
  }

  return (
    <span
      title={tooltipTitle}
      aria-label={tooltipTitle}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 9px',
        background: TIER_FILL_SOFT[tier],
        borderRadius: 999,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        fontSize: 11,
        fontWeight: 500,
        color: TIER_FILL[tier],
        letterSpacing: 0.1,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'inline-block',
          width: 6,
          height: 6,
          borderRadius: 999,
          background: TIER_FILL[tier],
        }}
      />
      {label}
    </span>
  );
}

/**
 * Heuristic classifier v0. Caller assembles the inputs from the
 * client record; this function maps them to a tier + reasons array.
 *
 * Future versions will read tenant_ai_preferences thresholds to
 * shift the green/amber/red borders per firm posture; v0 hard-codes
 * the boundaries.
 */
export type RiskInputs = {
  openIssueCount: number;
  overdueInvoiceCount: number;
  /** Days. Higher = more friction. */
  avgResponseDays: number;
  scopeCreepFlags: number;
  hasActiveAudit: boolean;
  hasPastDeadlineFiling: boolean;
};

export function classifyRisk(inputs: RiskInputs): {
  tier: Tier;
  reasons: string[];
} {
  const reasons: string[] = [];
  let strikes = 0;

  if (inputs.hasActiveAudit) {
    reasons.push('active IRS audit');
    strikes += 2; // counts double — audits are red-zone by definition
  }
  if (inputs.hasPastDeadlineFiling) {
    reasons.push('past-deadline filing');
    strikes += 2;
  }
  if (inputs.openIssueCount > 0) {
    reasons.push(`${inputs.openIssueCount} open compliance issue${inputs.openIssueCount === 1 ? '' : 's'}`);
    strikes += 1;
  }
  if (inputs.overdueInvoiceCount > 0) {
    reasons.push(
      `${inputs.overdueInvoiceCount} overdue invoice${inputs.overdueInvoiceCount === 1 ? '' : 's'}`,
    );
    strikes += 1;
  }
  if (inputs.avgResponseDays > 5) {
    reasons.push(`avg response ${Math.round(inputs.avgResponseDays)}d`);
    strikes += 1;
  }
  if (inputs.scopeCreepFlags > 0) {
    reasons.push(`${inputs.scopeCreepFlags} scope flag${inputs.scopeCreepFlags === 1 ? '' : 's'}`);
    strikes += 1;
  }

  if (strikes >= 2) return { tier: 'red', reasons };
  if (strikes === 1) return { tier: 'amber', reasons };
  return { tier: 'green', reasons: reasons.length > 0 ? reasons : ['nothing flagged'] };
}
