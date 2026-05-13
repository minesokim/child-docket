// /settings/notifications server actions.
//
// Seeds the canonical 4 notification categories per tenant.
// Idempotent via ON CONFLICT DO NOTHING. Only firm_owner may seed.

'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { withTenant } from '@docket/db';
import type { TenantId } from '@docket/shared';
import { getCurrentDocketUser } from '@/lib/current-user';

type Category = 'deadlines' | 'ai_alerts' | 'client_activity' | 'system';

interface CanonicalPref {
  category: Category;
  sms: boolean;
  email: boolean;
  inApp: boolean;
  threshold: 'all' | 'medium' | 'high';
  deadlineDaysBefore: number;
}

// Matrix derived from CLAUDE.md §8 Notifications.
const CANONICAL_PREFS: CanonicalPref[] = [
  {
    category: 'deadlines',
    sms: true,
    email: true,
    inApp: true,
    threshold: 'medium',
    deadlineDaysBefore: 7,
  },
  {
    category: 'ai_alerts',
    sms: false,
    email: true,
    inApp: true,
    threshold: 'medium',
    deadlineDaysBefore: 7,
  },
  {
    category: 'client_activity',
    sms: false,
    email: false,
    inApp: true,
    threshold: 'medium',
    deadlineDaysBefore: 7,
  },
  {
    category: 'system',
    sms: false,
    email: true,
    inApp: true,
    threshold: 'medium',
    deadlineDaysBefore: 7,
  },
];

export type SaveResult =
  | { ok: true; inserted: number }
  | { ok: false; error: string };

export async function seedNotificationDefaults(): Promise<SaveResult> {
  const user = await getCurrentDocketUser();
  if (!user) return { ok: false, error: 'Not signed in.' };
  if (user.role !== 'firm_owner') {
    return {
      ok: false,
      error: 'Only the firm owner may seed default categories.',
    };
  }

  let inserted = 0;
  await withTenant(user.tenantId as TenantId, async (db) => {
    for (const pref of CANONICAL_PREFS) {
      const result = await db.execute(sql`
        INSERT INTO notification_prefs (
          tenant_id,
          category,
          sms,
          email,
          in_app,
          threshold,
          deadline_days_before
        ) VALUES (
          ${user.tenantId}::uuid,
          ${pref.category},
          ${pref.sms},
          ${pref.email},
          ${pref.inApp},
          ${pref.threshold},
          ${pref.deadlineDaysBefore}
        )
        ON CONFLICT (tenant_id, category) DO NOTHING
        RETURNING id
      `);
      const arr = result as unknown as Array<{ id: string }>;
      if (arr.length > 0) inserted += 1;
    }
  });

  revalidatePath('/settings/notifications');
  return { ok: true, inserted };
}
