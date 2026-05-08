// /api/health — vendor health probe + schema-state check (client-portal mirror).
//
// Identical contract to apps/command-room. See that route's header for
// the full design + threat model. Two copies because routes are
// colocated per app; factor into a shared helper if a third app appears.

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
type SchemaResult = {
  firmProfileTable: boolean;
  firmPatternsTable: boolean;
  clientFactsTable: boolean;
  actionsChainSeqColumn: boolean;
  verifyActionsChainFn: boolean;
  allMigrationsApplied: boolean;
};
type CombinedResult = { db: DbResult; schema: SchemaResult | null };

let cachedAt = 0;
let cachedResult: CombinedResult | null = null;

async function checkDb(): Promise<DbResult> {
  const t0 = Date.now();
  try {
    const db = getAdminDb();
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('db_check_timeout')), DB_TIMEOUT_MS),
    );
    await Promise.race([db.execute(sql`SELECT 1`), timeout]);
    const latencyMs = Date.now() - t0;
    return {
      status: latencyMs > DB_DEGRADED_MS ? 'degraded' : 'healthy',
      latencyMs,
    };
  } catch {
    return { status: 'down', latencyMs: Date.now() - t0 };
  }
}

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

async function checkBoth(): Promise<CombinedResult> {
  const now = Date.now();
  if (cachedResult && now - cachedAt < CACHE_TTL_MS) {
    return cachedResult;
  }
  const [db, schema] = await Promise.all([checkDb(), checkSchema()]);
  const result: CombinedResult = { db, schema };
  cachedResult = result;
  cachedAt = now;
  return result;
}

export async function GET(_req: NextRequest) {
  const result = await checkBoth();
  const body = { ...result, timestamp: new Date().toISOString() };
  return Response.json(body, { status: result.db.status === 'down' ? 503 : 200 });
}
