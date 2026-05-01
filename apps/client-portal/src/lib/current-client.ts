// Server-side helper that resolves the current Clerk session to a Postgres
// `clients` row, creating one on first call if none exists.
//
// Called from /welcome on first auth'd page-load. The Clerk webhook path
// (which would create rows asynchronously) lands later — for v0 we do it
// inline since /welcome is the natural first authenticated screen.
//
// Tenant assignment: v0 pins all new clients to Vazant Consulting (Antonio's
// only tenant). Multi-tenant later via invite codes / domain routing.

import { auth, currentUser } from '@clerk/nextjs/server';
import { getAdminDb, schema } from '@docket/db/client';
import { eq } from 'drizzle-orm';

export type DocketClient = {
  id: string;
  tenantId: string;
  clerkUserId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  intakeStatus: string;
  preferredLanguage: string;
};

const VAZANT_TENANT_SLUG = 'vazant';

export async function getOrCreateCurrentClient(): Promise<DocketClient | null> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  const db = getAdminDb();

  // Fast path: already provisioned
  const existing = await db
    .select()
    .from(schema.clients)
    .where(eq(schema.clients.clerkUserId, clerkUserId))
    .limit(1);

  if (existing[0]) return existing[0] as DocketClient;

  // First sign-in. Look up Antonio's tenant + create the client row.
  const [tenant] = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.slug, VAZANT_TENANT_SLUG))
    .limit(1);

  if (!tenant) {
    // Tenant not seeded. Surface to caller — UI shows "no account provisioned"
    // type fallback rather than crashing.
    console.error('[current-client] Vazant tenant not seeded; refusing to create client');
    return null;
  }

  const clerkUser = await currentUser();
  const phone = clerkUser?.primaryPhoneNumber?.phoneNumber ?? null;
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? null;
  const firstName = clerkUser?.firstName ?? '';
  const lastName = clerkUser?.lastName ?? '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || phone || email || 'New client';

  const [created] = await db
    .insert(schema.clients)
    .values({
      tenantId: tenant.id,
      clerkUserId,
      fullName,
      email,
      phone,
      intakeStatus: 'in-progress',
    })
    .returning();

  return (created ?? null) as DocketClient | null;
}
