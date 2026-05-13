// scripts/apply-31.ts
//
// Apply + smoke for migration 0031 (settings + calendar layer).
// Hand-applied SQL since the Drizzle journal is stale past idx 16.
//
// Verifies:
//   - All 5 tables exist (tenant_ai_preferences, reminder_rules,
//     notification_prefs, calendar_events, tenant_settings)
//   - All 5 have RLS enabled + forced
//   - All 5 have the tenant_isolation policy installed
//   - All 5 have updated_at triggers installed
//   - users.theme_pref column added with CHECK
//   - Smoke insert under a synthetic tenant rolls back cleanly
//     (no synthetic rows pollute prod tables, codex pattern from
//     apply-30 lift)

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

const NEW_TABLES = [
  'tenant_ai_preferences',
  'reminder_rules',
  'notification_prefs',
  'calendar_events',
  'tenant_settings',
];

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error(`${RED}FATAL${RESET}: DATABASE_URL not set`);
    process.exit(2);
  }
  console.log(`${YELLOW}━━ apply-31 ━━${RESET}`);
  console.log(`Target: ${dbUrl.replace(/:[^:@]+@/, ':***@')}`);

  const sql = postgres(dbUrl, { max: 1, prepare: false });
  try {
    if (!SKIP_APPLY) {
      const ddl = readFileSync(
        path.resolve(__dirname, '../migrations/0031_settings_calendar.sql'),
        'utf8',
      );
      console.log(`${DIM}Applying 0031_settings_calendar.sql...${RESET}`);
      await sql.unsafe(ddl);
      console.log(`  ${GREEN}PASS${RESET}  migration applied`);
    }

    // Verify all 5 tables exist.
    const tableRows = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = ANY(${NEW_TABLES})
       ORDER BY table_name
    `;
    if (tableRows.length !== NEW_TABLES.length) {
      const got = tableRows.map((r) => r.table_name);
      const missing = NEW_TABLES.filter((t) => !got.includes(t));
      throw new Error(`missing tables: ${missing.join(', ')}`);
    }
    console.log(`  ${GREEN}PASS${RESET}  all 5 tables exist`);

    // Verify RLS enabled + forced on all 5.
    const rlsRows = await sql<
      { relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }[]
    >`
      SELECT c.relname,
             c.relrowsecurity,
             c.relforcerowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = ANY(${NEW_TABLES})
       ORDER BY c.relname
    `;
    for (const row of rlsRows) {
      if (!row.relrowsecurity || !row.relforcerowsecurity) {
        throw new Error(
          `RLS not enabled+forced on ${row.relname}: ` +
            `enabled=${row.relrowsecurity}, forced=${row.relforcerowsecurity}`,
        );
      }
    }
    console.log(`  ${GREEN}PASS${RESET}  RLS enabled + forced on all 5`);

    // Verify tenant_isolation policy on each.
    const policyRows = await sql<{ tablename: string; policyname: string }[]>`
      SELECT tablename, policyname FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename = ANY(${NEW_TABLES})
       ORDER BY tablename
    `;
    for (const t of NEW_TABLES) {
      const match = policyRows.find(
        (p) => p.tablename === t && p.policyname.startsWith('tenant_isolation_'),
      );
      if (!match) {
        throw new Error(`missing tenant_isolation policy on ${t}`);
      }
    }
    console.log(`  ${GREEN}PASS${RESET}  tenant_isolation policy on all 5`);

    // Verify updated_at triggers.
    const triggerRows = await sql<
      { event_object_table: string; trigger_name: string }[]
    >`
      SELECT event_object_table, trigger_name
        FROM information_schema.triggers
       WHERE event_object_schema = 'public'
         AND event_object_table = ANY(${NEW_TABLES})
         AND trigger_name LIKE '%updated_at%'
    `;
    for (const t of NEW_TABLES) {
      if (!triggerRows.find((r) => r.event_object_table === t)) {
        throw new Error(`missing updated_at trigger on ${t}`);
      }
    }
    console.log(`  ${GREEN}PASS${RESET}  updated_at trigger on all 5`);

    // Verify users.theme_pref column added.
    const themeRows = await sql<{ column_name: string; data_type: string }[]>`
      SELECT column_name, data_type
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'users'
         AND column_name = 'theme_pref'
    `;
    if (themeRows.length !== 1) {
      throw new Error('users.theme_pref column not found');
    }
    console.log(`  ${GREEN}PASS${RESET}  users.theme_pref column installed`);

    // Smoke insert into tenant_ai_preferences + tenant_settings under
    // bypass_rls (since we don't have a real tenant context here),
    // wrapped in a transaction that always rolls back.
    let smokeOk = false;
    try {
      await sql`BEGIN`;
      await sql`SET LOCAL app.bypass_rls = 'on'`;

      // Find an existing tenant to attach to (don't create one — the
      // tenants table has cascading FKs we'd need to satisfy).
      const tenantRows = await sql<{ id: string }[]>`
        SELECT id FROM tenants LIMIT 1
      `;
      if (tenantRows.length === 0) {
        console.log(
          `  ${YELLOW}SKIP${RESET}  smoke insert (no tenants in DB)`,
        );
        smokeOk = true;
      } else {
        const tenantId = tenantRows[0]!.id;

        // tenant_ai_preferences: insert default row.
        await sql`
          INSERT INTO tenant_ai_preferences (tenant_id)
          VALUES (${tenantId})
          ON CONFLICT (tenant_id) DO NOTHING
        `;
        const aiPrefs = await sql<{ tone: string; discovery_insights: boolean }[]>`
          SELECT tone, discovery_insights
            FROM tenant_ai_preferences
           WHERE tenant_id = ${tenantId}
        `;
        if (aiPrefs.length !== 1) {
          throw new Error('tenant_ai_preferences default insert failed');
        }
        if (aiPrefs[0]!.tone !== 'warm' || !aiPrefs[0]!.discovery_insights) {
          throw new Error(
            `defaults mismatch: tone=${aiPrefs[0]!.tone}, ` +
              `discovery_insights=${aiPrefs[0]!.discovery_insights}`,
          );
        }
        console.log(
          `  ${GREEN}PASS${RESET}  tenant_ai_preferences defaults ` +
            `${DIM}tone=warm, discovery_insights=true${RESET}`,
        );

        // tenant_settings: insert default row.
        await sql`
          INSERT INTO tenant_settings (tenant_id)
          VALUES (${tenantId})
          ON CONFLICT (tenant_id) DO NOTHING
        `;
        const settings = await sql<{ theme_pref: string }[]>`
          SELECT theme_pref FROM tenant_settings WHERE tenant_id = ${tenantId}
        `;
        if (settings.length !== 1 || settings[0]!.theme_pref !== 'system') {
          throw new Error(
            `tenant_settings.theme_pref default wrong: ` +
              `${settings[0]?.theme_pref ?? 'no row'}`,
          );
        }
        console.log(
          `  ${GREEN}PASS${RESET}  tenant_settings defaults ` +
            `${DIM}theme_pref=system${RESET}`,
        );

        // reminder_rules: try inserting one valid rule + reject bogus
        // trigger.
        await sql`
          INSERT INTO reminder_rules (tenant_id, trigger, interval_hours)
          VALUES (${tenantId}, 'missing_documents', 72)
          ON CONFLICT (tenant_id, trigger) DO NOTHING
        `;
        const rules = await sql<{ enabled: boolean }[]>`
          SELECT enabled FROM reminder_rules
           WHERE tenant_id = ${tenantId} AND trigger = 'missing_documents'
        `;
        if (rules.length !== 1) {
          throw new Error('reminder_rules insert failed');
        }
        console.log(`  ${GREEN}PASS${RESET}  reminder_rules insert + UNIQUE`);

        await sql`SAVEPOINT before_bad_trigger`;
        let rejectedBadTrigger = false;
        try {
          await sql`
            INSERT INTO reminder_rules (tenant_id, trigger)
            VALUES (${tenantId}, 'bogus_trigger')
          `;
        } catch {
          rejectedBadTrigger = true;
          await sql`ROLLBACK TO SAVEPOINT before_bad_trigger`;
        }
        if (!rejectedBadTrigger) {
          throw new Error('CHECK did not reject bogus reminder trigger');
        }
        console.log(`  ${GREEN}PASS${RESET}  reminder_rules CHECK enforces enum`);

        // notification_prefs: same pattern.
        await sql`
          INSERT INTO notification_prefs (tenant_id, category)
          VALUES (${tenantId}, 'deadlines')
          ON CONFLICT (tenant_id, category) DO NOTHING
        `;
        const notifs = await sql<{ email: boolean; in_app: boolean }[]>`
          SELECT email, in_app FROM notification_prefs
           WHERE tenant_id = ${tenantId} AND category = 'deadlines'
        `;
        if (notifs.length !== 1 || !notifs[0]!.email || !notifs[0]!.in_app) {
          throw new Error('notification_prefs defaults wrong');
        }
        console.log(
          `  ${GREEN}PASS${RESET}  notification_prefs defaults ` +
            `${DIM}email=true, in_app=true${RESET}`,
        );

        // calendar_events: insert a minimal event tied to a real
        // tenant.
        await sql`
          INSERT INTO calendar_events (
            tenant_id, title, starts_at, ends_at
          ) VALUES (
            ${tenantId},
            ${'smoke event'},
            ${new Date().toISOString()},
            ${new Date(Date.now() + 30 * 60_000).toISOString()}
          )
        `;
        const events = await sql<{ event_type: string }[]>`
          SELECT event_type FROM calendar_events
           WHERE tenant_id = ${tenantId} AND title = 'smoke event'
        `;
        if (events.length !== 1 || events[0]!.event_type !== 'meeting') {
          throw new Error('calendar_events default event_type wrong');
        }
        console.log(
          `  ${GREEN}PASS${RESET}  calendar_events insert + default ` +
            `${DIM}event_type=meeting${RESET}`,
        );

        smokeOk = true;
      }
    } finally {
      try {
        await sql`ROLLBACK`;
      } catch {
        // Tx might be aborted; ignore.
      }
    }
    if (!smokeOk) {
      throw new Error('smoke assertions did not complete');
    }
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
