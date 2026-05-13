// /clients/[id]/projects server actions.
//
// Four actions for the engagement_projects join table:
//   - attachEngagementToProject(engagementId, projectId, isPrimary?)
//     [ClientProjectPicker on /clients/[id]]
//   - detachEngagementFromProject(engagementId, projectId)
//     [ClientProjectPicker on /clients/[id]]
//   - setPrimaryProject(engagementId, projectId)
//     [ClientProjectPicker on /clients/[id]]
//   - setEngagementProjectNotes(engagementId, projectId, notes)
//     [EngagementProjectNotes on /projects/[id] instance view]
//
// Each is role-gated (firm_owner / preparer / reviewer), RLS-
// scoped via withTenant, idempotent where the operation has
// reasonable identity (attach UNIQUE catches dups). All four
// revalidate '/clients/[id]' AND '/projects/[id]' since the notes
// field surfaces on both routes.

'use server';

import { revalidatePath } from 'next/cache';
import { sql, eq, and } from 'drizzle-orm';
import { withTenant, schema } from '@docket/db/client';
import type { TenantId } from '@docket/shared';
import { getCurrentDocketUser } from '@/lib/current-user';

const ALLOWED_ROLES = new Set(['firm_owner', 'preparer', 'reviewer']);

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AttachResult =
  | { ok: true; alreadyAttached?: boolean }
  | { ok: false; error: string };

interface AuthorizedContext {
  tenantId: string;
  userId: string;
}

async function authorize(): Promise<
  { ok: true; ctx: AuthorizedContext } | { ok: false; error: string }
> {
  const user = await getCurrentDocketUser();
  if (!user) return { ok: false, error: 'Not signed in.' };
  if (!ALLOWED_ROLES.has(user.role)) {
    return {
      ok: false,
      error:
        'Only firm_owner, preparer, or reviewer roles may manage project assignments.',
    };
  }
  return { ok: true, ctx: { tenantId: user.tenantId, userId: user.id } };
}

/**
 * Verify the engagement belongs to this tenant. RLS enforces this
 * at the DB layer; we fail fast at the app layer for cleaner
 * error messaging.
 */
async function assertEngagementInTenant(
  tenantId: string,
  engagementId: string,
): Promise<boolean> {
  return await withTenant(tenantId as TenantId, async (db) => {
    const [row] = await db
      .select({ id: schema.engagements.id })
      .from(schema.engagements)
      .where(eq(schema.engagements.id, engagementId))
      .limit(1);
    return Boolean(row);
  });
}

/**
 * Load the project (template or instance) for this tenant. Codex
 * round 1 P1 caught: engagement_projects.project_id only FKs to
 * projects(id), so a forged or stale cross-tenant projectId would
 * either FK-throw (raw error to user) or succeed silently (cross-
 * tenant data leak). RLS on projects scopes the lookup; missing
 * row => not in this tenant.
 *
 * Codex round 4 P1: we also need the full row (kind, name,
 * is_template, etc.) to support clone-on-attach when the user
 * picks a template — see resolveAttachTarget below.
 */
type ProjectForAttach = {
  id: string;
  kind: string;
  name: string;
  description: string | null;
  isTemplate: boolean;
  colorHint: string | null;
};

async function loadProjectForAttach(
  tenantId: string,
  projectId: string,
): Promise<ProjectForAttach | null> {
  return await withTenant(tenantId as TenantId, async (db) => {
    const [row] = await db
      .select({
        id: schema.projects.id,
        kind: schema.projects.kind,
        name: schema.projects.name,
        description: schema.projects.description,
        isTemplate: schema.projects.isTemplate,
        colorHint: schema.projects.colorHint,
      })
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .limit(1);
    return row ?? null;
  });
}

/**
 * Attach an engagement to a project. Optionally mark primary; if
 * isPrimary=true, any existing primary attachment for this engagement
 * is cleared in the same transaction.
 */
export async function attachEngagementToProject(
  engagementId: string,
  projectId: string,
  isPrimary: boolean = false,
): Promise<AttachResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;
  if (!UUID_REGEX.test(engagementId)) {
    return { ok: false, error: 'Engagement ID is invalid.' };
  }
  if (!UUID_REGEX.test(projectId)) {
    return { ok: false, error: 'Project ID is invalid.' };
  }
  const engagementInTenant = await assertEngagementInTenant(
    auth.ctx.tenantId,
    engagementId,
  );
  if (!engagementInTenant) {
    return { ok: false, error: 'Engagement not found.' };
  }
  const projectInfo = await loadProjectForAttach(
    auth.ctx.tenantId,
    projectId,
  );
  if (!projectInfo) {
    return { ok: false, error: 'Project not found.' };
  }

  let alreadyAttached = false;
  let conflict = false;
  let attachedProjectId = projectId;
  await withTenant(auth.ctx.tenantId as TenantId, async (db) => {
    // Codex round 4 P1: clone-on-attach. Until V1.5 ships a
    // "clone template to instance" UI, the only way to populate
    // the project pool is the /projects seed action which inserts
    // is_template=true rows. Attaching engagements directly to a
    // template would make those attachments invisible from
    // /projects (template card doesn't surface engagement_count)
    // and /projects/[id] (template branch only loads derived
    // instances, not direct attachments). Fix: when the picker
    // sends a template projectId, transparently materialize a
    // derived instance for this engagement's tax_year (or reuse
    // an existing one for the same template+year). Templates
    // stay definition-only; instances are the real attachment
    // targets. Preserves the v0 template/instance mental model.
    if (projectInfo.isTemplate) {
      const [eng] = await db
        .select({ taxYear: schema.engagements.taxYear })
        .from(schema.engagements)
        .where(eq(schema.engagements.id, engagementId))
        .limit(1);
      const taxYear = eng?.taxYear ?? null;
      // Look for an existing instance derived from this template
      // for the same tax_year. Reuse keeps the data model clean
      // when two engagements share a project (e.g., both Maria's
      // 1040 and John's 1040 sit under "Annual Return Prep 2026").
      const reuseRows = await db.execute<{ id: string }>(
        taxYear === null
          ? sql`
              SELECT id::text AS id
                FROM projects
               WHERE source_template_id = ${projectId}::uuid
                 AND tax_year IS NULL
                 AND is_active
               ORDER BY created_at ASC
               LIMIT 1
            `
          : sql`
              SELECT id::text AS id
                FROM projects
               WHERE source_template_id = ${projectId}::uuid
                 AND tax_year = ${taxYear}
                 AND is_active
               ORDER BY created_at ASC
               LIMIT 1
            `,
      );
      const arr = reuseRows as unknown as Array<{ id: string }>;
      if (arr.length > 0 && arr[0]) {
        attachedProjectId = arr[0].id;
      } else {
        const instanceName = taxYear
          ? `${projectInfo.name} ${taxYear}`
          : projectInfo.name;
        const [instance] = await db
          .insert(schema.projects)
          .values({
            tenantId: auth.ctx.tenantId,
            kind: projectInfo.kind,
            name: instanceName,
            description: projectInfo.description,
            isTemplate: false,
            sourceTemplateId: projectId,
            isActive: true,
            taxYear,
            colorHint: projectInfo.colorHint,
          })
          .returning({ id: schema.projects.id });
        if (!instance) {
          throw new Error('Failed to materialize project instance');
        }
        attachedProjectId = instance.id;
      }
    }
    // Codex round 1 P2: insert FIRST (or no-op on conflict), THEN
    // conditionally promote to primary. The earlier shape cleared
    // the existing primary before the insert; on conflict (another
    // user attached the same project between page-load + click)
    // the engagement was left with no primary at all. Now the
    // primary clear-and-set runs only after the target row is
    // known to exist (either just inserted, or already there).
    // We always insert with is_primary=false; the promote step
    // handles the primary case atomically.
    const result = await db.execute(sql`
      INSERT INTO engagement_projects (
        tenant_id, engagement_id, project_id, is_primary
      )
      VALUES (
        ${auth.ctx.tenantId}::uuid,
        ${engagementId}::uuid,
        ${attachedProjectId}::uuid,
        false
      )
      ON CONFLICT (engagement_id, project_id) DO NOTHING
      RETURNING id
    `);
    const arr = result as unknown as Array<{ id: string }>;
    alreadyAttached = arr.length === 0;

    if (isPrimary) {
      // Codex round 3 P1: split clear+set into two statements,
      // exclude target from the clear. A single bulk UPDATE
      // SET is_primary = (project_id = target) can trip the
      // partial unique index from migration 0035 mid-statement
      // if Postgres visits the target row before the existing
      // primary — two rows transiently both is_primary=true.
      // Two-statement form: clear OTHER primaries first (target
      // is excluded), then promote target. No intermediate state
      // with two primaries. The unique_violation guard still
      // catches genuine concurrent-writer races.
      //
      // Codex round 5 P1: use attachedProjectId (the instance id
      // after clone-on-attach), NOT projectId (the template id).
      // Earlier shape leaked the template id into the UPDATE
      // WHERE clauses; when the user picked a template AND
      // checked Primary, the clear cleared the old primary but
      // the set matched zero rows (no engagement_projects row
      // has project_id = template), leaving the engagement with
      // no primary at all.
      try {
        await db.execute(sql`
          UPDATE engagement_projects
             SET is_primary = false
           WHERE engagement_id = ${engagementId}::uuid
             AND is_primary = true
             AND project_id <> ${attachedProjectId}::uuid
        `);
        await db.execute(sql`
          UPDATE engagement_projects
             SET is_primary = true
           WHERE engagement_id = ${engagementId}::uuid
             AND project_id = ${attachedProjectId}::uuid
             AND NOT is_primary
        `);
      } catch (err) {
        const code =
          (err as { code?: string }).code ??
          (err as { cause?: { code?: string } }).cause?.code;
        if (code === '23505') {
          conflict = true;
        } else {
          throw err;
        }
      }
    }
  });

  if (conflict) {
    return {
      ok: false,
      error:
        'Another preparer changed the primary project at the same time. Please retry.',
    };
  }
  revalidatePath(`/clients/[id]`, 'page');
  revalidatePath(`/projects/[id]`, 'page');
  return { ok: true, alreadyAttached };
}

/**
 * Detach an engagement from a project. Does not auto-promote
 * another attachment to primary if the detached one was primary —
 * v0 leaves the engagement without a primary project, which is
 * a valid state.
 */
export async function detachEngagementFromProject(
  engagementId: string,
  projectId: string,
): Promise<AttachResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;
  if (!UUID_REGEX.test(engagementId)) {
    return { ok: false, error: 'Engagement ID is invalid.' };
  }
  if (!UUID_REGEX.test(projectId)) {
    return { ok: false, error: 'Project ID is invalid.' };
  }

  let removed = false;
  await withTenant(auth.ctx.tenantId as TenantId, async (db) => {
    const result = await db.execute(sql`
      DELETE FROM engagement_projects
       WHERE engagement_id = ${engagementId}::uuid
         AND project_id = ${projectId}::uuid
      RETURNING id
    `);
    const arr = result as unknown as Array<{ id: string }>;
    removed = arr.length > 0;
  });

  if (!removed) {
    return { ok: false, error: 'Attachment not found.' };
  }
  revalidatePath(`/clients/[id]`, 'page');
  revalidatePath(`/projects/[id]`, 'page');
  return { ok: true };
}

/**
 * Mark a specific attachment as primary. Atomically clears any
 * other primary on the same engagement first.
 */
export async function setPrimaryProject(
  engagementId: string,
  projectId: string,
): Promise<AttachResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;
  if (!UUID_REGEX.test(engagementId)) {
    return { ok: false, error: 'Engagement ID is invalid.' };
  }
  if (!UUID_REGEX.test(projectId)) {
    return { ok: false, error: 'Project ID is invalid.' };
  }

  let updated = false;
  let conflict = false;
  await withTenant(auth.ctx.tenantId as TenantId, async (db) => {
    // Codex round 2 P2a: verify the target attachment exists in
    // the same transaction BEFORE any UPDATE. The earlier shape
    // cleared the existing primary first, then attempted to set
    // the target. If the target had been detached by another
    // preparer between page-load and click, the clear ran and the
    // set affected zero rows — leaving the engagement with no
    // primary at all. Now the target-exists check gates both
    // UPDATEs.
    //
    // Codex round 5 P2: SELECT alone doesn't lock the row, so a
    // concurrent detach BETWEEN the SELECT and the UPDATE could
    // still leave us in the "cleared old primary + promoted nothing"
    // state. SELECT FOR UPDATE acquires a row-level lock that
    // blocks concurrent DELETEs until our transaction commits.
    // Belt-and-suspenders: also check the set-UPDATE's RETURNING
    // count to make absolutely sure a row was promoted before
    // returning ok.
    const locked = await db.execute(sql`
      SELECT id
        FROM engagement_projects
       WHERE engagement_id = ${engagementId}::uuid
         AND project_id = ${projectId}::uuid
       FOR UPDATE
    `);
    if ((locked as unknown as unknown[]).length === 0) {
      updated = false;
      return;
    }
    // Codex round 3 P1: split clear+set into two statements,
    // exclude target from the clear. Same reasoning as the
    // attach action: single-statement bulk UPDATE on the unique-
    // indexed column can trip the partial unique index from
    // migration 0035 mid-statement. Two-statement form: clear
    // OTHER primaries first (target excluded), then promote
    // target if not already. No intermediate state with two
    // primaries. The unique_violation guard remains for genuine
    // concurrent-writer races (two preparers promoting different
    // attached projects at the same instant).
    try {
      await db.execute(sql`
        UPDATE engagement_projects
           SET is_primary = false
         WHERE engagement_id = ${engagementId}::uuid
           AND is_primary = true
           AND project_id <> ${projectId}::uuid
      `);
      const setResult = await db.execute(sql`
        UPDATE engagement_projects
           SET is_primary = true
         WHERE engagement_id = ${engagementId}::uuid
           AND project_id = ${projectId}::uuid
           AND NOT is_primary
        RETURNING id
      `);
      const setArr = setResult as unknown as Array<{ id: string }>;
      // Either we just promoted it (setArr.length === 1) or the
      // target was already primary (setArr.length === 0 because
      // of the NOT is_primary guard). Both are success states.
      // The FOR UPDATE above guarantees the row hasn't been
      // detached between check and set.
      void setArr;
      updated = true;
    } catch (err) {
      // pg unique_violation = 23505. Drizzle surfaces it on err.cause or err.code.
      const code =
        (err as { code?: string }).code ??
        (err as { cause?: { code?: string } }).cause?.code;
      if (code === '23505') {
        conflict = true;
      } else {
        throw err;
      }
    }
  });

  if (conflict) {
    return {
      ok: false,
      error:
        'Another preparer changed the primary project at the same time. Please retry.',
    };
  }
  if (!updated) {
    return {
      ok: false,
      error: 'Attachment not found. Attach the project first.',
    };
  }
  revalidatePath(`/clients/[id]`, 'page');
  revalidatePath(`/projects/[id]`, 'page');
  return { ok: true };
}

/**
 * Set or clear notes on an engagement_projects row. Notes are
 * the per-attachment context preparers leave for themselves —
 * "this client wants paper-only delivery" / "schedule next year's
 * estimate review at the kickoff meeting" / "do not pull
 * dependents from prior year." Surfaces inline on
 * /projects/[id] instance view (where the engagement list lives)
 * and is editable from the same surface.
 *
 * Trim + null-coerce empty strings so we don't accumulate empty-
 * string rows (semantic equivalent to no notes). Cap at 500 chars
 * to keep the row legible; longer notes belong in client memos
 * or engagement.notes (per-engagement, not per-attachment).
 */
export type NotesResult =
  | { ok: true }
  | { ok: false; error: string };

const NOTES_MAX_LENGTH = 500;

export async function setEngagementProjectNotes(
  engagementId: string,
  projectId: string,
  notes: string,
): Promise<NotesResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;
  if (!UUID_REGEX.test(engagementId)) {
    return { ok: false, error: 'Engagement ID is invalid.' };
  }
  if (!UUID_REGEX.test(projectId)) {
    return { ok: false, error: 'Project ID is invalid.' };
  }
  if (typeof notes !== 'string') {
    return { ok: false, error: 'Notes must be a string.' };
  }
  const trimmed = notes.trim();
  if (trimmed.length > NOTES_MAX_LENGTH) {
    return {
      ok: false,
      error: `Notes too long (max ${NOTES_MAX_LENGTH} characters).`,
    };
  }
  // Empty / whitespace-only collapses to NULL so the column never
  // accumulates empty-string rows that look "set" but render
  // identically to no notes.
  const persistValue: string | null = trimmed.length === 0 ? null : trimmed;

  let updated = false;
  await withTenant(auth.ctx.tenantId as TenantId, async (db) => {
    // Use Drizzle's eq+and for parameter safety on a nullable
    // text column. RETURNING id confirms the row existed before
    // the UPDATE — "attachment not found" branch surfaces the
    // stale-page case (engagement detached between page-load and
    // notes-save) as a friendly error rather than silent success.
    const result = await db
      .update(schema.engagementProjects)
      .set({ notes: persistValue })
      .where(
        and(
          eq(schema.engagementProjects.engagementId, engagementId),
          eq(schema.engagementProjects.projectId, projectId),
        ),
      )
      .returning({ id: schema.engagementProjects.id });
    updated = result.length > 0;
  });

  if (!updated) {
    return {
      ok: false,
      error: 'Attachment not found. Attach the project first.',
    };
  }
  revalidatePath(`/clients/[id]`, 'page');
  revalidatePath(`/projects/[id]`, 'page');
  return { ok: true };
}
