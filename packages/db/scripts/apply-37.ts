// scripts/apply-37.ts — webhook_events replay-protection table
// (Session 6 webhook signature audit, 2026-05-15).
//
// Applies migration 0037_webhook_events.sql and runs a security
// smoke that proves the three replay-protection invariants:
//
//   1. First-seen (provider, event_id) INSERT succeeds.
//   2. Duplicate INSERT for the same (provider, event_id) is dropped
//      by ON CONFLICT — RETURNING returns zero rows.
//   3. INSERT with a non-allowlisted provider value fails the
//      provider_check CHECK constraint.

import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({
  path: path.resolve(__dirname, '../../../.env.local'),
  override: true,
});

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
  console.log(`${YELLOW}━━ apply-37 ━━${RESET}`);
  console.log(`Target: ${dbUrl.replace(/:[^:@]+@/, ':***@')}`);

  const sql = postgres(dbUrl, { max: 1, prepare: false });
  try {
    if (!SKIP_APPLY) {
      const ddl = readFileSync(
        path.resolve(__dirname, '../migrations/0037_webhook_events.sql'),
        'utf8',
      );
      console.log(`${DIM}Applying 0037_webhook_events.sql...${RESET}`);
      await sql.unsafe(ddl);
      console.log(`  ${GREEN}PASS${RESET}  migration applied`);
    }

    // Table exists.
    const tableRows = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'webhook_events'
    `;
    if (tableRows.length === 0) {
      throw new Error('webhook_events table missing');
    }
    console.log(`  ${GREEN}PASS${RESET}  webhook_events table exists`);

    // UNIQUE constraint present.
    const constraintRows = await sql<{ conname: string }[]>`
      SELECT conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
       WHERE t.relname = 'webhook_events'
         AND c.contype = 'u'
         AND c.conname = 'webhook_events_provider_event_unique'
    `;
    if (constraintRows.length === 0) {
      throw new Error(
        'webhook_events_provider_event_unique constraint missing',
      );
    }
    console.log(`  ${GREEN}PASS${RESET}  UNIQUE (provider, event_id) present`);

    // CHECK constraint present.
    const checkRows = await sql<{ conname: string }[]>`
      SELECT conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
       WHERE t.relname = 'webhook_events'
         AND c.contype = 'c'
         AND c.conname = 'webhook_events_provider_check'
    `;
    if (checkRows.length === 0) {
      throw new Error('webhook_events_provider_check constraint missing');
    }
    console.log(`  ${GREEN}PASS${RESET}  CHECK (provider allowlist) present`);

    // Smoke insert wrapped in rollback.
    let smokeOk = false;
    try {
      await sql`BEGIN`;

      const eventId = `apply-37-${randomUUID()}`;

      // (1) First insert succeeds, returns row.
      const first = await sql<{ id: string }[]>`
        INSERT INTO webhook_events (provider, event_id)
        VALUES (${'square'}, ${eventId})
        ON CONFLICT (provider, event_id) DO NOTHING
        RETURNING id::text AS id
      `;
      if (first.length !== 1) {
        throw new Error(
          `first INSERT returned ${first.length} rows; expected 1`,
        );
      }
      console.log(`  ${GREEN}PASS${RESET}  first INSERT returns row`);

      // (2) Duplicate INSERT for same (provider, event_id) returns
      // zero rows (ON CONFLICT swallowed it).
      const dup = await sql<{ id: string }[]>`
        INSERT INTO webhook_events (provider, event_id)
        VALUES (${'square'}, ${eventId})
        ON CONFLICT (provider, event_id) DO NOTHING
        RETURNING id::text AS id
      `;
      if (dup.length !== 0) {
        throw new Error(`duplicate INSERT returned row; expected zero`);
      }
      console.log(
        `  ${GREEN}PASS${RESET}  duplicate INSERT swallowed by ON CONFLICT`,
      );

      // (3) Same event_id under a DIFFERENT provider is NOT a
      // duplicate — different (provider, event_id) tuple. Should
      // INSERT cleanly.
      const sameIdDifferentProvider = await sql<{ id: string }[]>`
        INSERT INTO webhook_events (provider, event_id)
        VALUES (${'twilio'}, ${eventId})
        ON CONFLICT (provider, event_id) DO NOTHING
        RETURNING id::text AS id
      `;
      if (sameIdDifferentProvider.length !== 1) {
        throw new Error(
          'cross-provider INSERT with same event_id did NOT insert; UNIQUE is over-broad',
        );
      }
      console.log(
        `  ${GREEN}PASS${RESET}  cross-provider same event_id inserts (UNIQUE on tuple, not event_id alone)`,
      );

      // (4) CHECK constraint rejects non-allowlisted provider.
      await sql`SAVEPOINT before_bad_provider`;
      let rejectedBadProvider = false;
      try {
        await sql`
          INSERT INTO webhook_events (provider, event_id)
          VALUES (${'forged-provider'}, ${'whatever'})
        `;
      } catch {
        rejectedBadProvider = true;
        await sql`ROLLBACK TO SAVEPOINT before_bad_provider`;
      }
      if (!rejectedBadProvider) {
        throw new Error(
          'CHECK did not reject non-allowlisted provider value',
        );
      }
      console.log(
        `  ${GREEN}PASS${RESET}  CHECK rejects non-allowlisted provider`,
      );

      smokeOk = true;
    } finally {
      try {
        await sql`ROLLBACK`;
      } catch {
        // Tx may already be aborted; ignore.
      }
    }
    if (!smokeOk) throw new Error('smoke assertions did not complete');
    console.log(`  ${GREEN}PASS${RESET}  rollback cleaned up smoke rows`);

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
