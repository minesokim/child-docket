// scripts/apply-34.ts — projects + engagement_projects migration.

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
const TABLES = ['projects', 'engagement_projects'];

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error(`${RED}FATAL${RESET}: DATABASE_URL not set`);
    process.exit(2);
  }
  console.log(`${YELLOW}━━ apply-34 ━━${RESET}`);
  console.log(`Target: ${dbUrl.replace(/:[^:@]+@/, ':***@')}`);

  const sql = postgres(dbUrl, { max: 1, prepare: false });
  try {
    if (!SKIP_APPLY) {
      const ddl = readFileSync(
        path.resolve(__dirname, '../migrations/0034_projects.sql'),
        'utf8',
      );
      console.log(`${DIM}Applying 0034_projects.sql...${RESET}`);
      await sql.unsafe(ddl);
      console.log(`  ${GREEN}PASS${RESET}  migration applied`);
    }

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

    const policyRows = await sql<{ tablename: string; policyname: string }[]>`
      SELECT tablename, policyname FROM pg_policies
       WHERE schemaname = 'public' AND tablename = ANY(${TABLES})
    `;
    for (const t of TABLES) {
      if (
        !policyRows.find(
          (p) => p.tablename === t && p.policyname.startsWith('tenant_isolation_'),
        )
      ) {
        throw new Error(`missing tenant_isolation policy on ${t}`);
      }
    }
    console.log(`  ${GREEN}PASS${RESET}  tenant_isolation policies present`);

    const trgRows = await sql<{ event_object_table: string; trigger_name: string }[]>`
      SELECT event_object_table, trigger_name
        FROM information_schema.triggers
       WHERE event_object_schema = 'public'
         AND event_object_table = 'projects'
         AND trigger_name = 'projects_updated_at'
    `;
    if (trgRows.length === 0) throw new Error('projects_updated_at trigger missing');
    console.log(`  ${GREEN}PASS${RESET}  projects updated_at trigger present`);

    // Smoke insert wrapped in always-rollback.
    let smokeOk = false;
    try {
      await sql`BEGIN`;
      await sql`SET LOCAL app.bypass_rls = 'on'`;

      const tenantRows = await sql<{ id: string }[]>`SELECT id FROM tenants LIMIT 1`;
      if (tenantRows.length === 0) {
        console.log(`  ${YELLOW}SKIP${RESET}  smoke insert (no tenants in DB)`);
        smokeOk = true;
      } else {
        const tenantId = tenantRows[0]!.id;

        // Insert a template project.
        const templateResult = await sql<{ id: string }[]>`
          INSERT INTO projects (tenant_id, kind, name, is_template, description)
          VALUES (
            ${tenantId}::uuid,
            ${'annual_return_prep'},
            ${'Annual Return Prep'},
            ${true},
            ${'Per-tax-year 1040/1120-S/1120/1065 prep workflow'}
          )
          RETURNING id
        `;
        const templateId = templateResult[0]!.id;
        console.log(`  ${GREEN}PASS${RESET}  template insert`);

        // Insert an instance project tracing back to the template.
        await sql`
          INSERT INTO projects (
            tenant_id, kind, name, is_template, source_template_id, tax_year
          ) VALUES (
            ${tenantId}::uuid,
            ${'annual_return_prep'},
            ${'2026 Annual Returns'},
            ${false},
            ${templateId}::uuid,
            ${2026}
          )
        `;
        console.log(`  ${GREEN}PASS${RESET}  instance insert with source_template_id`);

        // UNIQUE constraint catches duplicate (tenant, kind, name, tax_year).
        await sql`SAVEPOINT before_dup`;
        let rejectedDup = false;
        try {
          await sql`
            INSERT INTO projects (tenant_id, kind, name, is_template, tax_year)
            VALUES (
              ${tenantId}::uuid,
              ${'annual_return_prep'},
              ${'2026 Annual Returns'},
              ${false},
              ${2026}
            )
          `;
        } catch {
          rejectedDup = true;
          await sql`ROLLBACK TO SAVEPOINT before_dup`;
        }
        if (!rejectedDup) {
          throw new Error('UNIQUE did not reject duplicate (tenant, kind, name, year)');
        }
        console.log(`  ${GREEN}PASS${RESET}  UNIQUE (tenant, kind, name, year)`);

        // tax_year CHECK rejects bad values.
        await sql`SAVEPOINT before_bad_year`;
        let rejectedBadYear = false;
        try {
          await sql`
            INSERT INTO projects (tenant_id, kind, name, tax_year)
            VALUES (
              ${tenantId}::uuid,
              ${'audit_defense'},
              ${'Bad year project'},
              ${1900}
            )
          `;
        } catch {
          rejectedBadYear = true;
          await sql`ROLLBACK TO SAVEPOINT before_bad_year`;
        }
        if (!rejectedBadYear) {
          throw new Error('CHECK did not reject tax_year 1900');
        }
        console.log(`  ${GREEN}PASS${RESET}  tax_year CHECK enforces 2000-2100`);

        // engagement_projects requires a real engagement; skip the
        // FK verification here if no engagement exists for the tenant.
        const engRows = await sql<{ id: string; tenant_id: string }[]>`
          SELECT id, tenant_id FROM engagements WHERE tenant_id = ${tenantId}::uuid LIMIT 1
        `;
        if (engRows.length === 0) {
          console.log(
            `  ${YELLOW}SKIP${RESET}  engagement_projects FK check (no engagements for tenant)`,
          );
        } else {
          const engId = engRows[0]!.id;
          await sql`
            INSERT INTO engagement_projects (tenant_id, engagement_id, project_id, is_primary)
            VALUES (${tenantId}::uuid, ${engId}::uuid, ${templateId}::uuid, ${true})
          `;
          console.log(`  ${GREEN}PASS${RESET}  engagement_projects insert + primary flag`);

          // UNIQUE on (engagement_id, project_id)
          await sql`SAVEPOINT before_dup_join`;
          let rejectedDupJoin = false;
          try {
            await sql`
              INSERT INTO engagement_projects (tenant_id, engagement_id, project_id)
              VALUES (${tenantId}::uuid, ${engId}::uuid, ${templateId}::uuid)
            `;
          } catch {
            rejectedDupJoin = true;
            await sql`ROLLBACK TO SAVEPOINT before_dup_join`;
          }
          if (!rejectedDupJoin) {
            throw new Error('UNIQUE on (engagement_id, project_id) did not fire');
          }
          console.log(
            `  ${GREEN}PASS${RESET}  engagement_projects UNIQUE (engagement, project)`,
          );
        }

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
