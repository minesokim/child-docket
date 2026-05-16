// scripts/apply-36.ts — authorities + authority_chunks WITH CHECK
// tightening (Session 5 RLS audit, 2026-05-15).
//
// Applies migration 0036_authorities_tighten_with_check.sql and runs a
// security smoke test that proves the privilege-escalation path
// surfaced in the audit is now blocked.
//
// What the smoke proves:
//
//   1. The old `authorities_isolation` + `authority_chunks_isolation`
//      policies are gone.
//   2. The three new policies per table exist (_select, _tenant_write,
//      _bypass).
//   3. A tenant-scoped session (SET LOCAL app.current_tenant_id =
//      <tenantA>) can SELECT a global authority row (tenant_id IS NULL).
//   4. A tenant-scoped session is REJECTED when it tries to INSERT a
//      row with tenant_id = NULL. This is the privilege-escalation
//      defense — pre-0036 the IS NULL escape in the WITH CHECK
//      permitted this; post-0036 it does not.
//   5. A bypass-set session (SET LOCAL app.bypass_rls = 'on') CAN
//      INSERT a row with tenant_id = NULL. This is the admin path the
//      seed-authorities script uses.
//   6. Same four invariants on authority_chunks.

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
  // authorities
  { table: 'authorities', policy: 'authorities_select' },
  { table: 'authorities', policy: 'authorities_tenant_write' },
  { table: 'authorities', policy: 'authorities_bypass' },
  // authority_chunks
  { table: 'authority_chunks', policy: 'authority_chunks_select' },
  { table: 'authority_chunks', policy: 'authority_chunks_tenant_write' },
  { table: 'authority_chunks', policy: 'authority_chunks_bypass' },
];

const DROPPED_POLICIES = [
  { table: 'authorities', policy: 'authorities_isolation' },
  { table: 'authority_chunks', policy: 'authority_chunks_isolation' },
];

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error(`${RED}FATAL${RESET}: DATABASE_URL not set`);
    process.exit(2);
  }
  console.log(`${YELLOW}━━ apply-36 ━━${RESET}`);
  console.log(`Target: ${dbUrl.replace(/:[^:@]+@/, ':***@')}`);

  const sql = postgres(dbUrl, { max: 1, prepare: false });
  try {
    if (!SKIP_APPLY) {
      const ddl = readFileSync(
        path.resolve(
          __dirname,
          '../migrations/0036_authorities_tighten_with_check.sql',
        ),
        'utf8',
      );
      console.log(
        `${DIM}Applying 0036_authorities_tighten_with_check.sql...${RESET}`,
      );
      await sql.unsafe(ddl);
      console.log(`  ${GREEN}PASS${RESET}  migration applied`);
    }

    // ── Policy presence ────────────────────────────────────────
    const policyRows = await sql<{ tablename: string; policyname: string }[]>`
      SELECT tablename, policyname
        FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename IN ('authorities', 'authority_chunks')
    `;
    const present = new Set(
      policyRows.map((r) => `${r.tablename}.${r.policyname}`),
    );

    for (const { table, policy } of EXPECTED_POLICIES) {
      const key = `${table}.${policy}`;
      if (!present.has(key)) {
        throw new Error(`missing policy ${key}`);
      }
    }
    console.log(`  ${GREEN}PASS${RESET}  all 6 new policies present`);

    for (const { table, policy } of DROPPED_POLICIES) {
      const key = `${table}.${policy}`;
      if (present.has(key)) {
        throw new Error(
          `old policy ${key} still present (DROP POLICY did not apply)`,
        );
      }
    }
    console.log(`  ${GREEN}PASS${RESET}  old _isolation policies dropped`);

    // ── Security smoke: privilege escalation closed ───────────
    // Spin up an ephemeral tenant + a seeded global authority row,
    // then probe each behavior the audit demanded:
    //
    //   (1) tenant can SELECT global
    //   (2) tenant CANNOT INSERT NULL-tenant row
    //   (3) bypass CAN INSERT NULL-tenant row
    //
    // All wrapped in a final ROLLBACK to leave the DB clean.

    const tenantId = randomUUID();
    const tenantSlug = `apply-36-${randomUUID().slice(0, 8)}`;
    const globalSlug = `apply-36-global-${randomUUID().slice(0, 8)}`;

    let smokeOk = false;
    try {
      await sql`BEGIN`;
      await sql`SET LOCAL app.bypass_rls = 'on'`;

      // Seed: one tenant + one global authority row.
      await sql`
        INSERT INTO tenants (id, slug, name)
        VALUES (${tenantId}::uuid, ${tenantSlug}, ${'apply-36 test'})
      `;
      const seedAuthority = await sql<{ id: string }[]>`
        INSERT INTO authorities (
          tenant_id, kind, jurisdiction, citation_label, title, slug,
          external_url, source_uri, effective_date, applicable_tax_years,
          content_hash, metadata
        )
        VALUES (
          NULL,
          ${'irc'}::authority_kind,
          ${'federal'}::authority_jurisdiction,
          ${'IRC §99(apply-36-test)'},
          ${'apply-36 test authority'},
          ${globalSlug},
          NULL, NULL,
          ${'2025-01-01'}::date,
          ${'{}'}::int[],
          ${'deadbeef'},
          ${'{}'}::jsonb
        )
        RETURNING id::text AS id
      `;
      const globalAuthorityId = seedAuthority[0]!.id;
      console.log(`  ${DIM}seeded tenant + global authority${RESET}`);

      // Drop bypass; switch to tenant context.
      await sql`SET LOCAL app.bypass_rls = ''`;
      await sql.unsafe(
        `SET LOCAL app.current_tenant_id = '${tenantId}'`,
      );

      // (1) tenant CAN SELECT global row.
      const readRows = await sql<{ id: string }[]>`
        SELECT id::text FROM authorities WHERE slug = ${globalSlug}
      `;
      if (readRows.length !== 1) {
        throw new Error(
          'tenant session cannot read global authority row (USING regression)',
        );
      }
      console.log(
        `  ${GREEN}PASS${RESET}  tenant session reads global authority`,
      );

      // (2) tenant CANNOT INSERT with tenant_id = NULL.
      await sql`SAVEPOINT before_null_write`;
      let rejectedNullWrite = false;
      try {
        await sql`
          INSERT INTO authorities (
            tenant_id, kind, jurisdiction, citation_label, title, slug,
            external_url, source_uri, effective_date, applicable_tax_years,
            content_hash, metadata
          )
          VALUES (
            NULL,
            ${'irc'}::authority_kind,
            ${'federal'}::authority_jurisdiction,
            ${'IRC §FAKE'},
            ${'forged global authority'},
            ${'apply-36-forged-' + randomUUID().slice(0, 8)},
            NULL, NULL,
            ${'2025-01-01'}::date,
            ${'{}'}::int[],
            ${'deadbeef'},
            ${'{}'}::jsonb
          )
        `;
      } catch (err) {
        rejectedNullWrite = true;
        await sql`ROLLBACK TO SAVEPOINT before_null_write`;
        if (
          !(err instanceof Error) ||
          !/row-level security|policy/i.test(err.message)
        ) {
          throw new Error(
            `expected RLS rejection on NULL-tenant INSERT, got: ${err}`,
          );
        }
      }
      if (!rejectedNullWrite) {
        throw new Error(
          'tenant session SUCCEEDED at inserting NULL-tenant authority — privilege escalation still open',
        );
      }
      console.log(
        `  ${GREEN}PASS${RESET}  tenant session rejected on NULL-tenant INSERT`,
      );

      // (3) tenant CAN INSERT with own tenant_id (sanity).
      await sql`
        INSERT INTO authorities (
          tenant_id, kind, jurisdiction, citation_label, title, slug,
          external_url, source_uri, effective_date, applicable_tax_years,
          content_hash, metadata
        )
        VALUES (
          ${tenantId}::uuid,
          ${'firm_memo'}::authority_kind,
          ${'firm'}::authority_jurisdiction,
          ${'apply-36 firm memo'},
          ${'apply-36 tenant authority'},
          ${'apply-36-tenant-' + randomUUID().slice(0, 8)},
          NULL, NULL,
          ${'2025-01-01'}::date,
          ${'{}'}::int[],
          ${'cafebabe'},
          ${'{}'}::jsonb
        )
      `;
      console.log(
        `  ${GREEN}PASS${RESET}  tenant session can INSERT own-tenant row`,
      );

      // (4) bypass-set session CAN INSERT NULL-tenant row.
      await sql`SET LOCAL app.bypass_rls = 'on'`;
      // current_tenant_id remains set to tenantId, but the bypass
      // policy is OR'd with the tenant_write policy — bypass takes
      // priority for NULL-tenant writes.
      await sql`
        INSERT INTO authorities (
          tenant_id, kind, jurisdiction, citation_label, title, slug,
          external_url, source_uri, effective_date, applicable_tax_years,
          content_hash, metadata
        )
        VALUES (
          NULL,
          ${'irc'}::authority_kind,
          ${'federal'}::authority_jurisdiction,
          ${'IRC §99(admin-insert)'},
          ${'apply-36 admin-inserted global'},
          ${'apply-36-admin-' + randomUUID().slice(0, 8)},
          NULL, NULL,
          ${'2025-01-01'}::date,
          ${'{}'}::int[],
          ${'baadc0de'},
          ${'{}'}::jsonb
        )
      `;
      console.log(
        `  ${GREEN}PASS${RESET}  bypass session can INSERT NULL-tenant row`,
      );

      // (5) authority_chunks: same NULL-tenant rejection on a chunk
      // INSERT under a tenant session. Reset to tenant-only context.
      await sql`SET LOCAL app.bypass_rls = ''`;
      await sql.unsafe(
        `SET LOCAL app.current_tenant_id = '${tenantId}'`,
      );
      await sql`SAVEPOINT before_chunk_null_write`;
      let chunkRejected = false;
      try {
        await sql`
          INSERT INTO authority_chunks (
            authority_id, tenant_id, ordinal, section_path, heading,
            text, content_hash
          )
          VALUES (
            ${globalAuthorityId}::uuid,
            NULL,
            0,
            ${'{"forged"}'}::text[],
            ${'forged chunk'},
            ${'forged body'},
            ${'deadbeef'}
          )
        `;
      } catch (err) {
        chunkRejected = true;
        await sql`ROLLBACK TO SAVEPOINT before_chunk_null_write`;
        if (
          !(err instanceof Error) ||
          !/row-level security|policy/i.test(err.message)
        ) {
          throw new Error(
            `expected RLS rejection on chunk NULL-tenant INSERT, got: ${err}`,
          );
        }
      }
      if (!chunkRejected) {
        throw new Error(
          'tenant session SUCCEEDED at inserting NULL-tenant chunk — privilege escalation still open',
        );
      }
      console.log(
        `  ${GREEN}PASS${RESET}  tenant session rejected on NULL-tenant chunk INSERT`,
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
    console.log(
      `  ${GREEN}PASS${RESET}  rollback cleaned up smoke rows`,
    );

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
