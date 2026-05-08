// Smoke: cost-runaway-alert SQL + threshold logic.
//
// Exercises the same query the Inngest cron runs, against the dev DB,
// without going through Inngest. Validates:
//   1. The trailing-24h SUM(cost_usd) per tenant query returns rows
//      with the expected shape (tenant_id, total_usd both populated,
//      total_usd > 0).
//   2. The breach detection catches per-tenant + global thresholds at
//      synthetic low ceilings (cents instead of dollars).
//   3. The audit-row insert under bypass_rls + per-tenant LOCAL works.
//
// Usage: bun run services/workers/scripts/smoke-cost-runaway.ts
//
// IMPORTANT: this writes a `cost_runaway.detected` audit row when it
// detects a synthetic breach. The row is written to the highest-spend
// tenant in the dev DB. If you don't want any audit-row noise, run
// with `--dry` to skip the insert.

import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { getAdminDb } from '@docket/db';

interface TenantSpend {
  tenant_id: string;
  total_usd: number;
}

const DRY = process.argv.includes('--dry');

async function main() {
  const db = getAdminDb();
  await db.execute(sql`SET LOCAL app.bypass_rls = 'on'`);

  // Step 1 — query per-tenant spend (24h trailing)
  const rows = await db.execute<TenantSpend>(sql`
    SELECT
      tenant_id::text AS tenant_id,
      COALESCE(SUM(cost_usd), 0)::float8 AS total_usd
    FROM actions
    WHERE created_at > now() - interval '24 hours'
      AND cost_usd IS NOT NULL
    GROUP BY tenant_id
    HAVING COALESCE(SUM(cost_usd), 0) > 0
    ORDER BY total_usd DESC
  `);

  const perTenant = rows as unknown as TenantSpend[];
  const globalTotal = perTenant.reduce((acc, t) => acc + t.total_usd, 0);

  console.log('--- cost-runaway smoke ---');
  console.log(`per-tenant rows: ${perTenant.length}`);
  for (const t of perTenant) {
    console.log(`  ${t.tenant_id}: $${t.total_usd.toFixed(4)}`);
  }
  console.log(`global total (24h): $${globalTotal.toFixed(4)}`);
  console.log();

  // Step 2 — synthetic threshold detection at cents-level so even a
  // dev DB with minimal traffic surfaces a breach (proves the alert
  // path works end-to-end).
  const SYNTHETIC_PER_TENANT_USD = 0.0001;
  const SYNTHETIC_GLOBAL_USD = 0.0001;

  const breaches: Array<{
    scope: 'per-tenant' | 'global';
    tenant_id: string | null;
    total_usd: number;
    threshold_usd: number;
  }> = [];

  for (const t of perTenant) {
    if (t.total_usd > SYNTHETIC_PER_TENANT_USD) {
      breaches.push({
        scope: 'per-tenant',
        tenant_id: t.tenant_id,
        total_usd: t.total_usd,
        threshold_usd: SYNTHETIC_PER_TENANT_USD,
      });
    }
  }
  if (globalTotal > SYNTHETIC_GLOBAL_USD) {
    breaches.push({
      scope: 'global',
      tenant_id: null,
      total_usd: globalTotal,
      threshold_usd: SYNTHETIC_GLOBAL_USD,
    });
  }

  console.log(`breaches at synthetic threshold $${SYNTHETIC_PER_TENANT_USD}: ${breaches.length}`);
  for (const b of breaches) {
    console.log(
      `  ${b.scope}` +
        (b.tenant_id ? ` (${b.tenant_id})` : '') +
        ` — $${b.total_usd.toFixed(4)} > $${b.threshold_usd.toFixed(4)}`,
    );
  }
  console.log();

  if (breaches.length === 0) {
    console.log(
      'No spend in last 24h on dev DB. Run a hello-world or eval first to populate cost telemetry, then re-run this smoke.',
    );
    process.exit(0);
  }

  if (DRY) {
    console.log('--dry: skipping audit-row insert. Smoke passes (SQL + breach detection both green).');
    process.exit(0);
  }

  // Step 3 — exercise the audit-row insert path with a synthetic
  // payload tagged smoke=true so the row is identifiable in the
  // actions table later.
  const auditTenant = breaches[0]!.tenant_id ?? perTenant[0]!.tenant_id;
  const detectedAt = new Date().toISOString();

  await db.execute(sql`SET LOCAL app.bypass_rls = 'on'`);
  await db.execute(sql`SET LOCAL app.current_tenant_id = ${auditTenant}::text`);
  await db.execute(sql`
    INSERT INTO actions (
      tenant_id, action_class, tool_name,
      latency_ms, success, tool_input
    )
    VALUES (
      ${auditTenant}::uuid,
      'send-internal'::action_class,
      'cost_runaway.detected',
      0,
      false,
      ${JSON.stringify({
        scope: 'per-tenant',
        tenant_id: auditTenant,
        total_usd: Number(breaches[0]!.total_usd.toFixed(4)),
        threshold_usd: SYNTHETIC_PER_TENANT_USD,
        detected_at: detectedAt,
        smoke: true,
      })}::jsonb
    )
  `);

  console.log(
    `audit-row insert OK — wrote cost_runaway.detected (smoke=true) for tenant ${auditTenant} at ${detectedAt}`,
  );
  console.log();
  console.log('Smoke passes — SQL aggregate + breach detection + audit-row insert all green.');
  console.log(
    'NOTE: a synthetic smoke row is now in the actions audit chain. To remove it manually:',
  );
  console.log(
    `  DELETE FROM actions WHERE tool_name = 'cost_runaway.detected' AND tool_input->>'smoke' = 'true';`,
  );
  console.log(
    '  (The append-only trigger may block this on prod; it should succeed against the dev DB only.)',
  );
}

main().catch((err) => {
  console.error('smoke-cost-runaway FAILED:', err);
  process.exit(1);
});
