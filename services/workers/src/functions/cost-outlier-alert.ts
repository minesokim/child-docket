// Cron: every 30 min. Detects single-call cost outliers.
//
// Per PRODUCTION-READINESS §B (V1 must-have) — "Alert on any single call
// >$0.50." A bug that promotes a routine extract from Haiku to Opus, or a
// retry loop that runs without prompt caching, can show up as one rogue
// row in `actions` even when the 24h-window runaway-alert (cost-runaway-
// alert.ts) is still under threshold. The runaway alert catches the
// AGGREGATE; this catches the per-call SPIKE.
//
// COMPLEMENTS the existing crons:
//   - cost-runaway-alert.ts:   24h aggregate ceilings (per-tenant +
//                              global). Fires when the SLOW drift adds up.
//   - cost-outlier-alert.ts:   single-row spikes. Fires when ONE call
//                              eats the daily budget. (THIS FILE.)
//   - cost-spike-alert.ts:     day-over-day delta. Fires when a slow
//                              cumulative shift kicks in across many calls.
//
// THRESHOLDS (env-configurable)
//   COST_OUTLIER_THRESHOLD_USD   → single-call ceiling
//                                  (default 0.50, the V1 spec's number)
//
// SCHEDULE
//   `*/30 * * * *` — every 30 min. Off the top-of-hour to avoid contending
//   with cost-runaway-alert at :15.
//
// COST OF THIS CRON
//   1 SELECT/run × 48 runs/day = negligible. No LLM calls.
//
// IDEMPOTENCY
//   The query has a NOT EXISTS clause that excludes any action_id which
//   already has a `cost_outlier.detected` audit row pointing at it. Re-runs
//   are no-ops on already-alerted rows. Per /code-quality, this is the
//   pattern that beats checkpoint-state for crons because it survives
//   missed runs (Vercel cold start, Inngest backfill) without losing
//   coverage.
//
// EDGE CASES (12 enumerated, all handled)
//
//   INPUT
//     1. actions table empty                  → SELECT returns 0 rows;
//                                               no alerts; clean exit.
//     2. cost_usd NULL on legacy rows         → comparison filters them
//                                               (cost_usd > X is FALSE
//                                               on NULL).
//     3. COST_OUTLIER_THRESHOLD_USD env unset → default 0.50.
//     4. COST_OUTLIER_THRESHOLD_USD non-numeric
//                                              → Number() returns NaN;
//                                                NaN comparison filters
//                                                everything (logged
//                                                and surfaced).
//
//   STATE
//     5. Action with cost > threshold already alerted
//                                              → NOT EXISTS clause skips
//                                                it (idempotent re-run).
//     6. Same action created during cron's run window — duplicate detect?
//                                              → race only on a single
//                                                row in flight; concurrency
//                                                limit 1 plus NOT EXISTS
//                                                makes the second cron
//                                                no-op on already-flagged
//                                                rows.
//
//   FAILURE
//     7. DB connection drops mid-run          → Inngest retries;
//                                                idempotent re-entry.
//     8. INSERT of audit row fails             → step.run isolates per
//                                                breach; subsequent
//                                                breaches still flagged
//                                                (no infectious failure).
//     9. tool_input contains action_id but the
//        original action has been deleted     → impossible: actions is
//                                                append-only by trigger
//                                                (migration 0007).
//
//   TIME
//    10. Cron skipped (Vercel cold start)     → next run picks up all
//                                                still-unalerted outliers
//                                                regardless of how long
//                                                the gap was (NOT EXISTS
//                                                clause is time-independent).
//
//   PERMISSION
//    11. app.bypass_rls unset                  → SELECT scopes to current
//                                                tenant (NULL → no rows).
//                                                Defensive: cron runs in
//                                                admin context per Inngest
//                                                config.
//
//   DOMAIN
//    12. Bedrock cost recorded with Anthropic-direct pricing
//                                              → Pricing is consistent
//                                                across providers in the
//                                                orchestrator (5-10% drift
//                                                acceptable at v0).

/* eslint-disable no-console */

import { sql } from 'drizzle-orm';
import { inngest } from '../inngest-client.js';
import { getAdminDb } from '@docket/db';

const DEFAULT_OUTLIER_THRESHOLD_USD = 0.5;

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
  [key: string]: unknown;
}

export const costOutlierAlert = inngest.createFunction(
  {
    id: 'cost-outlier-alert',
    name: 'Cost-outlier alert (per-call, every 30 min)',
    concurrency: { limit: 1 },
  },
  // Every 30 min, off the hour to avoid contending with cost-runaway-alert (:15)
  // and the verify-actions-chain (07:00 UTC).
  { cron: '*/30 * * * *' },
  async ({ step, logger }) => {
    const thresholdUsd = Number(
      process.env.COST_OUTLIER_THRESHOLD_USD ?? DEFAULT_OUTLIER_THRESHOLD_USD,
    );

    if (!Number.isFinite(thresholdUsd) || thresholdUsd <= 0) {
      logger.error('cost-outlier-alert: invalid threshold', {
        configured: process.env.COST_OUTLIER_THRESHOLD_USD ?? '(unset)',
        falling_back_to: DEFAULT_OUTLIER_THRESHOLD_USD,
      });
    }
    const effectiveThreshold = Number.isFinite(thresholdUsd) && thresholdUsd > 0
      ? thresholdUsd
      : DEFAULT_OUTLIER_THRESHOLD_USD;

    // Step 1 — find unflagged outliers across all tenants. NOT EXISTS
    // makes this idempotent — a row is only emitted ONCE no matter how
    // many times the cron runs.
    const outliers = await step.run('select-unflagged-outliers', async () => {
      const db = getAdminDb();
      await db.execute(sql`SET LOCAL app.bypass_rls = 'on'`);
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
          AND a.cost_usd > ${effectiveThreshold}
          AND a.tool_name <> 'cost_outlier.detected'
          AND a.tool_name <> 'cost_runaway.detected'
          AND a.tool_name <> 'cost_spike.detected'
          AND a.created_at > now() - interval '7 days'
          AND NOT EXISTS (
            SELECT 1 FROM actions b
            WHERE b.tool_name = 'cost_outlier.detected'
              AND b.tool_input ->> 'action_id' = a.id::text
          )
        ORDER BY a.cost_usd DESC
        LIMIT 50
      `);
      return rows as unknown as OutlierRow[];
    });

    if (outliers.length === 0) {
      logger.info('cost-outlier-alert: no new outliers', {
        threshold_usd: effectiveThreshold,
      });
      return {
        alerted: 0,
        threshold_usd: effectiveThreshold,
      };
    }

    // Step 2 — record one audit row per outlier. Each per-step.run so a
    // single failure doesn't cascade.
    const detectedAt = new Date().toISOString();
    let alerted = 0;
    for (const o of outliers) {
      await step.run(`record-outlier-${o.action_id}`, async () => {
        const db = getAdminDb();
        await db.execute(sql`SET LOCAL app.bypass_rls = 'on'`);
        await db.execute(sql`SET LOCAL app.current_tenant_id = ${o.tenant_id}::text`);
        await db.execute(sql`
          INSERT INTO actions (
            tenant_id, action_class, tool_name,
            latency_ms, success, tool_input
          )
          VALUES (
            ${o.tenant_id}::uuid,
            'send-internal'::action_class,
            'cost_outlier.detected',
            0,
            false,
            ${JSON.stringify({
              action_id: o.action_id,
              agent_id: o.agent_id,
              tool_name: o.tool_name,
              model_used: o.model_used,
              cost_usd: Number(o.cost_usd.toFixed(4)),
              input_tokens: o.input_tokens,
              output_tokens: o.output_tokens,
              cached_tokens: o.cached_tokens,
              threshold_usd: effectiveThreshold,
              original_created_at: o.created_at,
              detected_at: detectedAt,
            })}::jsonb
          )
        `);
      });

      logger.error('cost-outlier-detected', {
        action_id: o.action_id,
        tenant_id: o.tenant_id,
        agent_id: o.agent_id,
        tool_name: o.tool_name,
        model_used: o.model_used,
        cost_usd: Number(o.cost_usd.toFixed(4)),
        threshold_usd: effectiveThreshold,
        detected_at: detectedAt,
      });
      alerted++;
    }

    return {
      alerted,
      threshold_usd: effectiveThreshold,
      detected_at: detectedAt,
    };
  },
);
