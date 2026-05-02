'use server';

// Reveal the plaintext value of a single sensitive field. The client
// calls this when the user clicks 'Edit' on a masked SSN/EIN/bank field
// - we decrypt that ONE leaf with the tenant DEK and return it for
// inline editing. The reveal is audit-logged with the path, so SOC 2
// evidence shows every plaintext access.
//
// PATH GATING
//   Only accepts paths in SENSITIVE_INTAKE_PATHS. Non-sensitive paths
//   are already in the masked answers blob as plaintext, so revealing
//   them is pointless and we don't want this becoming a generic
//   value-getter.
//
// RATE LIMIT
//   Each Clerk user gets 30 reveals per minute. Real-world flow:
//   editing SSN + EIN + bank routing + bank account during intake
//   uses ~5 reveals total. 30/min is generous yet cuts off
//   enumeration attacks. Returns ok:false on overflow instead of
//   throwing, so the UI can show a friendly retry message.

import { eq, and } from 'drizzle-orm';
import * as Sentry from '@sentry/nextjs';
import {
  decryptIfMarkedForTenant,
  getTenantDek,
  isEncrypted,
  schema,
  withTenant,
} from '@docket/db';
import {
  asTenantId,
  consumeRateToken,
  getAtPath,
  isSensitivePath,
} from '@docket/shared';
import { getOrCreateClient } from './auth';
import { getCurrentTaxYear } from './shared';

export type RevealIntakeFieldResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

export async function revealIntakeField(path: string): Promise<RevealIntakeFieldResult> {
  // 1. Path must be sensitive - refuse any other reveal request.
  if (!isSensitivePath(path)) {
    return { ok: false, error: 'Path is not a sensitive field' };
  }

  // 2. Auth.
  const authed = await getOrCreateClient();
  if (!authed) return { ok: false, error: 'Not signed in' };

  // 3. Rate limit. Key on Clerk user id so an attacker forging a
  // session can't spread across tenants.
  const limit = consumeRateToken(`reveal:${authed.clerkUserId}`, 30, 60_000);
  if (!limit.allowed) {
    return {
      ok: false,
      error: `Too many reveal requests. Try again in ${Math.ceil(limit.retryAfterMs / 1000)}s.`,
    };
  }

  const taxYear = await getCurrentTaxYear();
  const startedAt = Date.now();

  try {
    return await withTenant(asTenantId(authed.tenantId), async (db) => {
      const dek = await getTenantDek(db, asTenantId(authed.tenantId));

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

      if (!row) return { ok: false, error: 'Intake not found' };

      const stored = getAtPath(row.answers as unknown, path);

      // Resolve to plaintext. Sensitive paths are normally encrypted
      // markers; if the value was somehow stored plain (e.g., legacy
      // data from before encryption shipped), accept that too.
      let plaintext = '';
      if (stored == null) {
        plaintext = '';
      } else if (isEncrypted(stored)) {
        plaintext = decryptIfMarkedForTenant(stored, dek) as string;
      } else if (typeof stored === 'string') {
        plaintext = stored;
      } else {
        return { ok: false, error: 'Stored value has unexpected shape' };
      }

      // Audit log: 'read' actionClass. Path goes in toolInput; value
      // does NOT - the audit trail records that a reveal happened
      // without itself becoming a PII surface.
      const latencyMs = Date.now() - startedAt;
      await db.insert(schema.actions).values({
        tenantId: authed.tenantId,
        clientId: authed.clientId,
        userId: null,
        agentId: null,
        actionClass: 'read',
        toolName: 'revealIntakeField',
        toolInput: { path },
        toolOutput: { ok: true, hadValue: plaintext.length > 0 },
        latencyMs,
        success: true,
      });

      return { ok: true, value: plaintext };
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: 'intake-reveal', path },
    });
    return { ok: false, error: 'Reveal failed - please try again' };
  }
}
