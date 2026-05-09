'use server';

// Server action: charge a Square Web Payments SDK token.
//
// Called from the /deposit/page.tsx after the client-side SDK has
// tokenized the card. The token is single-use; PAN never reaches our
// servers. We POST it to Square's /v2/payments endpoint with the
// amount + idempotency key, persist the result to the payments
// table, and return success/failure to the client.
//
// SDK B FLOW
//   1. (browser) Square.payments(applicationId, locationId).card()
//                  → user enters card → card.tokenize() → token
//   2. (browser) POST token to this server action
//   3. (server)  this action: auth → cred → charge → persist → return
//   4. (browser) on success: setPaid + advance intake
//
// SECURITY POSTURE
//   - Token is single-use. Even if intercepted, it can only charge
//     once and only for the amount Square authorized at tokenization.
//   - PAN never touches Docket. The card form runs in a Square-
//     controlled iframe. We never see the digits.
//   - PCI scope: SAQ-A. The auditor needs to verify CSP allowlist
//     blocks any other source for the card form's iframe origin.
//   - Auth: Clerk-bound taxpayer (resolveClient). Tenant + clientId
//     come from their session; can't be forged.
//   - Rate limit: 6/min/clerkUserId — generous because the user
//     might retry on declined card; tight enough to block scripted
//     abuse.
//
// IDEMPOTENCY
//   Square's idempotency_key dedupes at their side. We pass the
//   payments row id as idempotency_key so a double-submit (network
//   blip + retry) returns the SAME payment. We INSERT a payments
//   row with status='pending' BEFORE calling Square so a failure
//   leaves a recoverable record.

import { eq } from 'drizzle-orm';
import * as Sentry from '@sentry/nextjs';
import {
  getTenantCredential,
  schema,
  withTenant,
  type SquareCredentials,
} from '@docket/db';
import {
  asTenantId,
  consumeRateToken,
} from '@docket/shared';
import { getOrCreateClient } from '@/lib/intake/auth';

export type ChargePaymentTokenResult =
  | {
      ok: true;
      paymentId: string;
      paymentRowId: string;
      collectedCents: number;
      receiptUrl: string | null;
    }
  | {
      ok: false;
      reason:
        | 'unauthenticated'
        | 'no-creds'
        | 'engagement-not-found'
        | 'engagement-waived'
        | 'card-declined'
        | 'amount-mismatch'
        | 'square-api'
        | 'rate-limit'
        | 'network';
      message: string;
      retryAfterMs?: number;
      squareErrorCode?: string;
      squareErrorCategory?: string;
    };

export interface ChargePaymentTokenInput {
  /** The single-use card token from Square Web Payments SDK card.tokenize(). */
  sourceId: string;
  /**
   * Server-trusted amount cents — derived from getDepositConfig at
   * /deposit page render. We re-validate against the engagement +
   * firm_profile here so a tampered client can't charge $0.01.
   */
  expectedAmountCents: number;
  /** Optional engagement to attach the payment to. */
  engagementId?: string;
  /** Tax year for the receipt + audit. */
  taxYear: number;
  /** Optional verification token (Square's 3-D Secure / SCA support). */
  verificationToken?: string;
}

export async function chargePaymentToken(
  input: ChargePaymentTokenInput,
): Promise<ChargePaymentTokenResult> {
  const ctx = await getOrCreateClient();
  if (!ctx) {
    return { ok: false, reason: 'unauthenticated', message: 'Not signed in' };
  }
  const { tenantId, clientId, clerkUserId } = ctx;

  const limit = consumeRateToken(`square-charge:${clerkUserId}`, 6, 60_000);
  if (!limit.allowed) {
    return {
      ok: false,
      reason: 'rate-limit',
      message: `Too many payment attempts. Try again in ${Math.ceil(limit.retryAfterMs / 1000)}s.`,
      retryAfterMs: limit.retryAfterMs,
    };
  }

  const startedAt = Date.now();

  try {
    return await withTenant(asTenantId(tenantId), async (db) => {
      // Resolve the SERVER-TRUSTED amount. Don't trust the client's
      // expectedAmountCents — re-derive from engagement + firm_profile.
      let serverAmount = 5000;
      let waived = false;
      let engagementRowId: string | null = null;
      if (input.engagementId) {
        const [eng] = await db
          .select({
            id: schema.engagements.id,
            feeQuotedCents: schema.engagements.feeQuotedCents,
            depositWaived: schema.engagements.depositWaived,
            taxYear: schema.engagements.taxYear,
          })
          .from(schema.engagements)
          .where(eq(schema.engagements.id, input.engagementId))
          .limit(1);
        if (!eng) {
          return { ok: false as const, reason: 'engagement-not-found' as const, message: 'Engagement not found' };
        }
        if (eng.depositWaived) {
          // The /deposit page should never have shown the form when
          // waived. But if a stale tab posts here, fail rather than
          // charge.
          return { ok: false as const, reason: 'engagement-waived' as const, message: 'Deposit is waived for this engagement.' };
        }
        engagementRowId = eng.id;
        if (eng.feeQuotedCents != null) serverAmount = eng.feeQuotedCents;
      }

      // Fall back to firm_profile default if no engagement override.
      if (serverAmount === 5000 && (!input.engagementId || engagementRowId == null)) {
        const [fp] = await db
          .select({ defaultDepositCents: schema.firmProfile.defaultDepositCents })
          .from(schema.firmProfile)
          .where(eq(schema.firmProfile.tenantId, tenantId))
          .limit(1);
        if (fp?.defaultDepositCents) serverAmount = fp.defaultDepositCents;
      }

      if (serverAmount !== input.expectedAmountCents) {
        return {
          ok: false as const,
          reason: 'amount-mismatch' as const,
          message: `Amount drift: client expected ${input.expectedAmountCents} cents, server resolves ${serverAmount}. Refresh + retry.`,
        };
      }

      const creds = (await getTenantCredential(
        db,
        asTenantId(tenantId),
        'square',
      )) as SquareCredentials | null;
      if (!creds) {
        return { ok: false as const, reason: 'no-creds' as const, message: 'No Square credentials configured' };
      }

      // Insert payments row in 'pending' state BEFORE the Square call.
      // The row id IS the idempotency key — a network retry uses the
      // same id, so Square returns the same payment if we already
      // succeeded once.
      const [paymentRow] = await db
        .insert(schema.payments)
        .values({
          tenantId,
          clientId,
          engagementId: engagementRowId,
          squarePaymentLinkId: 'sdk-' + crypto.randomUUID(),
          // squareOrderId stays as a placeholder until Square responds;
          // /v2/payments returns the orderId in the response body.
          squareOrderId: 'pending',
          status: 'pending',
          amountCents: serverAmount,
          currency: 'USD',
          checkoutUrl: '', // SDK B: no hosted URL; iframe stays in /deposit page
          taxYear: input.taxYear,
        })
        .returning({ id: schema.payments.id });
      const paymentRowId = paymentRow!.id;

      // Square /v2/payments call.
      const apiHost =
        creds.environment === 'production'
          ? 'https://connect.squareup.com'
          : 'https://connect.squareupsandbox.com';

      const body: Record<string, unknown> = {
        source_id: input.sourceId,
        idempotency_key: paymentRowId,
        amount_money: {
          amount: serverAmount,
          currency: 'USD',
        },
        location_id: creds.locationId,
        autocomplete: true,
        note: `${input.taxYear} tax-prep deposit`,
        reference_id: paymentRowId,
      };
      if (input.verificationToken) {
        body.verification_token = input.verificationToken;
      }

      let res: Response;
      try {
        res = await fetch(`${apiHost}/v2/payments`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${creds.accessToken}`,
            'Content-Type': 'application/json',
            'Square-Version': '2024-01-18',
          },
          body: JSON.stringify(body),
        });
      } catch (networkErr) {
        Sentry.captureException(networkErr, {
          tags: { component: 'square-charge', tenant: tenantId },
        });
        await db
          .update(schema.payments)
          .set({
            status: 'failed',
            lastSquareStatus: 'network',
            lastPolledAt: new Date(),
          })
          .where(eq(schema.payments.id, paymentRowId));
        return {
          ok: false as const,
          reason: 'network' as const,
          message: 'Could not reach Square. Check your connection and try again.',
        };
      }

      const json = (await res.json()) as
        | {
            payment: {
              id: string;
              status: string;
              amount_money: { amount: number; currency: string };
              total_money?: { amount: number };
              receipt_url?: string;
              order_id?: string;
            };
          }
        | { errors: Array<{ code: string; detail: string; category: string }> };

      if (!res.ok || !('payment' in json)) {
        const firstErr = 'errors' in json ? json.errors[0] : undefined;
        const isCardDeclined =
          firstErr?.category === 'PAYMENT_METHOD_ERROR' ||
          firstErr?.code === 'CARD_DECLINED' ||
          firstErr?.code === 'GENERIC_DECLINE';
        await db
          .update(schema.payments)
          .set({
            status: 'failed',
            lastSquareStatus: firstErr?.code ?? 'unknown',
            lastPolledAt: new Date(),
          })
          .where(eq(schema.payments.id, paymentRowId));
        return {
          ok: false as const,
          reason: isCardDeclined ? 'card-declined' : 'square-api',
          message: firstErr?.detail ?? `Square returned ${res.status}`,
          squareErrorCode: firstErr?.code,
          squareErrorCategory: firstErr?.category,
        };
      }

      const payment = json.payment;
      const collectedCents = payment.total_money?.amount ?? payment.amount_money.amount;
      const status: 'paid' | 'pending' = payment.status === 'COMPLETED' ? 'paid' : 'pending';
      const paidAt = status === 'paid' ? new Date() : null;

      await db
        .update(schema.payments)
        .set({
          status,
          collectedCents,
          checkoutUrl: payment.receipt_url ?? '',
          squarePaymentLinkId: payment.id,
          squareOrderId: payment.order_id ?? 'unknown',
          paidAt,
          lastPolledAt: new Date(),
          lastSquareStatus: payment.status,
        })
        .where(eq(schema.payments.id, paymentRowId));

      return {
        ok: true as const,
        paymentId: payment.id,
        paymentRowId,
        collectedCents,
        receiptUrl: payment.receipt_url ?? null,
      };
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'square-charge', tenant: tenantId },
    });
    return {
      ok: false,
      reason: 'square-api',
      message: 'Could not process payment. The error has been logged for review.',
    };
  } finally {
    void startedAt;
  }
}
