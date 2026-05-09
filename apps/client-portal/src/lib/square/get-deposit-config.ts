'use server';

// Server action: resolve deposit configuration for the /deposit
// intake page.
//
// Returns the amount + waiver state + Square SDK config the deposit
// form needs to render. Single round-trip; called once at page render.
//
// Resolution:
//   - If engagement.deposit_waived → waived=true, no charge needed
//   - else if engagement.fee_quoted_cents → that's the amount
//   - else firm_profile.default_deposit_cents
//   - else 5000 ($50 legacy default)
//
// The applicationId comes from tenant_credentials.kind=square.
// applicationId is PUBLIC (it ships in the browser bundle to
// initialize the SDK); accessToken is PRIVATE (only the server
// charge-payment-token action sees it). When applicationId is missing
// (legacy creds), the page falls back to a "deposit not yet ready"
// state that tells Antonio to add it via /settings/credentials.

import { eq, desc } from 'drizzle-orm';
import {
  getTenantCredential,
  schema,
  withTenant,
  type SquareCredentials,
} from '@docket/db';
import { asTenantId } from '@docket/shared';
import { getOrCreateClient } from '@/lib/intake/auth';

export type GetDepositConfigResult =
  | {
      ok: true;
      mode: 'charge';
      amountCents: number;
      currency: 'USD';
      taxYear: number;
      engagementId: string | null;
      square: {
        applicationId: string;
        locationId: string;
        environment: 'sandbox' | 'production';
      };
    }
  | {
      ok: true;
      mode: 'waived';
      taxYear: number;
      engagementId: string;
    }
  | {
      ok: true;
      mode: 'unconfigured';
      reason: 'no-cred' | 'no-application-id';
      amountCents: number;
      taxYear: number;
    }
  | {
      ok: false;
      reason: 'unauthenticated' | 'no-engagement';
      message: string;
    };

export async function getDepositConfig(): Promise<GetDepositConfigResult> {
  const ctx = await getOrCreateClient();
  if (!ctx) {
    return { ok: false, reason: 'unauthenticated', message: 'Not signed in' };
  }
  const { tenantId, clientId } = ctx;

  return await withTenant(asTenantId(tenantId), async (db) => {
    // Pull the most recent engagement for this client.
    const [eng] = await db
      .select({
        id: schema.engagements.id,
        feeQuotedCents: schema.engagements.feeQuotedCents,
        depositWaived: schema.engagements.depositWaived,
        taxYear: schema.engagements.taxYear,
      })
      .from(schema.engagements)
      .where(eq(schema.engagements.clientId, clientId))
      .orderBy(desc(schema.engagements.createdAt))
      .limit(1);

    // Fall back to current calendar year if no engagement (early
    // intake, before Antonio created one). Deposit still chargeable
    // — just no engagement-level override.
    const taxYear = eng?.taxYear ?? new Date().getFullYear() - 1;

    if (eng?.depositWaived) {
      return {
        ok: true as const,
        mode: 'waived' as const,
        taxYear,
        engagementId: eng.id,
      };
    }

    // Resolve amount.
    let amountCents: number;
    if (eng?.feeQuotedCents != null) {
      amountCents = eng.feeQuotedCents;
    } else {
      const [fp] = await db
        .select({ defaultDepositCents: schema.firmProfile.defaultDepositCents })
        .from(schema.firmProfile)
        .where(eq(schema.firmProfile.tenantId, tenantId))
        .limit(1);
      amountCents = fp?.defaultDepositCents ?? 5000;
    }

    // Pull Square cred.
    const creds = (await getTenantCredential(
      db,
      asTenantId(tenantId),
      'square',
    )) as SquareCredentials | null;

    if (!creds) {
      return {
        ok: true as const,
        mode: 'unconfigured' as const,
        reason: 'no-cred' as const,
        amountCents,
        taxYear,
      };
    }
    if (!creds.applicationId) {
      return {
        ok: true as const,
        mode: 'unconfigured' as const,
        reason: 'no-application-id' as const,
        amountCents,
        taxYear,
      };
    }

    return {
      ok: true as const,
      mode: 'charge' as const,
      amountCents,
      currency: 'USD',
      taxYear,
      engagementId: eng?.id ?? null,
      square: {
        applicationId: creds.applicationId,
        locationId: creds.locationId,
        environment: creds.environment,
      },
    };
  });
}
