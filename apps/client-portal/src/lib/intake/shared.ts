'use server';

// Shared async helpers for the intake server actions. Constants + types
// live in the individual files where they're used.

import { taxYearForDate } from '@docket/shared';

/**
 * Tax year for the active intake — wraps the timezone-aware helper
 * from @docket/shared with `now` and the caller's tenant timezone.
 *
 * Multi-firm note (Day 2 of post-audit hardening): the timezone is
 * the AUTHED tenant's, not a Vazant default. Callers get the tenant
 * timezone from `getOrCreateClient()` / `resolveClient()` — the auth
 * helper joins `tenants.timezone` so the tenant boundary is read in
 * the same round-trip as the auth check.
 *
 * Async because all 'use server' exports must be async functions
 * (Next.js wraps every export as an RPC-able action).
 */
export async function getCurrentTaxYear(timezone: string): Promise<number> {
  return taxYearForDate(new Date(), timezone);
}
