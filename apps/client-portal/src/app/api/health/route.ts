// /api/health — vendor health probe (client-portal mirror).
//
// Identical contract to the command-room version at the same path.
// Two route files instead of one shared helper because:
//   - Vercel routes are colocated under each app's app/api directory.
//   - The handler is < 50 lines; abstracting is overkill.
// If a third app appears, factor into packages/db/health.ts.
//
// Public endpoint, allowlisted in src/middleware.ts. Returns:
//   GET /api/health → 200 { db: { status, latencyMs }, timestamp }
//                   → 503 same shape but db.status='down'

import { type NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { getAdminDb } from '@docket/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DB_TIMEOUT_MS = 1500;
const DB_DEGRADED_MS = 500;
const CACHE_TTL_MS = 5000;

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
