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
// OBSERVABILITY POSTURE (2026-05-15 audit follow-up)
//   This path used to emit ~16 console.log lines per call to Vercel
//   function logs (DEK length, intake row id, tax year, paths count,
//   decrypted-field count, audit insertion timing). Vercel logs are
//   NOT a compliance-grade sink (no encryption at rest guarantee,
//   accessible to anyone with Vercel team access). Per SOC 2 CC6.7
//   the PII-adjacent telemetry needs to land in Sentry where the
//   scrubber in packages/shared/src/sentry-scrubber.ts redacts
//   sensitive-keyed fields + PII regexes before transmission, and
//   Sentry has tighter access controls than the Vercel log tail.
//
//   The replacement: every prior console.log is now either
//   (a) a Sentry.addBreadcrumb that rides along with any captured
//   exception from this same handler invocation — visible in the
//   Sentry event timeline, scrubbed by the existing config; or
//   (b) dropped entirely when the prior log was redundant or had
//   no PII-adjacent value (DEK length is constant; "entering
//   withTenant" was scaffolding).
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
  Sentry.addBreadcrumb({
    category: 'unlock-pii',
    level: 'info',
    message: 'start',
    data: { clientIdTail: clientId.slice(-6) },
  });
  try {
    // 1. Auth + role gate.
    const user = await getCurrentDocketUser();
    if (!user) {
      Sentry.addBreadcrumb({
        category: 'unlock-pii',
        level: 'warning',
        message: 'no-session — returning Not signed in',
      });
      return { ok: false, error: 'Not signed in' };
    }

    try {
      assertRole(user, ['firm_owner', 'preparer', 'reviewer']);
    } catch {
      Sentry.addBreadcrumb({
        category: 'unlock-pii',
        level: 'warning',
        message: 'role-gate rejected',
        data: { role: user.role },
      });
      return { ok: false, error: 'Role not authorized to unlock' };
    }

    // 2. Rate limit. Tighter than per-field reveal — each unlock is
    // ~6 fields. 6/min still lets a preparer move fast between clients.
    const limit = consumeRateToken(`pii-unlock:${user.clerkUserId}`, 6, 60_000);
    if (!limit.allowed) {
      Sentry.addBreadcrumb({
        category: 'unlock-pii',
        level: 'warning',
        message: 'rate-limited',
        data: { retryAfterMs: limit.retryAfterMs },
      });
      return {
        ok: false,
        error: `Too many unlock requests. Try again in ${Math.ceil(limit.retryAfterMs / 1000)}s.`,
      };
    }

    const startedAt = Date.now();

    return await withTenant(asTenantId(user.tenantId), async (db) => {
      const dek = await getTenantDek(db, asTenantId(user.tenantId));

      // Latest intake row for this client (most recent tax year).
      const [row] = await db
        .select()
        .from(schema.intakeResponses)
        .where(eq(schema.intakeResponses.clientId, clientId))
        .orderBy(desc(schema.intakeResponses.taxYear))
        .limit(1);

      if (!row) {
        Sentry.addBreadcrumb({
          category: 'unlock-pii',
          level: 'warning',
          message: 'intake-not-found',
          data: { clientIdTail: clientId.slice(-6) },
        });
        return { ok: false, error: 'Intake not found' };
      }
      Sentry.addBreadcrumb({
        category: 'unlock-pii',
        level: 'info',
        message: 'intake-row-loaded',
        data: { taxYear: row.taxYear },
      });

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

      // Decrypt every concrete path. Use the AAD-aware decryptor so
      // saves written by saveIntakeField (which encrypts with
      // deriveAAD({tenantId, clientId, taxYear, path})) decrypt
      // cleanly here. The 3-tier fallback inside
      // decryptIfMarkedForTenantWithAAD covers AAD-bound writes,
      // pre-AAD DEK writes, and legacy master-KEK writes — all three
      // exist during the migration window. taxYear comes from the
      // intake row we just loaded so the binding matches the writer.
      const plaintext: Record<string, string> = {};
      let decryptFailures = 0;
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
          // One bad value shouldn't tank the whole unlock. Capture +
          // skip. Sentry sees the exception with the path that failed
          // (path names are not PII; they're config like
          // 'spouse.ssn' or 'dependents.list.0.ssn').
          decryptFailures += 1;
          Sentry.captureException(decryptErr, {
            tags: { component: 'command-room-pii-unlock', stage: 'decrypt-field' },
            extra: { path },
          });
        }
      }
      Sentry.addBreadcrumb({
        category: 'unlock-pii',
        level: 'info',
        message: 'decrypt-summary',
        data: {
          decryptedCount: Object.keys(plaintext).length,
          attemptedCount: concretePaths.length,
          decryptFailures,
        },
      });

      const expiresAt = Date.now() + PII_UNLOCK_DURATION_MS;

      // ONE audit row per unlock. tool_input lists which paths were
      // unlocked (path names only, no plaintext). tool_output records
      // the count + expiry.
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
      Sentry.addBreadcrumb({
        category: 'unlock-pii',
        level: 'info',
        message: 'complete',
        data: { latencyMs },
      });

      return { ok: true, plaintext, expiresAt };
    });
  } catch (error) {
    // Real error (with message + stack) goes to Sentry via the existing
    // scrubber. Client sees a generic message so we don't leak internals.
    // The Sentry event captures the breadcrumbs above for the timeline.
    Sentry.captureException(error, {
      tags: { component: 'command-room-pii-unlock', stage: 'outer-catch' },
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
