'use server';

// firm_owner-gated server action: set the firm-wide default deposit
// amount that the intake /deposit page falls back to when an
// engagement doesn't override.
//
// AUTH POSTURE
//   firm_owner only — this is firm-wide configuration, not per-client.
//   preparer/reviewer can't change firm-wide defaults.
//
// IDEMPOTENCY
//   ON CONFLICT (tenant_id) DO UPDATE — the firm_profile row exists
//   for every tenant (seeded with the tenant). Overwrites
//   default_deposit_cents while preserving other columns.

import { eq, sql } from 'drizzle-orm';
import * as Sentry from '@sentry/nextjs';
import {
  persistAgentAction,
  schema,
  withTenant,
} from '@docket/db';
import {
  asTenantId,
  asUserId,
  consumeRateToken,
} from '@docket/shared';
import { getCurrentDocketUser } from '@/lib/current-user';

export type SetDefaultDepositResult =
  | { ok: true; defaultDepositCents: number }
  | {
      ok: false;
      reason: 'unauthenticated' | 'forbidden' | 'invalid-amount' | 'rate-limit' | 'db-error';
      message: string;
      retryAfterMs?: number;
    };

const MIN_CENTS = 0;
const MAX_CENTS = 1_000_000; // $10,000 — hard cap to prevent fat-finger

export async function setDefaultDepositCents(
  amountCents: number,
): Promise<SetDefaultDepositResult> {
  const user = await getCurrentDocketUser();
  if (!user) return { ok: false, reason: 'unauthenticated', message: 'Not signed in' };
  if (user.role !== 'firm_owner') {
    return {
      ok: false,
      reason: 'forbidden',
      message: 'Only firm_owner can set the default deposit amount.',
    };
  }

  if (
    !Number.isFinite(amountCents) ||
    !Number.isInteger(amountCents) ||
    amountCents < MIN_CENTS ||
    amountCents > MAX_CENTS
  ) {
    return {
      ok: false,
      reason: 'invalid-amount',
      message: `Amount must be a whole-cent integer between $${(MIN_CENTS / 100).toFixed(0)} and $${(MAX_CENTS / 100).toLocaleString()}.`,
    };
  }

  const limit = consumeRateToken(`set-default-deposit:${user.clerkUserId}`, 10, 60_000);
  if (!limit.allowed) {
    return {
      ok: false,
      reason: 'rate-limit',
      message: `Too many config changes. Retry in ${Math.ceil(limit.retryAfterMs / 1000)}s.`,
      retryAfterMs: limit.retryAfterMs,
    };
  }

  try {
    await withTenant(asTenantId(user.tenantId), async (db) => {
      // UPSERT — firm_profile row always exists post-seed but use
      // ON CONFLICT for safety in case a tenant was created before
      // the firm_profile migration ran.
      await db
        .insert(schema.firmProfile)
        .values({
          tenantId: user.tenantId,
          defaultDepositCents: amountCents,
        })
        .onConflictDoUpdate({
          target: schema.firmProfile.tenantId,
          set: {
            defaultDepositCents: amountCents,
            updatedAt: sql`now()`,
          },
        });
    });

    // Audit row.
    const persist = persistAgentAction({
      extraToolInput: { defaultDepositCents: amountCents },
      textPreviewLength: 0,
    });
    try {
      await persist({
        tenantId: asTenantId(user.tenantId),
        clientId: null,
        userId: asUserId(user.id),
        agentId: null,
        actionClass: 'send-internal',
        toolName: 'firm-profile.set-default-deposit',
        toolInput: {},
        toolOutput: { ok: true, defaultDepositCents: amountCents },
        modelUsed: null,
        inputTokens: null,
        outputTokens: null,
        cachedTokens: null,
        costUsd: null,
        latencyMs: 0,
        success: true,
        errorMessage: null,
      });
    } catch (auditErr) {
      console.error('[set-default-deposit] audit-row write failed:', auditErr);
    }

    return { ok: true, defaultDepositCents: amountCents };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'firm-profile-set-default-deposit', tenant: user.tenantId },
    });
    return {
      ok: false,
      reason: 'db-error',
      message: 'Could not save default deposit amount. The error has been logged for review.',
    };
  } finally {
    void eq;
  }
}
