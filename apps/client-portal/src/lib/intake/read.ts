'use server';

// Load (or create on first visit) the active intake row for the signed-in
// client. Sensitive fields are decrypted with the tenant DEK and then
// MASKED before returning to the client (see maskSensitiveFields). The
// client never receives plaintext SSN/EIN/bank by default — to see
// plaintext, the client must explicitly call revealIntakeField().
//
// Wrapped in React.cache(): memoizes the result for the duration of a
// single server render pass. The (intake) and /portal layouts both call
// this once each on every page load; React.cache guards against
// duplicate fetches if a child Server Component also needs the bundle.
//
// Race-safe creation: INSERT ... ON CONFLICT DO NOTHING with the unique
// index on (tenant_id, client_id, tax_year). Two concurrent first-visit
// calls (e.g., double-clicked CTA) both attempt insert; only the first
// succeeds. Both end up calling the SELECT fallback to load the
// canonical row.

import { cache } from 'react';
import { eq, and } from 'drizzle-orm';
import * as Sentry from '@sentry/nextjs';
import { decryptTree, getTenantDek, schema, withTenant } from '@docket/db';
import {
  type IntakeState,
  asTenantId,
  maskSensitiveFields,
} from '@docket/shared';
import { getOrCreateClient } from './auth';
import { getCurrentTaxYear } from './shared';

export type IntakeBundle = {
  clientId: string;
  intakeId: string;
  taxYear: number;
  status: 'in_progress' | 'complete' | 'abandoned';
  answers: IntakeState;
};

export const getOrCreateIntakeAnswers = cache(async (): Promise<IntakeBundle | null> => {
  const authed = await getOrCreateClient();
  if (!authed) return null;

  const taxYear = await getCurrentTaxYear();

  return withTenant(asTenantId(authed.tenantId), async (db) => {
    const dek = await getTenantDek(db, asTenantId(authed.tenantId));

    // Try to insert. If the row already exists (per the unique index),
    // this returns nothing — we then SELECT to load the canonical row.
    await db
      .insert(schema.intakeResponses)
      .values({
        tenantId: authed.tenantId,
        clientId: authed.clientId,
        taxYear,
        status: 'in_progress',
        answers: {},
        completedSteps: [],
      })
      .onConflictDoNothing({
        target: [
          schema.intakeResponses.tenantId,
          schema.intakeResponses.clientId,
          schema.intakeResponses.taxYear,
        ],
      });

    const [row] = await db
      .select()
      .from(schema.intakeResponses)
      .where(
        and(
          eq(schema.intakeResponses.clientId, authed.clientId),
          eq(schema.intakeResponses.taxYear, taxYear),
        ),
      )
      .limit(1);

    if (!row) {
      Sentry.captureMessage(
        '[intake] intake_responses missing after upsert (RLS misconfig?)',
        'error',
      );
      return null;
    }

    // Decrypt every encrypted leaf with the tenant DEK, then mask
    // sensitive paths before returning. Plaintext SSN/EIN/bank never
    // crosses the server-client boundary by default — the client must
    // call revealIntakeField for each path it wants in plaintext, which
    // is audit-logged.
    const decrypted = decryptTree(row.answers ?? {}, dek) as IntakeState;
    const masked = maskSensitiveFields(decrypted);
    return {
      clientId: authed.clientId,
      intakeId: row.id,
      taxYear,
      status: row.status as IntakeBundle['status'],
      answers: masked,
    };
  });
});
