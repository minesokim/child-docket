// Apply just migrations 0026 + 0027.
// One-shot: the apply-migrations-17-22 script chains all migrations and
// fails when a non-idempotent earlier migration (CREATE POLICY without
// IF NOT EXISTS) hits an already-applied state. 0026 + 0027 are
// fully idempotent (CREATE INDEX IF NOT EXISTS, ALTER TYPE … ADD VALUE
// IF NOT EXISTS) so they apply cleanly in isolation.

/* eslint-disable no-console */

import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '../../../.env.local'), override: true });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('FATAL: DATABASE_URL not set');
  process.exit(2);
}

const sql = postgres(url, { max: 1 });

const migrationsDir = path.resolve(__dirname, '..', 'migrations');
const FILES = [
  '0026_signatures_envelope_id_idx.sql',
  '0027_signature_status_kba_failed.sql',
];

for (const fname of FILES) {
  const full = path.join(migrationsDir, fname);
  console.log(`applying ${fname}`);
  try {
    const ddl = await fs.readFile(full, 'utf8');
    await sql.unsafe(ddl);
    console.log(`  ok`);
  } catch (e) {
    console.error(`  FAIL: ${(e as Error).message}`);
    await sql.end();
    process.exit(1);
  }
}

await sql.end();
console.log('done');
