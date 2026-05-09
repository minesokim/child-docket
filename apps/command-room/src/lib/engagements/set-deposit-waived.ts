'use server';

// firm_owner|preparer-gated server action: toggle engagement.deposit_waived.
//
// Used from /clients/[id] when Antonio wants to skip the deposit
// gate for a specific engagement (referral, in-laws, returning
// client cohort). The intake /deposit page checks deposit_waived
// at render and short-circuits to /done.
//
// AUDIT
//   Every flip writes an audit row with the previous + new state +
//   user id. If a flip needs to be reversed, the audit chain has the
//   provenance.

import { eq } from 'drizzle-orm';
import * as Sentry from '@sentry/nextjs';
import {
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

export type SetDepositWaivedResult =
  | { ok: true; engagementId: string; depositWaived: boolean }
  | {
      ok: false;
      reason:
        | 'unauthenticated'
        | 'forbidden'
        | 'engagement-not-found'
        | 'rate-limit'
        | 'db-error';
      message: string;
      retryAfterMs?: number;
    };

const ALLOWED_ROLES = new Set(['firm_owner', 'preparer']);

export async function setDepositWaived(
  engagementId: string,
  depositWaived: boolean,
): Promise<SetDepositWaivedResult> {
  const user = await getCurrentDocketUser();
  if (!user) return { ok: false, reason: 'unauthenticated', message: 'Not signed in' };
  if (!ALLOWED_ROLES.has(user.role)) {
    return {
      ok: false,
      reason: 'forbidden',
      message: `Role ${user.role} cannot waive deposits.`,
    };
  }

  const limit = consumeRateToken(`set-deposit-waived:${user.clerkUserId}`, 20, 60_000);
  if (!limit.allowed) {
    return {
      ok: false,
      reason: 'rate-limit',
      message: `Too many waiver changes. Retry in ${Math.ceil(limit.retryAfterMs / 1000)}s.`,
      retryAfterMs: limit.retryAfterMs,
    };
  }

  try {
    let clientId: string | null = null;
    let previousValue: boolean | null = null;

    await withTenant(asTenantId(user.tenantId), async (db) => {
      const [eng] = await db
        .select({ id: schema.engagements.id, clientId: schema.engagements.clientId, depositWaived: schema.engagements.depositWaived })
        .from(schema.engagements)
        .where(eq(schema.engagements.id, engagementId))
        .limit(1);
      if (!eng) {
        throw new EngagementNotFoundError();
      }
      clientId = eng.clientId;
      previousValue = eng.depositWaived;

      await db
        .update(schema.engagements)
        .set({ depositWaived })
        .where(eq(schema.engagements.id, engagementId));
    });

    // Audit row outside the withTenant since persistAgentAction
    // manages its own connection.
    const persist = persistAgentAction({
      extraToolInput: {
        engagementId,
        previousValue,
        newValue: depositWaived,
      },
      textPreviewLength: 0,
    });
    try {
      await persist({
        tenantId: asTenantId(user.tenantId),
        clientId: clientId ? asClientId(clientId) : null,
        userId: asUserId(user.id),
        agentId: null,
        actionClass: 'send-internal',
        toolName: 'engagement.set-deposit-waived',
        toolInput: {},
        toolOutput: { ok: true, engagementId, depositWaived },
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
      console.error('[set-deposit-waived] audit-row write failed:', auditErr);
    }

    return { ok: true, engagementId, depositWaived };
  } catch (err) {
    if (err instanceof EngagementNotFoundError) {
      return {
        ok: false,
        reason: 'engagement-not-found',
        message: 'Engagement not found',
      };
    }
    Sentry.captureException(err, {
      tags: { component: 'engagement-set-deposit-waived', tenant: user.tenantId },
    });
    return {
      ok: false,
      reason: 'db-error',
      message: 'Could not update waiver. The error has been logged for review.',
    };
  }
}

class EngagementNotFoundError extends Error {
  constructor() {
    super('Engagement not found');
    this.name = 'EngagementNotFoundError';
  }
}
