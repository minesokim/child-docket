// scripts/apply-29.ts
//
// One-shot apply + smoke for migration 0029 (discovery_scans table).
// Follows the same pattern as apply-28.ts: the Drizzle journal is
// out-of-date past idx 16, so post-0016 migrations are applied
// directly via the postgres client + verified with a focused smoke
// right after.
//
// USAGE
//   bun run packages/db/scripts/apply-29.ts                # apply + smoke
//   bun run packages/db/scripts/apply-29.ts --skip-apply   # smoke only
//
// FRESH-ENV BOOTSTRAP — extend the bootstrap chain in package.json
// to include this file alongside apply-28.ts.
//
// SAFETY
//   - Migration 0029 is purely additive: CREATE TABLE IF NOT EXISTS
//     + CREATE INDEX IF NOT EXISTS + idempotent ENUM creation via
//     DO $$ ... EXCEPTION WHEN duplicate_object. Re-running against
//     an already-migrated DB is a no-op.
//   - Smoke creates and tears down a synthetic discovery_scan row
//     in a transaction wrapped in try/finally so partial state
//     never leaks.
//   - Requires DATABASE_URL + PII_ENCRYPTION_KEY (the latter only
//     because @docket/db boots through the encryption module).

import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '../../../.env.local'), override: true });

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';

const SKIP_APPLY = process.argv.includes('--skip-apply');

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error(`${RED}FATAL${RESET}: DATABASE_URL not set`);
    process.exit(2);
  }

  console.log(`${YELLOW}━━ apply-29 ━━${RESET}`);
  console.log(`Target: ${dbUrl.replace(/:[^:@]+@/, ':***@')}`);

  const sql = postgres(dbUrl, { max: 1, prepare: false });

  try {
    // 1. Apply migration 0029 (unless skipped).
    if (!SKIP_APPLY) {
      const migrationPath = path.resolve(
        __dirname,
        '../migrations/0029_discovery_scans.sql',
      );
      const ddl = readFileSync(migrationPath, 'utf8');
      console.log(`${DIM}Applying ${path.basename(migrationPath)}...${RESET}`);
      await sql.unsafe(ddl);
      console.log(`  ${GREEN}PASS${RESET}  migration applied`);
    } else {
      console.log(`${DIM}Skipping apply (--skip-apply); smoke only${RESET}`);
    }

    // 2. Verify table exists.
    const tableRows = await sql<{ table_name: string }[]>`
      SELECT table_name
        FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = 'discovery_scans'
    `;
    if (tableRows.length === 0) {
      throw new Error('discovery_scans table missing after migration');
    }
    console.log(`  ${GREEN}PASS${RESET}  table exists`);

    // 3. Verify status enum has all 6 values.
    const enumRows = await sql<{ enumlabel: string }[]>`
      SELECT enumlabel
        FROM pg_enum
        JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
       WHERE pg_type.typname = 'discovery_scan_status'
       ORDER BY enumsortorder
    `;
    const expected = ['rendered', 'delivered', 'opened', 'downloaded', 'bounced', 'failed'];
    const actual = enumRows.map((r) => r.enumlabel);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(
        `enum values mismatch — got: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)}`,
      );
    }
    console.log(`  ${GREEN}PASS${RESET}  enum values: ${DIM}${actual.join(', ')}${RESET}`);

    // 4. Verify RLS enabled + FORCE.
    const rlsRows = await sql<
      { relrowsecurity: boolean; relforcerowsecurity: boolean }[]
    >`
      SELECT relrowsecurity, relforcerowsecurity
        FROM pg_class
       WHERE relname = 'discovery_scans'
    `;
    if (!rlsRows[0]?.relrowsecurity || !rlsRows[0]?.relforcerowsecurity) {
      throw new Error(
        `RLS not fully enabled — relrowsecurity=${rlsRows[0]?.relrowsecurity}, relforcerowsecurity=${rlsRows[0]?.relforcerowsecurity}`,
      );
    }
    console.log(`  ${GREEN}PASS${RESET}  RLS enabled + FORCE`);

    // 5. Verify the 4 indexes were created.
    const idxRows = await sql<{ indexname: string }[]>`
      SELECT indexname
        FROM pg_indexes
       WHERE tablename = 'discovery_scans'
       ORDER BY indexname
    `;
    const idxNames = idxRows.map((r) => r.indexname);
    const expectedIdx = [
      'discovery_scans_email_id_uniq',
      'discovery_scans_pkey',
      'discovery_scans_tenant_actions_idx',
      'discovery_scans_tenant_client_idx',
      'discovery_scans_tenant_created_at_idx',
      'discovery_scans_tenant_idx',
      'discovery_scans_tenant_status_idx',
    ];
    for (const expected of expectedIdx) {
      if (!idxNames.includes(expected)) {
        throw new Error(`index missing: ${expected} (got: ${idxNames.join(', ')})`);
      }
    }
    console.log(
      `  ${GREEN}PASS${RESET}  all ${expectedIdx.length} indexes present (incl pkey)`,
    );

    // 6. Verify the updated_at trigger.
    const triggerRows = await sql<{ trigger_name: string }[]>`
      SELECT trigger_name
        FROM information_schema.triggers
       WHERE event_object_table = 'discovery_scans'
         AND trigger_name = 'discovery_scans_updated_at'
    `;
    if (triggerRows.length === 0) {
      throw new Error('discovery_scans_updated_at trigger missing');
    }
    console.log(`  ${GREEN}PASS${RESET}  updated_at trigger present`);

    // 7. Smoke insert + retrieve + delete with RLS enforcement.
    const SMOKE_PREFIX = `smoke-c11-${Date.now()}`;
    console.log(`${DIM}Smoke: prefix=${SMOKE_PREFIX}${RESET}`);
    try {
      // Need a real tenant to satisfy the FK. Grab any existing one.
      const tenantRows = await sql<{ id: string }[]>`
        SELECT id::text AS id FROM tenants LIMIT 1
      `;
      const tenantId = tenantRows[0]?.id;
      if (!tenantId) {
        console.log(
          `  ${YELLOW}SKIP${RESET}  no tenants in DB — smoke insert skipped. Run seed to enable full smoke.`,
        );
      } else {
        // postgres-js prepares each tagged template as a single
        // statement; combining BEGIN + SELECT + INSERT in one
        // template fails with "cannot insert multiple commands into
        // a prepared statement". Split into separate calls.
        await sql`BEGIN`;
        await sql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
        await sql`
          INSERT INTO discovery_scans (
            tenant_id, storage_key, pdf_bytes, recipient_email,
            firm_name, tax_year, total_surfaced_dollars,
            positions_count, refused_count, highest_tier,
            trust_gate_allowed, url_expires_at
          ) VALUES (
            ${tenantId}::uuid,
            ${`${SMOKE_PREFIX}-storage-key`},
            ${33718},
            ${'smoke@example.test'},
            ${`${SMOKE_PREFIX}-firm`},
            ${2024},
            ${43400},
            ${8},
            ${3},
            ${3},
            ${false},
            ${new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString()}
          )
        `;
        const inserted = await sql<{
          id: string;
          status: string;
          firm_name: string;
        }[]>`
          SELECT id::text AS id, status::text AS status, firm_name
            FROM discovery_scans
           WHERE firm_name = ${`${SMOKE_PREFIX}-firm`}
        `;
        if (inserted.length !== 1) {
          throw new Error(`insert smoke: expected 1 row, got ${inserted.length}`);
        }
        if (inserted[0]!.status !== 'rendered') {
          throw new Error(
            `default status mismatch: got ${inserted[0]!.status}, expected 'rendered'`,
          );
        }
        console.log(
          `  ${GREEN}PASS${RESET}  insert + RLS-scoped select ${DIM}status=${inserted[0]!.status}${RESET}`,
        );
        await sql`ROLLBACK`;
        // Verify the rollback worked — set tenant scope on fresh tx
        // (ROLLBACK ends the previous transaction so SET LOCAL no
        // longer applies).
        await sql`BEGIN`;
        await sql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
        const afterRollback = await sql<{ count: string }[]>`
          SELECT COUNT(*)::text AS count
            FROM discovery_scans
           WHERE firm_name = ${`${SMOKE_PREFIX}-firm`}
        `;
        await sql`ROLLBACK`;
        if (afterRollback[0]?.count !== '0') {
          throw new Error(
            `rollback failed — ${afterRollback[0]?.count} rows survived`,
          );
        }
        console.log(`  ${GREEN}PASS${RESET}  rollback cleaned up smoke row`);
      }
    } catch (err) {
      // Best-effort rollback
      try {
        await sql`ROLLBACK`;
      } catch {}
      throw err;
    }

    console.log(`${GREEN}━━ all checks passed ━━${RESET}`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(`${RED}FATAL${RESET}: ${err.message}`);
  console.error(err);
  process.exit(1);
});
