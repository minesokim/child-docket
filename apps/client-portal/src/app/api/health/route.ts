// /api/health — vendor health probe + schema-state check (client-portal mirror).
//
// Identical contract to apps/command-room. See that route's header for
// the full design + threat model. Two copies because routes are
// colocated per app; factor into a shared helper if a third app appears.

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
  firmProfileTable: boolean;
  firmPatternsTable: boolean;
  clientFactsTable: boolean;
  actionsChainSeqColumn: boolean;
  verifyActionsChainFn: boolean;
  allMigrationsApplied: boolean;
};
type CombinedResult = {
  db: DbStatusResult;
  replica: ReplicaStatusResult;
  schema: SchemaResult | null;
};

let cachedAt = 0;
let cachedResult: CombinedResult | null = null;
// In-flight de-duplication. The replica probe can take up to 6s during
// a Neon read-replica cold-start (REPLICA_TIMEOUT_MS in health-probe.ts).
// Without this, concurrent /api/health hits during the wake-up window
// each fire their own probe — and worse, the cache TTL (5s) is shorter
// than the probe (6s) so subsequent polls also miss the cache. The
// shared-promise pattern + stamp-after-probe (below) keeps the cache
// honest for the full TTL after probes complete (codex C6-replica R1).
let inflightProbe: Promise<CombinedResult> | null = null;

async function checkSchema(): Promise<SchemaResult | null> {
  try {
    const db = getAdminDb();
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
    return null;
  }
}

async function checkAll(): Promise<CombinedResult> {
  if (cachedResult && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedResult;
  }
  // Share one probe across concurrent callers — replica cold-start
  // (up to 6s) is longer than the 5s cache TTL, so without this
  // every request during a cold-start window fires its own probe.
  if (inflightProbe) {
    return inflightProbe;
  }
  inflightProbe = (async () => {
    try {
      const [db, replica, schema] = await Promise.all([
        checkPrimaryDb(),
        checkReadReplica(),
        checkSchema(),
      ]);
      const result: CombinedResult = { db, replica, schema };
      cachedResult = result;
      // Stamp AFTER probes complete so the cache covers the full TTL
      // post-probe rather than (TTL - probe_duration). With a 6s
      // replica probe, pre-probe stamping would make the result stale
      // on arrival (codex C6-replica R10 P1).
      cachedAt = Date.now();
      return result;
    } finally {
      inflightProbe = null;
    }
  })();
  return inflightProbe;
}

export async function GET(_req: NextRequest) {
  const result = await checkAll();
  const body = { ...result, timestamp: new Date().toISOString() };
  // 503 keys off PRIMARY status only. Replica is informational in v0.
  return Response.json(body, { status: result.db.status === 'down' ? 503 : 200 });
}
