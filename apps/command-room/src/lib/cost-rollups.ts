// Cost rollup queries shared between /api/admin/cost (the JSON
// endpoint) and /dashboard/cost (the UI surface).
//
// Co-located in apps/command-room/src/lib so both consumers share
// the exact SQL + TypeScript shapes. RLS-bound via withTenant — no
// caller can leak across tenants by construction.

import { sql } from 'drizzle-orm';
import { withTenant } from '@docket/db';
import type { TenantId } from '@docket/shared';

export type Window = '24h' | '7d' | '30d';
export const ALLOWED_WINDOWS: Window[] = ['24h', '7d', '30d'];
export const WINDOW_INTERVAL: Record<Window, string> = {
  '24h': '24 hours',
  '7d': '7 days',
  '30d': '30 days',
};

export interface AgentSpendRow {
  agent_id: string | null;
  total_usd: number;
  call_count: number;
  [key: string]: unknown;
}
export interface ModelSpendRow {
  model_used: string | null;
  total_usd: number;
  call_count: number;
  [key: string]: unknown;
}
export interface ProviderSpendRow {
  provider: 'anthropic' | 'bedrock' | 'other';
  total_usd: number;
  call_count: number;
  [key: string]: unknown;
}
export interface DaySpendRow {
  day: string;
  total_usd: number;
  call_count: number;
  [key: string]: unknown;
}
export interface TotalsRow {
  total_usd: number;
  call_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cached_tokens: number;
  [key: string]: unknown;
}

export interface CostData {
  totals: TotalsRow;
  perAgent: AgentSpendRow[];
  perModel: ModelSpendRow[];
  perProvider: ProviderSpendRow[];
  perDay: DaySpendRow[];
}

/**
 * One row of the alerts banner shown on /dashboard/cost. Each shape is
 * a snapshot of a `cost_runaway.detected` / `cost_outlier.detected` /
 * `cost_spike.detected` audit row. The cost-runaway-alert,
 * cost-outlier-alert, and cost-spike-alert Inngest crons emit these.
 */
export type CostAlertKind =
  | 'cost_runaway.detected'
  | 'cost_outlier.detected'
  | 'cost_spike.detected';

export interface CostAlertRow {
  kind: CostAlertKind;
  detected_at: string;
  payload: Record<string, unknown>;
}

/**
 * Aggregate cost telemetry for a tenant over a relative time window.
 * 5 independent SUM/GROUP BY queries run in parallel; total latency
 * is one query's worth (~30-50ms on dev DB; bounded by the slowest).
 *
 * RLS-bound via withTenant — the SUM is always tenant-scoped.
 */
export async function loadCostData(
  tenantId: string,
  interval: string,
): Promise<CostData> {
  return await withTenant(tenantId as TenantId, async (db) => {
    const [totalsResult, perAgent, perModel, perProvider, perDay] = await Promise.all([
      db.execute<TotalsRow>(sql`
        SELECT
          COALESCE(SUM(cost_usd), 0)::float8 AS total_usd,
          COUNT(*)::int AS call_count,
          COALESCE(SUM(input_tokens), 0)::bigint AS total_input_tokens,
          COALESCE(SUM(output_tokens), 0)::bigint AS total_output_tokens,
          COALESCE(SUM(cached_tokens), 0)::bigint AS total_cached_tokens
        FROM actions
        WHERE created_at > now() - (${interval})::interval
          AND cost_usd IS NOT NULL
      `),
      db.execute<AgentSpendRow>(sql`
        SELECT agent_id,
               COALESCE(SUM(cost_usd), 0)::float8 AS total_usd,
               COUNT(*)::int AS call_count
        FROM actions
        WHERE created_at > now() - (${interval})::interval
          AND cost_usd IS NOT NULL
        GROUP BY agent_id
        ORDER BY total_usd DESC
      `),
      db.execute<ModelSpendRow>(sql`
        SELECT model_used,
               COALESCE(SUM(cost_usd), 0)::float8 AS total_usd,
               COUNT(*)::int AS call_count
        FROM actions
        WHERE created_at > now() - (${interval})::interval
          AND cost_usd IS NOT NULL
        GROUP BY model_used
        ORDER BY total_usd DESC
      `),
      db.execute<ProviderSpendRow>(sql`
        SELECT
          CASE
            WHEN tool_name LIKE 'anthropic.%' THEN 'anthropic'
            WHEN tool_name LIKE 'bedrock.%' THEN 'bedrock'
            ELSE 'other'
          END AS provider,
          COALESCE(SUM(cost_usd), 0)::float8 AS total_usd,
          COUNT(*)::int AS call_count
        FROM actions
        WHERE created_at > now() - (${interval})::interval
          AND cost_usd IS NOT NULL
        GROUP BY provider
        ORDER BY total_usd DESC
      `),
      db.execute<DaySpendRow>(sql`
        SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
               COALESCE(SUM(cost_usd), 0)::float8 AS total_usd,
               COUNT(*)::int AS call_count
        FROM actions
        WHERE created_at > now() - (${interval})::interval
          AND cost_usd IS NOT NULL
        GROUP BY day
        ORDER BY day ASC
      `),
    ]);

    const totals = (totalsResult as unknown as TotalsRow[])[0] ?? {
      total_usd: 0,
      call_count: 0,
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_cached_tokens: 0,
    };

    return {
      totals,
      perAgent: perAgent as unknown as AgentSpendRow[],
      perModel: perModel as unknown as ModelSpendRow[],
      perProvider: perProvider as unknown as ProviderSpendRow[],
      perDay: perDay as unknown as DaySpendRow[],
    };
  });
}

interface RawAlertRow {
  kind: string;
  detected_at: string;
  payload: unknown;
  [key: string]: unknown;
}

/**
 * Load the recent cost alerts for a tenant, newest first.
 *
 * Surfaced on /dashboard/cost as a banner above the rollup. Three kinds:
 *   - cost_runaway.detected — 24h aggregate exceeded (per-tenant or global)
 *   - cost_outlier.detected — single call exceeded threshold ($0.50 default)
 *   - cost_spike.detected   — today's spend > 1.5× yesterday's
 *
 * RLS-bound via withTenant — Antonio sees his alerts only.
 */
export async function loadCostAlerts(
  tenantId: string,
  interval: string,
  limit = 12,
): Promise<CostAlertRow[]> {
  return await withTenant(tenantId as TenantId, async (db) => {
    const rows = await db.execute<RawAlertRow>(sql`
      SELECT
        tool_name AS kind,
        created_at::text AS detected_at,
        tool_input AS payload
      FROM actions
      WHERE tool_name IN (
        'cost_runaway.detected',
        'cost_outlier.detected',
        'cost_spike.detected'
      )
        AND created_at > now() - (${interval})::interval
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);
    return (rows as unknown as RawAlertRow[])
      .filter((r): r is RawAlertRow & { kind: CostAlertKind } =>
        r.kind === 'cost_runaway.detected' ||
        r.kind === 'cost_outlier.detected' ||
        r.kind === 'cost_spike.detected',
      )
      .map((r) => ({
        kind: r.kind,
        detected_at: r.detected_at,
        payload: (r.payload && typeof r.payload === 'object'
          ? (r.payload as Record<string, unknown>)
          : {}) as Record<string, unknown>,
      }));
  });
}
