// User-role primitives shared between command-room (preparer surface)
// and any future caller that needs to know who's allowed to do what.
//
// Roles live here (in @docket/shared) so they're a single source of
// truth — schema enum (packages/db/src/schema.ts userRoleEnum), TS
// type, and runtime guards all derived from one tuple.
//
// Policy matrix lives in apps/command-room/src/lib/require-role.ts
// because it's command-room-specific. This module is just the shape.

// ────────────────────────────────────────────────────────────────
// USER_ROLES — canonical tuple. Order is stable; add new roles at
// the END so any persistence-of-position assumptions don't break.
// ────────────────────────────────────────────────────────────────
export const USER_ROLES = [
  'firm_owner',
  'preparer',
  'reviewer',
  'admin',
  'assistant',
] as const;

export type Role = (typeof USER_ROLES)[number];

/** Runtime guard. Use at the schema/Clerk → app boundary. */
export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}

/**
 * Pure throw-on-fail role check for Server Actions. Doesn't fetch —
 * caller passes a user it already loaded. Avoids the double-fetch
 * pattern when an action already needed the user for its own work.
 *
 * Use when you want a hard error that the caller's try/catch maps to
 * a structured failure result. For Server Components, prefer the
 * `requireRole` helper in apps/command-room/src/lib/require-role.ts —
 * that one redirects rather than throws.
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
 * Boolean predicate for inline UI gating — hide a button instead of
 * redirecting away from a page the user can partially see. Type
 * predicate narrows `user.role` to `Role` on the truthy branch.
 */
export function hasRole(
  user: { role: string },
  allowed: readonly Role[],
): user is { role: Role } {
  return isRole(user.role) && allowed.includes(user.role);
}
