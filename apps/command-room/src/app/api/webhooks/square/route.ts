// /api/webhooks/square — Square webhook receiver.
//
// Square POSTs payment + checkout lifecycle events here. We act on:
//   - payment.created            → confirms a charge landed
//   - payment.updated            → status transitions (PENDING → COMPLETED, etc)
//   - refund.created             → refund initiated
//   - refund.updated             → refund finalized
//   - online_checkout.location_settings.updated → ignore (config event)
//   - oauth.authorization.revoked → tenant revoked our access (CRITICAL —
//                                   should disable the cred + alert)
//
// SECURITY
//   1. HMAC verification via @docket/shared/webhooks. Square's
//      verifier hashes (notificationUrl + rawBody) — the URL must
//      match Square's dashboard config character-for-character.
//   2. Public endpoint, allowlisted in middleware.
//   3. Tenant resolution: Square's payload includes location_id
//      which we match to tenant_credentials.kind='square' rows.
//      The HMAC IS the auth — without it, anyone could spoof events.
//
// PAIRED WITH POLLING
//   apps/command-room/src/lib/square/refresh-payment-status.ts is
//   the manual fallback. With both wired, status flips are usually
//   webhook-driven (sub-second), with polling available if Square's
//   webhook is delayed/disabled.

import { type NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import {
  getAdminDb,
  schema,
  type DocketDb,
} from '@docket/db';
import { verifySquareSignature } from '@docket/shared/webhooks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SquareWebhookPayload {
  type?: string;
  merchant_id?: string;
  location_id?: string;
  event_id?: string;
  created_at?: string;
  data?: {
    type?: string;
    id?: string;
    object?: {
      payment?: SquarePayment;
      refund?: SquareRefund;
    };
  };
}

interface SquarePayment {
  id?: string;
  status?: 'APPROVED' | 'PENDING' | 'COMPLETED' | 'CANCELED' | 'FAILED';
  order_id?: string;
  reference_id?: string;
  total_money?: { amount: number; currency: string };
  receipt_url?: string;
  location_id?: string;
}

interface SquareRefund {
  id?: string;
  payment_id?: string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'FAILED';
  amount_money?: { amount: number; currency: string };
  reason?: string;
}

export async function POST(req: NextRequest) {
  // 1. Read raw body BEFORE parsing — verifier needs bytes.
  const rawBody = await req.text();

  // 2. Verify HMAC. Square signs (notificationUrl + body); the URL
  // must EXACTLY match what's configured in the Square dashboard.
  const signatureHeader = req.headers.get('x-square-hmacsha256-signature') ?? '';
  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  // Notification URL: Square sends this in their request signing
  // basis. We construct from the live request — must match what
  // Square dashboard has configured. If Vercel rewrites the URL
  // (https→http upstream / trailing slash) the verification fails.
  // Set SQUARE_WEBHOOK_NOTIFICATION_URL env var as override if so.
  const notificationUrl =
    process.env.SQUARE_WEBHOOK_NOTIFICATION_URL ??
    'https://docket-command-room.vercel.app/api/webhooks/square';

  if (!signatureKey) {
    // Misconfiguration — fail closed. Without the secret we can't
    // verify ANY incoming event is legitimate.
    console.error('[square-webhook] SQUARE_WEBHOOK_SIGNATURE_KEY env not set; dropping event');
    return new Response('webhook misconfigured', { status: 500 });
  }

  const verified = verifySquareSignature({
    notificationUrl,
    rawBody,
    signatureHeader,
    signatureKey,
  });
  if (!verified) {
    console.warn('[square-webhook] HMAC verification failed; dropping event');
    return new Response('unauthorized', { status: 401 });
  }

  let payload: SquareWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('malformed body', { status: 400 });
  }

  const eventType = payload.type;
  const adminDb = getAdminDb();

  try {
    switch (eventType) {
      case 'payment.created':
      case 'payment.updated': {
        const payment = payload.data?.object?.payment;
        if (!payment) {
          return new Response('ok', { status: 200 });
        }
        await handlePaymentEvent(adminDb, payment);
        return new Response('ok', { status: 200 });
      }
      case 'refund.created':
      case 'refund.updated': {
        const refund = payload.data?.object?.refund;
        if (!refund) {
          return new Response('ok', { status: 200 });
        }
        await handleRefundEvent(adminDb, refund);
        return new Response('ok', { status: 200 });
      }
      case 'oauth.authorization.revoked':
        // Tenant revoked Docket's access at Square. CRITICAL —
        // log + alert. v0 just logs; v1.5 disables the cred row +
        // surfaces a banner in /settings/credentials.
        console.warn(
          `[square-webhook] OAuth revoked: merchant=${payload.merchant_id} location=${payload.location_id}`,
        );
        return new Response('ok', { status: 200 });
      default:
        // Unknown event types — log + drop (Square sends config /
        // location-settings events we don't act on).
        console.log(`[square-webhook] unhandled event type: ${eventType}`);
        return new Response('ok', { status: 200 });
    }
  } catch (err) {
    console.error('[square-webhook] handler failed:', err instanceof Error ? err.message : 'unknown');
    return new Response('internal error', { status: 500 });
  }
}

async function handlePaymentEvent(db: DocketDb, payment: SquarePayment): Promise<void> {
  // Match by reference_id (we set this to payments.id when creating
  // the charge) OR by squareOrderId fallback.
  const refId = payment.reference_id;
  if (!refId) {
    console.log(`[square-webhook] payment ${payment.id} has no reference_id; can't link to row`);
    return;
  }

  const [row] = await db
    .select({
      id: schema.payments.id,
      tenantId: schema.payments.tenantId,
      status: schema.payments.status,
      collectedCents: schema.payments.collectedCents,
    })
    .from(schema.payments)
    .where(eq(schema.payments.id, refId))
    .limit(1);

  if (!row) {
    console.log(`[square-webhook] payments row ${refId} not found; dropping`);
    return;
  }

  // Map Square payment.status → payments.status.
  const newStatus = mapPaymentStatus(payment.status);
  const collectedCents = payment.total_money?.amount ?? row.collectedCents;
  const paidAt = newStatus === 'paid' ? new Date() : null;

  await db
    .update(schema.payments)
    .set({
      status: newStatus,
      collectedCents,
      checkoutUrl: payment.receipt_url ?? '',
      squarePaymentLinkId: payment.id ?? row.id,
      squareOrderId: payment.order_id ?? 'unknown',
      paidAt,
      lastPolledAt: new Date(),
      lastSquareStatus: payment.status ?? 'unknown',
    })
    .where(
      and(
        eq(schema.payments.id, row.id),
        eq(schema.payments.tenantId, row.tenantId),
      ),
    );

  console.log(
    `[square-webhook] payments ${row.id} → ${newStatus} (square=${payment.status}, collected=${collectedCents})`,
  );
}

async function handleRefundEvent(db: DocketDb, refund: SquareRefund): Promise<void> {
  if (!refund.payment_id) return;

  // Find the payments row by the Square payment id (squarePaymentLinkId).
  const [row] = await db
    .select({
      id: schema.payments.id,
      tenantId: schema.payments.tenantId,
      collectedCents: schema.payments.collectedCents,
      refundedCents: schema.payments.refundedCents,
    })
    .from(schema.payments)
    .where(eq(schema.payments.squarePaymentLinkId, refund.payment_id))
    .limit(1);

  if (!row) {
    console.log(`[square-webhook] refund target payment ${refund.payment_id} not found; dropping`);
    return;
  }

  const refundedAmount = refund.amount_money?.amount ?? 0;
  const newRefundedCents = row.refundedCents + refundedAmount;
  // Refund finalized → status='refunded' if full, 'partial' if partial.
  const isFull = newRefundedCents >= row.collectedCents;
  const newStatus = refund.status === 'COMPLETED'
    ? (isFull ? 'refunded' : 'partial')
    : undefined;

  if (newStatus) {
    await db
      .update(schema.payments)
      .set({
        status: newStatus,
        refundedCents: newRefundedCents,
        refundedAt: new Date(),
      })
      .where(
        and(
          eq(schema.payments.id, row.id),
          eq(schema.payments.tenantId, row.tenantId),
        ),
      );

    console.log(
      `[square-webhook] payments ${row.id} → ${newStatus} (refunded=${newRefundedCents} / ${row.collectedCents})`,
    );
  }
}

function mapPaymentStatus(squareStatus: string | undefined): 'paid' | 'pending' | 'failed' | 'cancelled' {
  switch (squareStatus) {
    case 'COMPLETED':
      return 'paid';
    case 'APPROVED':
    case 'PENDING':
      return 'pending';
    case 'CANCELED':
      return 'cancelled';
    case 'FAILED':
      return 'failed';
    default:
      return 'pending';
  }
}
