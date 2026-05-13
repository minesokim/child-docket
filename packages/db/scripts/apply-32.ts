// scripts/apply-32.ts
//
// Apply + smoke for migration 0032 (client_memories table).
// Hand-applied SQL since the Drizzle journal is stale past idx 16.

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
  console.log(`${YELLOW}━━ apply-32 ━━${RESET}`);
  console.log(`Target: ${dbUrl.replace(/:[^:@]+@/, ':***@')}`);

  const sql = postgres(dbUrl, { max: 1, prepare: false });
  try {
    if (!SKIP_APPLY) {
      const ddl = readFileSync(
        path.resolve(__dirname, '../migrations/0032_client_memories.sql'),
        'utf8',
      );
      console.log(`${DIM}Applying 0032_client_memories.sql...${RESET}`);
      await sql.unsafe(ddl);
      console.log(`  ${GREEN}PASS${RESET}  migration applied`);
    }

    // Table exists
    const tableRows = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'client_memories'
    `;
    if (tableRows.length === 0) throw new Error('client_memories table missing');
    console.log(`  ${GREEN}PASS${RESET}  table exists`);

    // RLS enabled + forced
    const rlsRows = await sql<{ relrowsecurity: boolean; relforcerowsecurity: boolean }[]>`
      SELECT c.relrowsecurity, c.relforcerowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = 'client_memories'
    `;
    if (
      rlsRows.length === 0 ||
      !rlsRows[0]!.relrowsecurity ||
      !rlsRows[0]!.relforcerowsecurity
    ) {
      throw new Error('RLS not enabled+forced on client_memories');
    }
    console.log(`  ${GREEN}PASS${RESET}  RLS enabled + forced`);

    // Policy exists
    const policyRows = await sql<{ policyname: string }[]>`
      SELECT policyname FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'client_memories'
    `;
    if (!policyRows.find((p) => p.policyname === 'tenant_isolation_client_memories')) {
      throw new Error('tenant_isolation policy missing');
    }
    console.log(`  ${GREEN}PASS${RESET}  tenant_isolation policy present`);

    // Indexes
    const idxRows = await sql<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes
       WHERE tablename = 'client_memories' ORDER BY indexname
    `;
    const expectedIdx = [
      'client_memories_active_idx',
      'client_memories_client_idx',
      'client_memories_pkey',
      'client_memories_source_action_idx',
      'client_memories_tenant_recent_idx',
    ];
    for (const e of expectedIdx) {
      if (!idxRows.find((r) => r.indexname === e)) {
        throw new Error(`missing index ${e}`);
      }
    }
    console.log(`  ${GREEN}PASS${RESET}  all 5 indexes present`);

    // updated_at trigger
    const trgRows = await sql<{ trigger_name: string }[]>`
      SELECT trigger_name FROM information_schema.triggers
       WHERE event_object_table = 'client_memories'
         AND trigger_name = 'client_memories_updated_at'
    `;
    if (trgRows.length === 0) throw new Error('updated_at trigger missing');
    console.log(`  ${GREEN}PASS${RESET}  updated_at trigger present`);

    // Smoke insert + CHECKs, wrapped in always-rollback transaction.
    let smokeOk = false;
    try {
      await sql`BEGIN`;
      await sql`SET LOCAL app.bypass_rls = 'on'`;

      // Find an existing client to attach memories to. Use the
      // client's own tenant_id so the FK validates.
      const clientRows = await sql<{ id: string; tenant_id: string }[]>`
        SELECT id, tenant_id FROM clients LIMIT 1
      `;
      if (clientRows.length === 0) {
        console.log(`  ${YELLOW}SKIP${RESET}  smoke insert (no clients in DB)`);
        smokeOk = true;
      } else {
        const tenantId = clientRows[0]!.tenant_id;
        const clientId = clientRows[0]!.id;

        // Default insert
        await sql`
          INSERT INTO client_memories (tenant_id, client_id, text)
          VALUES (
            ${tenantId}::uuid,
            ${clientId}::uuid,
            ${'Daughter Lily starts UC Davis Aug 2026 (AOTC + 529 windowing)'}
          )
        `;
        const ins = await sql<
          { text: string; pinned: boolean; dismissed: boolean; source_kind: string; confidence: number }[]
        >`
          SELECT text, pinned, dismissed, source_kind, confidence
            FROM client_memories
           WHERE client_id = ${clientId}::uuid AND tenant_id = ${tenantId}::uuid
           ORDER BY created_at DESC
           LIMIT 1
        `;
        if (ins.length !== 1) throw new Error('memory insert failed');
        if (ins[0]!.source_kind !== 'manual' || ins[0]!.pinned || ins[0]!.dismissed || ins[0]!.confidence !== 1) {
          throw new Error(
            `defaults wrong: source=${ins[0]!.source_kind} pinned=${ins[0]!.pinned} ` +
              `dismissed=${ins[0]!.dismissed} conf=${ins[0]!.confidence}`,
          );
        }
        console.log(
          `  ${GREEN}PASS${RESET}  insert + defaults ` +
            `${DIM}source=manual, pinned=false, conf=1${RESET}`,
        );

        // CHECK rejects bad source_kind
        await sql`SAVEPOINT before_bad_kind`;
        let rejectedBadKind = false;
        try {
          await sql`
            INSERT INTO client_memories (tenant_id, client_id, text, source_kind)
            VALUES (${tenantId}::uuid, ${clientId}::uuid, ${'bad'}, ${'bogus_kind'})
          `;
        } catch {
          rejectedBadKind = true;
          await sql`ROLLBACK TO SAVEPOINT before_bad_kind`;
        }
        if (!rejectedBadKind) throw new Error('CHECK did not reject bogus source_kind');
        console.log(`  ${GREEN}PASS${RESET}  CHECK rejects bad source_kind`);

        // CHECK rejects empty text
        await sql`SAVEPOINT before_empty`;
        let rejectedEmpty = false;
        try {
          await sql`
            INSERT INTO client_memories (tenant_id, client_id, text)
            VALUES (${tenantId}::uuid, ${clientId}::uuid, ${''})
          `;
        } catch {
          rejectedEmpty = true;
          await sql`ROLLBACK TO SAVEPOINT before_empty`;
        }
        if (!rejectedEmpty) throw new Error('CHECK did not reject empty text');
        console.log(`  ${GREEN}PASS${RESET}  CHECK rejects empty text`);

        // CHECK rejects confidence out of [0,1]
        await sql`SAVEPOINT before_bad_conf`;
        let rejectedBadConf = false;
        try {
          await sql`
            INSERT INTO client_memories (tenant_id, client_id, text, confidence)
            VALUES (${tenantId}::uuid, ${clientId}::uuid, ${'x'}, ${1.5})
          `;
        } catch {
          rejectedBadConf = true;
          await sql`ROLLBACK TO SAVEPOINT before_bad_conf`;
        }
        if (!rejectedBadConf) throw new Error('CHECK did not reject confidence > 1');
        console.log(`  ${GREEN}PASS${RESET}  CHECK rejects confidence > 1`);

        smokeOk = true;
      }
    } finally {
      try {
        await sql`ROLLBACK`;
      } catch {
        // Tx may be aborted; ignore.
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
