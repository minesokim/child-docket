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
import { assertWritable } from '@/lib/read-only-mode';

export async function completeIntake(): Promise<{ ok: boolean; error?: string }> {
  const authed = await getOrCreateClient();
  if (!authed) return { ok: false, error: 'Not signed in' };
  await assertWritable();

  const taxYear = await getCurrentTaxYear(authed.timezone);
  const startedAt = Date.now();

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

      // Append-only audit row in the SAME transaction. SOC 2 evidence
      // for the moment a taxpayer "submits" their intake package — the
      // schema.intakeResponses.completedAt column is mutable, but
      // actions is trigger-protected (migration 0007). If this insert
      // fails the whole transaction rolls back, including the status
      // update — we never claim a completion without an audit row.
      await db.insert(schema.actions).values({
        tenantId: authed.tenantId,
        clientId: authed.clientId,
        actionClass: 'send-internal',
        toolName: 'completeIntake',
        toolInput: { taxYear },
        latencyMs: Date.now() - startedAt,
        success: true,
      });

      return { ok: true };
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: 'intake-complete' },
    });
    return { ok: false, error: 'Could not mark intake complete' };
  }
}
