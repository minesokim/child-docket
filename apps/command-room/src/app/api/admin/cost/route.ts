// /api/admin/cost — Anthropic-spend visibility for firm owners.
//
// Per CLAUDE.md §7 + COSTS.md cost-discipline anchor + PRODUCTION-READINESS
// §B (V1). Pairs with the cost-runaway-alert hourly cron
// (services/workers/src/functions/cost-runaway-alert.ts):
//   - alert is PUSH (Sentry/Inngest dashboard fires when spend breaches)
//   - this endpoint is PULL (Antonio loads the page to see where money
//     went)
//
// CONTRACT
//   GET /api/admin/cost
//     → 200 { window: '24h' | '7d' | '30d', tenantId, totals, perAgent,
//             perModel, perProvider, perDay }
//     → 401 if not signed in
//     → 403 if signed in but role != 'firm_owner'
//     → 503 if DB unreachable
//
//   Query params:
//     ?window=24h | 7d | 30d   (default 7d)
//
// SCOPING
//   Tenant-scoped via withTenant — Antonio's spend only, never another
//   firm's. Even an Antonio with an admin Clerk session can't see other
//   tenants from this endpoint.
//
// AUTHZ
//   Limited to role='firm_owner' for now. Preparers don't get the
//   spend dashboard until role-scoped UI lands (V1.5). The data is
//   not catastrophically sensitive (no client PII), but spend visibility
//   is firm-owner concern by default.
//
// SECURITY
//   - Auth required (Clerk middleware enforces this above the route).
//   - Role check inside the handler.
//   - No cross-tenant leakage (withTenant binds the SUM to RLS).
//   - No sensitive payload — actions.tool_input includes prompt id +
//     model tier but we deliberately don't surface tool_input from this
//     endpoint. The client-side cost dashboard only needs aggregates.

import { type NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { withTenant } from '@docket/db';
import type { TenantId } from '@docket/shared';
import { getCurrentDocketUser } from '@/lib/current-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Window = '24h' | '7d' | '30d';
const ALLOWED_WINDOWS: Window[] = ['24h', '7d', '30d'];

const WINDOW_TO_INTERVAL: Record<Window, string> = {
  '24h': '24 hours',
  '7d': '7 days',
  '30d': '30 days',
};

interface AgentSpendRow {
  agent_id: string | null;
  total_usd: number;
  call_count: number;
  [key: string]: unknown;
}

interface ModelSpendRow {
  model_used: string | null;
  total_usd: number;
  call_count: number;
  [key: string]: unknown;
}

interface ProviderSpendRow {
  provider: 'anthropic' | 'bedrock' | 'other';
  total_usd: number;
  call_count: number;
  [key: string]: unknown;
}

interface DaySpendRow {
  day: string;
  total_usd: number;
  call_count: number;
  [key: string]: unknown;
}

interface TotalsRow {
  total_usd: number;
  call_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cached_tokens: number;
  [key: string]: unknown;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentDocketUser();
  if (!user) {
    return Response.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (user.role !== 'firm_owner') {
    return Response.json({ error: 'forbidden', role: user.role }, { status: 403 });
  }

  const searchParams = req.nextUrl.searchParams;
  const windowParam = (searchParams.get('window') ?? '7d') as Window;
  const windowKey: Window = ALLOWED_WINDOWS.includes(windowParam) ? windowParam : '7d';
  const interval = WINDOW_TO_INTERVAL[windowKey];

  try {
    const result = await withTenant(user.tenantId as TenantId, async (db) => {
      // Totals — single-row aggregate over the window.
      const totalsRows = await db.execute<TotalsRow>(sql`
        SELECT
          COALESCE(SUM(cost_usd), 0)::float8 AS total_usd,
          COUNT(*)::int AS call_count,
          COALESCE(SUM(input_tokens), 0)::bigint AS total_input_tokens,
          COALESCE(SUM(output_tokens), 0)::bigint AS total_output_tokens,
          COALESCE(SUM(cached_tokens), 0)::bigint AS total_cached_tokens
        FROM actions
        WHERE created_at > now() - (${interval})::interval
          AND cost_usd IS NOT NULL
      `);
      const totals = (totalsRows as unknown as TotalsRow[])[0] ?? {
        total_usd: 0,
        call_count: 0,
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_cached_tokens: 0,
      };

      // Per-agent rollup. agent_id NULL groups together as 'orchestrator'
      // (calls made without an agent context — typically internal).
      const perAgentRows = await db.execute<AgentSpendRow>(sql`
        SELECT
          agent_id,
          COALESCE(SUM(cost_usd), 0)::float8 AS total_usd,
          COUNT(*)::int AS call_count
        FROM actions
        WHERE created_at > now() - (${interval})::interval
          AND cost_usd IS NOT NULL
        GROUP BY agent_id
        ORDER BY total_usd DESC
      `);

      // Per-model rollup. model_used NULL is rare but possible for legacy
      // rows pre-orchestrator-telemetry (returns 'unknown' bucket).
      const perModelRows = await db.execute<ModelSpendRow>(sql`
        SELECT
          model_used,
          COALESCE(SUM(cost_usd), 0)::float8 AS total_usd,
          COUNT(*)::int AS call_count
        FROM actions
        WHERE created_at > now() - (${interval})::interval
          AND cost_usd IS NOT NULL
        GROUP BY model_used
        ORDER BY total_usd DESC
      `);

      // Per-provider rollup. tool_name pattern: anthropic.messages.create
      // or bedrock.converse. CASE coerces unknown strings into 'other'.
      const perProviderRows = await db.execute<ProviderSpendRow>(sql`
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
      `);

      // Per-day rollup over the same window. ISO day strings let the
      // client render a date-x-axis without timezone math.
      const perDayRows = await db.execute<DaySpendRow>(sql`
        SELECT
          to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
          COALESCE(SUM(cost_usd), 0)::float8 AS total_usd,
          COUNT(*)::int AS call_count
        FROM actions
        WHERE created_at > now() - (${interval})::interval
          AND cost_usd IS NOT NULL
        GROUP BY day
        ORDER BY day ASC
      `);

      return {
        totals,
        perAgent: perAgentRows as unknown as AgentSpendRow[],
        perModel: perModelRows as unknown as ModelSpendRow[],
        perProvider: perProviderRows as unknown as ProviderSpendRow[],
        perDay: perDayRows as unknown as DaySpendRow[],
      };
    });

    return Response.json(
      {
        window: windowKey,
        tenantId: user.tenantId,
        ...result,
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('[api/admin/cost] failed', err);
    return Response.json(
      {
        error: 'cost_query_failed',
        message: err instanceof Error ? err.message : 'unknown',
      },
      { status: 503 },
    );
  }
}
