// /api/health — vendor health probe.
//
// Public endpoint. Returns service-status booleans for downstream
// clients (HealthStatusGate in packages/ui polls this every 30s and
// flips ReadOnlyProvider + status banners accordingly).
//
// v1 scope: db only. Anthropic + R2 health are deferred — Anthropic
// failover is observable via the `provider` field on action rows
// (Bedrock fallback is normal during transient outages); R2 health
// would need a HEAD request to a known key with the right env wiring.
//
// CONTRACT
//   GET /api/health → 200 with { db: { status, latencyMs }, timestamp }
//                  → 503 same shape but db.status='down'
//
// SECURITY
//   - Public (no Clerk auth gate). Reveals only the binary state of
//     services + a coarse latency number — no tenant data.
//   - Allowlisted in src/middleware.ts isPublicRoute matcher (paired
//     with this route in the same commit).
//   - Rate-limit defense relies on Vercel's edge layer + the 1.5s
//     timeout below.

import { type NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { getAdminDb } from '@docket/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DB_TIMEOUT_MS = 1500;
const DB_DEGRADED_MS = 500; // DB ping > 500ms = degraded (warning shape)
const CACHE_TTL_MS = 5000;   // 5s in-process cache. Caps DB load from
                             // unauth bots / many concurrent gates polling
                             // the same lambda.

type ServiceStatus = 'healthy' | 'degraded' | 'down';
type DbResult = { status: ServiceStatus; latencyMs: number };

let cachedAt = 0;
let cachedResult: DbResult | null = null;

async function checkDb(): Promise<DbResult> {
  const now = Date.now();
  if (cachedResult && now - cachedAt < CACHE_TTL_MS) {
    return cachedResult;
  }

  const t0 = Date.now();
  let result: DbResult;
  try {
    const db = getAdminDb();
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('db_check_timeout')), DB_TIMEOUT_MS),
    );
    await Promise.race([db.execute(sql`SELECT 1`), timeout]);
    const latencyMs = Date.now() - t0;
    result = {
      status: latencyMs > DB_DEGRADED_MS ? 'degraded' : 'healthy',
      latencyMs,
    };
  } catch {
    result = { status: 'down', latencyMs: Date.now() - t0 };
  }

  cachedResult = result;
  cachedAt = now;
  return result;
}

export async function GET(_req: NextRequest) {
  const db = await checkDb();
  const body = { db, timestamp: new Date().toISOString() };
  return Response.json(body, { status: db.status === 'down' ? 503 : 200 });
}
