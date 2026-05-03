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
  SENSITIVE_INTAKE_PATHS,
} from '@docket/shared';
import { assertRole } from '@/lib/require-role';
import { getCurrentDocketUser } from '@/lib/current-user';

export const PII_UNLOCK_DURATION_MS = 15 * 60 * 1000;

export type UnlockClientPIIResult =
  | { ok: true; plaintext: Record<string, string>; expiresAt: number }
  | { ok: false; error: string };

export async function unlockClientPII(clientId: string): Promise<UnlockClientPIIResult> {
  // 1. Auth + role gate.
  const user = await getCurrentDocketUser();
  if (!user) return { ok: false, error: 'Not signed in' };

  try {
    assertRole(user, ['firm_owner', 'preparer', 'reviewer']);
  } catch {
    return { ok: false, error: 'Role not authorized to unlock' };
  }

  // 2. Rate limit. Tighter than per-field reveal — each unlock is
  // ~6 fields. 6/min still lets a preparer move fast between clients.
  const limit = consumeRateToken(`pii-unlock:${user.clerkUserId}`, 6, 60_000);
  if (!limit.allowed) {
    return {
      ok: false,
      error: `Too many unlock requests. Try again in ${Math.ceil(limit.retryAfterMs / 1000)}s.`,
    };
  }

  const startedAt = Date.now();

  try {
    return await withTenant(asTenantId(user.tenantId), async (db) => {
      const dek = await getTenantDek(db, asTenantId(user.tenantId));

      // Latest intake row for this client (most recent tax year).
      const [row] = await db
        .select()
        .from(schema.intakeResponses)
        .where(eq(schema.intakeResponses.clientId, clientId))
        .orderBy(desc(schema.intakeResponses.taxYear))
        .limit(1);

      if (!row) return { ok: false, error: 'Intake not found' };

      const answers = row.answers as Record<string, unknown>;

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

      // Decrypt every concrete path.
      const plaintext: Record<string, string> = {};
      for (const path of concretePaths) {
        const stored = getAtPath(answers, path);
        if (stored == null) continue;
        if (isEncrypted(stored)) {
          plaintext[path] = decryptIfMarkedForTenant(stored, dek) as string;
        } else if (typeof stored === 'string') {
          // Legacy plaintext (pre-encryption rollout). Surface anyway;
          // the field would otherwise just be the plain string already.
          plaintext[path] = stored;
        }
      }

      const expiresAt = Date.now() + PII_UNLOCK_DURATION_MS;

      // ONE audit row per unlock. tool_input lists which paths were
      // unlocked (path names only, no plaintext). tool_output records
      // the count + expiry. This is the security-event-of-record;
      // subsequent renders within the unlock window do not generate
      // additional audit rows.
      const latencyMs = Date.now() - startedAt;
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

      return { ok: true, plaintext, expiresAt };
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: 'command-room-pii-unlock' },
    });
    return { ok: false, error: 'Unlock failed — please try again' };
  }
}
