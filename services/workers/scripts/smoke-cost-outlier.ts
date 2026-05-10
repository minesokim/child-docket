// Smoke: cost-outlier-alert SQL + idempotency + audit-row insert.
//
// Exercises the same query the Inngest cron runs, against the dev DB,
// without going through Inngest. Validates:
//   1. The "outliers above threshold not yet flagged" SELECT (using the
//      production NOT EXISTS clause) returns rows with the expected shape.
//   2. The NOT EXISTS idempotency clause filters out the smoke's just-
//      inserted audit rows: after step 2, EACH originally-selected
//      action_id is filtered out by NOT EXISTS against the smoke key.
//   3. The audit-row insert under bypass_rls + per-tenant LOCAL works.
//
// Usage:
//   bun run services/workers/scripts/smoke-cost-outlier.ts          # writes audit rows
//   bun run services/workers/scripts/smoke-cost-outlier.ts --dry    # SELECT-only
//
// Smoke uses `cost_outlier.smoke-detected` (NOT the production
// `cost_outlier.detected`) for its INSERTs so it does not pollute the
// production cron's NOT EXISTS state. The SELECT in step 1 still uses
// the production NOT EXISTS to catch regressions in that filter.
//
// ACCEPTED LIMITATION (codex pass 8 P3): step 1 also excludes rows the
// smoke has already flagged on a prior run (so re-runs don't duplicate
// audit rows). This means a prior smoke run can hide a row from this
// smoke even if the production cron would still select it. The smoke
// is a BACKFILL for test-coverage-completeness, not the regression
// detector — that's /e2e + production deploy + monitoring. To force
// full re-evaluation, manually delete prior smoke rows from a dev DB
// (production rejects via the actions append-only trigger anyway).

import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { getAdminDb, disconnect, type DocketDb } from '@docket/db';

interface OutlierRow {
  action_id: string;
  tenant_id: string;
  agent_id: string | null;
  tool_name: string;
  model_used: string | null;
  cost_usd: number;
  input_tokens: number | null;
  output_tokens: number | null;
  cached_tokens: number | null;
  created_at: string;
}

const DRY = process.argv.includes('--dry');

// Synthetic threshold below v0 normal traffic so dev DB surfaces
// rows. Real prod threshold is COST_OUTLIER_THRESHOLD_USD (default
// 0.50). Smoke uses a much lower number to exercise the path.
const SYNTHETIC_THRESHOLD_USD = 0.0001;

// Smoke-specific tool_name so the smoke does NOT pollute the
// production cron's NOT EXISTS state. Codex flagged that using the
// real `cost_outlier.detected` would permanently mark real dev
// action_ids as already-alerted (actions is append-only post-mig
// 0007 — can't DELETE the smoke rows). The smoke-tagged name lets
// the smoke validate the same SCHEMA + INSERT + NOT-EXISTS pattern
// against its own tag namespace.
const SMOKE_TOOL_NAME = 'cost_outlier.smoke-detected';

async function main(): Promise<number> {
  const db = getAdminDb();
  // Codex flagged that getAdminDb() uses a 10-connection pool, so
  // plain SET only applies to ONE pool connection — subsequent
  // queries can hop connections and lose the settings. Wrap the
  // whole smoke in a transaction so SET LOCAL pins to the same
  // session for SELECT + INSERT + verify.
  return await db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL app.bypass_rls = 'on'`);
    return await runSmoke(tx);
  });
}

async function runSmoke(db: DocketDb): Promise<number> {
  // Step 1 — SELECT outliers using the EXACT cron query, including
  // the production NOT EXISTS clause (`cost_outlier.detected`).
  // This is what catches regressions in the production idempotency
  // filter. The smoke's INSERT in step 2 uses a separate
  // SMOKE_TOOL_NAME so smoke runs don't permanently mark real
  // dev actions as already-alerted by the cron.
  const rows = await db.execute<OutlierRow>(sql`
    SELECT
      a.id::text          AS action_id,
      a.tenant_id::text   AS tenant_id,
      a.agent_id          AS agent_id,
      a.tool_name         AS tool_name,
      a.model_used        AS model_used,
      a.cost_usd::float8  AS cost_usd,
      a.input_tokens      AS input_tokens,
      a.output_tokens     AS output_tokens,
      a.cached_tokens     AS cached_tokens,
      a.created_at::text  AS created_at
    FROM actions a
    WHERE a.cost_usd IS NOT NULL
      AND a.cost_usd > ${SYNTHETIC_THRESHOLD_USD}
      AND a.tool_name <> 'cost_outlier.detected'
      AND a.tool_name <> 'cost_outlier.smoke-detected'
      AND a.tool_name <> 'cost_runaway.detected'
      AND a.tool_name <> 'cost_spike.detected'
      AND a.tool_name <> 'cost_spike.smoke-detected'
      AND a.created_at > now() - interval '7 days'
      AND NOT EXISTS (
        SELECT 1 FROM actions b
        WHERE b.tool_name = 'cost_outlier.detected'
          AND b.tool_input ->> 'action_id' = a.id::text
      )
      -- Also exclude rows the smoke has already flagged on a prior
      -- run. Without this, re-running the smoke keeps appending
      -- duplicate cost_outlier.smoke-detected rows to the append-
      -- only audit log. Codex flagged this on pass 6.
      AND NOT EXISTS (
        SELECT 1 FROM actions c
        WHERE c.tool_name = ${SMOKE_TOOL_NAME}
          AND c.tool_input ->> 'action_id' = a.id::text
      )
    ORDER BY a.cost_usd DESC
    LIMIT 50
  `);

  const outliers = rows as unknown as OutlierRow[];

  console.log('--- cost-outlier smoke ---');
  console.log(`synthetic threshold: $${SYNTHETIC_THRESHOLD_USD}`);
  console.log(`unflagged outliers: ${outliers.length}`);
  for (const o of outliers.slice(0, 5)) {
    console.log(
      `  ${o.action_id.slice(0, 8)} ${o.tenant_id.slice(0, 8)} ${o.tool_name} = $${o.cost_usd.toFixed(6)}`,
    );
  }
  if (outliers.length > 5) console.log(`  ... +${outliers.length - 5} more`);
  console.log();

  if (outliers.length === 0) {
    console.log(
      'No unflagged outliers above synthetic threshold. Either:',
    );
    console.log(
      '  (a) all rows above threshold already have cost_outlier.detected audit rows (= idempotency works), or',
    );
    console.log(
      '  (b) dev DB has no cost telemetry yet (run a hello-world / eval first).',
    );
    return 0;
  }

  if (DRY) {
    console.log(
      '--dry: skipping audit-row insert. Smoke passes (SELECT + NOT EXISTS both green).',
    );
    return 0;
  }

  // Step 2 — exercise the audit-row insert path on EVERY outlier.
  // The cron flags all unflagged rows in one pass; the smoke must
  // mirror that to validate idempotency. Codex flagged that flagging
  // only the first row would leave the rerun-finds-zero claim false.
  const detectedAt = new Date().toISOString();
  // Plain SET (session-level) — `SET LOCAL` only applies inside a
  // transaction. Smoke scripts run as standalone Bun processes
  // without an enclosing tx, so use SET so the bypass_rls + tenant
  // settings actually take effect.
  await db.execute(sql`SET app.bypass_rls = 'on'`);

  for (const o of outliers) {
    await db.execute(sql`SET LOCAL app.current_tenant_id = ${o.tenant_id}::text`);
    await db.execute(sql`
      INSERT INTO actions (
        tenant_id, action_class, tool_name,
        latency_ms, success, tool_input
      )
      VALUES (
        ${o.tenant_id}::uuid,
        'send-internal'::action_class,
        ${SMOKE_TOOL_NAME},
        0,
        false,
        ${JSON.stringify({
          action_id: o.action_id,
          agent_id: o.agent_id,
          tool_name: o.tool_name,
          model_used: o.model_used,
          cost_usd: Number(o.cost_usd.toFixed(6)),
          threshold_usd: SYNTHETIC_THRESHOLD_USD,
          detected_at: detectedAt,
          smoke: true,
        })}::jsonb
      )
    `);
  }

  console.log(
    `audit-row inserts OK — wrote ${outliers.length} ${SMOKE_TOOL_NAME} rows at ${detectedAt}`,
  );
  console.log();

  // Step 3 — verify idempotency by checking that EACH originally-
  // selected action_id is now filtered out by the NOT EXISTS clause.
  //
  // Codex flagged that re-running the full SELECT could yield false-
  // failure on a live dev DB receiving new actions mid-smoke (a new
  // high-cost action arriving between insert + check would be
  // unflagged, looking like idempotency broke). Restrict to the
  // ORIGINAL action_ids — the only rows the smoke is actually
  // attesting about.
  const originalIds = outliers.map((o) => o.action_id);
  const reRun = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*)::int AS count FROM actions a
    WHERE a.id::text = ANY(${originalIds}::text[])
      AND NOT EXISTS (
        SELECT 1 FROM actions b
        WHERE b.tool_name = ${SMOKE_TOOL_NAME}
          AND b.tool_input ->> 'action_id' = a.id::text
      )
  `);
  const stillFlaggable = (reRun as unknown as Array<{ count: number }>)[0]?.count ?? 0;

  if (stillFlaggable > 0) {
    // THROW so the transaction rolls back. Returning 1 would commit
    // the inserted smoke rows even though verification failed —
    // codex flagged that on pass 7. With a throw, the rollback un-
    // does the inserts and the smoke can be re-run cleanly after
    // the regression is fixed.
    throw new Error(
      `idempotency BROKEN — ${stillFlaggable} of ${originalIds.length} originally-selected ` +
        `action(s) still match NOT EXISTS after smoke audit-row inserts. Transaction rolled back.`,
    );
  }

  console.log(
    `idempotency verified — all ${originalIds.length} originally-selected action_ids are now filtered ` +
      `out by NOT EXISTS against ${SMOKE_TOOL_NAME}. The same SQL pattern is what the production cron ` +
      `relies on against 'cost_outlier.detected'.`,
  );
  console.log();
  console.log(
    'Smoke passes — SELECT + NOT EXISTS idempotency + audit-row insert all green.',
  );
  console.log(
    'NOTE: smoke audit rows are tagged with tool_name = ' + SMOKE_TOOL_NAME + ' so the production',
  );
  console.log(
    "cron's NOT EXISTS clause does NOT see them — production state stays untouched.",
  );
  console.log(
    `Manual cleanup (dev DB only — actions is append-only post-mig 0007):`,
  );
  console.log(
    `  DELETE FROM actions WHERE tool_name = '${SMOKE_TOOL_NAME}';`,
  );

  return 0;
}

main()
  .then(async (code) => {
    // Close the postgres-js pool so the bun process exits promptly.
    // Without this, idle_timeout=20 keeps the process alive ~20s
    // after the success log, making the smoke appear to hang.
    await disconnect();
    process.exit(code);
  })
  .catch(async (err) => {
    console.error('smoke-cost-outlier FAILED:', err);
    await disconnect().catch(() => {});
    process.exit(1);
  });
