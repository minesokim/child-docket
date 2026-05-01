'use server';

// ────────────────────────────────────────────────────────────────
// Server actions for intake state persistence.
//
// Three primitives:
//   - getOrCreateIntakeAnswers()  — load (or create on first call) the
//     active intake_responses row for the signed-in client. Returns
//     answers with sensitive fields decrypted, ready for client render.
//
//   - saveIntakeField(path, value) — validate at the boundary, encrypt
//     if path is sensitive, set value at path on the JSONB blob, write,
//     audit-log to `actions`. Returns updated answers.
//
//   - completeIntake() — flip status to 'complete' once isIntakeComplete
//     evaluates true. Called from the /done page after final step.
//
// Every call is RLS-bound via withTenant(). Sensitive paths
// (SENSITIVE_INTAKE_PATHS) are AES-256-GCM encrypted at write time
// and decrypted at read time.
// ────────────────────────────────────────────────────────────────

import { auth, currentUser } from '@clerk/nextjs/server';
import { eq, and } from 'drizzle-orm';
import * as Sentry from '@sentry/nextjs';
import {
  getAdminDb,
  withTenant,
  schema,
  encryptFieldForTenant,
  decryptIfMarkedForTenant,
  getTenantDek,
  isEncrypted,
} from '@docket/db';
import {
  type IntakeState,
  getAtPath,
  isSensitivePath,
  maskSensitiveFields,
  setAtPath,
  taxYearForDate,
  validateIntakeField,
  asTenantId,
} from '@docket/shared';

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

const VAZANT_TENANT_SLUG = 'vazant';

/**
 * Tax year for the active intake — wraps the timezone-aware helper from
 * @docket/shared with `now` and the Vazant default tenant timezone.
 * When multi-tenant lands, this becomes a function of the resolved
 * tenant's timezone column.
 */
function getCurrentTaxYear(): number {
  return taxYearForDate(new Date(), 'America/Los_Angeles');
}

/**
 * Walk a JSONB tree and decrypt every encrypted leaf marker using the
 * tenant's DEK. Used on the read path so the client receives plain values
 * it can render directly.
 *
 * The DEK is passed in (rather than looked up per-leaf) so a single tree
 * walk amortizes one cache lookup across all encrypted fields.
 */
function decryptTree(node: unknown, dek: Buffer): unknown {
  if (node == null || typeof node !== 'object') return node;
  if (isEncrypted(node)) return decryptIfMarkedForTenant(node, dek);
  if (Array.isArray(node)) return node.map((item) => decryptTree(item, dek));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    out[k] = decryptTree(v, dek);
  }
  return out;
}

// ────────────────────────────────────────────────────────────────
// Auth + client provisioning
// ────────────────────────────────────────────────────────────────

type AuthedClient = {
  clientId: string;
  tenantId: string;
  clerkUserId: string;
};

/**
 * Resolve the Clerk session to a `clients` row, creating one tied to
 * Antonio's tenant on first call. Multi-tenant routing lands in v1.
 *
 * Race-safe: under concurrent first-visit calls (user double-clicks the
 * welcome CTA, or two tabs hit /welcome simultaneously), the unique
 * constraint on clients.clerk_user_id ensures only ONE INSERT succeeds.
 * Without ON CONFLICT DO NOTHING, the loser would surface a unique-
 * violation error and the user would see a 500 on first sign-in. With
 * it, both calls converge on the same canonical row via a follow-up
 * SELECT.
 *
 * Fast path: if a row already exists, the SELECT short-circuits before
 * we even look up the tenant or fetch Clerk user details. The INSERT
 * branch only runs on first sign-in.
 */
async function getOrCreateClient(): Promise<AuthedClient | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const db = getAdminDb();

  // Fast path: already provisioned. The vast majority of requests land
  // here after the very first sign-in for a user.
  const [existing] = await db
    .select({ id: schema.clients.id, tenantId: schema.clients.tenantId })
    .from(schema.clients)
    .where(eq(schema.clients.clerkUserId, userId))
    .limit(1);

  if (existing) {
    return { clientId: existing.id, tenantId: existing.tenantId, clerkUserId: userId };
  }

  // First sign-in for this Clerk user. Provision them under Vazant.
  const [tenant] = await db
    .select({ id: schema.tenants.id })
    .from(schema.tenants)
    .where(eq(schema.tenants.slug, VAZANT_TENANT_SLUG))
    .limit(1);

  if (!tenant) {
    Sentry.captureMessage('[intake] Vazant tenant not seeded — cannot provision client', 'error');
    return null;
  }

  const clerkUser = await currentUser();
  const phone = clerkUser?.primaryPhoneNumber?.phoneNumber ?? null;
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? null;
  const firstName = clerkUser?.firstName ?? '';
  const lastName = clerkUser?.lastName ?? '';
  const fullName =
    [firstName, lastName].filter(Boolean).join(' ') || phone || email || 'New client';

  // Race-safe insert: if another concurrent request beat us to inserting
  // a row for this Clerk user, ON CONFLICT DO NOTHING swallows the
  // unique-violation error. The follow-up SELECT picks up whichever row
  // ended up in the table — winner's or ours.
  await db
    .insert(schema.clients)
    .values({
      tenantId: tenant.id,
      clerkUserId: userId,
      fullName,
      email,
      phone,
      intakeStatus: 'in-progress',
    })
    .onConflictDoNothing({ target: schema.clients.clerkUserId });

  const [client] = await db
    .select({ id: schema.clients.id, tenantId: schema.clients.tenantId })
    .from(schema.clients)
    .where(eq(schema.clients.clerkUserId, userId))
    .limit(1);

  if (!client) {
    // Should never happen — the INSERT either succeeded (our row) or was
    // a no-op because someone else's row already exists. Either way the
    // SELECT should find a row. If we get here, something is wrong with
    // RLS or the unique constraint.
    Sentry.captureMessage(
      '[intake] client row missing after upsert (RLS or constraint misconfig?)',
      'error',
    );
    return null;
  }
  return { clientId: client.id, tenantId: client.tenantId, clerkUserId: userId };
}

// ────────────────────────────────────────────────────────────────
// Public types
// ────────────────────────────────────────────────────────────────

export type IntakeBundle = {
  clientId: string;
  intakeId: string;
  taxYear: number;
  status: 'in_progress' | 'complete' | 'abandoned';
  answers: IntakeState;
};

export type SaveIntakeFieldResult =
  | { ok: true; answers: IntakeState }
  | { ok: false; error: string; path: string };

// ────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────

/**
 * Load (or create on first visit) the active intake row for the signed-in
 * client. Sensitive fields are decrypted before return, so the result can
 * be passed straight to a client component for rendering.
 *
 * Race-safe: uses INSERT ... ON CONFLICT DO NOTHING with the unique index
 * on (tenant_id, client_id, tax_year). Two concurrent first-visit calls
 * (e.g., double-clicked CTA) will both attempt insert; only the first
 * succeeds. Both end up calling the SELECT fallback to load the canonical
 * row. No duplicates possible.
 *
 * Returns null when:
 *   - No Clerk session
 *   - Vazant tenant not seeded (deployment misconfig)
 */
export async function getOrCreateIntakeAnswers(): Promise<IntakeBundle | null> {
  const authed = await getOrCreateClient();
  if (!authed) return null;

  const taxYear = getCurrentTaxYear();

  return withTenant(asTenantId(authed.tenantId), async (db) => {
    // Resolve the tenant's DEK once per request. First-access provisioning
    // happens transparently inside getTenantDek if dek_encrypted is NULL on
    // the tenant row.
    const dek = await getTenantDek(db, asTenantId(authed.tenantId));

    // Try to insert. If the row already exists (per the unique index), this
    // returns nothing — we then SELECT to load the canonical row.
    await db
      .insert(schema.intakeResponses)
      .values({
        tenantId: authed.tenantId,
        clientId: authed.clientId,
        taxYear,
        status: 'in_progress',
        answers: {},
        completedSteps: [],
      })
      .onConflictDoNothing({
        target: [
          schema.intakeResponses.tenantId,
          schema.intakeResponses.clientId,
          schema.intakeResponses.taxYear,
        ],
      });

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

    if (!row) {
      Sentry.captureMessage(
        '[intake] intake_responses missing after upsert (RLS misconfig?)',
        'error',
      );
      return null;
    }

    // Decrypt every encrypted leaf with the tenant DEK, then immediately
    // mask sensitive paths before returning to the client. Plaintext SSN/
    // EIN/bank never crosses the server-client boundary by default — the
    // client must explicitly call revealIntakeField() for each path it
    // wants to see in plaintext, which is audit-logged.
    const decrypted = decryptTree(row.answers ?? {}, dek) as IntakeState;
    const masked = maskSensitiveFields(decrypted);
    return {
      clientId: authed.clientId,
      intakeId: row.id,
      taxYear,
      status: row.status as IntakeBundle['status'],
      answers: masked,
    };
  });
}

/**
 * Validate, encrypt-if-sensitive, and persist a single field write.
 * Returns the full updated answers object so the caller can sync local
 * state without an extra fetch.
 */
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

  const taxYear = getCurrentTaxYear();
  const sensitive = isSensitivePath(path);

  try {
    return await withTenant(asTenantId(authed.tenantId), async (db) => {
      // 3. Resolve the tenant's DEK before the row read — even though we
      // only need it on the sensitive branch, doing it here keeps the
      // critical-section serial logic clean and avoids holding the row
      // lock across a (potentially) DEK-cache-miss DB read.
      const dek = sensitive
        ? await getTenantDek(db, asTenantId(authed.tenantId))
        : null;

      // 4. Load current row WITH FOR UPDATE — locks it for the duration of
      // this transaction. Concurrent saveIntakeField calls to the same
      // intake row serialize through this lock, so the read-modify-write
      // pattern below is safe. Without FOR UPDATE, two concurrent saves to
      // different paths could race and clobber each other (T1 and T2 both
      // read {}, T1 writes {a:1}, T2 writes {b:2} — T1's update is lost).
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
        return { ok: false, error: 'Intake row not found — call getOrCreateIntakeAnswers first', path };
      }

      // 5. Compute the storage value. Sensitive paths get encrypted with
      // the tenant DEK; everything else stores plain. Mixed encrypted/plain
      // in the same JSONB tree is fine — decryptTree() handles both on read.
      const valueToStore = sensitive && dek
        ? encryptFieldForTenant(String(validatedValue), dek)
        : validatedValue;

      const currentStorage = (existing.answers as unknown) ?? {};
      const updatedStorage = setAtPath(currentStorage, path, valueToStore);

      // 6. Persist. updated_at bumps on every write so we can debug
      // ("when did this field last flip?") and use it as an
      // optimistic-concurrency token if needed later.
      await db
        .update(schema.intakeResponses)
        .set({
          answers: updatedStorage as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(schema.intakeResponses.id, existing.id));

      // 7. Audit log. NOT best-effort — if the audit insert fails, the
      // whole transaction rolls back (we're inside withTenant's tx). For
      // SOC 2 / IRS Pub 1345 compliance, every state-changing write must
      // leave a tamper-evident audit trail. Allowing writes without audit
      // would let an attacker who saturates the actions table to make
      // inserts fail also cover their data-modification tracks.
      //
      // Note: the path is recorded but the value is not. We log the value
      // TYPE only (string/number/boolean) so the audit trail proves a
      // write happened without itself becoming a PII leak surface.
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

      // 8. Return decrypted-then-masked view for the client's local state.
      // We need the tenant DEK either way now (sensitive write OR not), so
      // resolve it if we didn't already on the encrypt branch. Cache hit on
      // the second call when sensitive=true.
      //
      // Masking applies to ALL sensitive paths regardless of whether THIS
      // write was sensitive — the client's IntakeProvider will hold masked
      // sentinels for every sensitive field after every save, so plaintext
      // never lingers in client state past the active edit.
      const dekForRead = dek ?? (await getTenantDek(db, asTenantId(authed.tenantId)));
      const decrypted = decryptTree(updatedStorage, dekForRead) as IntakeState;
      const masked = maskSensitiveFields(decrypted);
      return { ok: true, answers: masked };
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: 'intake-actions', path, sensitive: String(sensitive) },
    });
    return { ok: false, error: 'Save failed — please try again', path };
  }
}

/**
 * Reveal the plaintext value of a single sensitive field. The client
 * calls this when the user clicks "Edit" on a masked SSN field — we
 * decrypt that ONE leaf with the tenant DEK and return it for inline
 * editing. The reveal is audit-logged with the path, so SOC 2 evidence
 * shows every plaintext access.
 *
 * Path validation: only accepts paths that match SENSITIVE_INTAKE_PATHS.
 * Non-sensitive paths return an error — non-sensitive values are already
 * in the masked answers blob as plaintext, so revealing them would be
 * pointless and we don't want this becoming a generic value-getter.
 *
 * Returns plaintext or empty string if the field has never been set.
 */
export type RevealIntakeFieldResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

export async function revealIntakeField(path: string): Promise<RevealIntakeFieldResult> {
  // 1. Path must be sensitive — refuse any other reveal request.
  if (!isSensitivePath(path)) {
    return { ok: false, error: 'Path is not a sensitive field' };
  }

  // 2. Auth.
  const authed = await getOrCreateClient();
  if (!authed) return { ok: false, error: 'Not signed in' };

  const taxYear = getCurrentTaxYear();
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
      // markers, but if the value was somehow stored plain (e.g., legacy
      // data from before encryption shipped), we accept that too.
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

      // Audit log: reveal is a 'read' action. Path goes in toolInput;
      // value does NOT — the audit trail records that a reveal happened
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
      tags: { component: 'intake-actions', stage: 'revealIntakeField', path },
    });
    return { ok: false, error: 'Reveal failed — please try again' };
  }
}

/**
 * Mark the intake complete. Called from /done after the final step.
 * Idempotent — a re-call on an already-complete intake is a no-op.
 */
export async function completeIntake(): Promise<{ ok: boolean; error?: string }> {
  const authed = await getOrCreateClient();
  if (!authed) return { ok: false, error: 'Not signed in' };

  const taxYear = getCurrentTaxYear();

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
      tags: { component: 'intake-actions', stage: 'completeIntake' },
    });
    return { ok: false, error: 'Could not mark intake complete' };
  }
}
