// /api/health — vendor health probe + schema-state check.
//
// Public endpoint. Returns service-status booleans for downstream
// clients (HealthStatusGate in packages/ui polls this every 30s and
// flips ReadOnlyProvider + status banners accordingly).
//
// CONTRACT
//   GET /api/health
//     → 200 with { db: { status, latencyMs }, schema, timestamp }
//     → 503 same shape but db.status='down'
//
// SCHEMA-STATE FIELD (added 2026-05-08)
//   `schema.migrationsApplied` reports whether tonight's migrations
//   0019-0022 are present on the connected DB. Lets us verify
//   prod-vs-dev schema parity from outside the lambda by curling
//   the endpoint. The check is a single information_schema query
//   that runs alongside the DB-ping and adds ~5-15ms.
//
//   This is intentionally NOT auth-gated. The information disclosure
//   is "do these tables exist" — observable from any other side
//   effect anyway (e.g., a 500 from an action insert reveals the
//   schema state). Public access is the right trade-off for the
//   observability gain.
//
// SECURITY
//   - Public (no Clerk auth gate). Reveals only binary service state
//     + latency + schema booleans — no tenant data.
//   - Allowlisted in src/middleware.ts isPublicRoute matcher.
//   - Rate-limit defense via 1.5s timeout + 5s in-process cache.

import { type NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import {
  getAdminDb,
  checkPrimaryDb,
  checkReadReplica,
  type DbStatusResult,
  type ReplicaStatusResult,
} from '@docket/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CACHE_TTL_MS = 5000;

type SchemaResult = {
  // Tables/columns/functions tonight's migrations 0019-0022 are
  // expected to install. Each field is true if the artifact exists
  // on the connected DB.
  firmProfileTable: boolean;
  firmPatternsTable: boolean;
  clientFactsTable: boolean;
  actionsChainSeqColumn: boolean;
  verifyActionsChainFn: boolean;
  // Convenience: are ALL the above true? Use this from monitoring.
  allMigrationsApplied: boolean;
};
// Combined response shape. Adding `replica` is backwards-compatible:
// older HealthStatusGate clients ignore unknown fields.
type CombinedResult = {
  db: DbStatusResult;
  replica: ReplicaStatusResult;
  schema: SchemaResult | null;
};

let cachedAt = 0;
let cachedResult: CombinedResult | null = null;

async function checkSchema(): Promise<SchemaResult | null> {
  try {
    const db = getAdminDb();
    // One query reveals all five artifacts via UNION ALL. Cheap.
    const rows = await db.execute<{ artifact: string; present: boolean }>(sql`
      SELECT 'firm_profile_table' AS artifact,
             EXISTS (SELECT 1 FROM information_schema.tables
                      WHERE table_schema = 'public' AND table_name = 'firm_profile') AS present
      UNION ALL
      SELECT 'firm_patterns_table',
             EXISTS (SELECT 1 FROM information_schema.tables
                      WHERE table_schema = 'public' AND table_name = 'firm_patterns')
      UNION ALL
      SELECT 'client_facts_table',
             EXISTS (SELECT 1 FROM information_schema.tables
                      WHERE table_schema = 'public' AND table_name = 'client_facts')
      UNION ALL
      SELECT 'actions_chain_seq_column',
             EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema = 'public' AND table_name = 'actions'
                        AND column_name = 'chain_seq')
      UNION ALL
      SELECT 'verify_actions_chain_fn',
             EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'verify_actions_chain')
    `);
    const map = new Map<string, boolean>();
    for (const row of rows as unknown as Array<{ artifact: string; present: boolean }>) {
      map.set(row.artifact, row.present === true);
    }
    const result: SchemaResult = {
      firmProfileTable: map.get('firm_profile_table') ?? false,
      firmPatternsTable: map.get('firm_patterns_table') ?? false,
      clientFactsTable: map.get('client_facts_table') ?? false,
      actionsChainSeqColumn: map.get('actions_chain_seq_column') ?? false,
      verifyActionsChainFn: map.get('verify_actions_chain_fn') ?? false,
      allMigrationsApplied: false,
    };
    result.allMigrationsApplied =
      result.firmProfileTable &&
      result.firmPatternsTable &&
      result.clientFactsTable &&
      result.actionsChainSeqColumn &&
      result.verifyActionsChainFn;
    return result;
  } catch {
    return null; // schema query failed; don't leak details
  }
}

async function checkAll(): Promise<CombinedResult> {
  const now = Date.now();
  if (cachedResult && now - cachedAt < CACHE_TTL_MS) {
    return cachedResult;
  }
  // Run in parallel — three independent probes:
  //   - primary DB (one round-trip; SELECT 1)
  //   - read replica (one round-trip on a separate pool, OR
  //     short-circuited to 'not-configured' when env unset)
  //   - schema check (one round-trip; UNION ALL of information_schema)
  const [db, replica, schema] = await Promise.all([
    checkPrimaryDb(),
    checkReadReplica(),
    checkSchema(),
  ]);
  const result: CombinedResult = { db, replica, schema };
  cachedResult = result;
  cachedAt = now;
  return result;
}

export async function GET(_req: NextRequest) {
  const result = await checkAll();
  const body = { ...result, timestamp: new Date().toISOString() };
  // 503 still keys off PRIMARY status. Replica state is informational
  // — it doesn't bring the system down even when the replica itself
  // is unreachable, because reads are still served by primary in v0.
  return Response.json(body, { status: result.db.status === 'down' ? 503 : 200 });
}
