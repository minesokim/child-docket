// Server-side helper that resolves the current Clerk session to a
// Postgres user record + tenant.
//
// Tenant resolution (Day 2 of post-audit hardening — multi-firm wiring):
//   1. If the Clerk session has an orgId, look up tenants WHERE
//      clerk_org_id = orgId. That's the multi-firm path: one Clerk
//      Organization = one tenant.
//   2. If no orgId, fall back to a tenant-unscoped lookup (transitional).
//      Antonio creates the Clerk Org via the dashboard and runs a
//      one-line UPDATE to link tenants.clerk_org_id; before that lands,
//      the legacy email-claim path keeps the dev loop working.
//
// User resolution (within the tenant boundary):
//   1. SELECT users WHERE clerk_user_id = <session.userId> [AND tenant_id = T]
//   2. If not found, SELECT users WHERE email = <verified primary email>
//      [AND tenant_id = T]. Match → UPDATE clerk_user_id and return.
//      This is the "claim" path: a pre-seeded row gets bound to the
//      real Clerk userId on first sign-in matching the verified email.
//   3. NEW (Day 4 wire-up): if the user is in a Clerk Org we track AND
//      no users row matches them, auto-provision a row with role
//      'preparer'. This is the "first staff member" path — when
//      Antonio invites someone via Clerk Org invite, their first
//      sign-in lands here and gets a baseline-permissions row.
//      Antonio elevates roles manually via UPDATE for now.
//   4. If we can't auto-provision (no orgId, or orgId doesn't match a
//      tenant) → return null. The caller renders "no account".

import { auth, currentUser } from '@clerk/nextjs/server';
import { getAdminDb, schema } from '@docket/db/client';
import { and, eq } from 'drizzle-orm';
import * as Sentry from '@sentry/nextjs';
import type { Role } from '@docket/shared';

export type DocketUser = {
  id: string;
  tenantId: string;
  clerkUserId: string;
  email: string;
  name: string | null;
  /** Schema-enforced enum — see @docket/shared USER_ROLES. */
  role: Role;
  /** Tenant display name, joined from tenants table for UI headers. */
  tenantName: string;
  /** Tenant slug — useful for URL prefixes / per-tenant redirects later. */
  tenantSlug: string;
};

export async function getCurrentDocketUser(): Promise<DocketUser | null> {
  const { userId: clerkUserId, orgId } = await auth();
  if (!clerkUserId) return null;

  const db = getAdminDb();

  // 1. Resolve tenant from the Clerk Organization (multi-firm path).
  let tenantId: string | null = null;
  if (orgId) {
    const [tenant] = await db
      .select({ id: schema.tenants.id })
      .from(schema.tenants)
      .where(eq(schema.tenants.clerkOrgId, orgId))
      .limit(1);

    if (!tenant) {
      // Clerk session is in some org we don't track. Refuse — we
      // can't determine which firm's data to scope to, and a
      // tenant-unscoped lookup would defeat the multi-firm
      // boundary. Antonio sets clerk_org_id via the dashboard +
      // one-line UPDATE; if that hasn't landed yet, sign out of
      // the org or we'll keep landing here.
      Sentry.captureMessage(
        '[command-room] Clerk orgId has no matching tenants.clerk_org_id',
        'warning',
      );
      return null;
    }
    tenantId = tenant.id;
  }

  // 2. Fast path: clerkUserId match, scoped to tenant if known.
  // Join tenants for display name + slug — avoids a follow-up
  // lookup in pages that render the tenant header.
  const byClerkIdWhere = tenantId
    ? and(eq(schema.users.clerkUserId, clerkUserId), eq(schema.users.tenantId, tenantId))
    : eq(schema.users.clerkUserId, clerkUserId);

  const byClerkId = await db
    .select({
      id: schema.users.id,
      tenantId: schema.users.tenantId,
      clerkUserId: schema.users.clerkUserId,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
      tenantName: schema.tenants.name,
      tenantSlug: schema.tenants.slug,
    })
    .from(schema.users)
    .innerJoin(schema.tenants, eq(schema.tenants.id, schema.users.tenantId))
    .where(byClerkIdWhere)
    .limit(1);

  if (byClerkId[0]) {
    return byClerkId[0] satisfies DocketUser;
  }

  // 3. Claim path: match by VERIFIED PRIMARY email, bind clerkUserId.
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
  //   - Tenant-scope the lookup if orgId is set. `email` is intentionally
  //     NOT unique on users — two firms can seed the same email (a
  //     contractor working both books). Without the filter the
  //     first-match-wins UPDATE is non-deterministic.
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const primary = clerkUser.emailAddresses.find(
    (ea) => ea.id === clerkUser.primaryEmailAddressId,
  );
  if (!primary) return null;
  if (primary.verification?.status !== 'verified') return null;

  const email = primary.emailAddress.toLowerCase();

  const byEmailWhere = tenantId
    ? and(eq(schema.users.email, email), eq(schema.users.tenantId, tenantId))
    : eq(schema.users.email, email);

  const byEmail = await db
    .select({
      id: schema.users.id,
      tenantId: schema.users.tenantId,
      clerkUserId: schema.users.clerkUserId,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
      tenantName: schema.tenants.name,
      tenantSlug: schema.tenants.slug,
    })
    .from(schema.users)
    .innerJoin(schema.tenants, eq(schema.tenants.id, schema.users.tenantId))
    .where(byEmailWhere)
    .limit(1);

  if (byEmail[0]) {
    // Found a pre-provisioned row by email. Bind it to this Clerk
    // identity AND capture the Clerk profile image. Surfaces in the
    // client-portal AskAntonioBar / AskAntonioChat / AvatarSlot via
    // the firm-owner JOIN in client-portal/lib/intake/auth.ts. NULL
    // when Clerk hasn't captured an image — UI falls back to initials.
    const [updated] = await db
      .update(schema.users)
      .set({ clerkUserId, avatarUrl: clerkUser.imageUrl ?? null })
      .where(eq(schema.users.id, byEmail[0].id))
      .returning({
        id: schema.users.id,
        tenantId: schema.users.tenantId,
        clerkUserId: schema.users.clerkUserId,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.users.role,
      });

    if (!updated) return null;

    // The UPDATE...RETURNING doesn't carry the joined tenant fields;
    // splice them in from the byEmail read which already has them.
    return {
      ...updated,
      tenantName: byEmail[0].tenantName,
      tenantSlug: byEmail[0].tenantSlug,
    } satisfies DocketUser;
  }

  // 4. Auto-provision (Day 4 — "first staff member" path).
  //
  // Reached when: Clerk session is bound to an org we track, but no
  // users row exists for this clerkUserId AND no row exists matching
  // their email. This is the new-hire flow: Antonio invited someone
  // via Clerk Org invite, they accepted, this is their first sign-in.
  //
  // We INSERT a row with the safe baseline role 'preparer'. Antonio
  // elevates manually for now via:
  //   UPDATE users SET role = 'firm_owner' WHERE email = '...';
  //
  // Why we DON'T auto-provision in legacy mode (no orgId): without
  // the Clerk Org boundary we can't determine which tenant to assign
  // the user to. The seed-then-claim path covers Antonio's own
  // bootstrap; everyone else needs to come in through an invite.
  if (!orgId || !tenantId) {
    return null;
  }

  // Build the display name from Clerk's profile fields. Falls back to
  // email local-part if Clerk hasn't captured a name (some providers
  // don't surface one).
  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim() ||
    email.split('@')[0] ||
    null;

  // Race-safe insert: if two concurrent first-sign-ins hit at once,
  // the unique constraint on clerk_user_id makes the loser's INSERT
  // fail. We catch and re-read.
  try {
    const [created] = await db
      .insert(schema.users)
      .values({
        tenantId,
        clerkUserId,
        email,
        name,
        // Capture the Clerk profile image for the client-portal
        // firm-owner avatar surface (see client-portal/lib/intake/
        // auth.ts loadFirmOwner). NULL → UI falls back to initials.
        avatarUrl: clerkUser.imageUrl ?? null,
        role: 'preparer',
      })
      .returning({
        id: schema.users.id,
        tenantId: schema.users.tenantId,
        clerkUserId: schema.users.clerkUserId,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.users.role,
      });

    if (!created) {
      Sentry.captureMessage(
        '[command-room] auto-provision INSERT returned no row',
        'error',
      );
      return null;
    }

    // Pull tenant display fields. Same shape as the byEmail path —
    // INSERT...RETURNING can't carry the joined columns.
    const [tenant] = await db
      .select({ name: schema.tenants.name, slug: schema.tenants.slug })
      .from(schema.tenants)
      .where(eq(schema.tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      Sentry.captureMessage(
        '[command-room] auto-provision: tenant disappeared between resolution and insert',
        'error',
      );
      return null;
    }

    return {
      ...created,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
    } satisfies DocketUser;
  } catch (err) {
    // Most likely: lost the race against a concurrent first-sign-in.
    // Re-read by clerkUserId; the winner's row is now present.
    const [reread] = await db
      .select({
        id: schema.users.id,
        tenantId: schema.users.tenantId,
        clerkUserId: schema.users.clerkUserId,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.users.role,
        tenantName: schema.tenants.name,
        tenantSlug: schema.tenants.slug,
      })
      .from(schema.users)
      .innerJoin(schema.tenants, eq(schema.tenants.id, schema.users.tenantId))
      .where(eq(schema.users.clerkUserId, clerkUserId))
      .limit(1);

    if (reread) return reread satisfies DocketUser;

    Sentry.captureException(err, {
      tags: { component: 'command-room-auto-provision' },
    });
    return null;
  }
}
