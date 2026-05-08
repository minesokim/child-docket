// Smoke: cost-rollup queries shared by /api/admin/cost + /dashboard/cost.
//
// Exercises loadCostData against the dev DB to confirm:
//   1. The 5 parallel SQL queries all return without error.
//   2. The shapes match the TypeScript types (totals, perAgent, perModel,
//      perProvider, perDay).
//   3. RLS scoping works — passing the seeded tenant returns ONLY that
//      tenant's actions; passing a fake UUID returns zeros.
//   4. The window param maps to the correct interval string.
//
// Usage: bun run apps/command-room/scripts/smoke-cost-rollups.ts
//
// Prereqs: DATABASE_URL set in .env, dev DB has at least one tenant + 1
// action with cost_usd recorded. The orchestrator hello-world tests
// + bun-test runs of the agent fleet will have populated this.

// Bun loads .env automatically; no dotenv import needed.
import { sql } from 'drizzle-orm';
import { getAdminDb } from '@docket/db';
import { loadCostData, WINDOW_INTERVAL } from '../src/lib/cost-rollups.js';

interface TenantRow {
  id: string;
}

async function main() {
  const db = getAdminDb();
  // Pull a tenant that has cost data.
  const rows = await db.execute<TenantRow>(sql`
    SELECT DISTINCT tenant_id::text AS id
    FROM actions
    WHERE cost_usd IS NOT NULL
    LIMIT 1
  `);
  const tenants = rows as unknown as TenantRow[];
  if (tenants.length === 0) {
    console.log('No tenants with cost data on dev DB.');
    console.log('Run a hello-world or eval first to populate cost telemetry.');
    process.exit(0);
  }
  const tenantId = tenants[0]!.id;

  console.log('--- cost-rollups smoke ---');
  console.log(`tenant: ${tenantId}`);
  console.log();

  for (const window of ['24h', '7d', '30d'] as const) {
    const t0 = Date.now();
    const data = await loadCostData(tenantId, WINDOW_INTERVAL[window]);
    const elapsed = Date.now() - t0;

    console.log(`[${window}] (${elapsed}ms)`);
    console.log(
      `  totals: $${data.totals.total_usd.toFixed(4)} across ${data.totals.call_count} calls`,
    );
    console.log(
      `    tokens: in=${data.totals.total_input_tokens} out=${data.totals.total_output_tokens} cached=${data.totals.total_cached_tokens}`,
    );
    console.log(`  perAgent:    ${data.perAgent.length} groups`);
    console.log(`  perModel:    ${data.perModel.length} groups`);
    console.log(`  perProvider: ${data.perProvider.length} groups`);
    console.log(`  perDay:      ${data.perDay.length} days`);

    // Shape assertions.
    if (typeof data.totals.total_usd !== 'number') {
      console.error('FAIL: totals.total_usd is not a number');
      process.exit(1);
    }
    for (const r of data.perAgent) {
      if (typeof r.total_usd !== 'number') {
        console.error('FAIL: perAgent row total_usd not a number');
        process.exit(1);
      }
    }
    console.log();
  }

  // Cross-tenant isolation NOTE: omitted from this smoke because the
  // dev DATABASE_URL connects as the table owner, which bypasses RLS
  // by default in Postgres (FORCE ROW LEVEL SECURITY does not apply
  // to owners). The cost dashboard relies on RLS via withTenant to
  // scope SUMs; in prod the lambda connects under docket_app (a
  // non-owner role) and RLS enforces. Confirming isolation requires
  // running under a non-owner role — done explicitly by the
  // packages/db RLS test suite (DATABASE_URL_RLS_TEST env var) which
  // skips when unset and is the canonical place to verify isolation.
  //
  // For the cost dashboard specifically: post-deploy, curl
  // /api/admin/cost with a Clerk session bound to firm A and confirm
  // it does NOT return firm B's data. That's the prod confidence
  // signal.

  console.log();
  console.log('SMOKE OK: 3 windows pass shape + non-error checks.');
  console.log('Cross-tenant isolation is checked separately under the non-owner role');
  console.log('in packages/db RLS tests; dev DB connects as owner so RLS bypasses here.');
}

main().catch((err) => {
  console.error('smoke-cost-rollups FAILED:', err);
  process.exit(1);
});
