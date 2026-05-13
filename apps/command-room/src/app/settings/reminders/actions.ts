// /settings/reminders server actions.
//
// Seeds the canonical 5 reminder rules per tenant. Idempotent —
// ON CONFLICT DO NOTHING means re-clicking the button just no-ops on
// rules already present. Only firm_owner may seed.

'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { withTenant } from '@docket/db';
import type { TenantId } from '@docket/shared';
import { getCurrentDocketUser } from '@/lib/current-user';

type Trigger =
  | 'missing_documents'
  | 'engagement_letter_unsigned'
  | 'eightyseventynine_pending'
  | 'outstanding_balance'
  | 'year_round_planning';

interface CanonicalRule {
  trigger: Trigger;
  enabled: boolean;
  intervalHours: number;
  maxAttempts: number;
  channel: string;
}

const CANONICAL_RULES: CanonicalRule[] = [
  {
    trigger: 'missing_documents',
    enabled: true,
    intervalHours: 72,
    maxAttempts: 5,
    channel: 'auto',
  },
  {
    trigger: 'engagement_letter_unsigned',
    enabled: true,
    intervalHours: 48,
    maxAttempts: 4,
    channel: 'email',
  },
  {
    trigger: 'eightyseventynine_pending',
    enabled: true,
    intervalHours: 24,
    maxAttempts: 3,
    channel: 'auto',
  },
  {
    trigger: 'outstanding_balance',
    enabled: true,
    intervalHours: 168, // 1 week
    maxAttempts: 8,
    channel: 'email',
  },
  {
    trigger: 'year_round_planning',
    enabled: false, // opt-in per CLAUDE.md §8
    intervalHours: 2160, // 90 days (quarterly)
    maxAttempts: 4,
    channel: 'email',
  },
];

export type SaveResult =
  | { ok: true; inserted: number }
  | { ok: false; error: string };

export async function seedDefaults(): Promise<SaveResult> {
  const user = await getCurrentDocketUser();
  if (!user) return { ok: false, error: 'Not signed in.' };
  if (user.role !== 'firm_owner') {
    return {
      ok: false,
      error: 'Only the firm owner may seed default rules.',
    };
  }

  let inserted = 0;
  await withTenant(user.tenantId as TenantId, async (db) => {
    for (const rule of CANONICAL_RULES) {
      const result = await db.execute(sql`
        INSERT INTO reminder_rules (
          tenant_id,
          trigger,
          enabled,
          interval_hours,
          max_attempts,
          channel
        ) VALUES (
          ${user.tenantId}::uuid,
          ${rule.trigger},
          ${rule.enabled},
          ${rule.intervalHours},
          ${rule.maxAttempts},
          ${rule.channel}
        )
        ON CONFLICT (tenant_id, trigger) DO NOTHING
        RETURNING id
      `);
      const arr = result as unknown as Array<{ id: string }>;
      if (arr.length > 0) inserted += 1;
    }
  });

  revalidatePath('/settings/reminders');
  return { ok: true, inserted };
}
