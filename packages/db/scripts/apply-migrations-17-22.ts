// Apply migrations 0017-0022 to the configured DATABASE_URL.
//
// Why this exists outside drizzle-kit:
//   The journal (meta/_journal.json) only tracks through 0016. 0017
//   and 0018 are hand-authored SQL files added without journal
//   updates; 0019-0022 likewise. drizzle-kit migrate refuses to run
//   them because they're not registered.
//
// This script reads each .sql file directly and runs it against the
// connected DB. Each migration file is idempotent (IF NOT EXISTS,
// DO-block guards on ADD CONSTRAINT, etc.), so re-running is safe.
//
// Usage:
//   bun run packages/db/scripts/apply-migrations-17-22.ts

/* eslint-disable no-console */

import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '../../../.env.local'), override: true });

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';

const MIGRATIONS = [
  '0017_documents_slot_id.sql',
  '0018_documents_merged_into.sql',
  '0019_firm_profile.sql',
  '0020_firm_patterns.sql',
  '0021_client_facts.sql',
  '0022_actions_crypto_chain.sql',
];

async function main(): Promise<number> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(`${RED}FATAL${RESET} DATABASE_URL not set`);
    return 2;
  }

  console.log(`${YELLOW}━━ apply-migrations-17-22 ━━${RESET}`);
  console.log(`Target: ${url.replace(/:[^@]*@/, ':***@')}`);
  console.log('');

  const sql = postgres(url, { max: 1 });

  const migrationsDir = path.resolve(__dirname, '..', 'migrations');

  for (const fname of MIGRATIONS) {
    const fullPath = path.join(migrationsDir, fname);
    process.stdout.write(`  ${DIM}${fname}${RESET} ... `);
    try {
      const ddl = await fs.readFile(fullPath, 'utf8');
      // Run as ONE statement so PG treats the whole file atomically.
      // Postgres handles multi-statement strings via the unsafe API;
      // we trust our own files (no user input).
      await sql.unsafe(ddl);
      console.log(`${GREEN}ok${RESET}`);
    } catch (err) {
      console.log(`${RED}FAIL${RESET}  ${(err as Error).message}`);
      await sql.end();
      return 1;
    }
  }

  console.log('');
  console.log(`${GREEN}━━ all ${MIGRATIONS.length} migrations applied ━━${RESET}`);

  // Quick sanity: verify the tables + functions exist.
  const tables = await sql<Array<{ table_name: string }>>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('firm_profile', 'firm_patterns', 'client_facts')
    ORDER BY table_name
  `;
  console.log(`Tables present: ${tables.map((t) => t.table_name).join(', ') || '(none)'}`);

  const fns = await sql<Array<{ proname: string }>>`
    SELECT proname FROM pg_proc
    WHERE proname IN ('verify_actions_chain', 'enforce_actions_chain', 'enforce_client_facts_bindings')
    ORDER BY proname
  `;
  console.log(`Functions present: ${fns.map((f) => f.proname).join(', ') || '(none)'}`);

  const cols = await sql<Array<{ column_name: string }>>`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'actions'
      AND column_name IN ('chain_seq', 'prev_hash', 'row_hash')
    ORDER BY column_name
  `;
  console.log(`actions chain cols: ${cols.map((c) => c.column_name).join(', ') || '(none)'}`);

  await sql.end();
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(`${RED}FATAL${RESET}`, e);
    process.exit(2);
  });
