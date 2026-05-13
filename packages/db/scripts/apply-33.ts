// scripts/apply-33.ts
//
// Apply + smoke for migration 0033 (nudges + nudge_rules tables).
// Verifies: tables exist, RLS on both, policies installed, triggers
// installed, CHECKs work, smoke insert/dedup works.

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

const TABLES = ['nudge_rules', 'nudges'];

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error(`${RED}FATAL${RESET}: DATABASE_URL not set`);
    process.exit(2);
  }
  console.log(`${YELLOW}━━ apply-33 ━━${RESET}`);
  console.log(`Target: ${dbUrl.replace(/:[^:@]+@/, ':***@')}`);

  const sql = postgres(dbUrl, { max: 1, prepare: false });
  try {
    if (!SKIP_APPLY) {
      const ddl = readFileSync(
        path.resolve(__dirname, '../migrations/0033_nudges.sql'),
        'utf8',
      );
      console.log(`${DIM}Applying 0033_nudges.sql...${RESET}`);
      await sql.unsafe(ddl);
      console.log(`  ${GREEN}PASS${RESET}  migration applied`);
    }

    // Both tables exist
    const tableRows = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY(${TABLES})
       ORDER BY table_name
    `;
    if (tableRows.length !== TABLES.length) {
      const got = tableRows.map((r) => r.table_name);
      const missing = TABLES.filter((t) => !got.includes(t));
      throw new Error(`missing tables: ${missing.join(', ')}`);
    }
    console.log(`  ${GREEN}PASS${RESET}  both tables exist`);

    // RLS enabled + forced on both
    const rlsRows = await sql<
      { relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }[]
    >`
      SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = ANY(${TABLES})
    `;
    for (const row of rlsRows) {
      if (!row.relrowsecurity || !row.relforcerowsecurity) {
        throw new Error(`RLS not enabled+forced on ${row.relname}`);
      }
    }
    console.log(`  ${GREEN}PASS${RESET}  RLS enabled + forced on both`);

    // Tenant isolation policies
    const policyRows = await sql<{ tablename: string; policyname: string }[]>`
      SELECT tablename, policyname FROM pg_policies
       WHERE schemaname = 'public' AND tablename = ANY(${TABLES})
    `;
    for (const t of TABLES) {
      if (!policyRows.find((p) => p.tablename === t && p.policyname.startsWith('tenant_isolation_'))) {
        throw new Error(`missing tenant_isolation policy on ${t}`);
      }
    }
    console.log(`  ${GREEN}PASS${RESET}  tenant_isolation policies present`);

    // updated_at triggers
    const trgRows = await sql<{ event_object_table: string; trigger_name: string }[]>`
      SELECT event_object_table, trigger_name
        FROM information_schema.triggers
       WHERE event_object_schema = 'public'
         AND event_object_table = ANY(${TABLES})
         AND trigger_name LIKE '%updated_at%'
    `;
    for (const t of TABLES) {
      if (!trgRows.find((r) => r.event_object_table === t)) {
        throw new Error(`missing updated_at trigger on ${t}`);
      }
    }
    console.log(`  ${GREEN}PASS${RESET}  updated_at triggers present on both`);

    // Smoke insert wrapped in always-rollback transaction.
    let smokeOk = false;
    try {
      await sql`BEGIN`;
      await sql`SET LOCAL app.bypass_rls = 'on'`;

      const clientRows = await sql<{ id: string; tenant_id: string }[]>`
        SELECT id, tenant_id FROM clients LIMIT 1
      `;
      if (clientRows.length === 0) {
        console.log(`  ${YELLOW}SKIP${RESET}  smoke insert (no clients in DB)`);
        smokeOk = true;
      } else {
        const tenantId = clientRows[0]!.tenant_id;
        const clientId = clientRows[0]!.id;

        // Create a nudge rule.
        const ruleInsert = await sql<{ id: string }[]>`
          INSERT INTO nudge_rules (tenant_id, trigger_class, trigger_key)
          VALUES (${tenantId}::uuid, ${'milestone'}, ${'business_revenue_250k'})
          RETURNING id
        `;
        const ruleId = ruleInsert[0]!.id;
        console.log(`  ${GREEN}PASS${RESET}  nudge_rules insert`);

        // CHECK rejects bad trigger_class on nudge_rules.
        await sql`SAVEPOINT before_bad_class`;
        let rejectedBadClass = false;
        try {
          await sql`
            INSERT INTO nudge_rules (tenant_id, trigger_class, trigger_key)
            VALUES (${tenantId}::uuid, ${'bogus_class'}, ${'x'})
          `;
        } catch {
          rejectedBadClass = true;
          await sql`ROLLBACK TO SAVEPOINT before_bad_class`;
        }
        if (!rejectedBadClass) {
          throw new Error('CHECK did not reject bogus trigger_class');
        }
        console.log(`  ${GREEN}PASS${RESET}  trigger_class CHECK enforces enum`);

        // UNIQUE on (tenant_id, trigger_class, trigger_key).
        await sql`SAVEPOINT before_dup`;
        let rejectedDup = false;
        try {
          await sql`
            INSERT INTO nudge_rules (tenant_id, trigger_class, trigger_key)
            VALUES (${tenantId}::uuid, ${'milestone'}, ${'business_revenue_250k'})
          `;
        } catch {
          rejectedDup = true;
          await sql`ROLLBACK TO SAVEPOINT before_dup`;
        }
        if (!rejectedDup) {
          throw new Error('UNIQUE constraint did not reject duplicate (tenant, class, key)');
        }
        console.log(`  ${GREEN}PASS${RESET}  nudge_rules UNIQUE (tenant, class, key)`);

        // Insert a nudge tied to the rule.
        await sql`
          INSERT INTO nudges (
            tenant_id, client_id, rule_id, trigger_class, trigger_key,
            title, body, draft_outreach, recommended_channel, confidence
          ) VALUES (
            ${tenantId}::uuid,
            ${clientId}::uuid,
            ${ruleId}::uuid,
            ${'milestone'},
            ${'business_revenue_250k'},
            ${"Patel LLC's business revenue crossed $250K · S-corp election conversation"},
            ${'Patel LLC reported $267K revenue for Q3. Above the S-corp election threshold; conversation about reasonable comp + AAA review recommended before year-end.'},
            ${'Hi John, I wanted to flag something. Your Q3 financials show Patel LLC crossed the $250K revenue mark — we should talk about whether an S-corp election makes sense for tax year 2026. Quick 20-minute call this week?'},
            ${'email'},
            ${0.85}
          )
        `;
        const ins = await sql<
          { status: string; confidence: number; title: string }[]
        >`
          SELECT status, confidence, title FROM nudges
           WHERE tenant_id = ${tenantId}::uuid
             AND client_id = ${clientId}::uuid
             AND trigger_key = ${'business_revenue_250k'}
           ORDER BY created_at DESC LIMIT 1
        `;
        if (ins.length !== 1) throw new Error('nudge insert failed');
        if (ins[0]!.status !== 'pending') {
          throw new Error(`default status wrong: ${ins[0]!.status}`);
        }
        console.log(
          `  ${GREEN}PASS${RESET}  nudges insert + default status ${DIM}status=pending${RESET}`,
        );

        // CHECK rejects bad status on nudges.
        await sql`SAVEPOINT before_bad_status`;
        let rejectedBadStatus = false;
        try {
          await sql`
            INSERT INTO nudges (
              tenant_id, client_id, trigger_class, trigger_key,
              title, body, status
            ) VALUES (
              ${tenantId}::uuid, ${clientId}::uuid, ${'milestone'},
              ${'x'}, ${'t'}, ${'b'}, ${'bogus_status'}
            )
          `;
        } catch {
          rejectedBadStatus = true;
          await sql`ROLLBACK TO SAVEPOINT before_bad_status`;
        }
        if (!rejectedBadStatus) {
          throw new Error('CHECK did not reject bogus nudges status');
        }
        console.log(`  ${GREEN}PASS${RESET}  nudges status CHECK enforces enum`);

        // CHECK rejects empty title.
        await sql`SAVEPOINT before_empty_title`;
        let rejectedEmptyTitle = false;
        try {
          await sql`
            INSERT INTO nudges (
              tenant_id, client_id, trigger_class, trigger_key,
              title, body
            ) VALUES (
              ${tenantId}::uuid, ${clientId}::uuid, ${'milestone'},
              ${'x'}, ${''}, ${'b'}
            )
          `;
        } catch {
          rejectedEmptyTitle = true;
          await sql`ROLLBACK TO SAVEPOINT before_empty_title`;
        }
        if (!rejectedEmptyTitle) {
          throw new Error('CHECK did not reject empty title');
        }
        console.log(`  ${GREEN}PASS${RESET}  nudges title CHECK rejects empty`);

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
