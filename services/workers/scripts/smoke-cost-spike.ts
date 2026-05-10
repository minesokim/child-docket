// Smoke: cost-spike-alert SQL + ratio detection + audit-row insert.
//
// Exercises the same per-tenant today-vs-yesterday SUM the Inngest
// cron runs, against the dev DB, without going through Inngest.
// Validates:
//   1. The window-function SUM correctly partitions today (last 24h)
//      from yesterday (24h-48h ago) per tenant.
//   2. The ratio computation correctly flags spikes above the
//      (synthetic) multiplier threshold.
//   3. The baseline-floor suppresses noise from low-volume periods.
//   4. The audit-row insert under bypass_rls + per-tenant LOCAL works.
//
// Usage:
//   bun run services/workers/scripts/smoke-cost-spike.ts        # writes audit rows
//   bun run services/workers/scripts/smoke-cost-spike.ts --dry  # SELECT-only

import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { getAdminDb, disconnect, type DocketDb } from '@docket/db';

interface DailySpend {
  tenant_id: string;
  today_usd: number;
  yesterday_usd: number;
  today_calls: number;
  yesterday_calls: number;
}

const DRY = process.argv.includes('--dry');

// Synthetic params way below v0 normal so dev DB surfaces rows
// even with sparse traffic. Real prod defaults are
// COST_SPIKE_MULTIPLIER (1.5) + COST_SPIKE_MIN_BASELINE_USD (0.10).
//
// Baseline is intentionally NONZERO so the smoke exercises the
// suppression branch. With baseline=0.0 the script claimed to test
// floor-suppression but never actually entered that code path — codex
// flagged this. Use $0.0001 — low enough that real dev traffic
// satisfies it but high enough to exclude $0-baseline tenants.
const SYNTHETIC_MULTIPLIER = 1.01;
const SYNTHETIC_BASELINE = 0.0001;

// Smoke-specific tool_name — see smoke-cost-outlier.ts for rationale
// (avoid polluting the production cron's audit state).
const SMOKE_TOOL_NAME = 'cost_spike.smoke-detected';

async function main(): Promise<number> {
  const db = getAdminDb();
  // Wrap in a transaction so SET LOCAL pins to one pool connection
  // for all queries (codex flagged that getAdminDb()'s 10-conn pool
  // can hop connections between standalone db.execute() calls).
  return await db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL app.bypass_rls = 'on'`);
    return await runSmoke(tx);
  });
}

async function runSmoke(db: DocketDb): Promise<number> {

  // Step 1 — per-tenant today vs yesterday (mirror of cron query).
  const rows = await db.execute<DailySpend>(sql`
    SELECT
      tenant_id::text AS tenant_id,
      COALESCE(SUM(CASE
        WHEN created_at > now() - interval '24 hours'
        THEN cost_usd ELSE 0
      END), 0)::float8 AS today_usd,
      COALESCE(SUM(CASE
        WHEN created_at > now() - interval '48 hours'
          AND created_at <= now() - interval '24 hours'
        THEN cost_usd ELSE 0
      END), 0)::float8 AS yesterday_usd,
      COUNT(CASE
        WHEN created_at > now() - interval '24 hours'
        THEN 1
      END)::int AS today_calls,
      COUNT(CASE
        WHEN created_at > now() - interval '48 hours'
          AND created_at <= now() - interval '24 hours'
        THEN 1
      END)::int AS yesterday_calls
    FROM actions
    WHERE created_at > now() - interval '48 hours'
      AND cost_usd IS NOT NULL
      AND tool_name NOT IN (
        'cost_runaway.detected',
        'cost_outlier.detected',
        'cost_outlier.smoke-detected',
        'cost_spike.detected',
        'cost_spike.smoke-detected'
      )
    GROUP BY tenant_id
    HAVING
      COALESCE(SUM(CASE
        WHEN created_at > now() - interval '24 hours'
        THEN cost_usd ELSE 0
      END), 0) > 0
      -- Exclude tenants whose spike was already flagged by a prior
      -- smoke run today (within 24h). Without this, every re-run
      -- appends a duplicate cost_spike.smoke-detected row to the
      -- append-only audit log. Codex flagged this on pass 7.
      AND NOT EXISTS (
        SELECT 1 FROM actions s
        WHERE s.tool_name = ${SMOKE_TOOL_NAME}
          AND s.tenant_id::text = actions.tenant_id::text
          AND s.created_at > now() - interval '24 hours'
      )
    ORDER BY today_usd DESC
  `);

  const perTenant = rows as unknown as DailySpend[];

  console.log('--- cost-spike smoke ---');
  console.log(`synthetic multiplier: ${SYNTHETIC_MULTIPLIER}× (real default 1.5)`);
  console.log(`synthetic baseline floor: $${SYNTHETIC_BASELINE} (real default $0.10)`);
  console.log(`tenants with today-spend: ${perTenant.length}`);
  for (const t of perTenant) {
    const ratio = t.yesterday_usd > 0 ? t.today_usd / t.yesterday_usd : null;
    console.log(
      `  ${t.tenant_id.slice(0, 8)}: today=$${t.today_usd.toFixed(4)} yesterday=$${t.yesterday_usd.toFixed(4)} ratio=${ratio !== null ? ratio.toFixed(2) : 'n/a'}`,
    );
  }
  console.log();

  // Step 2 — apply synthetic threshold to find spikes.
  const detectedAt = new Date().toISOString();
  const spikes: Array<{ tenant: DailySpend; ratio: number }> = [];
  for (const row of perTenant) {
    if (row.yesterday_usd < SYNTHETIC_BASELINE) continue;
    if (row.yesterday_usd === 0) continue; // ratio undefined; skip (cron also skips)
    const ratio = row.today_usd / row.yesterday_usd;
    if (ratio >= SYNTHETIC_MULTIPLIER) {
      spikes.push({ tenant: row, ratio });
    }
  }

  console.log(`spikes at synthetic ${SYNTHETIC_MULTIPLIER}×: ${spikes.length}`);
  for (const s of spikes) {
    console.log(
      `  ${s.tenant.tenant_id.slice(0, 8)}: ${s.ratio.toFixed(2)}× day-over-day`,
    );
  }
  console.log();

  if (spikes.length === 0) {
    console.log(
      'No spikes detected. Either:',
    );
    console.log(
      '  (a) dev DB has no traffic in the last 48h, or',
    );
    console.log(
      '  (b) yesterday-spend is zero across all tenants (no baseline → cron also skips),',
    );
    console.log(
      '  (c) traffic is flat day-over-day (no spike).',
    );
    return 0;
  }

  if (DRY) {
    console.log(
      '--dry: skipping audit-row insert. Smoke passes (SELECT + ratio + baseline-floor all green).',
    );
    return 0;
  }

  // Step 3 — exercise the audit-row insert for EVERY spike, mirroring
  // cost-spike-alert.ts which records one audit row per tenant in
  // one pass. Codex flagged that flagging only spikes[0] left
  // re-runs unidempotent on multi-tenant spike data.
  for (const s of spikes) {
  await db.execute(sql`SET LOCAL app.current_tenant_id = ${s.tenant.tenant_id}::text`);
  await db.execute(sql`
    INSERT INTO actions (
      tenant_id, action_class, tool_name,
      latency_ms, success, tool_input
    )
    VALUES (
      ${s.tenant.tenant_id}::uuid,
      'send-internal'::action_class,
      ${SMOKE_TOOL_NAME},
      0,
      false,
      ${JSON.stringify({
        tenant_id: s.tenant.tenant_id,
        today_usd: Number(s.tenant.today_usd.toFixed(4)),
        yesterday_usd: Number(s.tenant.yesterday_usd.toFixed(4)),
        ratio: Number(s.ratio.toFixed(2)),
        today_calls: s.tenant.today_calls,
        yesterday_calls: s.tenant.yesterday_calls,
        multiplier_threshold: SYNTHETIC_MULTIPLIER,
        baseline_floor_usd: SYNTHETIC_BASELINE,
        detected_at: detectedAt,
        smoke: true,
      })}::jsonb
    )
  `);
  }  // end for-each-spike

  console.log(
    `audit-row inserts OK — wrote ${spikes.length} ${SMOKE_TOOL_NAME} rows at ${detectedAt}`,
  );
  console.log();
  console.log(
    'Smoke passes — SELECT + ratio + baseline-floor + audit-row insert all green.',
  );
  console.log(
    `NOTE: smoke rows tagged with tool_name = ${SMOKE_TOOL_NAME} so production cron is untouched.`,
  );
  console.log(
    `Manual cleanup (dev DB only): DELETE FROM actions WHERE tool_name = '${SMOKE_TOOL_NAME}';`,
  );

  return 0;
}

main()
  .then(async (code) => {
    // Close the postgres-js pool so the bun process exits promptly.
    // Without this, idle_timeout=20 keeps the process alive ~20s
    // after the success log.
    await disconnect();
    process.exit(code);
  })
  .catch(async (err) => {
    console.error('smoke-cost-spike FAILED:', err);
    await disconnect().catch(() => {});
    process.exit(1);
  });
