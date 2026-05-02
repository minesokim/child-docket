'use server';

// Auth + client-row binding. Resolves a Clerk session to a `clients`
// row by matching the verified phone number against pre-seeded rows.
//
// Why phone-based binding instead of auto-provisioning (May 2026 audit):
//
//   The previous flow auto-created a client row in the hardcoded
//   Vazant tenant on first phone-OTP completion. Codex flagged this RED:
//   "anyone who can complete the public phone OTP flow gets a real
//   client row under Antonio's tenant without an invitation."
//
//   The fix is to make the client-row a CREDENTIAL, not a CONSEQUENCE
//   of auth. Antonio (or any preparer) seeds clients rows for the
//   people he expects to onboard — he already knows them, he already
//   has their phone numbers. When that phone completes Clerk OTP, the
//   row gets bound (clerk_user_id UPDATE). Unknown phones → no
//   binding → "no portal access — contact your preparer" page.
//
// Multi-firm posture:
//
//   This design is naturally multi-tenant. Each firm seeds its own
//   clients with its own phone numbers. The phone → client lookup
//   doesn't need a tenant filter — phones uniquely identify a client
//   within their firm, and v0 has no overlap across firms.
//
//   When the second firm onboards and a person could plausibly be a
//   client of both (rare), we'll add a tenant-selection step. Today
//   that branch flags an error and routes to no-access; the data
//   model still supports adding it later.
//
// Race-safety:
//
//   The binding UPDATE includes `WHERE clerk_user_id IS NULL` so two
//   concurrent first-sign-ins (double-click /welcome) can't overwrite
//   each other. The unique constraint on clerk_user_id is the second
//   line of defense.

import { auth, currentUser } from '@clerk/nextjs/server';
import { eq, and, isNull, asc } from 'drizzle-orm';
import * as Sentry from '@sentry/nextjs';
import { getAdminDb, schema } from '@docket/db';

// Resolves the firm owner for a tenant. Returns the OLDEST firm_owner
// row by createdAt — deterministic when there are multiple, which v0
// shouldn't have but the schema permits.
//
// Pulled out of resolveClient so both the fast-path read and the
// post-bind read can call it. One round-trip per call; we do at most
// one per resolveClient invocation.
async function loadFirmOwner(
  db: ReturnType<typeof getAdminDb>,
  tenantId: string,
): Promise<AuthedClient['firmOwner']> {
  const [owner] = await db
    .select({
      name: schema.users.name,
      avatarUrl: schema.users.avatarUrl,
    })
    .from(schema.users)
    .where(and(eq(schema.users.tenantId, tenantId), eq(schema.users.role, 'firm_owner')))
    .orderBy(asc(schema.users.createdAt))
    .limit(1);

  if (!owner || !owner.name) return null;
  const firstName = owner.name.split(/\s+/)[0] ?? owner.name;
  return {
    name: owner.name,
    firstName,
    avatarUrl: owner.avatarUrl,
  };
}

export type AuthedClient = {
  clientId: string;
  tenantId: string;
  clerkUserId: string;
  /** Tenant timezone, used by tax-year computation. */
  timezone: string;
  /** Tenant display name — surfaces in /welcome H1 etc. */
  tenantName: string;
  /**
   * The firm owner of the current tenant. Surfaces in AskAntonioBar
   * ("Stuck? Ask {firstName}"), AskAntonioChat header, AvatarSlot,
   * AntonioNote — replaces the previous hardcoded "Antonio" copy.
   *
   * Multi-firm note: a tenant could have multiple users with role
   * 'firm_owner' down the road; for v0 we pick LIMIT 1 deterministically
   * (oldest by createdAt). Refine when that case actually exists.
   *
   * `null` if the tenant has no firm_owner row yet (shouldn't happen
   * post-seed, but the UI falls back to "Antonio Vazquez" / antonio.webp
   * defaults so this can't crash a render).
   */
  firmOwner: {
    name: string;
    /** First-name slice for "Ask {firstName}" copy. */
    firstName: string;
    /** Avatar URL from Clerk imageUrl. NULL → UI shows initials of name. */
    avatarUrl: string | null;
  } | null;
};

/**
 * Reasons the resolver couldn't return an authed client. Useful for
 * routing — `/welcome` redirects 'no_invite' to `/no-access`.
 */
export type AuthResolution =
  | { kind: 'authed'; client: AuthedClient }
  | { kind: 'no_session' }   // not signed in
  | { kind: 'no_invite' };   // signed in, but phone doesn't match any pre-seeded client

/**
 * Backwards-compatible shim returning AuthedClient | null. Existing
 * server actions (write/read/reveal/complete/sign) all check for null;
 * 'no_invite' and 'no_session' both surface as null and the caller
 * returns "Not signed in". Pages that care about the distinction
 * (like /welcome) call resolveClient() directly.
 */
export async function getOrCreateClient(): Promise<AuthedClient | null> {
  const r = await resolveClient();
  return r.kind === 'authed' ? r.client : null;
}

export async function resolveClient(): Promise<AuthResolution> {
  const { userId } = await auth();
  if (!userId) return { kind: 'no_session' };

  const db = getAdminDb();

  // Fast path: already bound. Vast majority of requests land here.
  // Join tenants to pull timezone + display name in the same
  // round-trip — every server action ends up needing the timezone
  // for tax-year computation, and most pages need the tenant name
  // for headers.
  const [existing] = await db
    .select({
      id: schema.clients.id,
      tenantId: schema.clients.tenantId,
      timezone: schema.tenants.timezone,
      tenantName: schema.tenants.name,
    })
    .from(schema.clients)
    .innerJoin(schema.tenants, eq(schema.tenants.id, schema.clients.tenantId))
    .where(eq(schema.clients.clerkUserId, userId))
    .limit(1);

  if (existing) {
    const firmOwner = await loadFirmOwner(db, existing.tenantId);
    return {
      kind: 'authed',
      client: {
        clientId: existing.id,
        tenantId: existing.tenantId,
        clerkUserId: userId,
        timezone: existing.timezone,
        tenantName: existing.tenantName,
        firmOwner,
      },
    };
  }

  // Not yet bound. Look for a matching pre-seeded clients row by
  // VERIFIED phone. Same hardening as command-room/current-user.ts:
  // unverified phones don't count.
  const clerkUser = await currentUser();
  const phoneObj = clerkUser?.primaryPhoneNumber;
  if (!phoneObj) return { kind: 'no_invite' };
  if (phoneObj.verification?.status !== 'verified') return { kind: 'no_invite' };

  const phoneE164 = phoneObj.phoneNumber;

  const candidates = await db
    .select({ id: schema.clients.id, tenantId: schema.clients.tenantId })
    .from(schema.clients)
    .where(and(eq(schema.clients.phone, phoneE164), isNull(schema.clients.clerkUserId)))
    .limit(2);

  if (candidates.length === 0) {
    Sentry.captureMessage(
      '[intake] phone-OTP completed but no matching unbound client row',
      'warning',
    );
    return { kind: 'no_invite' };
  }

  if (candidates.length > 1) {
    // Multi-tenant ambiguity. v0 single-tenant cannot hit this; flag
    // when the second firm starts seeding so we know to add a
    // tenant-selection step.
    Sentry.captureMessage(
      '[intake] phone matches multiple unbound client rows across tenants',
      'error',
    );
    return { kind: 'no_invite' };
  }

  const target = candidates[0]!;

  // Race-safe binding UPDATE. The IS NULL predicate means a concurrent
  // bind (user double-clicked /welcome) can't overwrite us, and we
  // can't overwrite them.
  const [bound] = await db
    .update(schema.clients)
    .set({
      clerkUserId: userId,
      intakeStatus: 'in-progress',
      updatedAt: new Date(),
    })
    .where(and(eq(schema.clients.id, target.id), isNull(schema.clients.clerkUserId)))
    .returning({ id: schema.clients.id, tenantId: schema.clients.tenantId });

  if (!bound) {
    // Lost the race. The winner's bind already landed; re-read by
    // clerkUserId.
    const [reread] = await db
      .select({
        id: schema.clients.id,
        tenantId: schema.clients.tenantId,
        timezone: schema.tenants.timezone,
        tenantName: schema.tenants.name,
      })
      .from(schema.clients)
      .innerJoin(schema.tenants, eq(schema.tenants.id, schema.clients.tenantId))
      .where(eq(schema.clients.clerkUserId, userId))
      .limit(1);

    if (reread) {
      const firmOwner = await loadFirmOwner(db, reread.tenantId);
      return {
        kind: 'authed',
        client: {
          clientId: reread.id,
          tenantId: reread.tenantId,
          clerkUserId: userId,
          timezone: reread.timezone,
          tenantName: reread.tenantName,
          firmOwner,
        },
      };
    }

    Sentry.captureMessage(
      '[intake] phone bind UPDATE missed and clerkUserId re-read also missed',
      'error',
    );
    return { kind: 'no_invite' };
  }

  // Pull tenant + firm owner for the freshly-bound row. Could fold
  // into the UPDATE...RETURNING with a join, but Drizzle's
  // UPDATE...RETURNING doesn't support joins — a follow-up SELECT is
  // the simpler shape, and the row is fresh so cache-invalidation
  // isn't a concern.
  const [tenantRow] = await db
    .select({ timezone: schema.tenants.timezone, name: schema.tenants.name })
    .from(schema.tenants)
    .where(eq(schema.tenants.id, bound.tenantId))
    .limit(1);

  const firmOwner = await loadFirmOwner(db, bound.tenantId);

  return {
    kind: 'authed',
    client: {
      clientId: bound.id,
      tenantId: bound.tenantId,
      clerkUserId: userId,
      timezone: tenantRow?.timezone ?? 'America/Los_Angeles',
      tenantName: tenantRow?.name ?? 'Your tax preparer',
      firmOwner,
    },
  };
}
