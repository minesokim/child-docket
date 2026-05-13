// /settings/nudges — Nudge rules configuration.
//
// Per CLAUDE.md §8 Nudges section + §9 Nudges Agent. Per-tenant
// configuration of which life-event / time-window / drift /
// milestone / drift-from-prior / compliance-risk triggers fire
// as preparer-to-client outreach prompts.
//
// V0 surface: read-only diagnostic + seed-defaults button + per-
// rule toggle (firm_owner gated). The actual Nudge agent that
// generates draft outreach against enabled rules ships in C22+.

import { sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { withTenant } from '@docket/db';
import type { TenantId } from '@docket/shared';
import { getCurrentDocketUser } from '@/lib/current-user';
import { CommandShell } from '@/components/command-shell';
import { SeedNudgeRulesButton } from './seed-button';
import { NudgeRuleToggle } from './rule-toggle';
import { getCanonicalRuleMetadata } from './metadata';
import '../settings.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TriggerClass =
  | 'life_event'
  | 'time_window'
  | 'drift'
  | 'milestone'
  | 'drift_from_prior'
  | 'compliance_risk';

interface RuleRow {
  id: string;
  trigger_class: TriggerClass;
  trigger_key: string;
  enabled: boolean;
  confidence_floor: number;
  max_per_client_per_days: number;
  respect_quiet_hours: boolean;
  [key: string]: unknown;
}

const CLASS_GROUPS: Array<{
  key: TriggerClass;
  label: string;
  description: string;
}> = [
  {
    key: 'compliance_risk',
    label: 'Compliance risk',
    description:
      'CA SoS suspension, BOI deadlines, entity-out-of-standing. Urgency-tier nudges (7-day expiry).',
  },
  {
    key: 'milestone',
    label: 'Milestone',
    description:
      'Business hits $250K rev, §199A phaseout edge, new LLC formation. Tax-decision conversations.',
  },
  {
    key: 'time_window',
    label: 'Time window',
    description:
      'Q3 estimates, Roth conversion window, year-end planning. Calendar-driven.',
  },
  {
    key: 'life_event',
    label: 'Life event',
    description:
      'Child starts college, marriage, spouse death. Long-window relationship prompts.',
  },
  {
    key: 'drift',
    label: 'Drift',
    description:
      'W-2 jumped 40%, 1099 income tripled, charitable doubled. Year-over-year signal triggers.',
  },
  {
    key: 'drift_from_prior',
    label: 'YoY change',
    description:
      'Refund dropped 60%, deduction posture flipped, withholding pattern changed. Filed-return signals.',
  },
];

async function loadRules(tenantId: string): Promise<RuleRow[]> {
  return await withTenant(tenantId as TenantId, async (db) => {
    const rows = await db.execute<RuleRow>(sql`
      SELECT
        id::text AS id,
        trigger_class,
        trigger_key,
        enabled,
        confidence_floor,
        max_per_client_per_days,
        respect_quiet_hours
      FROM nudge_rules
      WHERE tenant_id = ${tenantId}::uuid
      ORDER BY trigger_class, trigger_key
    `);
    return rows as unknown as RuleRow[];
  });
}

export default async function NudgesSettingsPage() {
  const user = await getCurrentDocketUser();
  if (!user) redirect('/sign-in');

  let rules: RuleRow[] = [];
  let errorMessage: string | null = null;
  try {
    rules = await loadRules(user.tenantId);
  } catch (err) {
    errorMessage =
      err instanceof Error ? err.message : 'Failed to load nudge rules';
  }

  const canEdit = user.role === 'firm_owner';
  const meta = getCanonicalRuleMetadata();
  const rulesByClass = new Map<TriggerClass, RuleRow[]>();
  for (const r of rules) {
    const existing = rulesByClass.get(r.trigger_class) ?? [];
    existing.push(r);
    rulesByClass.set(r.trigger_class, existing);
  }

  const totalCanonical = Object.keys(meta).length;
  const missingCount = totalCanonical - rules.length;

  return (
    <CommandShell user={user} tenantName={user.tenantName} activeHref="/settings">
      <div className="settings">
        <header className="settings-header">
          <div className="settings-eyebrow">Practice</div>
          <h1 className="settings-title">Nudges</h1>
          <p className="settings-subtitle">
            Proactive outreach prompts triggered by life events, deadlines,
            milestones, and compliance signals across your client book. Distinct
            from Reminders (which chase clients who owe you something) — Nudges
            push you to reach out before clients know they need you.
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
            <div className="settings-error-title">Couldn't load nudge rules</div>
            <div className="settings-error-body">{errorMessage}</div>
          </div>
        )}

        {!canEdit && (
          <div
            style={{
              padding: 12,
              background: 'oklch(96% 0.01 85)',
              border: '1px solid oklch(90% 0.01 85)',
              borderRadius: 10,
              marginBottom: 20,
              fontSize: 13,
              color: 'oklch(35% 0.01 85)',
            }}
          >
            Only the firm owner may edit nudge rules. View-only mode.
          </div>
        )}

        <section className="settings-section">
          <div className="settings-section-head">
            <h2 className="settings-section-title">Rule catalog</h2>
            {canEdit && missingCount > 0 && (
              <SeedNudgeRulesButton missingCount={missingCount} />
            )}
          </div>

          {rules.length === 0 ? (
            <div
              style={{
                padding: '24px 18px',
                background: 'oklch(99% 0.005 85)',
                border: '1px dashed oklch(90% 0.008 85)',
                borderRadius: 10,
                fontSize: 13,
                color: 'oklch(45% 0.01 85)',
                lineHeight: 1.55,
              }}
            >
              <div
                style={{
                  fontWeight: 500,
                  color: 'oklch(30% 0.01 85)',
                  marginBottom: 4,
                }}
              >
                No nudge rules installed
              </div>
              Install the canonical catalog with one click. {totalCanonical} rules
              across 6 trigger classes (compliance risk, milestone, time window,
              life event, drift, year-over-year change). You can disable any rule
              after seeding.
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
              }}
            >
              {CLASS_GROUPS.map((group) => {
                const groupRules = rulesByClass.get(group.key) ?? [];
                if (groupRules.length === 0) return null;
                const enabledCount = groupRules.filter((r) => r.enabled).length;
                return (
                  <section key={group.key}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        marginBottom: 8,
                      }}
                    >
                      <h3
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'oklch(20% 0.01 85)',
                          margin: 0,
                          letterSpacing: 0.1,
                        }}
                      >
                        {group.label}
                      </h3>
                      <span
                        style={{
                          fontSize: 11,
                          color: 'oklch(50% 0.01 85)',
                          letterSpacing: 0.2,
                          textTransform: 'uppercase',
                        }}
                      >
                        {enabledCount} of {groupRules.length} enabled
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: 12,
                        color: 'oklch(50% 0.01 85)',
                        margin: '0 0 10px 0',
                        lineHeight: 1.55,
                      }}
                    >
                      {group.description}
                    </p>
                    <ul
                      style={{
                        listStyle: 'none',
                        padding: 0,
                        margin: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      {groupRules.map((rule) => {
                        const key = `${rule.trigger_class}:${rule.trigger_key}`;
                        const metadata = meta[key];
                        return (
                          <li
                            key={rule.id}
                            style={{
                              padding: '10px 12px',
                              background: 'oklch(99% 0.005 85)',
                              border: '1px solid oklch(93% 0.008 85)',
                              borderRadius: 8,
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 12,
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: 500,
                                  color: 'oklch(20% 0.01 85)',
                                  marginBottom: 2,
                                }}
                              >
                                {metadata?.label ?? rule.trigger_key}
                              </div>
                              {metadata?.description && (
                                <div
                                  style={{
                                    fontSize: 11,
                                    color: 'oklch(48% 0.01 85)',
                                    lineHeight: 1.5,
                                    marginBottom: 4,
                                  }}
                                >
                                  {metadata.description}
                                </div>
                              )}
                              <div
                                style={{
                                  fontSize: 10,
                                  color: 'oklch(55% 0.01 85)',
                                  letterSpacing: 0.2,
                                }}
                              >
                                confidence floor {Math.round(rule.confidence_floor * 100)}% · max {rule.max_per_client_per_days}d/client
                                {rule.respect_quiet_hours
                                  ? ' · honors Quiet Hours'
                                  : ' · ignores Quiet Hours (urgency)'}
                              </div>
                            </div>
                            <NudgeRuleToggle
                              ruleId={rule.id}
                              enabled={rule.enabled}
                              disabled={!canEdit}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </section>

        <section className="settings-section" style={{ marginTop: 24 }}>
          <div className="settings-section-head">
            <h2 className="settings-section-title">How nudges run</h2>
          </div>
          <div
            style={{
              padding: '14px 16px',
              background: 'oklch(99% 0.005 85)',
              border: '1px solid oklch(93% 0.008 85)',
              borderRadius: 10,
              fontSize: 13,
              color: 'oklch(35% 0.01 85)',
              lineHeight: 1.6,
            }}
          >
            <strong style={{ color: 'oklch(20% 0.01 85)' }}>Daily cron</strong> walks
            your enabled rules against client facts, engagement state, and the
            calendar. Each matching client + rule combination produces a pending
            nudge with a pre-drafted outreach. You approve, edit, or dismiss from
            the home feed or <Link href="/nudges" style={{ color: 'oklch(42% 0.09 150)', textDecoration: 'none' }}>/nudges</Link>.
            <br />
            <br />
            <strong style={{ color: 'oklch(20% 0.01 85)' }}>Quiet Hours</strong> apply
            to most nudges. Compliance-risk rules (SoI overdue, entity out of
            standing, BOI deadline) bypass quiet hours because the urgency window
            outweighs the noise discipline.
            <br />
            <br />
            <strong style={{ color: 'oklch(20% 0.01 85)' }}>Calibration</strong>:
            when you dismiss a nudge with a reason, the agent learns to lower
            confidence for that trigger on that client over time.
          </div>
        </section>
      </div>
    </CommandShell>
  );
}
