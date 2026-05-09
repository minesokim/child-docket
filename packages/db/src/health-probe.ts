// Vendor health probes — primary DB + read replica.
//
// Used by /api/health in both command-room + client-portal. Same
// shape so the HealthStatusGate consumer in @docket/ui parses both
// app responses identically.
//
// SECURITY
//   These probes use getAdminDb() / getReadReplicaDb() — both bypass
//   RLS. They run a single SELECT 1 query that touches no tenant
//   data; safe to call from a public /api/health route.
//
// COST
//   Each probe is one round-trip + 1.5s timeout cap. Cached at the
//   route layer (5s TTL) so a popular health-check pattern doesn't
//   flood the connection pool.

import { sql } from 'drizzle-orm';
import {
  getAdminDb,
  getReadReplicaDb,
  isReadReplicaConfigured,
} from './client.js';

export type ServiceStatus = 'healthy' | 'degraded' | 'down';
export type DbStatusResult = { status: ServiceStatus; latencyMs: number };

/**
 * Replica probe result.
 *
 *   configured=false: env var DATABASE_URL_READ_REPLICA is unset; no
 *                     replica wired. Field returned as-is so /api/health
 *                     consumers can show "not configured" vs "configured
 *                     but down" — meaningfully different operational
 *                     postures.
 *   configured=true: env var is set. status reflects the live probe.
 */
export type ReplicaStatusResult =
  | { configured: false }
  | { configured: true; status: ServiceStatus; latencyMs: number };

const DB_TIMEOUT_MS = 1500;
const DB_DEGRADED_MS = 500;

/**
 * Probe the primary DB. Returns 'down' on any error including
 * connection failure or timeout. 'degraded' when the round-trip
 * exceeds DB_DEGRADED_MS (500ms) — Neon p99 routinely spikes to
 * 200-400ms in normal operation; 500ms is the line above which
 * users start to feel the lag in the UI.
 */
export async function checkPrimaryDb(): Promise<DbStatusResult> {
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

/**
 * Probe the read replica when DATABASE_URL_READ_REPLICA is configured.
 * When unconfigured, returns { configured: false } without making any
 * DB call — operators see "no replica" on the dashboard, not a
 * spurious 'down'.
 */
export async function checkReadReplica(): Promise<ReplicaStatusResult> {
  if (!isReadReplicaConfigured()) {
    return { configured: false };
  }
  const t0 = Date.now();
  try {
    const db = getReadReplicaDb();
    if (!db) {
      // Configured but connection construction returned null (likely
      // a malformed URL postgres-js silently rejected). Treat as down
      // so the operator sees an actionable signal.
      return { configured: true, status: 'down', latencyMs: Date.now() - t0 };
    }
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('replica_check_timeout')), DB_TIMEOUT_MS),
    );
    await Promise.race([db.execute(sql`SELECT 1`), timeout]);
    const latencyMs = Date.now() - t0;
    return {
      configured: true,
      status: latencyMs > DB_DEGRADED_MS ? 'degraded' : 'healthy',
      latencyMs,
    };
  } catch {
    return { configured: true, status: 'down', latencyMs: Date.now() - t0 };
  }
}
