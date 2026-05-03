'use server';

// Validate, encrypt-if-sensitive, and persist a single field write.
// Returns the full updated answers object (with sensitive fields masked)
// so the caller can sync local state without an extra fetch.
//
// CONCURRENCY MODEL
//   Wraps the read-modify-write in a transaction with FOR UPDATE on the
//   intake_responses row. Concurrent saves to different paths serialize
//   on the row lock, so the JSONB merge is safe. Without FOR UPDATE,
//   T1 + T2 could each read {}, T1 writes {a:1}, T2 writes {b:2} -
//   T1's update would be lost.
//
// AUDIT TRAIL
//   Every write inserts a row into `actions` with actionClass =
//   'mutate-intake', the path, the value type (NOT the value), and
//   latency. The insert is INSIDE the same transaction, so if the
//   audit log fails the data write rolls back. SOC 2 control: no
//   write without audit.
//
// RATE LIMIT
//   Not applied here - saveIntakeField is hit on every keystroke
//   debounce, which would always trip a per-minute limit. The
//   debounce + Clerk session gating are the protection. Reveal +
//   flush are the abuse-prone surfaces and ARE rate-limited.

import { eq, and } from 'drizzle-orm';
import * as Sentry from '@sentry/nextjs';
import {
  encryptFieldForTenant,
  decryptTree,
  getTenantDek,
  schema,
  withTenant,
} from '@docket/db';
import {
  type IntakeState,
  asTenantId,
  isSensitivePath,
  maskSensitiveFields,
  setAtPath,
  validateIntakeField,
} from '@docket/shared';
import { getOrCreateClient } from './auth';
import { getCurrentTaxYear } from './shared';

export type SaveIntakeFieldResult =
  | { ok: true; answers: IntakeState }
  | { ok: false; error: string; path: string };

export async function saveIntakeField(
  path: string,
  value: unknown,
): Promise<SaveIntakeFieldResult> {
  const startedAt = Date.now();

  // 1. Validate at the boundary. Reject malformed or unknown paths.
  const validation = validateIntakeField(path, value);
  if (!validation.ok) {
    return { ok: false, error: validation.error, path: validation.path };
  }
  const validatedValue = validation.value;

  // 2. Auth.
  const authed = await getOrCreateClient();
  if (!authed) return { ok: false, error: 'Not signed in', path };

  const taxYear = await getCurrentTaxYear(authed.timezone);
  const sensitive = isSensitivePath(path);

  try {
    return await withTenant(asTenantId(authed.tenantId), async (db) => {
      // 3. Resolve the tenant's DEK before the row read - keeps the
      // critical-section logic clean and avoids holding the row lock
      // across a (potentially) DEK-cache-miss DB read.
      const dek = sensitive
        ? await getTenantDek(db, asTenantId(authed.tenantId))
        : null;

      // 4. Load current row WITH FOR UPDATE - locks it for the duration
      // of this transaction. Concurrent saveIntakeField calls to the
      // same intake row serialize through this lock, so the
      // read-modify-write below is safe.
      const [existing] = await db
        .select()
        .from(schema.intakeResponses)
        .where(
          and(
            eq(schema.intakeResponses.clientId, authed.clientId),
            eq(schema.intakeResponses.taxYear, taxYear),
          ),
        )
        .for('update')
        .limit(1);

      if (!existing) {
        return {
          ok: false,
          error: 'Intake row not found - call getOrCreateIntakeAnswers first',
          path,
        };
      }

      // 5. Compute the storage value. Sensitive paths get encrypted
      // with the tenant DEK; everything else stores plain. Mixed
      // encrypted/plain in the same JSONB tree is fine - decryptTree()
      // handles both on read.
      const valueToStore =
        sensitive && dek ? encryptFieldForTenant(String(validatedValue), dek) : validatedValue;

      const currentStorage = (existing.answers as unknown) ?? {};
      const updatedStorage = setAtPath(currentStorage, path, valueToStore);

      // 6. Persist. updated_at bumps on every write.
      await db
        .update(schema.intakeResponses)
        .set({
          answers: updatedStorage as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(schema.intakeResponses.id, existing.id));

      // 7. Side-effect: keep clients.full_name in sync with the
      // taxpayer's self-reported legal name. Preparers create client
      // rows with a placeholder name (the name they know the client
      // by); when the client types their full legal name on /personal,
      // we want the command-room client list and detail page header
      // to reflect THAT — not the placeholder. Plain text, not
      // encrypted (full_name is not in SENSITIVE_INTAKE_PATHS).
      if (path === 'personal.fullName' && typeof validatedValue === 'string') {
        const trimmed = validatedValue.trim();
        if (trimmed.length > 0) {
          await db
            .update(schema.clients)
            .set({ fullName: trimmed, updatedAt: new Date() })
            .where(eq(schema.clients.id, authed.clientId));
        }
      }

      // 8. Audit log. NOT best-effort - if the audit insert fails,
      // the whole transaction rolls back. SOC 2 / IRS Pub 1345
      // requirement: every state-changing write leaves a tamper-
      // evident audit trail. The path is recorded but the VALUE is
      // not - only the value's type - so the audit trail itself is
      // not a PII surface.
      const latencyMs = Date.now() - startedAt;
      await db.insert(schema.actions).values({
        tenantId: authed.tenantId,
        clientId: authed.clientId,
        userId: null,
        agentId: null,
        actionClass: 'mutate-intake',
        toolName: 'saveIntakeField',
        toolInput: { path, sensitive, valueType: typeof validatedValue },
        toolOutput: { ok: true },
        latencyMs,
        success: true,
      });

      // 8. Return decrypted-then-masked view for the client's local
      // state. Need the DEK either way now, so resolve if not already
      // cached. Cache hit on the second call when sensitive=true.
      const dekForRead = dek ?? (await getTenantDek(db, asTenantId(authed.tenantId)));
      const decrypted = decryptTree(updatedStorage, dekForRead) as IntakeState;
      const masked = maskSensitiveFields(decrypted);
      return { ok: true, answers: masked };
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: 'intake-write', path, sensitive: String(sensitive) },
    });
    return { ok: false, error: 'Save failed - please try again', path };
  }
}
