// /settings/reminders — Automated Reminders configuration.
//
// Per CLAUDE.md §8 Automated Reminders. Five canonical reminder
// triggers per tenant. V0 surface: read-only diagnostic + a "seed
// defaults" action that inserts the canonical 5 rules with their
// migration-recommended defaults. Per-rule edit UI lands in v1.5.
//
// The point of this page in v1: prove the rules table is wired,
// surface the cadence Antonio's firm is running on, give him a
// single button to install the canonical set on his tenant. The
// reminder execution loop (Inngest cron + scheduler) lands as a
// follow-up commit.

import { sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { withTenant } from '@docket/db';
import type { TenantId } from '@docket/shared';
import { getCurrentDocketUser } from '@/lib/current-user';
import { CommandShell } from '@/components/command-shell';
import { SeedDefaultsButton } from './seed-defaults-button';
import '../settings.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Trigger =
  | 'missing_documents'
  | 'engagement_letter_unsigned'
  | 'eightyseventynine_pending'
  | 'outstanding_balance'
  | 'year_round_planning';

interface RuleRow {
  trigger: Trigger;
  enabled: boolean;
  interval_hours: number;
  max_attempts: number;
  channel: string;
  respect_quiet_hours: boolean;
  [key: string]: unknown;
}

const TRIGGER_LABELS: Record<Trigger, { name: string; description: string }> = {
  missing_documents: {
    name: 'Missing documents',
    description:
      'Nudge client to upload outstanding docs. Default: every 72h, max 5 attempts.',
  },
  engagement_letter_unsigned: {
    name: 'Engagement letter unsigned',
    description:
      'Nudge to sign the engagement letter. Default: every 48h, max 4 attempts.',
  },
  eightyseventynine_pending: {
    name: 'Form 8879 awaiting signature',
    description:
      'Tax-season-critical signature reminder. Default: every 24h, max 3 attempts.',
  },
  outstanding_balance: {
    name: 'Outstanding balance',
    description:
      'Invoice past due. Default: weekly until paid. Email channel only.',
  },
  year_round_planning: {
    name: 'Year-round planning touchpoint',
    description:
      'Quarterly check-in (Q2 extensions, Q3 estimates, Q4 Roth conversion). Opt-in per firm.',
  },
};

async function loadRules(tenantId: string): Promise<RuleRow[]> {
  return await withTenant(tenantId as TenantId, async (db) => {
    const rows = await db.execute<RuleRow>(sql`
      SELECT
        trigger,
        enabled,
        interval_hours,
        max_attempts,
        channel,
        respect_quiet_hours
      FROM reminder_rules
      WHERE tenant_id = ${tenantId}::uuid
      ORDER BY trigger
    `);
    return rows as unknown as RuleRow[];
  });
}

export default async function RemindersPage() {
  const user = await getCurrentDocketUser();
  if (!user) redirect('/sign-in');

  let rules: RuleRow[] = [];
  let errorMessage: string | null = null;
  try {
    rules = await loadRules(user.tenantId);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'Failed to load reminder rules';
  }

  const canEdit = user.role === 'firm_owner';
  const rulesByTrigger = new Map<Trigger, RuleRow>();
  for (const r of rules) rulesByTrigger.set(r.trigger, r);

  return (
    <CommandShell user={user} tenantName={user.tenantName} activeHref="/settings">
      <div className="settings">
        <header className="settings-header">
          <div className="settings-eyebrow">Practice</div>
          <h1 className="settings-title">Automated Reminders</h1>
          <p className="settings-subtitle">
            Five canonical reminder rules per tenant. The reminder
            execution loop runs on Inngest cron + checks every active
            engagement against these rules. Per-rule edit UI lands in v1.5;
            for v1 the canonical defaults install as a single action.
          </p>
          <div style={{ marginTop: 10 }}>
            <Link
              href="/settings"
              style={{
                fontSize: 13,
                color: 'oklch(42% 0.09 150)',
                textDecoration: 'none',
              }}
            >
              ← Back to settings
            </Link>
          </div>
        </header>

        {errorMessage && (
          <div className="settings-error" role="alert">
            <div className="settings-error-title">Couldn't load reminder rules</div>
            <div className="settings-error-body">{errorMessage}</div>
          </div>
        )}

        <section className="settings-section">
          <div className="settings-section-head">
            <h2 className="settings-section-title">Canonical triggers</h2>
            {canEdit && rules.length < 5 && (
              <SeedDefaultsButton missingCount={5 - rules.length} />
            )}
          </div>
          <ul className="settings-integrations">
            {(Object.keys(TRIGGER_LABELS) as Trigger[]).map((trigger) => {
              const rule = rulesByTrigger.get(trigger);
              const meta = TRIGGER_LABELS[trigger];
              return (
                <li key={trigger} className="settings-integ">
                  <div className="settings-integ-main">
                    <div className="settings-integ-name">{meta.name}</div>
                    <div className="settings-integ-purpose">
                      {meta.description}
                    </div>
                    {rule && (
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 11,
                          color: 'oklch(50% 0.01 85)',
                        }}
                      >
                        every {rule.interval_hours}h · max{' '}
                        {rule.max_attempts} attempts · {rule.channel} channel
                        {rule.respect_quiet_hours && ' · honors Quiet Hours'}
                      </div>
                    )}
                  </div>
                  <span
                    className={`settings-integ-status ${
                      rule
                        ? rule.enabled
                          ? 'settings-integ-ok'
                          : 'settings-integ-missing'
                        : 'settings-integ-missing'
                    }`}
                  >
                    {rule
                      ? rule.enabled
                        ? 'Enabled'
                        : 'Disabled'
                      : 'Not seeded'}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </CommandShell>
  );
}
