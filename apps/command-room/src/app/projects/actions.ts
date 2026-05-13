// /projects server actions.
//
// Seeds the canonical 12 project templates per tenant. Idempotent
// via UNIQUE (tenant_id, kind, name, tax_year) + ON CONFLICT DO
// NOTHING. firm_owner gated.
//
// Canonical template definitions live in ./metadata.ts so the
// non-async helpers (getCanonicalTemplateMetadata, CANONICAL_PROJECT_TEMPLATES)
// don't violate Next.js Server Actions "every export must be async"
// rule. Codex round 4 (C24) caught this build-break and the move
// to a separate module is the fix.

'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { withTenant } from '@docket/db/client';
import type { TenantId } from '@docket/shared';
import { getCurrentDocketUser } from '@/lib/current-user';
import { CANONICAL_PROJECT_TEMPLATES } from './metadata';

export type SeedResult =
  | { ok: true; inserted: number; total: number }
  | { ok: false; error: string };

export async function seedProjectTemplates(): Promise<SeedResult> {
  const user = await getCurrentDocketUser();
  if (!user) return { ok: false, error: 'Not signed in.' };
  if (user.role !== 'firm_owner') {
    return {
      ok: false,
      error: 'Only the firm owner may seed default project templates.',
    };
  }

  let inserted = 0;
  await withTenant(user.tenantId as TenantId, async (db) => {
    for (const tpl of CANONICAL_PROJECT_TEMPLATES) {
      const result = await db.execute(sql`
        INSERT INTO projects (
          tenant_id, kind, name, description,
          is_template, is_active, color_hint
        ) VALUES (
          ${user.tenantId}::uuid,
          ${tpl.kind},
          ${tpl.name},
          ${tpl.description},
          ${true},
          ${true},
          ${tpl.colorHint}
        )
        ON CONFLICT (tenant_id, kind, name, tax_year) DO NOTHING
        RETURNING id
      `);
      const arr = result as unknown as Array<{ id: string }>;
      if (arr.length > 0) inserted += 1;
    }
  });

  revalidatePath('/projects');
  return { ok: true, inserted, total: CANONICAL_PROJECT_TEMPLATES.length };
}
