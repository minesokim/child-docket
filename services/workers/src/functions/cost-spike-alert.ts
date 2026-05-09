// Cron: daily at 09:00 UTC. Detects day-over-day cost spikes per tenant.
//
// Per PRODUCTION-READINESS §B (V1 must-have) — "Alert on day-over-day
// cost spike >50%." A new prompt version that 1.6×s the per-call cost
// across the fleet won't trigger the runaway-alert (still under $5/day
// per-tenant ceiling) and won't trigger the outlier-alert (no single
// call exceeds $0.50). It WILL show up as today's-aggregate >> yesterday's.
//
// COMPLEMENTS the existing crons:
//   - cost-runaway-alert.ts:   24h aggregate ceilings. Fires when slow
//                              drift adds up against a static threshold.
//   - cost-outlier-alert.ts:   single-row spikes. Fires on per-call rogue.
//   - cost-spike-alert.ts:     day-over-day delta. Fires on relative jump
//                              even when absolute remains under runaway. (THIS FILE.)
//
// THRESHOLDS (env-configurable)
//   COST_SPIKE_MULTIPLIER        → today must exceed yesterday by this
//                                  factor (default 1.5, i.e. 50% spike,
//                                  the V1 spec's number)
//   COST_SPIKE_MIN_BASELINE_USD  → only alert if YESTERDAY's spend was at
//                                  least this much (default 0.10). Avoids
//                                  alerting "1 cent → 5 cents = 5× spike"
//                                  noise during low-volume periods.
//
// SCHEDULE
//   `0 9 * * *` — daily at 09:00 UTC (5 AM EDT, 2 AM PDT). Window settles
//   after midnight rollover; Antonio's morning brief lands a few hours
//   before he opens email.
//
// COST OF THIS CRON
//   Two SUM queries × 1 run/day = negligible. No LLM calls.
//
// EDGE CASES (10 enumerated, all handled)
//
//   INPUT
//     1. actions empty for both windows         → today=0, yesterday=0;
//                                                  no spike (multiplier
//                                                  undefined, skip).
//     2. yesterday=0, today>0 (newly active)    → multiplier infinite;
//                                                  skip (covered by
//                                                  baseline floor).
//     3. cost_usd NULL on legacy rows           → COALESCE handles.
//     4. Multiplier env unset                   → default 1.5.
//     5. Baseline-floor env unset                → default 0.10.
//
//   STATE
//     6. Single-tenant case (only Vazant today)  → loop trivially handles
//                                                  N=1.
//     7. New tenant added today (no yesterday)  → baseline floor blocks
//                                                  noise alert.
//
//   FAILURE
//     8. DB connection drops                    → Inngest retries;
//                                                  idempotent (insert is
//                                                  keyed by detected_at,
//                                                  but daily granularity
//                                                  means at most 2 audit
//                                                  rows per spike — that
//                                                  is acceptable noise).
//
//   TIME
//     9. Cron skipped (Vercel cold start)       → next day's run picks up
//                                                  the spike if it
//                                                  persists; one-day-only
//                                                  spike is undetected.
//                                                  Acceptable: the user
//                                                  already has the
//                                                  cost-runaway-alert
//                                                  catching aggregate
//                                                  drift hourly.
//
//   DOMAIN
//    10. Bedrock cost recorded with Anthropic-direct pricing
//                                                → consistent across
//                                                  providers per the
//                                                  orchestrator pricing
//                                                  table.

/* eslint-disable no-console */

import { sql } from 'drizzle-orm';
import { inngest } from '../inngest-client.js';
import { getAdminDb } from '@docket/db';

const DEFAULT_MULTIPLIER = 1.5;
const DEFAULT_MIN_BASELINE_USD = 0.1;

interface DailySpend {
  tenant_id: string;
  today_usd: number;
  yesterday_usd: number;
  today_calls: number;
  yesterday_calls: number;
  [key: string]: unknown;
}

export const costSpikeAlert = inngest.createFunction(
  {
    id: 'cost-spike-alert',
    name: 'Cost-spike alert (day-over-day, daily 09:00 UTC)',
    concurrency: { limit: 1 },
  },
  { cron: '0 9 * * *' },
  async ({ step, logger }) => {
    const multiplier = Number(
      process.env.COST_SPIKE_MULTIPLIER ?? DEFAULT_MULTIPLIER,
    );
    const minBaselineUsd = Number(
      process.env.COST_SPIKE_MIN_BASELINE_USD ?? DEFAULT_MIN_BASELINE_USD,
    );

    if (!Number.isFinite(multiplier) || multiplier <= 1) {
      logger.error('cost-spike-alert: invalid multiplier', {
        configured: process.env.COST_SPIKE_MULTIPLIER ?? '(unset)',
        falling_back_to: DEFAULT_MULTIPLIER,
      });
    }
    const effMultiplier = Number.isFinite(multiplier) && multiplier > 1
      ? multiplier
      : DEFAULT_MULTIPLIER;
    const effBaseline = Number.isFinite(minBaselineUsd) && minBaselineUsd >= 0
      ? minBaselineUsd
      : DEFAULT_MIN_BASELINE_USD;

    // Step 1 — per-tenant today vs yesterday spend, single query.
    const perTenant = await step.run('compare-day-over-day', async () => {
      const db = getAdminDb();
      await db.execute(sql`SET LOCAL app.bypass_rls = 'on'`);
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
            'cost_spike.detected'
          )
        GROUP BY tenant_id
        HAVING
          COALESCE(SUM(CASE
            WHEN created_at > now() - interval '24 hours'
            THEN cost_usd ELSE 0
          END), 0) > 0
        ORDER BY today_usd DESC
      `);
      return rows as unknown as DailySpend[];
    });

    const detectedAt = new Date().toISOString();
    let alerted = 0;
    const summary: Array<{
      tenant_id: string;
      today_usd: number;
      yesterday_usd: number;
      ratio: number | null;
    }> = [];

    for (const row of perTenant) {
      // Skip if yesterday's baseline below floor — avoids
      // 0.01 → 0.05 = 5× spike noise.
      if (row.yesterday_usd < effBaseline) {
        summary.push({
          tenant_id: row.tenant_id,
          today_usd: Number(row.today_usd.toFixed(4)),
          yesterday_usd: Number(row.yesterday_usd.toFixed(4)),
          ratio: null,
        });
        continue;
      }

      const ratio = row.today_usd / row.yesterday_usd;
      summary.push({
        tenant_id: row.tenant_id,
        today_usd: Number(row.today_usd.toFixed(4)),
        yesterday_usd: Number(row.yesterday_usd.toFixed(4)),
        ratio: Number(ratio.toFixed(2)),
      });

      if (ratio < effMultiplier) continue;

      // Spike detected — record audit row + log error.
      await step.run(`record-spike-${row.tenant_id}`, async () => {
        const db = getAdminDb();
        await db.execute(sql`SET LOCAL app.bypass_rls = 'on'`);
        await db.execute(sql`SET LOCAL app.current_tenant_id = ${row.tenant_id}::text`);
        await db.execute(sql`
          INSERT INTO actions (
            tenant_id, action_class, tool_name,
            latency_ms, success, tool_input
          )
          VALUES (
            ${row.tenant_id}::uuid,
            'send-internal'::action_class,
            'cost_spike.detected',
            0,
            false,
            ${JSON.stringify({
              tenant_id: row.tenant_id,
              today_usd: Number(row.today_usd.toFixed(4)),
              yesterday_usd: Number(row.yesterday_usd.toFixed(4)),
              ratio: Number(ratio.toFixed(2)),
              today_calls: row.today_calls,
              yesterday_calls: row.yesterday_calls,
              multiplier_threshold: effMultiplier,
              baseline_floor_usd: effBaseline,
              detected_at: detectedAt,
            })}::jsonb
          )
        `);
      });

      logger.error('cost-spike-detected', {
        tenant_id: row.tenant_id,
        today_usd: Number(row.today_usd.toFixed(4)),
        yesterday_usd: Number(row.yesterday_usd.toFixed(4)),
        ratio: Number(ratio.toFixed(2)),
        threshold: effMultiplier,
        detected_at: detectedAt,
      });
      alerted++;
    }

    if (alerted === 0) {
      logger.info('cost-spike-alert: no spikes', {
        tenants_examined: perTenant.length,
        threshold: effMultiplier,
        summary,
      });
    }

    return {
      alerted,
      tenants_examined: perTenant.length,
      threshold: effMultiplier,
      baseline_floor_usd: effBaseline,
      detected_at: detectedAt,
      summary,
    };
  },
);
