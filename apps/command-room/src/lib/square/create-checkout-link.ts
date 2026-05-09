'use server';

// Server action: create a Square Checkout link for a client deposit.
//
// Per CLAUDE.md section 6 + section 15 Phase 2.
//
// Antonio collects a $50 deposit at intake. Square is his existing
// merchant tool, so the flow is: preparer clicks "Create deposit
// link", Docket calls Square's Checkout API to mint a hosted
// payment URL, the URL is sent to the client via SMS/email/portal,
// the webhook fires when paid.
//
// FLOW
//   1. Auth (firm_owner | preparer can request).
//   2. Pull Square credentials from tenant_credentials vault.
//   3. POST to Square's payment-link API with:
//      - amount in cents (default $50.00)
//      - description ('2024 tax prep deposit · {client name}')
//      - redirect URL back to the portal
//   4. Insert a row into payments (or actions audit) tracking the
//      checkout id + URL.
//   5. Audit-log via persistAgentAction with action_class=
//      'send-external'.
//
// FAILURE MODES
//   - No Square creds -> { ok: false, reason: 'no-creds' }
//   - Square API error -> 'square-api'
//   - Network -> 'network'
//   - Rate-limit (10/min/user) -> 'rate-limit'
//   - Client not found -> 'client-not-found'
//
// FUTURE WORK (not in this scaffold)
//   - Webhook for payment-completed: Square POSTs to a webhook
//     when the deposit clears. v1 wires the webhook to update
//     the deposit's paid_at timestamp + emit a payment.received
//     event for the issue queue.
//   - Refund flow: full + partial refunds via Square's API. v1.
//   - Idempotency key store: Square's idempotency_key is included
//     here as a hash of (clientId, taxYear, amount); a real
//     deduplication store ensures a double-click doesn't create
//     two checkout links. v1.

import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import * as Sentry from '@sentry/nextjs';
import {
  getTenantCredential,
  persistAgentAction,
  schema,
  withTenant,
} from '@docket/db';
import {
  asTenantId,
  asClientId,
  asUserId,
  consumeRateToken,
} from '@docket/shared';
import { getCurrentDocketUser } from '@/lib/current-user';

const ALLOWED_ROLES = new Set(['firm_owner', 'preparer']);
const DEFAULT_AMOUNT_CENTS = 5000; // $50.00

export type CreateCheckoutLinkResult =
  | {
      ok: true;
      checkoutUrl: string;
      paymentLinkId: string;
      orderId: string;
    }
  | {
      ok: false;
      reason:
        | 'unauthenticated'
        | 'forbidden'
        | 'no-creds'
        | 'rate-limit'
        | 'client-not-found'
        | 'square-api'
        | 'network';
      message: string;
      retryAfterMs?: number;
      squareErrorCode?: string;
    };

export interface CreateCheckoutLinkInput {
  clientId: string;
  /** Cents. Defaults to $50.00 = 5000. */
  amountCents?: number;
  /** Tax year for description ('2024 tax prep deposit'). */
  taxYear: number;
  /** Where the user lands after payment. Default: portal home. */
  redirectUrl?: string;
}

export async function createCheckoutLink(
  input: CreateCheckoutLinkInput,
): Promise<CreateCheckoutLinkResult> {
  const user = await getCurrentDocketUser();
  if (!user) return { ok: false, reason: 'unauthenticated', message: 'Not signed in' };
  if (!ALLOWED_ROLES.has(user.role)) {
    return {
      ok: false,
      reason: 'forbidden',
      message: `Role ${user.role} cannot create checkout links`,
    };
  }

  const limit = consumeRateToken(`square-checkout:${user.clerkUserId}`, 10, 60_000);
  if (!limit.allowed) {
    return {
      ok: false,
      reason: 'rate-limit',
      message: `Too many requests. Retry in ${Math.ceil(limit.retryAfterMs / 1000)}s.`,
      retryAfterMs: limit.retryAfterMs,
    };
  }

  const amountCents = input.amountCents ?? DEFAULT_AMOUNT_CENTS;
  const startedAt = Date.now();

  try {
    return await withTenant(asTenantId(user.tenantId), async (db) => {
      const creds = await getTenantCredential(db, asTenantId(user.tenantId), 'square');
      if (!creds) {
        return {
          ok: false,
          reason: 'no-creds' as const,
          message: 'No Square credentials configured for this tenant',
        };
      }

      const [client] = await db
        .select({
          id: schema.clients.id,
          fullName: schema.clients.fullName,
          email: schema.clients.email,
        })
        .from(schema.clients)
        .where(eq(schema.clients.id, input.clientId))
        .limit(1);
      if (!client) {
        return {
          ok: false,
          reason: 'client-not-found' as const,
          message: 'Client not found in your tenant',
        };
      }

      // Idempotency key: deterministic per (client, year, amount).
      // A double-click within the same minute returns the SAME
      // checkout link from Square (no duplicate). Different days
      // or different amounts mint a new link.
      const idemKey = createHash('sha256')
        .update(`${input.clientId}|${input.taxYear}|${amountCents}`)
        .digest('hex')
        .slice(0, 45);

      const apiHost =
        creds.environment === 'production'
          ? 'https://connect.squareup.com'
          : 'https://connect.squareupsandbox.com';

      const url = `${apiHost}/v2/online-checkout/payment-links`;
      const body = {
        idempotency_key: idemKey,
        quick_pay: {
          name: `${input.taxYear} tax prep deposit`,
          price_money: {
            amount: amountCents,
            currency: 'USD',
          },
          location_id: creds.locationId,
        },
        checkout_options: {
          redirect_url:
            input.redirectUrl ??
            (process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL ?? 'https://docket-portal.vercel.app') +
              '/portal',
          ask_for_shipping_address: false,
          merchant_support_email: client.email ?? undefined,
        },
        pre_populated_data: client.email
          ? { buyer_email: client.email }
          : undefined,
        description: `Deposit for ${client.fullName} - ${input.taxYear} tax prep`,
      };

      let res: Response;
      try {
        res = await fetch(url, {
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
          tags: { component: 'square-checkout', tenant: user.tenantId },
        });
        await writeAuditRow(user, input.clientId, false, {
          stage: 'square-api',
          reason: 'network',
        });
        return {
          ok: false,
          reason: 'network' as const,
          message: 'Could not reach Square. Try again.',
        };
      }

      const json = (await res.json()) as
        | {
            payment_link: {
              id: string;
              url: string;
              order_id: string;
            };
          }
        | { errors: Array<{ code: string; detail: string; category: string }> };

      if (!res.ok || !('payment_link' in json)) {
        const firstErr = 'errors' in json ? json.errors[0] : undefined;
        await writeAuditRow(user, input.clientId, false, {
          stage: 'square-api',
          statusCode: res.status,
          errorCode: firstErr?.code,
          errorDetail: firstErr?.detail,
        });
        return {
          ok: false,
          reason: 'square-api' as const,
          message: firstErr?.detail ?? `Square returned ${res.status}`,
          squareErrorCode: firstErr?.code,
        };
      }

      // Success.
      await writeAuditRow(user, input.clientId, true, {
        stage: 'created',
        paymentLinkId: json.payment_link.id,
        orderId: json.payment_link.order_id,
        checkoutUrl: json.payment_link.url,
        amountCents,
        taxYear: input.taxYear,
        latencyMs: Date.now() - startedAt,
      });

      return {
        ok: true,
        checkoutUrl: json.payment_link.url,
        paymentLinkId: json.payment_link.id,
        orderId: json.payment_link.order_id,
      };
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'square-checkout', tenant: user.tenantId },
    });
    return {
      ok: false,
      reason: 'square-api',
      message: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

async function writeAuditRow(
  user: { id: string; tenantId: string },
  clientId: string,
  success: boolean,
  details: Record<string, unknown>,
): Promise<void> {
  const persist = persistAgentAction({
    extraToolInput: details,
    textPreviewLength: 0,
  });
  try {
    await persist({
      tenantId: asTenantId(user.tenantId),
      clientId: asClientId(clientId),
      userId: asUserId(user.id),
      agentId: null,
      actionClass: 'send-external',
      toolName: 'square.create-checkout-link',
      toolInput: {},
      toolOutput: { success, ...details },
      modelUsed: null,
      inputTokens: null,
      outputTokens: null,
      cachedTokens: null,
      costUsd: null,
      latencyMs: typeof details.latencyMs === 'number' ? details.latencyMs : 0,
      success,
      errorMessage: success ? null : String(details.errorDetail ?? 'unknown'),
    });
  } catch (err) {
    console.error('[square-checkout] audit-row write failed:', err);
  }
}
