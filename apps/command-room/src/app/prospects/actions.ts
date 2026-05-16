'use server';

// Prospects admin server actions.
//
// Per Session 12 / L16 100-customers-by-8/1 (must-ship #4: CRM /
// funnel tracking by 5/18). The prospects table (migration 0030)
// captures Discovery Scan form submissions; David (founder) needs
// to track them through the lifecycle: submitted → contacted →
// scan_sent → converted | rejected.
//
// SECURITY
//   - Server-action-only. Browser cannot reach this directly.
//   - assertRole(['firm_owner']) gates the action. Today David is
//     the only firm_owner of the only tenant; once tenant #2
//     onboards, this gate needs `platform_admin` role (V1.5).
//   - prospects table is a PLATFORM table (no RLS per Session 5's
//     PLATFORM_TABLES allowlist) so we use getAdminDb directly.
//     The role gate is the access boundary.
//
// STATUS TRANSITIONS
//   submitted → contacted    sets contactedAt
//   contacted → scan_sent    sets scanSentAt
//   scan_sent → converted    sets convertedAt (caller separately
//                            sets convertedTenantId once the
//                            tenant onboarding completes)
//   submitted | contacted | scan_sent → rejected   sets rejectedAt
//
// We do NOT enforce these transitions in code — David might
// legitimately mark a fresh submission as rejected without
// contacting (spam, out of segment). The DB CHECK constraint
// (migration 0030) restricts status to the 5 allowed values; the
// action just updates the row + records the relevant timestamp.

import { revalidatePath } from 'next/cache';
import { eq, sql } from 'drizzle-orm';
import { getAdminDb, schema } from '@docket/db';
import { assertRole } from '@/lib/require-role';
import { getCurrentDocketUser } from '@/lib/current-user';

const VALID_STATUSES = [
  'submitted',
  'contacted',
  'scan_sent',
  'converted',
  'rejected',
] as const;

type ProspectStatus = (typeof VALID_STATUSES)[number];

function timestampColumnForStatus(
  status: ProspectStatus,
): 'contactedAt' | 'scanSentAt' | 'convertedAt' | 'rejectedAt' | null {
  switch (status) {
    case 'contacted':
      return 'contactedAt';
    case 'scan_sent':
      return 'scanSentAt';
    case 'converted':
      return 'convertedAt';
    case 'rejected':
      return 'rejectedAt';
    case 'submitted':
      // No-op: submittedAt is set at INSERT time + never re-set.
      return null;
  }
}

export interface UpdateStatusResult {
  ok: boolean;
  error?: string;
}

/**
 * Update a prospect's lifecycle status + record the relevant
 * timestamp. Server action invoked from the prospects admin UI.
 *
 * Returns { ok: true } on success or { ok: false, error } when:
 *   - User not signed in
 *   - User not firm_owner (other roles bounce here)
 *   - Invalid status value (shouldn't happen via UI; defensive
 *     against a malicious direct invocation)
 *   - Prospect id not found (returns ok:true with no-op for
 *     idempotency — re-running an action on a missing id is
 *     observable as a no-op via the revalidate)
 */
export async function updateProspectStatus(
  prospectId: string,
  newStatus: ProspectStatus,
): Promise<UpdateStatusResult> {
  const user = await getCurrentDocketUser();
  if (!user) {
    return { ok: false, error: 'Not signed in' };
  }
  try {
    assertRole(user, ['firm_owner']);
  } catch {
    return { ok: false, error: 'Forbidden' };
  }

  if (!VALID_STATUSES.includes(newStatus)) {
    return { ok: false, error: `Invalid status: ${newStatus}` };
  }

  if (!prospectId || prospectId.length === 0) {
    return { ok: false, error: 'Missing prospect id' };
  }

  const db = getAdminDb();
  const timestampCol = timestampColumnForStatus(newStatus);

  // Two-column UPDATE: status + the matching timestamp column.
  // For 'submitted' there's no extra timestamp to set; the
  // submittedAt column is INSERT-time-only.
  if (timestampCol === null) {
    await db
      .update(schema.prospects)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(schema.prospects.id, prospectId));
  } else {
    await db
      .update(schema.prospects)
      .set({
        status: newStatus,
        [timestampCol]: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.prospects.id, prospectId));
  }

  revalidatePath('/prospects');
  return { ok: true };
}
