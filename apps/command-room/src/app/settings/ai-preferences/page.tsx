// /settings/ai-preferences — per-tenant AI behavior configuration.
//
// Per CLAUDE.md §8 AI Preferences. Drives every agent's system-prompt
// assembly + insight-suppression filter. Lives at
// command-room Settings → Intelligence → AI Preferences.
//
// FOLLOW-UP queued: pull the actual settings UX into separate
// /settings/intelligence and /settings/practice sub-trees (per the
// IA in CLAUDE.md §4). For now the /settings landing page links
// to this and the sibling pages directly.

import { sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { withTenant } from '@docket/db';
import type { TenantId } from '@docket/shared';
import { getCurrentDocketUser } from '@/lib/current-user';
import { CommandShell } from '@/components/command-shell';
import { AiPreferencesForm, type AiPreferencesValues } from './form';
import '../settings.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AiPreferencesRow {
  tone: 'professional' | 'warm' | 'direct';
  discovery_insights: boolean;
  compliance_flags: boolean;
  risk_tier_classification: boolean;
  deadline_alerts: boolean;
  pricing_inconsistency_alerts: boolean;
  churn_risk_alerts: boolean;
  capacity_warnings: boolean;
  personality: string;
  quiet_hours_enabled: boolean;
  quiet_hours_start_min: number;
  quiet_hours_end_min: number;
  [key: string]: unknown;
}

const DEFAULTS: AiPreferencesValues = {
  tone: 'warm',
  discovery_insights: true,
  compliance_flags: true,
  risk_tier_classification: true,
  deadline_alerts: true,
  pricing_inconsistency_alerts: true,
  churn_risk_alerts: true,
  capacity_warnings: true,
  personality: '',
  quiet_hours_enabled: true,
  quiet_hours_start: '19:00',
  quiet_hours_end: '07:00',
};

function minToHHMM(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, '0');
  const m = (min % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

async function loadAiPreferences(tenantId: string): Promise<AiPreferencesValues> {
  return await withTenant(tenantId as TenantId, async (db) => {
    const rows = await db.execute<AiPreferencesRow>(sql`
      SELECT
        tone,
        discovery_insights,
        compliance_flags,
        risk_tier_classification,
        deadline_alerts,
        pricing_inconsistency_alerts,
        churn_risk_alerts,
        capacity_warnings,
        personality,
        quiet_hours_enabled,
        quiet_hours_start_min,
        quiet_hours_end_min
      FROM tenant_ai_preferences
      WHERE tenant_id = ${tenantId}::uuid
    `);
    const arr = rows as unknown as AiPreferencesRow[];
    const row = arr[0];
    if (!row) return DEFAULTS;
    return {
      tone: row.tone,
      discovery_insights: row.discovery_insights,
      compliance_flags: row.compliance_flags,
      risk_tier_classification: row.risk_tier_classification,
      deadline_alerts: row.deadline_alerts,
      pricing_inconsistency_alerts: row.pricing_inconsistency_alerts,
      churn_risk_alerts: row.churn_risk_alerts,
      capacity_warnings: row.capacity_warnings,
      personality: row.personality,
      quiet_hours_enabled: row.quiet_hours_enabled,
      quiet_hours_start: minToHHMM(row.quiet_hours_start_min),
      quiet_hours_end: minToHHMM(row.quiet_hours_end_min),
    };
  });
}

export default async function AiPreferencesPage() {
  const user = await getCurrentDocketUser();
  if (!user) redirect('/sign-in');

  let values: AiPreferencesValues = DEFAULTS;
  let errorMessage: string | null = null;
  try {
    values = await loadAiPreferences(user.tenantId);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'Failed to load AI preferences';
  }

  const canEdit = user.role === 'firm_owner';

  return (
    <CommandShell user={user} tenantName={user.tenantName} activeHref="/settings">
      <div className="settings">
        <header className="settings-header">
          <div className="settings-eyebrow">Intelligence</div>
          <h1 className="settings-title">AI Preferences</h1>
          <p className="settings-subtitle">
            How the AI talks, what it surfaces, what it suppresses. Drives
            every agent's system prompt + insight-suppression filter
            firm-wide. Per-client overrides land in v1.5.
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
            <div className="settings-error-title">Couldn't load preferences</div>
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
            Only the firm owner may edit these settings. You can view the
            current configuration below.
          </div>
        )}

        <AiPreferencesForm initialValues={values} canEdit={canEdit} />
      </div>
    </CommandShell>
  );
}
