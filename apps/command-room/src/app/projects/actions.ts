// /projects server actions.
//
// Seeds the canonical 12 project templates per tenant. Idempotent
// via UNIQUE (tenant_id, kind, name, tax_year) + ON CONFLICT DO
// NOTHING. firm_owner gated.
//
// Also archive / unarchive project rows. Archiving sets is_active
// = false; the /projects gallery filters NOT is_active so archived
// projects vanish from view but stay reachable via /projects/[id]
// URLs (where the header offers Unarchive). Engagement attachments
// stay live — archiving a project doesn't detach its engagements
// (the firm may later unarchive). Per CLAUDE.md §4: firms customize
// + clone templates; instances accumulate per tax year. Archive is
// the housekeeping primitive.
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

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SeedResult =
  | { ok: true; inserted: number; total: number }
  | { ok: false; error: string };

export type ArchiveResult =
  | { ok: true }
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

/**
 * Archive a project (template or instance). Sets is_active = false.
 * Idempotent: archiving an already-archived project is a no-op.
 * Engagement attachments persist (engagement_projects rows are not
 * cascade-affected). firm_owner gated since this is the destructive-
 * feeling action; preparer/reviewer can attach + detach but only the
 * firm owner archives.
 */
export async function archiveProject(
  projectId: string,
): Promise<ArchiveResult> {
  const user = await getCurrentDocketUser();
  if (!user) return { ok: false, error: 'Not signed in.' };
  if (user.role !== 'firm_owner') {
    return {
      ok: false,
      error: 'Only the firm owner may archive projects.',
    };
  }
  if (!UUID_REGEX.test(projectId)) {
    return { ok: false, error: 'Project ID is invalid.' };
  }

  let updated = false;
  let templateGuard = false;
  await withTenant(user.tenantId as TenantId, async (db) => {
    // RETURNING gates the not-found case. RLS scopes the UPDATE so
    // cross-tenant projectIds can't be mutated; missing row =>
    // either truly missing OR a forged cross-tenant id — both
    // surface as "Project not found."
    //
    // Codex round 4 P2 #1 (C27): refuse to archive templates. The
    // /projects/[id] header hides the archive button for templates
    // (codex round 2 P2 fix), but a forged server-action call could
    // bypass the UI. Archived canonical templates have no in-product
    // unarchive path (seedProjectTemplates ON CONFLICT DO NOTHING
    // can't recreate them), so this is a hard server-side block.
    const result = await db.execute(sql`
      UPDATE projects
         SET is_active = false,
             updated_at = NOW()
       WHERE id = ${projectId}::uuid
         AND NOT is_template
      RETURNING id
    `);
    const arr = result as unknown as Array<{ id: string }>;
    if (arr.length > 0) {
      updated = true;
    } else {
      // Distinguish template-rejection from not-found so the caller
      // gets a useful message.
      const probe = await db.execute(sql`
        SELECT is_template
          FROM projects
         WHERE id = ${projectId}::uuid
         LIMIT 1
      `);
      const probeArr = probe as unknown as Array<{ is_template: boolean }>;
      if (probeArr.length > 0 && probeArr[0]?.is_template) {
        templateGuard = true;
      }
    }
  });

  if (templateGuard) {
    return {
      ok: false,
      error:
        'Templates cannot be archived. Use the /projects gallery to manage canonical templates.',
    };
  }
  if (!updated) {
    return { ok: false, error: 'Project not found.' };
  }
  revalidatePath('/projects');
  revalidatePath(`/projects/[id]`, 'page');
  // Codex round 1 P2 (C27): /clients/[id] also derives its project
  // picker from projects.is_active (the availableRows query filters
  // WHERE p.is_active). Without this revalidation, a client page
  // cached before the archive can still show the archived project
  // as attachable. Same applies to unarchive (re-surface the row).
  revalidatePath(`/clients/[id]`, 'page');
  return { ok: true };
}

/**
 * Unarchive a project. Sets is_active = true. Idempotent. Same
 * firm_owner gate as archive. Reachable from /projects/[id] header
 * when the project is archived (the gallery filters is_active so
 * archived projects don't surface there). Symmetric template
 * rejection: canonical templates aren't archivable, so unarchive
 * isn't a meaningful operation on them either.
 */
export async function unarchiveProject(
  projectId: string,
): Promise<ArchiveResult> {
  const user = await getCurrentDocketUser();
  if (!user) return { ok: false, error: 'Not signed in.' };
  if (user.role !== 'firm_owner') {
    return {
      ok: false,
      error: 'Only the firm owner may unarchive projects.',
    };
  }
  if (!UUID_REGEX.test(projectId)) {
    return { ok: false, error: 'Project ID is invalid.' };
  }

  let updated = false;
  await withTenant(user.tenantId as TenantId, async (db) => {
    const result = await db.execute(sql`
      UPDATE projects
         SET is_active = true,
             updated_at = NOW()
       WHERE id = ${projectId}::uuid
         AND NOT is_template
      RETURNING id
    `);
    const arr = result as unknown as Array<{ id: string }>;
    updated = arr.length > 0;
  });

  if (!updated) {
    return { ok: false, error: 'Project not found.' };
  }
  revalidatePath('/projects');
  revalidatePath(`/projects/[id]`, 'page');
  // Codex round 1 P2 (C27): /clients/[id] also derives its project
  // picker from projects.is_active (the availableRows query filters
  // WHERE p.is_active). Without this revalidation, a client page
  // cached before the archive can still show the archived project
  // as attachable. Same applies to unarchive (re-surface the row).
  revalidatePath(`/clients/[id]`, 'page');
  return { ok: true };
}
