// /settings/ai-preferences server actions.
//
// Save handler for tenant_ai_preferences. UPSERTs the single row per
// tenant. Only firm_owner role may edit (per CLAUDE.md §8 — AI
// behavior is a firm-owner decision, not a preparer-level setting).
//
// Plain TS validation at the server action boundary; we don't pull
// zod into command-room just for this surface (and the schema is
// small enough to validate by hand).

'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { withTenant } from '@docket/db';
import type { TenantId } from '@docket/shared';
import { getCurrentDocketUser } from '@/lib/current-user';

const VALID_TONES = new Set(['professional', 'warm', 'direct']);

function hhmmToMin(hhmm: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export type SaveResult =
  | { ok: true }
  | { ok: false; error: string };

export async function saveAiPreferences(
  formData: FormData,
): Promise<SaveResult> {
  const user = await getCurrentDocketUser();
  if (!user) return { ok: false, error: 'Not signed in.' };
  if (user.role !== 'firm_owner') {
    return {
      ok: false,
      error: 'Only the firm owner may edit AI preferences.',
    };
  }

  const tone = (formData.get('tone') ?? 'warm').toString();
  if (!VALID_TONES.has(tone)) {
    return { ok: false, error: 'Invalid tone value.' };
  }

  const personality = (formData.get('personality') ?? '').toString();
  if (personality.length > 500) {
    return { ok: false, error: 'Personality must be 500 characters or fewer.' };
  }

  const startStr = (formData.get('quiet_hours_start') ?? '19:00').toString();
  const endStr = (formData.get('quiet_hours_end') ?? '07:00').toString();
  const startMin = hhmmToMin(startStr);
  const endMin = hhmmToMin(endStr);
  if (startMin === null || endMin === null) {
    return { ok: false, error: 'Quiet Hours time format must be HH:MM.' };
  }

  const cb = (key: string) => formData.get(key) === 'on';

  const values = {
    tone: tone as 'professional' | 'warm' | 'direct',
    discovery_insights: cb('discovery_insights'),
    compliance_flags: cb('compliance_flags'),
    risk_tier_classification: cb('risk_tier_classification'),
    deadline_alerts: cb('deadline_alerts'),
    pricing_inconsistency_alerts: cb('pricing_inconsistency_alerts'),
    churn_risk_alerts: cb('churn_risk_alerts'),
    capacity_warnings: cb('capacity_warnings'),
    personality,
    quiet_hours_enabled: cb('quiet_hours_enabled'),
    quiet_hours_start_min: startMin,
    quiet_hours_end_min: endMin,
  };

  await withTenant(user.tenantId as TenantId, async (db) => {
    await db.execute(sql`
      INSERT INTO tenant_ai_preferences (
        tenant_id,
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
      ) VALUES (
        ${user.tenantId}::uuid,
        ${values.tone},
        ${values.discovery_insights},
        ${values.compliance_flags},
        ${values.risk_tier_classification},
        ${values.deadline_alerts},
        ${values.pricing_inconsistency_alerts},
        ${values.churn_risk_alerts},
        ${values.capacity_warnings},
        ${values.personality},
        ${values.quiet_hours_enabled},
        ${values.quiet_hours_start_min},
        ${values.quiet_hours_end_min}
      )
      ON CONFLICT (tenant_id) DO UPDATE SET
        tone = EXCLUDED.tone,
        discovery_insights = EXCLUDED.discovery_insights,
        compliance_flags = EXCLUDED.compliance_flags,
        risk_tier_classification = EXCLUDED.risk_tier_classification,
        deadline_alerts = EXCLUDED.deadline_alerts,
        pricing_inconsistency_alerts = EXCLUDED.pricing_inconsistency_alerts,
        churn_risk_alerts = EXCLUDED.churn_risk_alerts,
        capacity_warnings = EXCLUDED.capacity_warnings,
        personality = EXCLUDED.personality,
        quiet_hours_enabled = EXCLUDED.quiet_hours_enabled,
        quiet_hours_start_min = EXCLUDED.quiet_hours_start_min,
        quiet_hours_end_min = EXCLUDED.quiet_hours_end_min,
        updated_at = now()
    `);
  });

  revalidatePath('/settings/ai-preferences');
  return { ok: true };
}
