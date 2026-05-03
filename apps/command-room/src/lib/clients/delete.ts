'use server';

// Delete a client from the command-room.
//
// This is the CCPA right-to-delete path: when invoked, every row
// downstream of the client cascades:
//
//   intake_responses → CASCADE → deleted (encrypted PII gone)
//   documents        → CASCADE → deleted (R2 storage keys orphan;
//                                          GC them on a separate sweep)
//   messages         → CASCADE → deleted
//   engagements      → CASCADE → deleted (which in turn cascade
//                                          their own dependent rows)
//   signatures       → CASCADE → deleted (legal artifacts gone too —
//                                          retain a copy on R2 if
//                                          tax-record retention demands)
//   issues           → CASCADE → deleted
//   actions          → SET NULL → audit history preserved with
//                                  client_id = NULL (migration 0008
//                                  + the trigger carve-out in 0012).
//
// Role gate: firm_owner + admin only. Preparers / reviewers /
// assistants don't get to make organizational decisions like
// purging a client record. CCPA + retention policy questions
// belong with the firm owner.

import { eq, and } from 'drizzle-orm';
import * as Sentry from '@sentry/nextjs';
import { revalidatePath } from 'next/cache';
import { withTenant, schema } from '@docket/db/client';
import { asTenantId } from '@docket/shared';
import { requireRole } from '@/lib/require-role';

export type DeleteClientResult =
  | { ok: true; deletedName: string }
  | { ok: false; error: string };

export async function deleteClient(input: {
  clientId: string;
  /** Confirmation: caller passes the client's full_name so we can
   *  fail loudly if the IDs don't line up (defense against UI bugs
   *  pointing the dialog at the wrong row). */
  confirmName: string;
}): Promise<DeleteClientResult> {
  const user = await requireRole(['firm_owner', 'admin']);

  if (!input.clientId || typeof input.clientId !== 'string') {
    return { ok: false, error: 'Missing client id.' };
  }

  try {
    return await withTenant(asTenantId(user.tenantId), async (db) => {
      // Read first so we can verify the name matches what the UI
      // confirmed — and so we can echo back the deleted name in
      // the success result. RLS ensures we only see rows in this
      // tenant; cross-tenant id guesses get notFound from the SELECT.
      const [target] = await db
        .select({
          id: schema.clients.id,
          fullName: schema.clients.fullName,
        })
        .from(schema.clients)
        .where(eq(schema.clients.id, input.clientId))
        .limit(1);

      if (!target) {
        return { ok: false, error: 'Client not found.' };
      }

      if (target.fullName !== input.confirmName) {
        Sentry.captureMessage(
          '[command-room] deleteClient name mismatch — possible UI bug',
          'warning',
        );
        return {
          ok: false,
          error: 'Name mismatch — refusing to delete. Refresh and try again.',
        };
      }

      await db.delete(schema.clients).where(eq(schema.clients.id, input.clientId));

      // Refresh both list and any open detail pages.
      revalidatePath('/clients');
      revalidatePath(`/clients/${input.clientId}`);

      return { ok: true, deletedName: target.fullName };
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: 'command-room-delete-client' },
    });
    return { ok: false, error: 'Could not delete client. Please try again.' };
  }
}
