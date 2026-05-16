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
  decryptTreeWithAAD,
  deriveAAD,
  encryptFieldForTenantWithAAD,
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
import { assertWritable } from '@/lib/read-only-mode';

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
  await assertWritable();

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
      // with the tenant DEK + AAD bound to (tenantId, clientId, path)
      // so the ciphertext can't be relocated across rows; everything
      // else stores plain. Mixed encrypted/plain in the same JSONB
      // tree is fine — decryptTreeWithAAD() handles both on read,
      // and falls back through AAD-less + master-KEK paths for
      // pre-migration data.
      const valueToStore =
        sensitive && dek
          ? encryptFieldForTenantWithAAD(
              String(validatedValue),
              dek,
              deriveAAD({
                tenantId: authed.tenantId,
                clientId: authed.clientId,
                taxYear,
                path,
              }),
            )
          : validatedValue;

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

      // 7. Side-effect: keep the clients table in sync with intake-
      // collected fields the COMMAND ROOM reads directly. The 8879
      // request action (and other server actions) validates against
      // `clients.email` / `clients.full_name` / `clients.state` — NOT
      // against the JSON inside intake_responses.answers. Without
      // mirroring these fields, intake input is invisible to the
      // preparer-side flow and 8879 requests fail with
      // 'client-incomplete' even after a complete intake.
      //
      // Mirror-back set:
      //   - personal.fullName     → clients.full_name
      //   - personal.email        → clients.email          (Session 17 fix)
      //   - personal.addressState → clients.state          (Session 17 fix)
      //
      // Explicitly NOT mirrored:
      //   - personal.phone — bound to Clerk identity at sign-in time;
      //     re-keying the binding from intake is unsafe.
      //   - personal.ssn — sensitive, encrypted in intake_responses
      //     only; never written plaintext into clients.
      //   - personal.dateOfBirth / occupation / street / city / zip —
      //     no corresponding clients.* column today.
      //
      // All three mirrored fields are plain text (none in
      // SENSITIVE_INTAKE_PATHS).
      if (typeof validatedValue === 'string') {
        const trimmed = validatedValue.trim();
        if (trimmed.length > 0) {
          if (path === 'personal.fullName') {
            await db
              .update(schema.clients)
              .set({ fullName: trimmed, updatedAt: new Date() })
              .where(eq(schema.clients.id, authed.clientId));
          } else if (path === 'personal.email') {
            // Lowercase to match the canonical form set by
            // command-room's createClient — email comparisons stay
            // case-insensitive that way.
            const normalized = trimmed.toLowerCase();
            await db
              .update(schema.clients)
              .set({ email: normalized, updatedAt: new Date() })
              .where(eq(schema.clients.id, authed.clientId));
          } else if (path === 'personal.addressState') {
            // StateCodeSchema (packages/shared/src/intake-schemas.ts)
            // already validates as a 2-letter US state code; trimming
            // is belt-and-suspenders.
            await db
              .update(schema.clients)
              .set({ state: trimmed, updatedAt: new Date() })
              .where(eq(schema.clients.id, authed.clientId));
          }
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
      // The AAD builder mirrors what the writer above passes — same
      // (tenantId, clientId, path) tuple — so AAD-bound leaves
      // recently written by this same call decrypt cleanly. Pre-AAD
      // leaves still in the tree fall through to the AAD-less DEK
      // path inside decryptIfMarkedForTenantWithAAD.
      const dekForRead = dek ?? (await getTenantDek(db, asTenantId(authed.tenantId)));
      const decrypted = decryptTreeWithAAD(updatedStorage, dekForRead, (leafPath) =>
        deriveAAD({
          tenantId: authed.tenantId,
          clientId: authed.clientId,
          taxYear,
          path: leafPath,
        }),
      ) as IntakeState;
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
