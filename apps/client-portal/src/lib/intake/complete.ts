'use server';

// Mark the intake complete. Called from /done after the final step.
// Idempotent - a re-call on an already-complete intake is a no-op
// (sets the same status + timestamp again).

import { eq, and } from 'drizzle-orm';
import * as Sentry from '@sentry/nextjs';
import { schema, withTenant } from '@docket/db';
import { asTenantId } from '@docket/shared';
import { getOrCreateClient } from './auth';
import { getCurrentTaxYear } from './shared';

export async function completeIntake(): Promise<{ ok: boolean; error?: string }> {
  const authed = await getOrCreateClient();
  if (!authed) return { ok: false, error: 'Not signed in' };

  const taxYear = await getCurrentTaxYear();

  try {
    return await withTenant(asTenantId(authed.tenantId), async (db) => {
      await db
        .update(schema.intakeResponses)
        .set({
          status: 'complete',
          completedAt: new Date(),
        })
        .where(
          and(
            eq(schema.intakeResponses.clientId, authed.clientId),
            eq(schema.intakeResponses.taxYear, taxYear),
          ),
        );
      return { ok: true };
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: 'intake-complete' },
    });
    return { ok: false, error: 'Could not mark intake complete' };
  }
}
