// Drizzle client + tenant-scoped helpers.
//
// Two ways to query Postgres:
//   1. getAdminDb()           — plain Drizzle, NO tenant scoping. Migrations + admin only.
//   2. withTenant(tenantId)   — wraps fn in a transaction that sets app.current_tenant_id.
//                                RLS policies in 0001_rls_policies.sql then filter every
//                                read + write to the tenant's rows.
//
// Application code (orchestrator, Inngest workers, Next.js route handlers) MUST use
// withTenant(). getAdminDb() bypasses RLS and should never appear in tenant-scoped paths.
//
// A lint rule + code-review gate enforces this — see SECURITY.md (TODO).

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres, { type Sql } from 'postgres';
import * as schema from './schema.js';
import type { TenantId } from '@docket/shared';

export type DocketDb = PostgresJsDatabase<typeof schema>;

let _client: Sql | null = null;

function getClient(): Sql {
  if (_client) return _client;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL not set. For local dev, add it to .env.local. For prod, set it in the Vercel/Fly environment.',
    );
  }
  _client = postgres(url, {
    max: 10,                          // connection pool size
    idle_timeout: 20,                 // seconds — Neon scales connections up/down
    connect_timeout: 10,
    prepare: false,                   // safer with Neon's pooler
  });
  return _client;
}

// ────────────────────────────────────────────────────────────────
// ADMIN client — no tenant scoping. Use for:
//   - drizzle-kit migrate (one-shot SQL apply)
//   - seed scripts that create tenants + cross-tenant fixtures
//   - tenant onboarding (creating the tenants row)
//   - platform-admin tooling
// NEVER use this for application traffic.
// ────────────────────────────────────────────────────────────────
export function getAdminDb(): DocketDb {
  return drizzle(getClient(), { schema });
}

// ────────────────────────────────────────────────────────────────
// TENANT-SCOPED client — RLS-bound to a single tenant for the lifetime of fn.
//
// Internally:
//   1. opens a Postgres transaction
//   2. SETs app.current_tenant_id to tenantId (transaction-local)
//   3. runs fn() with a Drizzle client bound to that transaction
//   4. commits on success / rolls back on throw
//
// All reads + writes inside fn are filtered by RLS policies (0001_rls_policies.sql).
// Querying another tenant's rows returns zero rows even if you tried.
//
// Usage:
//   await withTenant(antonio.id as TenantId, async (db) => {
//     const issues = await db.select().from(schema.issues).limit(20);
//     return issues;
//   });
// ────────────────────────────────────────────────────────────────
export async function withTenant<T>(
  tenantId: TenantId,
  fn: (db: DocketDb) => Promise<T>,
): Promise<T> {
  const db = getAdminDb();
  return await db.transaction(async (tx) => {
    // set_config(name, value, is_local=true) is the function form of SET LOCAL.
    // is_local=true means it lasts only for this transaction.
    await tx.execute(sql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`);
    return await fn(tx as DocketDb);
  });
}

// ────────────────────────────────────────────────────────────────
// READ-REPLICA client — same-cell Neon replica for vendor resilience.
//
// v0 disaster-recovery posture (per PRODUCTION-READINESS §A + decision
// AUTONOMOUS-DECISIONS §5):
//
//   1. /api/health probes BOTH primary + replica. Operators see
//      replica state on the dashboard.
//   2. When primary degrades or fails, the manual failover is to flip
//      DATABASE_URL to point at the replica's URL (Neon docs: promote
//      replica to primary via the console, or just point the app at
//      the replica for read-only mode).
//   3. Auto-routing reads to replica is V1.5 — needs request-scoped
//      session config, txn boundary detection, and cache coherence
//      handling. Not v0 scope.
//
// The replica is a SEPARATE postgres-js connection pool with its own
// idle timeouts. Lazy-constructed: not initialized until first use,
// so a missing or malformed DATABASE_URL_READ_REPLICA doesn't crash
// the app at startup.
// ────────────────────────────────────────────────────────────────

let _replicaClient: Sql | null = null;

/**
 * Returns true if DATABASE_URL_READ_REPLICA is configured, regardless
 * of whether the connection has been opened or is reachable. Used by
 * /api/health to decide whether to surface a replica field.
 */
export function isReadReplicaConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL_READ_REPLICA);
}

function getReplicaClient(): Sql | null {
  if (_replicaClient) return _replicaClient;
  const url = process.env.DATABASE_URL_READ_REPLICA;
  if (!url) return null;
  // Same connection settings as primary. Smaller pool because replica
  // is read-mostly + the primary handles writes; if traffic shifts
  // to replica during a failover the operator can scale up via env.
  _replicaClient = postgres(url, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
  return _replicaClient;
}

/**
 * Returns a Drizzle client connected to the read replica, or null when
 * DATABASE_URL_READ_REPLICA is unset OR the connection construction
 * throws. Callers MUST handle null — no implicit fallback to primary
 * (that would mask a broken replica config in production).
 *
 * Use ONLY for read paths that are explicitly opted-in to replica
 * routing. v0 has no such call sites; the function exists so /api/health
 * can probe it and so V1.5 read-routing has a stable handle to import.
 */
export function getReadReplicaDb(): DocketDb | null {
  // Wrap BOTH client construction AND drizzle(...) in the catch.
  // Either call can throw — postgres-js may reject malformed URLs at
  // construction; drizzle() is less likely but not impossible to throw
  // (e.g., schema-validation surprises). Catching only the first leaves
  // a hole.
  try {
    const client = getReplicaClient();
    if (!client) return null;
    return drizzle(client, { schema });
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────────
// Lifecycle helpers for tests + scripts.
// ────────────────────────────────────────────────────────────────
export async function disconnect(): Promise<void> {
  if (_client) {
    await _client.end();
    _client = null;
  }
  if (_replicaClient) {
    await _replicaClient.end();
    _replicaClient = null;
  }
}

// Re-export the schema for consumers that want both DB + types from one import.
export { schema };
