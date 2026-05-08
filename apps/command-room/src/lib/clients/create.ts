'use server';

// Create a new client row from the command-room.
//
// Flow:
//   1. Preparer fills in name + phone (+ optional email/state) on
//      /clients/new.
//   2. This server action validates + inserts a clients row scoped
//      to the preparer's tenant via withTenant() (RLS-bound).
//   3. clerk_user_id stays NULL — when the client completes phone
//      OTP on the client portal, the binding flow in
//      apps/client-portal/src/lib/intake/auth.ts sets it.
//   4. Caller renders the success card with the share link
//      (https://<client-portal-url>/login?phone=<E.164>&country=<2-letter>).
//
// Auth: requires firm_owner / preparer / reviewer / admin role.
// Assistants don't manage the client roster.

import { eq, and } from 'drizzle-orm';
import * as Sentry from '@sentry/nextjs';
import { withTenant, schema } from '@docket/db/client';
import { asTenantId } from '@docket/shared';
import type { TenantId } from '@docket/shared';
import { requireRole } from '@/lib/require-role';
import { assertWritable } from '@/lib/read-only-mode';
import { revalidatePath } from 'next/cache';

export type CreateClientResult =
  | {
      ok: true;
      clientId: string;
      fullName: string;
      phone: string;
    }
  | {
      ok: false;
      error: string;
      field?: 'fullName' | 'phone' | 'email';
    };

export async function createClient(input: {
  fullName: string;
  /** E.164 phone, e.g. "+15622736682". */
  phone: string;
  email?: string;
  state?: string;
  preferredLanguage?: string;
}): Promise<CreateClientResult> {
  const user = await requireRole(['firm_owner', 'preparer', 'reviewer', 'admin']);

  // Read-only mode gate. Throws ReadOnlyModeError if the DB is
  // down / timing out. Pairs with the WriteAction UI wrapper —
  // UI is best-effort; this is the load-bearing security check.
  await assertWritable();

  // Validate.
  const fullName = input.fullName.trim();
  if (fullName.length < 2) {
    return { ok: false, error: 'Full name is required.', field: 'fullName' };
  }
  if (fullName.length > 200) {
    return { ok: false, error: 'Name is too long.', field: 'fullName' };
  }

  const phone = input.phone.trim();
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
    return {
      ok: false,
      error: 'Phone must be in E.164 format, e.g. +15622736682.',
      field: 'phone',
    };
  }

  const email = input.email?.trim().toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Email looks invalid.', field: 'email' };
  }

  try {
    const result = await withTenant(asTenantId(user.tenantId), async (db) => {
      // Reject duplicates within the same tenant. The phone must be
      // unique-per-tenant for the binding flow to work deterministically.
      const [existing] = await db
        .select({ id: schema.clients.id, fullName: schema.clients.fullName })
        .from(schema.clients)
        .where(eq(schema.clients.phone, phone))
        .limit(1);

      if (existing) {
        return {
          duplicate: true as const,
          existingName: existing.fullName,
        };
      }

      const [created] = await db
        .insert(schema.clients)
        .values({
          tenantId: user.tenantId,
          fullName,
          phone,
          email,
          state: input.state?.trim() || null,
          preferredLanguage: input.preferredLanguage?.trim() || 'en',
          intakeStatus: 'not-started',
          kycStatus: 'pending',
          // clerk_user_id intentionally NULL — set by the phone-binding
          // flow on the client portal when the taxpayer signs in.
        })
        .returning({
          id: schema.clients.id,
          fullName: schema.clients.fullName,
          phone: schema.clients.phone,
        });

      if (!created) {
        return { duplicate: false as const, created: null };
      }

      return { duplicate: false as const, created };
    });

    if (result.duplicate) {
      return {
        ok: false,
        error: `A client with phone ${phone} already exists (${result.existingName}).`,
        field: 'phone',
      };
    }

    if (!result.created || !result.created.phone) {
      Sentry.captureMessage('[command-room] createClient INSERT returned no row', 'error');
      return { ok: false, error: 'Could not create client. Please try again.' };
    }

    // Refresh the /clients list cache so the new row shows immediately.
    revalidatePath('/clients');

    return {
      ok: true,
      clientId: result.created.id,
      fullName: result.created.fullName,
      phone: result.created.phone,
    };
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: 'command-room-create-client' },
    });
    return { ok: false, error: 'Could not create client. Please try again.' };
  }
}
