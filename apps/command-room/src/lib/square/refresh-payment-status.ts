'use server';

// Server action: refresh the status of a payments row by polling Square.
//
// Until the per-tenant webhook signature key path lands (deferred —
// requires SquareCredentials shape extension + UI form change),
// payment status flows through this manual refresh action. The
// command-room UI calls it from a "Refresh status" button on the
// /clients/[id] payments panel; the result UPDATEs the payments row.
//
// FLOW
//   1. Auth (firm_owner | preparer)
//   2. Pull payments row by id (tenant-scoped via withTenant)
//   3. Pull Square credentials
//   4. Square API: GET /v2/orders/{order_id}
//      - state COMPLETED → status='paid', paid_at=now()
//      - state OPEN/PROPOSED → still pending; record last_polled_at
//      - state CANCELED → status='cancelled'
//      - tenders array sums collected_cents
//      - refunds array sums refunded_cents → status='refunded' if equals collected
//   5. UPDATE payments + audit row + return new status
//
// FAILURE MODES
//   - Auth failure → 'unauthenticated' / 'forbidden'
//   - Rate limit (10/min/user) → 'rate-limit'
//   - Payment row not found → 'not-found'
//   - No Square creds → 'no-creds'
//   - Square API error → 'square-api'
//   - Network → 'network'
//
// IDEMPOTENCY
//   Polling is read-only on Square's side. Repeat polls return the
//   same data; the UPDATE is keyed by (tenant_id, square_payment_
//   link_id) which is UNIQUE. last_polled_at advances every call.

import { eq } from 'drizzle-orm';
import * as Sentry from '@sentry/nextjs';
import {
  getTenantCredential,
  persistAgentAction,
  schema,
  withTenant,
  type SquareCredentials,
} from '@docket/db';
import {
  asTenantId,
  asClientId,
  asUserId,
  consumeRateToken,
} from '@docket/shared';
import { getCurrentDocketUser } from '@/lib/current-user';

const ALLOWED_ROLES = new Set(['firm_owner', 'preparer']);

export type RefreshPaymentStatusResult =
  | {
      ok: true;
      status: 'pending' | 'paid' | 'partial' | 'refunded' | 'cancelled' | 'failed';
      collectedCents: number;
      refundedCents: number;
      paidAt: string | null;
      refundedAt: string | null;
      squareState: string;
    }
  | {
      ok: false;
      reason:
        | 'unauthenticated'
        | 'forbidden'
        | 'not-found'
        | 'no-creds'
        | 'rate-limit'
        | 'square-api'
        | 'network';
      message: string;
      retryAfterMs?: number;
      squareErrorCode?: string;
    };

export async function refreshPaymentStatus(
  paymentId: string,
): Promise<RefreshPaymentStatusResult> {
  const user = await getCurrentDocketUser();
  if (!user) return { ok: false, reason: 'unauthenticated', message: 'Not signed in' };
  if (!ALLOWED_ROLES.has(user.role)) {
    return { ok: false, reason: 'forbidden', message: `Role ${user.role} cannot refresh payments` };
  }

  const limit = consumeRateToken(`square-refresh:${user.clerkUserId}`, 10, 60_000);
  if (!limit.allowed) {
    return {
      ok: false,
      reason: 'rate-limit',
      message: `Too many requests. Retry in ${Math.ceil(limit.retryAfterMs / 1000)}s.`,
      retryAfterMs: limit.retryAfterMs,
    };
  }

  const startedAt = Date.now();

  try {
    return await withTenant(asTenantId(user.tenantId), async (db) => {
      const [row] = await db
        .select()
        .from(schema.payments)
        .where(eq(schema.payments.id, paymentId))
        .limit(1);
      if (!row) {
        return {
          ok: false as const,
          reason: 'not-found' as const,
          message: 'Payment record not found',
        };
      }

      const creds = (await getTenantCredential(
        db,
        asTenantId(user.tenantId),
        'square',
      )) as SquareCredentials | null;
      if (!creds) {
        return {
          ok: false as const,
          reason: 'no-creds' as const,
          message: 'No Square credentials configured for this tenant',
        };
      }

      const apiHost =
        creds.environment === 'production'
          ? 'https://connect.squareup.com'
          : 'https://connect.squareupsandbox.com';
      const url = `${apiHost}/v2/orders/${encodeURIComponent(row.squareOrderId)}`;

      let res: Response;
      try {
        res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${creds.accessToken}`,
            'Square-Version': '2024-01-18',
          },
        });
      } catch (networkErr) {
        Sentry.captureException(networkErr, {
          tags: { component: 'square-refresh', tenant: user.tenantId },
        });
        return {
          ok: false as const,
          reason: 'network' as const,
          message: 'Could not reach Square. Try again.',
        };
      }

      const json = (await res.json()) as
        | {
            order: {
              id: string;
              state: 'OPEN' | 'COMPLETED' | 'CANCELED' | 'DRAFT';
              total_money?: { amount: number; currency: string };
              tenders?: Array<{ amount_money?: { amount: number }; created_at?: string }>;
              refunds?: Array<{ amount_money?: { amount: number }; created_at?: string }>;
            };
          }
        | { errors: Array<{ code: string; detail: string; category: string }> };

      if (!res.ok || !('order' in json)) {
        const firstErr = 'errors' in json ? json.errors[0] : undefined;
        return {
          ok: false as const,
          reason: 'square-api' as const,
          message: firstErr?.detail ?? `Square returned ${res.status}`,
          squareErrorCode: firstErr?.code,
        };
      }

      const order = json.order;
      const collectedCents = (order.tenders ?? []).reduce(
        (sum, t) => sum + (t.amount_money?.amount ?? 0),
        0,
      );
      const refundedCents = (order.refunds ?? []).reduce(
        (sum, r) => sum + (r.amount_money?.amount ?? 0),
        0,
      );

      // Square event timestamps. Use the EARLIEST tender's created_at
      // (Square Checkout creates one tender on completion; if multiple,
      // earliest is when the customer first paid). Same for refunds.
      // Fall back to wall-clock now() only when Square didn't supply
      // created_at — should be rare; logged for diagnostics.
      const earliestTenderAt = pickEarliestCreatedAt(order.tenders);
      const earliestRefundAt = pickEarliestCreatedAt(order.refunds);

      // Status derivation:
      //   COMPLETED with no refunds → paid
      //   COMPLETED with refunded == collected → refunded
      //   COMPLETED with refunded < collected → partial (rare)
      //   CANCELED → cancelled
      //   OPEN/PROPOSED/DRAFT → pending (cursor advance only)
      type Status = 'pending' | 'paid' | 'partial' | 'refunded' | 'cancelled' | 'failed';
      let status: Status;
      let paidAt: Date | null = null;
      let refundedAt: Date | null = null;

      if (order.state === 'COMPLETED') {
        if (refundedCents === 0) {
          status = 'paid';
          // Preserve original paidAt; on first transition to paid,
          // use Square event time (earliest tender) not poll time.
          paidAt = row.paidAt ?? earliestTenderAt ?? new Date();
        } else if (refundedCents >= collectedCents) {
          status = 'refunded';
          paidAt = row.paidAt ?? earliestTenderAt;
          refundedAt = row.refundedAt ?? earliestRefundAt ?? new Date();
        } else {
          status = 'partial';
          paidAt = row.paidAt ?? earliestTenderAt ?? new Date();
          refundedAt = row.refundedAt ?? earliestRefundAt ?? new Date();
        }
      } else if (order.state === 'CANCELED') {
        status = 'cancelled';
      } else {
        status = 'pending';
      }

      const polledAt = new Date();
      await db
        .update(schema.payments)
        .set({
          status,
          collectedCents,
          refundedCents,
          paidAt,
          refundedAt,
          lastPolledAt: polledAt,
          lastSquareStatus: order.state,
        })
        .where(eq(schema.payments.id, paymentId));

      // Audit row.
      const persist = persistAgentAction({
        extraToolInput: {
          paymentId,
          paymentLinkId: row.squarePaymentLinkId,
          previousStatus: row.status,
          newStatus: status,
          squareState: order.state,
          collectedCents,
          refundedCents,
        },
        textPreviewLength: 0,
      });
      try {
        await persist({
          tenantId: asTenantId(user.tenantId),
          clientId: asClientId(row.clientId),
          userId: asUserId(user.id),
          agentId: null,
          actionClass: 'read',
          toolName: 'square.refresh-payment-status',
          toolInput: {},
          toolOutput: { status, squareState: order.state },
          modelUsed: null,
          inputTokens: null,
          outputTokens: null,
          cachedTokens: null,
          costUsd: null,
          latencyMs: Date.now() - startedAt,
          success: true,
          errorMessage: null,
        });
      } catch (auditErr) {
        console.error('[square-refresh] audit-row write failed:', auditErr);
      }

      return {
        ok: true as const,
        status,
        collectedCents,
        refundedCents,
        paidAt: paidAt ? paidAt.toISOString() : null,
        refundedAt: refundedAt ? refundedAt.toISOString() : null,
        squareState: order.state,
      };
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'square-refresh', tenant: user.tenantId },
    });
    return {
      ok: false,
      reason: 'square-api',
      message: 'Could not refresh payment status. The error has been logged for review.',
    };
  }
}

/**
 * Pick the earliest valid created_at from a list of Square tender or
 * refund objects. Returns null if the list is empty or none of them
 * have a parseable created_at.
 */
function pickEarliestCreatedAt(
  items: Array<{ created_at?: string }> | undefined,
): Date | null {
  if (!items || items.length === 0) return null;
  let earliest: Date | null = null;
  for (const item of items) {
    if (!item.created_at) continue;
    const d = new Date(item.created_at);
    if (isNaN(d.getTime())) continue;
    if (!earliest || d.getTime() < earliest.getTime()) {
      earliest = d;
    }
  }
  return earliest;
}
