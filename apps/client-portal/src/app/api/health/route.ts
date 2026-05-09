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
  const now = Date.now();
  if (cachedResult && now - cachedAt < CACHE_TTL_MS) {
    return cachedResult;
  }
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
  // 503 keys off PRIMARY status only. Replica is informational in v0.
  return Response.json(body, { status: result.db.status === 'down' ? 503 : 200 });
}
