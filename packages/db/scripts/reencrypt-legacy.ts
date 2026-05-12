// One-time re-encryption of legacy master-KEK-encrypted PII to per-tenant DEKs.
//
// CONTEXT
//   Pre-batch-9 production data was encrypted with the master KEK directly.
//   Batch 9 introduced per-tenant DEKs. To preserve compatibility,
//   `decryptIfMarkedForTenant` has a master-KEK fallback that fires when the
//   tenant-DEK decrypt path raises a GCM auth-tag mismatch.
//
//   The fallback is a SOC 2 audit smell: every read silently tries two keys.
//   This script ELIMINATES that smell by walking every encrypted leaf in
//   tenant-scoped JSONB (intake_responses, notice_responses) and re-encrypting
//   anything master-KEK-encrypted with the tenant's DEK.
//
//   Once this script reports `legacy: 0` across the entire DB, the fallback
//   in encryption.ts can be removed in a follow-up commit.
//
// USAGE
//   pnpm --filter @docket/db reencrypt-legacy --dry-run    # report what would change
//   pnpm --filter @docket/db reencrypt-legacy              # actually rewrite rows
//
// SAFETY
//   - Default mode is --dry-run-OFF. The script DOES write. Set --dry-run to
//     scan-only.
//   - Every per-tenant pass is wrapped in withTenant() — RLS still active
//     even though we're using getAdminDb() for the tenant-list scan.
//   - Per-row update is conditional: we only UPDATE if at least one leaf
//     was actually migrated. Untouched rows stay untouched.
//   - The actions table is append-only post-mig 0007, so this script does
//     NOT write audit entries (it's an admin migration, not application traffic).
//   - Idempotent: running twice does the right thing — second run finds
//     zero legacy blobs because round 1 cleaned everything.

import { eq, sql } from 'drizzle-orm';
import { asTenantId, type TenantId } from '@docket/shared';
import { getAdminDb, withTenant, disconnect } from '../src/client.js';
import { getTenantDek } from '../src/dek-cache.js';
import { deriveAAD } from '../src/encryption.js';
import { walkAndRewrite } from '../src/reencrypt-legacy-walker.js';
import { tenants, intakeResponses } from '../src/schema.js';

type Stats = {
  tenantsScanned: number;
  rowsScanned: number;
  rowsTouched: number;
  leavesScanned: number;
  legacyMigrated: number;
  alreadyTenant: number;
  errors: number;
};

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');

function log(...parts: unknown[]): void {
  console.log('[reencrypt-legacy]', ...parts);
}
function vlog(...parts: unknown[]): void {
  if (VERBOSE) console.log('[reencrypt-legacy]', ...parts);
}

// ────────────────────────────────────────────────────────────────
// Per-tenant pass.
// ────────────────────────────────────────────────────────────────

async function rewriteTenantData(
  tenantId: TenantId,
  stats: Stats,
): Promise<void> {
  await withTenant(tenantId, async (db) => {
    // First make sure the tenant has a DEK; provisions one if NULL.
    const dek = await getTenantDek(db, tenantId);

    // ── intake_responses ─────────────────────────────────────────
    // intake_responses leaves are AAD-bound to (tenantId, clientId,
    // taxYear, path) since the C1 commit that migrated saveIntakeField
    // to encryptFieldForTenantWithAAD. Pass an aadBuilder so the
    // walker recognizes AAD-bound leaves (counts them as already-tenant
    // and doesn't misclassify them as errors). Legacy master-KEK
    // leaves still get migrated to the AAD-LESS tenant DEK format
    // here — a follow-up commit (C3) will optionally re-encrypt those
    // legacy leaves with AAD in one pass; until then the read-side
    // 3-tier fallback covers them.
    const intakeRows = await db
      .select({
        id: intakeResponses.id,
        clientId: intakeResponses.clientId,
        taxYear: intakeResponses.taxYear,
        answers: intakeResponses.answers,
      })
      .from(intakeResponses);

    for (const row of intakeRows) {
      stats.rowsScanned += 1;
      const rowClientId = row.clientId;
      const rowTaxYear = row.taxYear;
      const aadBuilder = (leafPath: string): Buffer =>
        deriveAAD({
          tenantId,
          clientId: rowClientId,
          taxYear: rowTaxYear,
          path: leafPath,
        });
      const result = walkAndRewrite(row.answers, dek, aadBuilder);
      stats.leavesScanned += result.total;
      stats.legacyMigrated += result.changed;
      stats.alreadyTenant += result.alreadyTenant;
      stats.errors += result.errors;

      if (result.changed > 0) {
        vlog(
          `intake_responses ${row.id}: ${result.changed}/${result.total} leaves migrated`,
        );
        if (!DRY_RUN) {
          await db
            .update(intakeResponses)
            .set({
              answers: result.tree as typeof intakeResponses.$inferInsert.answers,
              updatedAt: new Date(),
            })
            .where(eq(intakeResponses.id, row.id));
        }
        stats.rowsTouched += 1;
      }
    }

    // notice_responses is Phase 2 — it doesn't have JSONB-encrypted fields
    // yet. When that table starts holding encrypted PII (notice draft body,
    // IRS account numbers, etc.) extend this script to walk it too.
  });
}

// ────────────────────────────────────────────────────────────────
// Entry point.
// ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE (will rewrite rows)'}`);

  if (!process.env.DATABASE_URL) {
    log('FATAL: DATABASE_URL not set.');
    process.exit(1);
  }
  if (!process.env.PII_ENCRYPTION_KEY) {
    log('FATAL: PII_ENCRYPTION_KEY not set. Master KEK is required to read legacy blobs.');
    process.exit(1);
  }

  const stats: Stats = {
    tenantsScanned: 0,
    rowsScanned: 0,
    rowsTouched: 0,
    leavesScanned: 0,
    legacyMigrated: 0,
    alreadyTenant: 0,
    errors: 0,
  };

  // Tenants is NOT RLS-scoped, so the admin client can list them all.
  const adminDb = getAdminDb();
  const tenantRows = await adminDb
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants)
    .orderBy(sql`${tenants.createdAt} ASC`);

  log(`Found ${tenantRows.length} tenants`);

  for (const t of tenantRows) {
    stats.tenantsScanned += 1;
    log(`Scanning tenant ${t.id} (${t.name})`);
    try {
      await rewriteTenantData(asTenantId(t.id), stats);
    } catch (err) {
      stats.errors += 1;
      log('ERROR processing tenant', t.id, err instanceof Error ? err.message : err);
    }
  }

  log('────────────────── SUMMARY ──────────────────');
  log(`Tenants scanned:     ${stats.tenantsScanned}`);
  log(`Rows scanned:        ${stats.rowsScanned}`);
  log(
    `Rows ${DRY_RUN ? 'would update' : 'updated'}:  ${stats.rowsTouched}`,
  );
  log(`Encrypted leaves:    ${stats.leavesScanned}`);
  log(`  on tenant DEK:     ${stats.alreadyTenant}`);
  log(`  legacy migrated:   ${stats.legacyMigrated}`);
  log(`Errors:              ${stats.errors}`);
  if (DRY_RUN) {
    log('Dry run only — no rows were modified. Re-run without --dry-run to apply.');
  } else if (stats.legacyMigrated > 0) {
    log('Migration complete. Re-run with --dry-run to confirm `legacy migrated: 0`.');
  } else {
    log(
      'No legacy blobs found. Safe to remove the master-KEK fallback in encryption.ts.',
    );
  }

  await disconnect();
  process.exit(stats.errors > 0 ? 1 : 0);
}

main().catch((err) => {
  log('FATAL', err);
  process.exit(1);
});
