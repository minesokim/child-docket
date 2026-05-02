'use server';

// Auth + client-row provisioning. Resolves a Clerk session to a `clients`
// row, creating the row tied to Antonio's tenant on first sign-in.
//
// Race-safe: under concurrent first-visit calls (user double-clicks the
// welcome CTA, or two tabs hit /welcome simultaneously), the unique
// constraint on clients.clerk_user_id ensures only ONE INSERT succeeds.
// ON CONFLICT DO NOTHING swallows the loser; both calls converge on the
// same canonical row via the follow-up SELECT.
//
// Fast path: existing users hit the SELECT-first short circuit on every
// request after their first sign-in, no INSERT, no Clerk currentUser()
// fetch.

import { auth, currentUser } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import * as Sentry from '@sentry/nextjs';
import { getAdminDb, schema } from '@docket/db';

const VAZANT_TENANT_SLUG = 'vazant';

export type AuthedClient = {
  clientId: string;
  tenantId: string;
  clerkUserId: string;
};

export async function getOrCreateClient(): Promise<AuthedClient | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const db = getAdminDb();

  // Fast path: already provisioned. Vast majority of requests land here.
  const [existing] = await db
    .select({ id: schema.clients.id, tenantId: schema.clients.tenantId })
    .from(schema.clients)
    .where(eq(schema.clients.clerkUserId, userId))
    .limit(1);

  if (existing) {
    return { clientId: existing.id, tenantId: existing.tenantId, clerkUserId: userId };
  }

  // First sign-in for this Clerk user. Provision them under Vazant.
  const [tenant] = await db
    .select({ id: schema.tenants.id })
    .from(schema.tenants)
    .where(eq(schema.tenants.slug, VAZANT_TENANT_SLUG))
    .limit(1);

  if (!tenant) {
    Sentry.captureMessage('[intake] Vazant tenant not seeded - cannot provision client', 'error');
    return null;
  }

  const clerkUser = await currentUser();
  const phone = clerkUser?.primaryPhoneNumber?.phoneNumber ?? null;
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? null;
  const firstName = clerkUser?.firstName ?? '';
  const lastName = clerkUser?.lastName ?? '';
  const fullName =
    [firstName, lastName].filter(Boolean).join(' ') || phone || email || 'New client';

  // Race-safe insert: if another concurrent request beat us, ON CONFLICT
  // DO NOTHING swallows the unique violation. Follow-up SELECT picks up
  // whichever row ended up in the table.
  await db
    .insert(schema.clients)
    .values({
      tenantId: tenant.id,
      clerkUserId: userId,
      fullName,
      email,
      phone,
      intakeStatus: 'in-progress',
    })
    .onConflictDoNothing({ target: schema.clients.clerkUserId });

  const [client] = await db
    .select({ id: schema.clients.id, tenantId: schema.clients.tenantId })
    .from(schema.clients)
    .where(eq(schema.clients.clerkUserId, userId))
    .limit(1);

  if (!client) {
    // INSERT either succeeded (our row) or no-opped because someone
    // else's row already existed. The SELECT should always find a row.
    // If we get here, it's an RLS or constraint misconfig.
    Sentry.captureMessage(
      '[intake] client row missing after upsert (RLS or constraint misconfig?)',
      'error',
    );
    return null;
  }
  return { clientId: client.id, tenantId: client.tenantId, clerkUserId: userId };
}
