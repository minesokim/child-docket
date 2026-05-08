// Seed fixtures into a database + R2 bucket.
//
// Used by:
//   - Staging environment provisioning (CI / local dev)
//   - Smoke tests that need known data ("upload this fixture, expect that result")
//   - Agent eval harnesses (input fixtures → expected output)
//
// SAFETY: refuses to run if DATABASE_URL points at a known prod host
// pattern. Devs can override with FORCE_SEED_PROD=1, but this should
// NEVER be used. The check is the last line of defense between
// fixture seeding and "we just nuked Antonio's DB."

/* eslint-disable no-console */

import { eq, and, inArray } from 'drizzle-orm';
import {
  schema,
  type DocketDb,
} from '@docket/db';
import { putObject, deleteObject } from '@docket/storage';

import {
  fixtureTenant,
  fixtureUsers,
  fixtureClients,
  fixtureEngagements,
  fixtureIntakeAnswers,
  fixtureDocuments,
} from './fixtures.js';
import { PLACEHOLDER_PNG_BYTES } from './binaries.js';

// ────────────────────────────────────────────────────────────────
// Production-safety guard — refuse to run against prod hosts.
//
// These patterns match the DB hosts we know are prod. Add to this list
// as we add more environments. The list is allowlist-shaped: matching
// hosts are REJECTED. Unknown hosts get a warning + run.
// ────────────────────────────────────────────────────────────────
const PROD_HOST_PATTERNS = [
  /^ep-twilight-violet-anb70ud4-pooler\.c-6\.us-east-1\.aws\.neon\.tech$/,
  // Add additional prod hosts here as new environments come online.
];

function assertNotProduction(): void {
  if (process.env.FORCE_SEED_PROD === '1') {
    console.warn(
      '[test-fixtures] FORCE_SEED_PROD=1 — bypassing prod guard. THIS IS DANGEROUS.',
    );
    return;
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL not set — cannot determine target environment');
  }
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error('DATABASE_URL is not parseable as URL');
  }
  for (const pattern of PROD_HOST_PATTERNS) {
    if (pattern.test(host)) {
      throw new Error(
        `[test-fixtures] REFUSING to seed against production host ${host}. ` +
          `If you really need to (you don't), set FORCE_SEED_PROD=1.`,
      );
    }
  }
}

// ────────────────────────────────────────────────────────────────
// Seed.
//
// Idempotent: existing fixture rows (matched by hardcoded UUIDs)
// are upserted, not duplicated. Safe to run repeatedly against the
// same staging DB.
// ────────────────────────────────────────────────────────────────

export type SeedFixturesResult = {
  inserted: {
    tenants: number;
    users: number;
    clients: number;
    engagements: number;
    intakeResponses: number;
    documents: number;
  };
  uploaded: {
    r2Objects: number;
  };
};

export type SeedFixturesOptions = {
  /**
   * Skip uploading binary blobs to R2. Useful when seeding a DB-only
   * staging branch where R2 isn't configured. Document rows still get
   * inserted with their `storage_key`, but the underlying R2 object
   * won't exist.
   */
  skipR2?: boolean;
};

export async function seedFixtures(
  db: DocketDb,
  opts: SeedFixturesOptions = {},
): Promise<SeedFixturesResult> {
  assertNotProduction();

  const result: SeedFixturesResult = {
    inserted: {
      tenants: 0,
      users: 0,
      clients: 0,
      engagements: 0,
      intakeResponses: 0,
      documents: 0,
    },
    uploaded: { r2Objects: 0 },
  };

  // ─── Tenant ───
  await db
    .insert(schema.tenants)
    .values({
      id: fixtureTenant.id,
      name: fixtureTenant.name,
      slug: fixtureTenant.slug,
      timezone: fixtureTenant.timezone,
      defaultTrustLevel: fixtureTenant.defaultTrustLevel,
      bedrockEnabled: fixtureTenant.bedrockEnabled,
      clerkOrgId: fixtureTenant.clerkOrgId,
    })
    .onConflictDoNothing({ target: schema.tenants.id });
  result.inserted.tenants = 1;

  // ─── Users ───
  for (const user of Object.values(fixtureUsers)) {
    await db
      .insert(schema.users)
      .values({
        id: user.id,
        tenantId: user.tenantId,
        clerkUserId: user.clerkUserId,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
      })
      .onConflictDoNothing({ target: schema.users.id });
    result.inserted.users++;
  }

  // ─── Clients ───
  for (const client of Object.values(fixtureClients)) {
    await db
      .insert(schema.clients)
      .values({
        id: client.id,
        tenantId: client.tenantId,
        clerkUserId: client.clerkUserId,
        fullName: client.fullName,
        email: client.email,
        phone: client.phone,
        state: client.state,
        preferredLanguage: client.preferredLanguage,
        intakeStatus: client.intakeStatus,
        kycStatus: client.kycStatus,
      })
      .onConflictDoNothing({ target: schema.clients.id });
    result.inserted.clients++;
  }

  // ─── Engagements ───
  for (const engagement of Object.values(fixtureEngagements)) {
    await db
      .insert(schema.engagements)
      .values({
        id: engagement.id,
        tenantId: engagement.tenantId,
        clientId: engagement.clientId,
        type: engagement.type,
        status: engagement.status,
        taxYear: engagement.taxYear,
      })
      .onConflictDoNothing({ target: schema.engagements.id });
    result.inserted.engagements++;
  }

  // ─── Intake responses (PLAINTEXT in fixtures) ───
  //
  // Real prod intake_responses rows have specific fields encrypted via
  // encryptFieldForTenant + the per-tenant DEK. Fixtures use the IRS-
  // reserved 000-XX-XXXX SSN block (legitimately fake), so encryption
  // is unnecessary AND would fight tests that want to read the values
  // back. Fixtures store plaintext; tests that need to exercise the
  // encryption path explicitly wrap fields with encryptFieldForTenant.
  //
  // decryptTree() in the read path passes unencrypted values through
  // unchanged (see encryption.ts), so reads still work.
  //
  // Map: clientKey ('alice'|'bob'|'carol') → clientId
  const clientKeyById = new Map<string, string>();
  for (const [key, client] of Object.entries(fixtureClients)) {
    clientKeyById.set(key, client.id);
  }
  for (const [clientKey, answers] of Object.entries(fixtureIntakeAnswers)) {
    const clientId = clientKeyById.get(clientKey);
    if (!clientId) continue;
    await db
      .insert(schema.intakeResponses)
      .values({
        tenantId: fixtureTenant.id,
        clientId,
        taxYear: 2025,
        answers: answers as Record<string, unknown>,
      })
      .onConflictDoNothing({
        target: [
          schema.intakeResponses.tenantId,
          schema.intakeResponses.clientId,
          schema.intakeResponses.taxYear,
        ],
      });
    result.inserted.intakeResponses++;
  }

  // ─── Documents (R2 upload + DB row) ───
  for (const doc of Object.values(fixtureDocuments)) {
    if (!opts.skipR2) {
      await putObject({
        storageKey: doc.storageKey,
        body: PLACEHOLDER_PNG_BYTES,
        mimeType: doc.mimeType,
      });
      result.uploaded.r2Objects++;
    }

    await db
      .insert(schema.documents)
      .values({
        id: doc.id,
        tenantId: doc.tenantId,
        clientId: doc.clientId,
        storageKey: doc.storageKey,
        originalFilename: doc.originalFilename,
        mimeType: doc.mimeType,
        sizeBytes: doc.sizeBytes,
        parsePhase: doc.parsePhase,
        aiClassification: doc.aiClassification,
        aiConfidence: doc.aiConfidence,
        aiLegibility: doc.aiLegibility,
        aiSuggestedFilename: doc.aiSuggestedFilename,
        finalFilename: doc.finalFilename,
        binarized: doc.binarized,
        slotId: doc.slotId,
      })
      .onConflictDoNothing({ target: schema.documents.id });
    result.inserted.documents++;
  }

  return result;
}

// ────────────────────────────────────────────────────────────────
// Cleanup.
//
// HARD-DELETE in dev only — our soft-delete-in-prod policy lands in
// V1.5 (per PRODUCTION-READINESS §D). For now, dev tests want hard
// DELETE so re-seeding starts from a clean slate.
//
// CASCADE order matters because of FKs:
//   documents → engagements → intake_responses → clients → users → tenant
//
// Safer than relying on FK CASCADE because it gives explicit row counts
// for assertions in test setup/teardown.
// ────────────────────────────────────────────────────────────────

export type CleanupFixturesResult = {
  deleted: {
    documents: number;
    engagements: number;
    intakeResponses: number;
    clients: number;
    users: number;
    tenants: number;
    r2Objects: number;
  };
};

export type CleanupFixturesOptions = {
  /**
   * Hard DELETE rather than soft (deleted_at = now()). Default true for
   * fixtures since we want the next seed to start from zero.
   */
  hardDelete?: boolean;
  /** Skip R2 deletion (useful if R2 isn't configured for this env). */
  skipR2?: boolean;
};

export async function cleanupFixtures(
  db: DocketDb,
  opts: CleanupFixturesOptions = {},
): Promise<CleanupFixturesResult> {
  assertNotProduction();

  if (opts.hardDelete === false) {
    throw new Error(
      'cleanupFixtures soft-delete path not yet implemented (V1.5). Pass hardDelete: true.',
    );
  }

  const result: CleanupFixturesResult = {
    deleted: {
      documents: 0,
      engagements: 0,
      intakeResponses: 0,
      clients: 0,
      users: 0,
      tenants: 0,
      r2Objects: 0,
    },
  };

  // R2 cleanup first (safe even if DB delete fails)
  if (!opts.skipR2) {
    for (const doc of Object.values(fixtureDocuments)) {
      try {
        await deleteObject({ storageKey: doc.storageKey });
        result.deleted.r2Objects++;
      } catch (err) {
        // Tolerate "object not found" — fixtures may have been
        // partial-seeded. Log everything else.
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes('NoSuchKey') && !msg.includes('not found')) {
          console.warn(
            `[test-fixtures] R2 delete failed for ${doc.storageKey}: ${msg}`,
          );
        }
      }
    }
  }

  // DB cleanup in dependency order.
  const docIds = Object.values(fixtureDocuments).map((d) => d.id);
  const docDeleted = await db
    .delete(schema.documents)
    .where(inArray(schema.documents.id, docIds))
    .returning({ id: schema.documents.id });
  result.deleted.documents = docDeleted.length;

  const engagementIds = Object.values(fixtureEngagements).map((e) => e.id);
  const engagementDeleted = await db
    .delete(schema.engagements)
    .where(inArray(schema.engagements.id, engagementIds))
    .returning({ id: schema.engagements.id });
  result.deleted.engagements = engagementDeleted.length;

  const clientIds = Object.values(fixtureClients).map((c) => c.id);
  const intakeDeleted = await db
    .delete(schema.intakeResponses)
    .where(
      and(
        eq(schema.intakeResponses.tenantId, fixtureTenant.id),
        inArray(schema.intakeResponses.clientId, clientIds),
      ),
    )
    .returning({ id: schema.intakeResponses.id });
  result.deleted.intakeResponses = intakeDeleted.length;

  const clientDeleted = await db
    .delete(schema.clients)
    .where(inArray(schema.clients.id, clientIds))
    .returning({ id: schema.clients.id });
  result.deleted.clients = clientDeleted.length;

  const userIds = Object.values(fixtureUsers).map((u) => u.id);
  const userDeleted = await db
    .delete(schema.users)
    .where(inArray(schema.users.id, userIds))
    .returning({ id: schema.users.id });
  result.deleted.users = userDeleted.length;

  const tenantDeleted = await db
    .delete(schema.tenants)
    .where(eq(schema.tenants.id, fixtureTenant.id))
    .returning({ id: schema.tenants.id });
  result.deleted.tenants = tenantDeleted.length;

  return result;
}
