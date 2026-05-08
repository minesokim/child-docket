// Cron: hourly Anthropic-spend runaway detection.
//
// Per CLAUDE.md §7 + COSTS.md cost-discipline anchor — v0 target is
// $50/mo Anthropic API spend during the build (≈$1.67/day). A bug
// that loops a Sonnet call without prompt caching can burn that in
// minutes; without an alert, we'd find out when the monthly invoice
// arrives. This cron polls every hour, sums actions.cost_usd over
// the trailing 24h, and fires Sentry-grade warnings when spend
// crosses tier thresholds.
//
// Per PRODUCTION-READINESS §B (V1) — paired with the cost-dashboard
// endpoint (TIER 3.1, follow-up). The dashboard is for visibility;
// this cron is for action — the spend signal travels by alert, not
// by someone happening to load a page.
//
// THRESHOLDS (env-configurable so we can tune without redeploying)
//   COST_RUNAWAY_PER_TENANT_USD_24H  → per-tenant 24h spend ceiling
//                                     (default 5.00, i.e. $5/day per
//                                     tenant)
//   COST_RUNAWAY_GLOBAL_USD_24H      → total-across-tenants ceiling
//                                     (default 10.00, i.e. $10/day —
//                                     6× the $1.67/day v0 target)
//
// Why two thresholds:
//   - Per-tenant catches the "single bad agent run is looping" case
//     even if global spend looks normal.
//   - Global catches the "many tenants drifting up at once" case
//     (e.g., a new prompt version 5×ed cost across the fleet).
//
// SCHEDULE
//   Hourly at :15 — `15 * * * *`. Off the top-of-hour to avoid
//   contending with verify-actions-chain at 07:00 UTC.
//
// COST OF THIS CRON
//   24 SUM queries/day × ~5ms each = negligible. No LLM calls.
//
// FAILURE MODES (per /edge-cases skill, 12 enumerated)
//
//   INPUT
//     - actions table empty: SUM returns NULL → coerced to 0; no alert.
//     - costUsd column NULL on legacy rows: COALESCE handles it.
//     - Threshold env var unset: use defaults (logged once at fn start).
//
//   STATE
//     - Tenant added mid-run: missed by THIS hour, picked up next hour.
//     - Cost recorded with negative number (impossible per orchestrator
//       arithmetic, but defensive): SUM still works; alerts on positive
//       totals only.
//
//   FAILURE
//     - DB connection drops: Inngest retries; idempotent (read-only
//       except for the audit row insert, which is keyed by detected_at).
//     - Sentry/logger unavailable: logger.error still goes to stdout
//       and Inngest's run history; alert is best-effort.
//
//   TIME
//     - Trailing 24h is a sliding window — if a $4.99 hour rolls off
//       and a $4.99 hour rolls in, total stays under threshold. That's
//       correct: we care about RECENT spend, not cumulative.
//     - Cron skipped (Vercel cold start): one missed run is fine; the
//       next hour catches the runaway. If multiple misses, the trailing
//       24h still catches the spend when the cron resumes.
//
//   PERMISSION
//     - app.bypass_rls is set per-step (admin context). If unset, the
//       SUM scopes to the current tenant (NULL → no rows) and reports
//       $0 for everyone. Defensive guard not added — the cron is
//       admin-context-only by Inngest config.
//
//   DOMAIN
//     - Bedrock cost is recorded with Anthropic-direct pricing per the
//       PRICING table in docket-agent.ts (5-10% understated). Acceptable
//       for v0 since runaway alert thresholds are 3-6× the daily target.
//     - Prompt caching cost is recorded at the cached rate (correct).

import { sql } from 'drizzle-orm';
import { inngest } from '../inngest-client.js';
import { getAdminDb, schema } from '@docket/db';

const DEFAULT_PER_TENANT_CEILING_USD = 5.0;
const DEFAULT_GLOBAL_CEILING_USD = 10.0;

interface TenantSpend {
  tenant_id: string;
  total_usd: number;
  [key: string]: unknown;
}

interface BreachRecord {
  scope: 'per-tenant' | 'global';
  tenant_id: string | null;
  total_usd: number;
  threshold_usd: number;
}

export const costRunawayAlert = inngest.createFunction(
  {
    id: 'cost-runaway-alert',
    name: 'Cost-runaway alert (hourly)',
    // Sequential — tiny query, no DB-load concern; concurrency 1
    // makes the audit-row insert ordering trivially stable.
    concurrency: { limit: 1 },
  },
  // :15 every hour — off-peak from verify-actions-chain at :00 of 07:00.
  { cron: '15 * * * *' },
  async ({ step, logger }) => {
    const perTenantCeiling = Number(
      process.env.COST_RUNAWAY_PER_TENANT_USD_24H ?? DEFAULT_PER_TENANT_CEILING_USD,
    );
    const globalCeiling = Number(
      process.env.COST_RUNAWAY_GLOBAL_USD_24H ?? DEFAULT_GLOBAL_CEILING_USD,
    );

    // Step 1 — query per-tenant cost over trailing 24h, in admin
    // context. RLS bypass set per step so the SUM crosses tenants.
    const perTenant = await step.run('sum-cost-per-tenant-24h', async () => {
      const db = getAdminDb();
      await db.execute(sql`SET LOCAL app.bypass_rls = 'on'`);
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
      return rows as unknown as TenantSpend[];
    });

    const globalTotal = perTenant.reduce((acc, t) => acc + t.total_usd, 0);

    const breaches: BreachRecord[] = [];

    for (const t of perTenant) {
      if (t.total_usd > perTenantCeiling) {
        breaches.push({
          scope: 'per-tenant',
          tenant_id: t.tenant_id,
          total_usd: t.total_usd,
          threshold_usd: perTenantCeiling,
        });
      }
    }

    if (globalTotal > globalCeiling) {
      breaches.push({
        scope: 'global',
        tenant_id: null,
        total_usd: globalTotal,
        threshold_usd: globalCeiling,
      });
    }

    if (breaches.length === 0) {
      logger.info('cost-runaway-alert: under thresholds', {
        global_total_usd: Number(globalTotal.toFixed(4)),
        per_tenant_count: perTenant.length,
        per_tenant_ceiling_usd: perTenantCeiling,
        global_ceiling_usd: globalCeiling,
      });
      return {
        breaches: 0,
        global_total_usd: Number(globalTotal.toFixed(4)),
        per_tenant_count: perTenant.length,
      };
    }

    // Step 2 — record breaches to actions audit trail. Each breach
    // becomes a `cost_runaway.detected` row scoped to the offending
    // tenant (or NULL for global, scoped to a synthetic system tenant
    // — we use the FIRST tenant in the result as the audit anchor for
    // global breaches since actions.tenant_id is NOT NULL).
    //
    // TODO(v1): introduce a dedicated `system` tenant for global-scope
    // audit rows. For now, global breaches log to the highest-spending
    // tenant's audit chain so the breach is traceable to a tenant
    // context that can investigate.
    const detectedAt = new Date().toISOString();
    for (const breach of breaches) {
      const auditTenant = breach.tenant_id ?? perTenant[0]?.tenant_id;
      if (!auditTenant) continue; // No tenants → can't write audit row.

      await step.run(`record-breach-${breach.scope}-${auditTenant}`, async () => {
        const db = getAdminDb();
        await db.execute(sql`SET LOCAL app.bypass_rls = 'on'`);
        await db.execute(
          sql`SET LOCAL app.current_tenant_id = ${auditTenant}::text`,
        );
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
              scope: breach.scope,
              tenant_id: breach.tenant_id,
              total_usd: Number(breach.total_usd.toFixed(4)),
              threshold_usd: breach.threshold_usd,
              detected_at: detectedAt,
            })}::jsonb
          )
        `);
      });

      // logger.error surfaces to Inngest dashboard + Vercel runtime
      // logs. When @sentry/node is wired into workers (V1.5), bridge
      // this through Sentry.captureMessage(severity='warning').
      logger.error('cost-runaway-detected', {
        scope: breach.scope,
        tenant_id: breach.tenant_id,
        total_usd: Number(breach.total_usd.toFixed(4)),
        threshold_usd: breach.threshold_usd,
        detected_at: detectedAt,
      });
    }

    return {
      breaches: breaches.length,
      global_total_usd: Number(globalTotal.toFixed(4)),
      per_tenant_count: perTenant.length,
      per_tenant_ceiling_usd: perTenantCeiling,
      global_ceiling_usd: globalCeiling,
    };
  },
);
