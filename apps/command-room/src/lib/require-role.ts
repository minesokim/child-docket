// Role-based access control for the command-room (preparer surface).
//
// Day 3 of post-audit hardening. The substrate landed in Day 2 (users
// table multi-tenant, tenants.clerkOrgId for firm boundary). This file
// adds the role boundary on top: which firm members can do which
// things, enforced at the Server Component / Server Action edge.
//
// ─────────────────────────────────────────────────────────────────
// POLICY MATRIX
// ─────────────────────────────────────────────────────────────────
//
//   Role          Sees client list?  Sees fees + notes?  Reveals SSN/EIN?  Signs returns?  Manages team?
//   firm_owner    yes                yes                 yes               yes (PTIN)      yes
//   preparer      yes                yes                 yes               no              no
//   reviewer      yes                yes                 yes               no              no
//   admin         yes (basic info)   yes (billing only)  NO                no              yes
//   assistant     yes (basic info)   no                  NO                no              no
//
// PTIN-signing authority (`firm_owner` only) is enforced when the
// DocuSign + KBA flow wires up on Day 13. Today the 8879 page is
// hard-disabled in production; that gate stays in place even after
// role enforcement lands so role enforcement isn't load-bearing alone.
//
// SSN/EIN reveal: today the reveal endpoint lives in client-portal
// (taxpayer self-reveal of own data), not command-room (preparer
// reveal of client data). When the preparer-reveal endpoint lands,
// it'll call assertRole(['firm_owner', 'preparer', 'reviewer'])
// before surfacing plaintext.
//
// ─────────────────────────────────────────────────────────────────
// USAGE
// ─────────────────────────────────────────────────────────────────
//
// Server Component (page.tsx):
//
//   const user = await requireRole(['firm_owner', 'preparer', 'reviewer']);
//   // user is the DocketUser, guaranteed in-role; redirects on fail.
//
// Server Action ('use server'):
//
//   const user = await getCurrentDocketUser();
//   if (!user) return { ok: false, error: 'Not signed in' };
//   assertRole(user, ['firm_owner']);
//   // throws if role doesn't match; caller's try/catch surfaces error.
//
// Inline UI gating (hide a button rather than redirect):
//
//   {hasRole(user, ['firm_owner']) && <SignReturnButton />}

import { redirect } from 'next/navigation';
import { isRole, type Role } from '@docket/shared';
import { getCurrentDocketUser, type DocketUser } from './current-user';

/**
 * Server Component helper. Resolves the current Clerk session to a
 * DocketUser, then verifies the user's role is in the allowed set.
 * Redirects on fail:
 *   - no session     → /sign-in
 *   - role mismatch  → /clients (the role-agnostic landing page)
 *
 * Always returns a DocketUser; on fail the redirect throws and this
 * function never returns to the caller. Server Components can rely on
 * the return value being non-null.
 */
export async function requireRole(allowed: readonly Role[]): Promise<DocketUser> {
  const user = await getCurrentDocketUser();
  if (!user) redirect('/sign-in');

  if (!isRole(user.role) || !allowed.includes(user.role)) {
    // Role mismatch. Bounce to /clients — the safest "you're signed
    // in but can't see this" landing surface. Keep this generic;
    // explicit "denied" UI can land later if Antonio asks for it.
    redirect('/clients');
  }

  return user;
}

/**
 * Pure throw-on-fail variant for Server Actions. Doesn't redirect
 * (Server Actions can't gracefully redirect from inside a throw); the
 * caller's try/catch should map the error to a structured result.
 *
 * Caller is responsible for null-checking the user first — `assertRole`
 * doesn't fetch, it asserts on what you already have. This separation
 * avoids the double-fetch when a Server Action already called
 * getCurrentDocketUser() for its own reasons.
 */
export function assertRole(
  user: { role: string },
  allowed: readonly Role[],
): asserts user is { role: Role } {
  if (!isRole(user.role)) {
    throw new Error(`Unauthorized: unknown role '${user.role}'`);
  }
  if (!allowed.includes(user.role)) {
    throw new Error(
      `Unauthorized: role '${user.role}' not in [${allowed.join(', ')}]`,
    );
  }
}

/**
 * Boolean predicate for inline UI gating. Useful when you want to
 * hide a button instead of redirecting away from a page the user can
 * partially see.
 */
export function hasRole(
  user: { role: string },
  allowed: readonly Role[],
): user is { role: Role } {
  return isRole(user.role) && allowed.includes(user.role);
}
