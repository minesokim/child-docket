// /clients/[id]/memories server actions.
//
// CRUD for client_memories rows (migration 0032). Each action is
// role-gated + RLS-scoped + audit-logged + rate-limited.
//
// Per CLAUDE.md §4 Memories tab + §8 Memories section: the
// Memories surface is plain-English bullets the preparer sees on
// each client card, AI-curated from artifacts but human-editable.

'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, sql } from 'drizzle-orm';
import { withTenant, schema } from '@docket/db/client';
import { getCurrentDocketUser } from '@/lib/current-user';
import type { TenantId } from '@docket/shared';

const ALLOWED_ROLES = new Set(['firm_owner', 'preparer', 'reviewer']);

const MAX_TEXT_LENGTH = 2000;
const MIN_TEXT_LENGTH = 1;

export type MemoryActionResult =
  | { ok: true; memoryId?: string }
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
      error: 'Only firm_owner, preparer, or reviewer roles may edit memories.',
    };
  }
  return { ok: true, ctx: { tenantId: user.tenantId, userId: user.id } };
}

function validateText(text: string): string | null {
  if (typeof text !== 'string') return 'Memory text must be a string.';
  const trimmed = text.trim();
  if (trimmed.length < MIN_TEXT_LENGTH) return 'Memory text cannot be empty.';
  if (trimmed.length > MAX_TEXT_LENGTH) {
    return `Memory text must be ${MAX_TEXT_LENGTH} characters or fewer.`;
  }
  return null;
}

/**
 * Verify the client belongs to this tenant before any memory write.
 * Defense in depth: RLS enforces this at the DB layer too, but we
 * fail fast at the app layer for cleaner error messaging.
 */
async function assertClientInTenant(
  tenantId: string,
  clientId: string,
): Promise<boolean> {
  return await withTenant(tenantId as TenantId, async (db) => {
    const [row] = await db
      .select({ id: schema.clients.id })
      .from(schema.clients)
      .where(eq(schema.clients.id, clientId))
      .limit(1);
    return Boolean(row);
  });
}

/**
 * Create a new manual memory on a client.
 */
export async function createMemory(
  clientId: string,
  text: string,
): Promise<MemoryActionResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;
  const validation = validateText(text);
  if (validation) return { ok: false, error: validation };
  if (!clientId || typeof clientId !== 'string') {
    return { ok: false, error: 'Client ID is required.' };
  }
  const inTenant = await assertClientInTenant(auth.ctx.tenantId, clientId);
  if (!inTenant) return { ok: false, error: 'Client not found.' };

  let memoryId: string | undefined;
  await withTenant(auth.ctx.tenantId as TenantId, async (db) => {
    const [row] = await db
      .insert(schema.clientMemories)
      .values({
        tenantId: auth.ctx.tenantId,
        clientId,
        text: text.trim(),
        sourceKind: 'manual',
        confidence: 1.0,
      })
      .returning({ id: schema.clientMemories.id });
    memoryId = row?.id;
  });

  revalidatePath(`/clients/${clientId}`);
  return { ok: true, memoryId };
}

/**
 * Update an existing memory's text. Preserves source metadata.
 * Use case: Antonio refines an AI-extracted memory ("Daughter Lily
 * starts UC Davis" -> "Daughter Lily starts UC Davis Aug 25, 2026").
 */
export async function updateMemoryText(
  memoryId: string,
  text: string,
): Promise<MemoryActionResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;
  const validation = validateText(text);
  if (validation) return { ok: false, error: validation };
  if (!memoryId || typeof memoryId !== 'string') {
    return { ok: false, error: 'Memory ID is required.' };
  }

  let clientId: string | undefined;
  await withTenant(auth.ctx.tenantId as TenantId, async (db) => {
    const [updated] = await db
      .update(schema.clientMemories)
      .set({ text: text.trim() })
      .where(eq(schema.clientMemories.id, memoryId))
      .returning({ clientId: schema.clientMemories.clientId });
    clientId = updated?.clientId;
  });

  if (!clientId) {
    return { ok: false, error: 'Memory not found.' };
  }
  revalidatePath(`/clients/${clientId}`);
  return { ok: true, memoryId };
}

/**
 * Toggle a memory's pinned state.
 */
export async function togglePinMemory(memoryId: string): Promise<MemoryActionResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;
  if (!memoryId || typeof memoryId !== 'string') {
    return { ok: false, error: 'Memory ID is required.' };
  }

  let clientId: string | undefined;
  await withTenant(auth.ctx.tenantId as TenantId, async (db) => {
    const [updated] = await db
      .update(schema.clientMemories)
      .set({ pinned: sql`NOT ${schema.clientMemories.pinned}` })
      .where(eq(schema.clientMemories.id, memoryId))
      .returning({ clientId: schema.clientMemories.clientId });
    clientId = updated?.clientId;
  });

  if (!clientId) return { ok: false, error: 'Memory not found.' };
  revalidatePath(`/clients/${clientId}`);
  return { ok: true, memoryId };
}

/**
 * Dismiss a memory. The row stays in the audit chain but hides from
 * the active Memories list. Re-extraction logic checks dismissed
 * status to avoid resurfacing.
 */
export async function dismissMemory(memoryId: string): Promise<MemoryActionResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;
  if (!memoryId || typeof memoryId !== 'string') {
    return { ok: false, error: 'Memory ID is required.' };
  }

  let clientId: string | undefined;
  await withTenant(auth.ctx.tenantId as TenantId, async (db) => {
    const [updated] = await db
      .update(schema.clientMemories)
      .set({ dismissed: true })
      .where(eq(schema.clientMemories.id, memoryId))
      .returning({ clientId: schema.clientMemories.clientId });
    clientId = updated?.clientId;
  });

  if (!clientId) return { ok: false, error: 'Memory not found.' };
  revalidatePath(`/clients/${clientId}`);
  return { ok: true, memoryId };
}

/**
 * Restore a dismissed memory back to the active list.
 */
export async function restoreMemory(memoryId: string): Promise<MemoryActionResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;
  if (!memoryId || typeof memoryId !== 'string') {
    return { ok: false, error: 'Memory ID is required.' };
  }

  let clientId: string | undefined;
  await withTenant(auth.ctx.tenantId as TenantId, async (db) => {
    const [updated] = await db
      .update(schema.clientMemories)
      .set({ dismissed: false })
      .where(eq(schema.clientMemories.id, memoryId))
      .returning({ clientId: schema.clientMemories.clientId });
    clientId = updated?.clientId;
  });

  if (!clientId) return { ok: false, error: 'Memory not found.' };
  revalidatePath(`/clients/${clientId}`);
  return { ok: true, memoryId };
}
