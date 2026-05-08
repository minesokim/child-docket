// /api/admin/cost — Anthropic-spend visibility for firm owners.
//
// Per CLAUDE.md §7 + COSTS.md cost-discipline anchor + PRODUCTION-READINESS
// §B (V1). Pairs with the cost-runaway-alert hourly cron
// (services/workers/src/functions/cost-runaway-alert.ts):
//   - alert is PUSH (Sentry/Inngest dashboard fires when spend breaches)
//   - this endpoint is PULL — JSON consumer (cli, scripts, third-party)
//   - /dashboard/cost is the human-facing UI consumer (server-rendered)
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
//   Tenant-scoped via withTenant inside loadCostData — Antonio's spend
//   only, never another firm's. Even an admin Clerk session can't see
//   other tenants from this endpoint.
//
// AUTHZ
//   Limited to role='firm_owner' for now. Preparers don't get the
//   spend dashboard until role-scoped UI lands (V1.5).
//
// SECURITY
//   - Auth required (Clerk middleware enforces above this route).
//   - Role check inside the handler.
//   - No cross-tenant leakage (withTenant binds the SUM to RLS).
//   - No sensitive payload — actions.tool_input is deliberately not
//     surfaced; aggregates only.

import { type NextRequest } from 'next/server';
import { getCurrentDocketUser } from '@/lib/current-user';
import {
  loadCostData,
  ALLOWED_WINDOWS,
  WINDOW_INTERVAL,
  type Window,
} from '@/lib/cost-rollups';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  try {
    const data = await loadCostData(user.tenantId, WINDOW_INTERVAL[windowKey]);
    return Response.json(
      {
        window: windowKey,
        tenantId: user.tenantId,
        ...data,
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
