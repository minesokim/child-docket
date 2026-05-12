'use server';

// Per-session PII unlock for the preparer-side intake summary.
//
// Antonio prepping a return needs to type SSN/EIN/bank into OLT or
// other prep software. Per-field click-to-reveal was friction-y
// (6 clicks per client). Per-session unlock: one click reveals all
// sensitive values for THIS client for 15 minutes, then auto-locks.
// Less friction, slightly larger plaintext window — explicit
// founder choice.
//
// SECURITY POSTURE
//   - Plaintext lives in browser React state for the unlock window.
//     Auto-clears on timeout, on lock click, on client-page unmount.
//   - One audit row per UNLOCK action (not per field viewed). The
//     audit captures which paths were potentially viewable, not
//     when each was rendered. From a security audit standpoint,
//     the unlock IS the read event.
//   - Role-gate: firm_owner | preparer | reviewer (admin + assistant
//     blocked). Same gate as the per-field reveal it replaced.
//   - Rate-limit: 6 unlocks per minute per Clerk user. Tighter than
//     per-field reveal because each unlock returns the full plaintext
//     map (~6 fields), not one. 6/min lets the preparer move between
//     ~6 clients per minute, which is unusually fast.
//
// PATH ENUMERATION
//   Walks the SENSITIVE_INTAKE_PATHS globs against the actual answers
//   tree to enumerate concrete paths with values. dependents.list.*.ssn
//   expands per actual dependent count. Returns only paths that have
//   non-null values — empty fields are not in the response.

import { eq, desc } from 'drizzle-orm';
import * as Sentry from '@sentry/nextjs';
import {
  decryptIfMarkedForTenantWithAAD,
  deriveAAD,
  getTenantDek,
  isEncrypted,
  schema,
  withTenant,
} from '@docket/db';
import {
  asTenantId,
  consumeRateToken,
  getAtPath,
  SENSITIVE_INTAKE_PATHS,
} from '@docket/shared';
import { assertRole } from '@/lib/require-role';
import { getCurrentDocketUser } from '@/lib/current-user';
import { PII_UNLOCK_DURATION_MS } from './unlock-config';

export type UnlockClientPIIResult =
  | { ok: true; plaintext: Record<string, string>; expiresAt: number }
  | { ok: false; error: string };

export async function unlockClientPII(clientId: string): Promise<UnlockClientPIIResult> {
  // Stage-by-stage logging. Every line lands in Vercel function logs
  // so when this hangs/fails in production we can see exactly which
  // step died. Format: "[unlockClientPII] <stage>: <detail>". The
  // outer try makes sure NO exception escapes to the client — if we
  // hit the catch, the UI gets a clean error instead of a hung promise.
  console.log('[unlockClientPII] start clientId=', clientId);
  try {
    // 1. Auth + role gate.
    const user = await getCurrentDocketUser();
    if (!user) {
      console.log('[unlockClientPII] no user — returning no-session');
      return { ok: false, error: 'Not signed in' };
    }
    console.log('[unlockClientPII] user=', user.id, 'role=', user.role, 'tenant=', user.tenantId);

    try {
      assertRole(user, ['firm_owner', 'preparer', 'reviewer']);
    } catch {
      console.log('[unlockClientPII] role gate rejected role=', user.role);
      return { ok: false, error: 'Role not authorized to unlock' };
    }

    // 2. Rate limit. Tighter than per-field reveal — each unlock is
    // ~6 fields. 6/min still lets a preparer move fast between clients.
    const limit = consumeRateToken(`pii-unlock:${user.clerkUserId}`, 6, 60_000);
    if (!limit.allowed) {
      console.log('[unlockClientPII] rate-limited retryAfterMs=', limit.retryAfterMs);
      return {
        ok: false,
        error: `Too many unlock requests. Try again in ${Math.ceil(limit.retryAfterMs / 1000)}s.`,
      };
    }

    const startedAt = Date.now();
    console.log('[unlockClientPII] entering withTenant');

    return await withTenant(asTenantId(user.tenantId), async (db) => {
      console.log('[unlockClientPII] inside withTenant — fetching DEK');
      const dek = await getTenantDek(db, asTenantId(user.tenantId));
      console.log('[unlockClientPII] DEK fetched ok, length=', dek?.length);

      // Latest intake row for this client (most recent tax year).
      console.log('[unlockClientPII] querying intake_responses');
      const [row] = await db
        .select()
        .from(schema.intakeResponses)
        .where(eq(schema.intakeResponses.clientId, clientId))
        .orderBy(desc(schema.intakeResponses.taxYear))
        .limit(1);

      if (!row) {
        console.log('[unlockClientPII] no intake row found for clientId=', clientId);
        return { ok: false, error: 'Intake not found' };
      }
      console.log('[unlockClientPII] intake row id=', row.id, 'taxYear=', row.taxYear);

      const answers = (row.answers ?? {}) as Record<string, unknown>;

      // Enumerate concrete sensitive paths against this client's answers.
      // Globs expand by walking the array at the prefix. We only include
      // paths that have non-null values so the response is minimal.
      const concretePaths: string[] = [];
      for (const pattern of SENSITIVE_INTAKE_PATHS) {
        if (!pattern.includes('*')) {
          if (getAtPath(answers, pattern) != null) concretePaths.push(pattern);
          continue;
        }
        const [beforeStar, afterStar] = pattern.split('.*.');
        if (beforeStar === undefined) continue;
        const arrayValue = getAtPath(answers, beforeStar);
        if (!Array.isArray(arrayValue)) continue;
        for (let i = 0; i < arrayValue.length; i++) {
          const itemPath = `${beforeStar}.${i}.${afterStar}`;
          if (getAtPath(answers, itemPath) != null) concretePaths.push(itemPath);
        }
      }
      console.log('[unlockClientPII] concrete paths=', concretePaths.length);

      // Decrypt every concrete path. Use the AAD-aware decryptor so
      // saves written by saveIntakeField (which encrypts with
      // deriveAAD({tenantId, clientId, taxYear, path})) decrypt
      // cleanly here. The 3-tier fallback inside
      // decryptIfMarkedForTenantWithAAD covers AAD-bound writes,
      // pre-AAD DEK writes, and legacy master-KEK writes — all three
      // exist during the migration window. taxYear comes from the
      // intake row we just loaded so the binding matches the writer.
      const plaintext: Record<string, string> = {};
      for (const path of concretePaths) {
        const stored = getAtPath(answers, path);
        if (stored == null) continue;
        try {
          if (isEncrypted(stored)) {
            const aad = deriveAAD({
              tenantId: user.tenantId,
              clientId,
              taxYear: row.taxYear,
              path,
            });
            plaintext[path] = decryptIfMarkedForTenantWithAAD(stored, dek, aad) as string;
          } else if (typeof stored === 'string') {
            // Legacy plaintext (pre-encryption rollout). Surface anyway;
            // the field would otherwise just be the plain string already.
            plaintext[path] = stored;
          }
        } catch (decryptErr) {
          // One bad value shouldn't tank the whole unlock. Log + skip.
          console.error('[unlockClientPII] decrypt failed path=', path, 'err=', decryptErr);
        }
      }
      console.log('[unlockClientPII] decrypted count=', Object.keys(plaintext).length);

      const expiresAt = Date.now() + PII_UNLOCK_DURATION_MS;

      // ONE audit row per unlock. tool_input lists which paths were
      // unlocked (path names only, no plaintext). tool_output records
      // the count + expiry.
      const latencyMs = Date.now() - startedAt;
      console.log('[unlockClientPII] inserting audit row');
      await db.insert(schema.actions).values({
        tenantId: user.tenantId,
        clientId,
        userId: user.id,
        agentId: null,
        actionClass: 'read',
        toolName: 'unlockClientPII',
        toolInput: { paths: concretePaths, durationMs: PII_UNLOCK_DURATION_MS },
        toolOutput: { ok: true, count: Object.keys(plaintext).length, expiresAt },
        latencyMs,
        success: true,
      });
      console.log('[unlockClientPII] complete latencyMs=', latencyMs);

      return { ok: true, plaintext, expiresAt };
    });
  } catch (error) {
    // Real error (with message + stack) lands here; the client sees a
    // generic message so we don't leak internals.
    console.error('[unlockClientPII] CAUGHT:', error);
    if (error instanceof Error) {
      console.error('[unlockClientPII] message:', error.message);
      console.error('[unlockClientPII] stack:', error.stack);
    }
    Sentry.captureException(error, {
      tags: { component: 'command-room-pii-unlock' },
    });
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Unlock failed: ${error.message}`
          : 'Unlock failed — check server logs',
    };
  }
}
