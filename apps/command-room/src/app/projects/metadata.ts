// Canonical project template metadata.
//
// Lives in a non-`'use server'` file because Next.js Server Actions
// require every export from a `'use server'` module to be an async
// function. The canonical-template descriptions are pure data
// helpers shared between the seeder action (./actions.ts) and the
// settings/projects pages — they aren't server actions, so they
// belong in a plain module.
//
// Codex round 4 (C24) caught the build-break this fixes: previously
// getCanonicalTemplateMetadata + ProjectTemplate lived in actions.ts
// alongside seedProjectTemplates, which made the Next.js build
// reject the non-async metadata export.

export interface ProjectTemplate {
  kind: string;
  name: string;
  description: string;
  colorHint: string;
}

/**
 * Canonical 12 project templates per CLAUDE.md §4 Command Room
 * Projects. Each kind also represents the canonical primary
 * workflow type firms encounter; firms can clone + rename.
 */
export const CANONICAL_PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    kind: 'annual_return_prep',
    name: 'Annual Return Prep',
    description:
      'Per-tax-year 1040 / 1120-S / 1120 / 1065 prep workflow. Branched by form type. Drives the dominant engagement lifecycle from January through April 15.',
    colorHint: 'forest',
  },
  {
    kind: 'discovery_scan',
    name: 'Discovery Scan',
    description:
      'Book-wide deduction surfacing with cited authority. The wedge offering — productized at $1-5K per book. Runs continuously against the client roster.',
    colorHint: 'amber',
  },
  {
    kind: 'audit_defense',
    name: 'Audit Defense Engagement',
    description:
      'Per active audit. Pulls transcripts, drafts §6651 reasonable-cause arguments, builds the contemporaneous-documentation file. Year-round work.',
    colorHint: 'terra',
  },
  {
    kind: 'notice_response',
    name: 'Notice Response Workflow',
    description:
      'CP2000 / CP504 / LT11 et al. Triage + drafted response with cited authority. Off-season recurring revenue ($200-$500 per notice handled).',
    colorHint: 'amber',
  },
  {
    kind: 'quarterly_estimates',
    name: 'Quarterly Estimated Payments Cycle',
    description:
      'Four touchpoints per year (Apr 15 / Jun 15 / Sep 15 / Jan 15). Pre-calculates safe-harbor amounts; pre-drafts client reminders.',
    colorHint: 'ink-blue',
  },
  {
    kind: 'incorporation',
    name: 'Incorporation',
    description:
      'CA SoS filing + Form 8832 election + BOI registration + first-year compliance. Mom-and-pop incorporation flow.',
    colorHint: 'forest',
  },
  {
    kind: 'boi_annual',
    name: 'BOI Annual Filing',
    description:
      'FinCEN Beneficial Ownership Information. Required for all corps + LLCs within 90 days of formation, 30 days of any change. $500/day penalty risk.',
    colorHint: 'terra',
  },
  {
    kind: 'year_round_planning',
    name: 'Year-Round Planning Touchpoints',
    description:
      'Q2 extension review / Q3 estimates / Q4 Roth conversion window + bunching strategy. Quarterly check-in cadence that justifies subscription pricing.',
    colorHint: 'forest',
  },
  {
    kind: 'statement_of_information',
    name: 'Statement of Information Renewal',
    description:
      'Annual or biennial CA SoS filing per entity type. Suspension risk if overdue. Antonio sells this at $10-25 per filing.',
    colorHint: 'amber',
  },
  {
    kind: 'pre_filing_reconciliation',
    name: 'Pre-Filing IRS Reconciliation',
    description:
      'Pull W&I transcripts via Tax Pro Account → compare to client-uploaded docs → flag missing forms before the IRS auto-letter fires. Marquee invisible value-add (V1.5).',
    colorHint: 'ink-blue',
  },
  {
    kind: 'transcript_pull_cycle',
    name: '8821 Transcript Pull Cycle',
    description:
      'Per-quarter automated transcript pull for monitored clients. Catches IRS letters before they hit the mailbox. (Depends on V1.5 Tax Pro Account integration.)',
    colorHint: 'ink-blue',
  },
  {
    kind: 'client_onboarding',
    name: 'Client Onboarding',
    description:
      'Intake → docs → engagement letter → §7216 consent → deposit. Standardizes the first-week-of-new-client motion.',
    colorHint: 'forest',
  },
];

/**
 * Get canonical template metadata for the UI — labels + colors
 * keyed by kind. UI uses this to render template descriptions when
 * a firm's project row has the canonical kind.
 */
export function getCanonicalTemplateMetadata(): Record<
  string,
  { description: string; colorHint: string }
> {
  const map: Record<string, { description: string; colorHint: string }> = {};
  for (const t of CANONICAL_PROJECT_TEMPLATES) {
    map[t.kind] = { description: t.description, colorHint: t.colorHint };
  }
  return map;
}
