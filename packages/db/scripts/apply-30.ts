// scripts/apply-30.ts
//
// One-shot apply + smoke for migration 0030 (prospects table). Same
// pattern as apply-29: hand-applied SQL since the Drizzle journal is
// stale past idx 16.

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
  console.log(`${YELLOW}━━ apply-30 ━━${RESET}`);
  console.log(`Target: ${dbUrl.replace(/:[^:@]+@/, ':***@')}`);
  const sql = postgres(dbUrl, { max: 1, prepare: false });
  try {
    if (!SKIP_APPLY) {
      const ddl = readFileSync(
        path.resolve(__dirname, '../migrations/0030_prospects.sql'),
        'utf8',
      );
      console.log(`${DIM}Applying 0030_prospects.sql...${RESET}`);
      await sql.unsafe(ddl);
      console.log(`  ${GREEN}PASS${RESET}  migration applied`);
    }
    const tableRows = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'prospects'
    `;
    if (tableRows.length === 0) throw new Error('prospects table missing');
    console.log(`  ${GREEN}PASS${RESET}  table exists`);

    const idxRows = await sql<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes
       WHERE tablename = 'prospects' ORDER BY indexname
    `;
    const expected = [
      'prospects_email_idx',
      'prospects_firm_name_idx',
      'prospects_pkey',
      'prospects_status_idx',
      'prospects_submitted_at_idx',
    ];
    for (const e of expected) {
      if (!idxRows.find((r) => r.indexname === e)) {
        throw new Error(
          `missing index ${e} — got ${idxRows.map((r) => r.indexname).join(', ')}`,
        );
      }
    }
    console.log(`  ${GREEN}PASS${RESET}  all 5 indexes present`);

    // Smoke insert + check, wrapped in a transaction that always
    // rolls back — even if any assertion throws, no synthetic row
    // pollutes the real prospects queue (codex C12 R4 P3).
    // `bootstrap` invokes this script automatically; a partial
    // failure here previously left smoke-c12-<ts>@example.test
    // rows behind in the live lead table.
    const SMOKE_EMAIL = `smoke-c12-${Date.now()}@example.test`;
    let smokeOk = false;
    try {
      await sql`BEGIN`;
      await sql`
        INSERT INTO prospects (
          first_name, last_name, firm_name, designation, firm_size,
          tax_software, email, source, redacted_confirmed
        ) VALUES (
          ${'Smoke'},
          ${'Test'},
          ${`Smoke Firm ${Date.now()}`},
          ${'EA'},
          ${'Solo'},
          ${'OLT'},
          ${SMOKE_EMAIL},
          ${'cold email'},
          ${true}
        )
      `;
      const inserted = await sql<{ status: string; email: string }[]>`
        SELECT status, email FROM prospects WHERE email = ${SMOKE_EMAIL}
      `;
      if (inserted.length !== 1) {
        throw new Error(
          `insert smoke: expected 1 row, got ${inserted.length}`,
        );
      }
      if (inserted[0]!.status !== 'submitted') {
        throw new Error(
          `default status mismatch: got ${inserted[0]!.status}`,
        );
      }
      console.log(
        `  ${GREEN}PASS${RESET}  insert + default status ${DIM}status=submitted${RESET}`,
      );

      // CHECK constraint enforcement. The bad UPDATE will fail INSIDE
      // the transaction; Postgres aborts the txn. We need a savepoint
      // so we can catch + continue the txn for the cleanup ROLLBACK.
      await sql`SAVEPOINT before_check`;
      let rejectedBadStatus = false;
      try {
        await sql`UPDATE prospects SET status = ${'bogus'} WHERE email = ${SMOKE_EMAIL}`;
      } catch {
        rejectedBadStatus = true;
        await sql`ROLLBACK TO SAVEPOINT before_check`;
      }
      if (!rejectedBadStatus) {
        throw new Error('CHECK constraint did NOT reject bogus status');
      }
      console.log(`  ${GREEN}PASS${RESET}  status CHECK rejects bogus values`);

      smokeOk = true;
    } finally {
      // Always roll back the smoke transaction — never persist the
      // synthetic row, regardless of which assertion passed/failed.
      try {
        await sql`ROLLBACK`;
      } catch {
        // Tx might already be aborted; ignore.
      }
    }
    if (!smokeOk) {
      throw new Error('smoke assertions did not complete');
    }
    console.log(`  ${GREEN}PASS${RESET}  rollback cleaned up smoke row`);

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
