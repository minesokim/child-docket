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

  // Claim path: match by VERIFIED PRIMARY email, bind clerkUserId.
  //
  // Hardening from the May 2026 security audit:
  //   - Use the *primary* email (clerkUser.primaryEmailAddressId), not
  //     emailAddresses[0]. Clerk users can have multiple email addresses
  //     in any order; emailAddresses[0] is non-deterministic and can be
  //     a secondary, unverified address an attacker controls.
  //   - Require Clerk's verification.status === 'verified'. Without this
  //     check, anyone who *claims* an email matching a pre-seeded admin
  //     row could bind their Clerk identity to it before proving they
  //     own the inbox.
  //   - TODO(multi-tenant): when the second firm onboards, scope this
  //     lookup by Clerk Organization id (auth().orgId → tenants.clerkOrgId).
  //     `email` is intentionally NOT unique on users — two firms can have
  //     the same email seeded (a contractor working both books). Without a
  //     tenant filter, the first-match-wins UPDATE is non-deterministic.
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const primary = clerkUser.emailAddresses.find(
    (ea) => ea.id === clerkUser.primaryEmailAddressId,
  );
  if (!primary) return null;
  if (primary.verification?.status !== 'verified') return null;

  const email = primary.emailAddress.toLowerCase();

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
