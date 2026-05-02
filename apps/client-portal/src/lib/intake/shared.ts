'use server';

// Shared async helpers for the intake server actions. Constants + types
// live in the individual files where they're used.

import { taxYearForDate } from '@docket/shared';

/**
 * Tax year for the active intake — wraps the timezone-aware helper from
 * @docket/shared with `now` and the Vazant default tenant timezone.
 * When multi-tenant lands, this takes a tenant id + reads its timezone
 * column.
 *
 * Async because all 'use server' exports must be async functions
 * (Next.js wraps every export as an RPC-able action).
 */
export async function getCurrentTaxYear(): Promise<number> {
  return taxYearForDate(new Date(), 'America/Los_Angeles');
}
