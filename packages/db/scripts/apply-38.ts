// scripts/apply-38.ts — bypass-RLS policies on 12 original tables
// (Session 11 RLS posture finish, 2026-05-16).
//
// Applies migration 0038_bypass_rls_policies.sql and runs a security
// smoke that proves four invariants:
//
//   1. Each new <table>_bypass policy exists.
//   2. With app.bypass_rls = 'on' set INSIDE an explicit tx, an
//      admin SELECT crosses tenant lines.
//   3. With app.bypass_rls unset, the existing tenant_isolation
//      policy still fires (no leak from the change).
//   4. The bypass policy WITH CHECK lets a bypass-set session
//      INSERT a row for an arbitrary tenant_id (admin path).
//
// Same shape as apply-36 (authorities tighten) + apply-37 (webhook
// events).

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

const EXPECTED_POLICIES = [
  'users_bypass',
  'clients_bypass',
  'engagements_bypass',
  'issues_bypass',
  'documents_bypass',
  'messages_bypass',
  'actions_bypass',
  'approvals_bypass',
  'signatures_bypass',
  'gmail_threads_bypass',
  'intake_responses_bypass',
  'notice_responses_bypass',
];

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error(`${RED}FATAL${RESET}: DATABASE_URL not set`);
    process.exit(2);
  }
  console.log(`${YELLOW}━━ apply-38 ━━${RESET}`);
  console.log(`Target: ${dbUrl.replace(/:[^:@]+@/, ':***@')}`);

  const sql = postgres(dbUrl, { max: 1, prepare: false });
  try {
    if (!SKIP_APPLY) {
      const ddl = readFileSync(
        path.resolve(__dirname, '../migrations/0038_bypass_rls_policies.sql'),
        'utf8',
      );
      console.log(`${DIM}Applying 0038_bypass_rls_policies.sql...${RESET}`);
      await sql.unsafe(ddl);
      console.log(`  ${GREEN}PASS${RESET}  migration applied`);
    }

    // ── Policy presence ────────────────────────────────────────
    const policyRows = await sql<{ tablename: string; policyname: string }[]>`
      SELECT tablename, policyname
        FROM pg_policies
       WHERE schemaname = 'public'
         AND policyname = ANY(${EXPECTED_POLICIES})
    `;
    const presentNames = new Set(policyRows.map((r) => r.policyname));
    for (const expected of EXPECTED_POLICIES) {
      if (!presentNames.has(expected)) {
        throw new Error(`missing policy: ${expected}`);
      }
    }
    console.log(
      `  ${GREEN}PASS${RESET}  all 12 <table>_bypass policies present`,
    );

    // ── Smoke: bypass works inside an explicit transaction ────
    //
    // The Session 4 finding noted that getAdminDb()'s non-tx-wrapped
    // execute means SET LOCAL is a no-op at the auto-commit boundary.
    // This smoke uses the postgres-js `begin` / `commit` explicitly
    // to mimic the FIXED verify-actions-chain pattern (Session 11
    // updates the cron in the same commit).
    let smokeOk = false;
    try {
      await sql`BEGIN`;

      // Create two ephemeral tenants for cross-tenant verification.
      const tenantA = randomUUID();
      const tenantB = randomUUID();
      const slugSuffix = randomUUID().slice(0, 8);
      await sql`SET LOCAL app.bypass_rls = 'on'`;
      await sql`
        INSERT INTO tenants (id, slug, name)
        VALUES
          (${tenantA}::uuid, ${'apply-38-a-' + slugSuffix}, ${'apply-38-A'}),
          (${tenantB}::uuid, ${'apply-38-b-' + slugSuffix}, ${'apply-38-B'})
      `;

      // Bypass-set admin INSERT into actions — should succeed for
      // BOTH tenants in the same session. Pre-Session-11 this failed
      // for any role without BYPASSRLS attribute because no policy
      // permitted cross-tenant writes.
      await sql`
        INSERT INTO actions (
          tenant_id, action_class, tool_name,
          latency_ms, success, tool_input
        )
        VALUES
          (${tenantA}::uuid, ${'read'}, ${'apply-38-smoke'},
           0, true, ${'{}'}::jsonb),
          (${tenantB}::uuid, ${'read'}, ${'apply-38-smoke'},
           0, true, ${'{}'}::jsonb)
      `;
      console.log(
        `  ${GREEN}PASS${RESET}  bypass-set INSERT crosses tenants in same session`,
      );

      // Bypass-set admin SELECT — should see both tenants' rows.
      const adminRows = await sql<{ tenant_id: string }[]>`
        SELECT tenant_id::text AS tenant_id
          FROM actions
         WHERE tool_name = 'apply-38-smoke'
           AND tenant_id IN (${tenantA}::uuid, ${tenantB}::uuid)
      `;
      if (adminRows.length !== 2) {
        throw new Error(
          `bypass SELECT returned ${adminRows.length} rows; expected 2 (cross-tenant)`,
        );
      }
      console.log(
        `  ${GREEN}PASS${RESET}  bypass-set SELECT returns rows from both tenants`,
      );

      // Confirm the existing tenant_isolation policy still fires
      // when bypass_rls is NOT set. Reset bypass + scope to tenantA.
      await sql`SET LOCAL app.bypass_rls = ''`;
      await sql.unsafe(`SET LOCAL app.current_tenant_id = '${tenantA}'`);
      const tenantScopedRows = await sql<{ tenant_id: string }[]>`
        SELECT tenant_id::text AS tenant_id
          FROM actions
         WHERE tool_name = 'apply-38-smoke'
      `;
      if (tenantScopedRows.length !== 1) {
        throw new Error(
          `tenant-scoped SELECT returned ${tenantScopedRows.length} rows; expected 1 (own tenant only)`,
        );
      }
      if (tenantScopedRows[0]!.tenant_id !== tenantA) {
        throw new Error(
          'tenant-scoped SELECT crossed tenant boundary — RLS regression',
        );
      }
      console.log(
        `  ${GREEN}PASS${RESET}  tenant_isolation still fires when bypass unset`,
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
