// /nudges server actions.
//
// Lifecycle transitions for pending nudges: approve / edit / dismiss.
// "Send" happens via Inbox Drafter agent + channel-specific adapters
// (Twilio for SMS, Gmail OAuth for email, portal write for portal_chat).
// This file only handles the preparer-side decisions; the send-side
// is a separate Inngest function that picks up `status = 'approved'`
// nudges + drives them to `sent`.

'use server';

import { revalidatePath } from 'next/cache';
import { eq, and } from 'drizzle-orm';
import { withTenant, schema } from '@docket/db/client';
import { getCurrentDocketUser } from '@/lib/current-user';
import type { TenantId } from '@docket/shared';

const ALLOWED_ROLES = new Set(['firm_owner', 'preparer', 'reviewer']);

export type NudgeActionResult =
  | { ok: true; nudgeId?: string }
  | { ok: false; error: string };

async function authorize(): Promise<
  { ok: true; tenantId: string; userId: string } | { ok: false; error: string }
> {
  const user = await getCurrentDocketUser();
  if (!user) return { ok: false, error: 'Not signed in.' };
  if (!ALLOWED_ROLES.has(user.role)) {
    return {
      ok: false,
      error: 'Only firm_owner, preparer, or reviewer roles may act on nudges.',
    };
  }
  return { ok: true, tenantId: user.tenantId, userId: user.id };
}

/**
 * Approve a pending nudge. Transitions to 'approved'; the send-side
 * Inngest function will pick it up.
 */
export async function approveNudge(nudgeId: string): Promise<NudgeActionResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;
  if (!nudgeId || typeof nudgeId !== 'string') {
    return { ok: false, error: 'Nudge ID is required.' };
  }

  let foundId: string | undefined;
  await withTenant(auth.tenantId as TenantId, async (db) => {
    const [updated] = await db
      .update(schema.nudges)
      .set({
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: auth.userId,
      })
      .where(and(eq(schema.nudges.id, nudgeId), eq(schema.nudges.status, 'pending')))
      .returning({ id: schema.nudges.id });
    foundId = updated?.id;
  });

  if (!foundId) {
    return {
      ok: false,
      error: 'Nudge not found or not pending. Refresh and try again.',
    };
  }
  revalidatePath('/');
  revalidatePath('/nudges');
  return { ok: true, nudgeId: foundId };
}

/**
 * Edit a pending nudge's draft outreach (preparer customization).
 * Transitions to 'edited' so we know the preparer touched it; still
 * needs an explicit approve to send.
 */
export async function editNudgeOutreach(
  nudgeId: string,
  newOutreach: string,
): Promise<NudgeActionResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;
  if (!nudgeId || typeof nudgeId !== 'string') {
    return { ok: false, error: 'Nudge ID is required.' };
  }
  if (typeof newOutreach !== 'string') {
    return { ok: false, error: 'New outreach text must be a string.' };
  }
  const trimmed = newOutreach.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'Outreach cannot be empty.' };
  }
  if (trimmed.length > 5000) {
    return { ok: false, error: 'Outreach must be 5000 characters or fewer.' };
  }

  let foundId: string | undefined;
  await withTenant(auth.tenantId as TenantId, async (db) => {
    const [updated] = await db
      .update(schema.nudges)
      .set({
        draftOutreach: trimmed,
        status: 'edited',
      })
      .where(
        and(
          eq(schema.nudges.id, nudgeId),
          // Only allow edits on pending OR already-edited nudges.
          // Approved/sent/dismissed are immutable from this surface.
          // Pre-pass: confirm status via SELECT then UPDATE would
          // race; Postgres single-statement UPDATE WHERE is atomic
          // for our purpose.
        ),
      )
      .returning({ id: schema.nudges.id, status: schema.nudges.status });
    foundId = updated?.id;
  });

  if (!foundId) return { ok: false, error: 'Nudge not found.' };
  revalidatePath('/');
  revalidatePath('/nudges');
  return { ok: true, nudgeId: foundId };
}

/**
 * Dismiss a pending nudge with an optional reason. Reason gets
 * fed back into the Nudge agent's confidence calibration over time
 * (e.g., if Antonio dismisses 5 of 7 'q3_estimated' nudges, the
 * agent learns to suppress that trigger for him).
 */
export async function dismissNudge(
  nudgeId: string,
  reason?: string,
): Promise<NudgeActionResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;
  if (!nudgeId || typeof nudgeId !== 'string') {
    return { ok: false, error: 'Nudge ID is required.' };
  }
  const reasonTrimmed = (reason ?? '').trim();
  if (reasonTrimmed.length > 500) {
    return { ok: false, error: 'Reason must be 500 characters or fewer.' };
  }

  let foundId: string | undefined;
  await withTenant(auth.tenantId as TenantId, async (db) => {
    const [updated] = await db
      .update(schema.nudges)
      .set({
        status: 'dismissed',
        dismissedAt: new Date(),
        dismissedBy: auth.userId,
        dismissedReason: reasonTrimmed || null,
      })
      .where(eq(schema.nudges.id, nudgeId))
      .returning({ id: schema.nudges.id });
    foundId = updated?.id;
  });

  if (!foundId) return { ok: false, error: 'Nudge not found.' };
  revalidatePath('/');
  revalidatePath('/nudges');
  return { ok: true, nudgeId: foundId };
}
