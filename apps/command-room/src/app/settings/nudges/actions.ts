// /settings/nudges server actions.
//
// Seeds the canonical nudge rules per tenant. Idempotent — UNIQUE
// constraint on (tenant_id, trigger_class, trigger_key) makes
// re-clicking no-op on rules already present. Only firm_owner may
// seed.
//
// Also exposes per-rule enable/disable toggle.
//
// Canonical rule definitions + getCanonicalRuleMetadata live in
// ./metadata.ts so the non-async helpers don't violate Next.js
// Server Actions "every export must be async" rule. Codex round 4
// (C24) caught this build-break.

'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { withTenant } from '@docket/db';
import type { TenantId } from '@docket/shared';
import { getCurrentDocketUser } from '@/lib/current-user';
import { CANONICAL_NUDGE_RULES } from './metadata';

export type SeedResult =
  | { ok: true; inserted: number; total: number }
  | { ok: false; error: string };

export async function seedNudgeDefaults(): Promise<SeedResult> {
  const user = await getCurrentDocketUser();
  if (!user) return { ok: false, error: 'Not signed in.' };
  if (user.role !== 'firm_owner') {
    return {
      ok: false,
      error: 'Only the firm owner may seed default nudge rules.',
    };
  }

  let inserted = 0;
  await withTenant(user.tenantId as TenantId, async (db) => {
    for (const rule of CANONICAL_NUDGE_RULES) {
      const result = await db.execute(sql`
        INSERT INTO nudge_rules (
          tenant_id,
          trigger_class,
          trigger_key,
          enabled,
          confidence_floor,
          max_per_client_per_days,
          respect_quiet_hours
        ) VALUES (
          ${user.tenantId}::uuid,
          ${rule.triggerClass},
          ${rule.triggerKey},
          ${rule.enabled},
          ${rule.confidenceFloor},
          ${rule.maxPerClientPerDays},
          ${rule.respectQuietHours}
        )
        ON CONFLICT (tenant_id, trigger_class, trigger_key) DO NOTHING
        RETURNING id
      `);
      const arr = result as unknown as Array<{ id: string }>;
      if (arr.length > 0) inserted += 1;
    }
  });

  revalidatePath('/settings/nudges');
  return { ok: true, inserted, total: CANONICAL_NUDGE_RULES.length };
}

export type ToggleResult =
  | { ok: true; enabled: boolean }
  | { ok: false; error: string };

/**
 * Toggle a single nudge rule's enabled flag. Used by the
 * per-rule switch on /settings/nudges.
 */
export async function toggleNudgeRule(ruleId: string): Promise<ToggleResult> {
  const user = await getCurrentDocketUser();
  if (!user) return { ok: false, error: 'Not signed in.' };
  if (user.role !== 'firm_owner') {
    return {
      ok: false,
      error: 'Only the firm owner may toggle nudge rules.',
    };
  }
  if (!ruleId || typeof ruleId !== 'string') {
    return { ok: false, error: 'Rule ID is required.' };
  }

  let newState: boolean | undefined;
  await withTenant(user.tenantId as TenantId, async (db) => {
    const result = await db.execute<{ enabled: boolean }>(sql`
      UPDATE nudge_rules
         SET enabled = NOT enabled
       WHERE id = ${ruleId}::uuid
       RETURNING enabled
    `);
    const arr = result as unknown as Array<{ enabled: boolean }>;
    newState = arr[0]?.enabled;
  });

  if (newState === undefined) {
    return { ok: false, error: 'Rule not found.' };
  }
  revalidatePath('/settings/nudges');
  return { ok: true, enabled: newState };
}
