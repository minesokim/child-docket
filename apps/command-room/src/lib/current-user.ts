// Server-side helper that resolves the current Clerk session to a Postgres
// user record + tenant.
//
// Lookup strategy (self-healing on first sign-in):
//   1. SELECT users WHERE clerk_user_id = <session.userId>
//   2. If not found, SELECT users WHERE email = <session.email>
//      → if matched, UPDATE clerk_user_id and return.
//      → this is the "claim" path: a pre-seeded row gets bound to the
//        real Clerk userId on first sign-in matching email.
//   3. If still not found, return null. The caller decides what to do
//      (typically: render a "no account provisioned" screen).
//
// Webhook-based provisioning (Clerk user.created → POST our endpoint) lands
// in Layer 0.5 when client phone-OTP signups need to auto-provision rows.
// For Layer 0 (Antonio admin), the seed-then-claim path is sufficient.

import { auth, currentUser } from '@clerk/nextjs/server';
import { getAdminDb, schema } from '@docket/db/client';
import { eq } from 'drizzle-orm';

export type DocketUser = {
  id: string;
  tenantId: string;
  clerkUserId: string;
  email: string;
  name: string | null;
  role: string;
};

export async function getCurrentDocketUser(): Promise<DocketUser | null> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  const db = getAdminDb();

  // Fast path: bound user
  const byClerkId = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.clerkUserId, clerkUserId))
    .limit(1);

  if (byClerkId[0]) {
    return byClerkId[0] as DocketUser;
  }

  // Claim path: match by email, bind clerkUserId.
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress?.toLowerCase();
  if (!email) return null;

  const byEmail = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (!byEmail[0]) return null;

  // Found a pre-provisioned row by email. Bind it to this Clerk identity.
  const [updated] = await db
    .update(schema.users)
    .set({ clerkUserId })
    .where(eq(schema.users.id, byEmail[0].id))
    .returning();

  return (updated ?? null) as DocketUser | null;
}
