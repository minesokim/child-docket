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

// Primary timeout stays tight (1.5s). On Neon Launch tier the primary
// has auto-suspend OFF so it is never cold; a 1.5s timeout is plenty.
const DB_TIMEOUT_MS = 1500;

// Replica timeout is larger because Neon read-replica branches DO
// auto-suspend after idle, and a cold-start takes 2-5 seconds. The
// previous 1.5s cap caused the probe to time out and report `down`
// during the wake-up window, even though the replica was just
// resuming. (Fix surfaced after a user-visible "Replica DB
// unavailable" dashboard banner despite the replica being healthy
// on direct probe; 2026-05-12.)
//
// TRADE-OFF: when the replica is GENUINELY unreachable, /api/health
// now blocks for up to 6s before reporting `down`. Cached for 5s so
// concurrent polls share the result. HealthStatusGate polls every
// 30s; the user-visible impact is the FIRST poll after a replica
// outage takes 6s instead of 1.5s. Acceptable for v0; future work
// can run the replica probe in the background with last-known-state
// fallback if this delay matters.
const REPLICA_TIMEOUT_MS = 6000;

// Primary degraded threshold (500ms) reflects normal Neon p99 spikes
// of 200-400ms — anything beyond starts to feel laggy in the UI.
const DB_DEGRADED_MS = 500;

// Replica degraded threshold is HIGHER than primary's because a
// Neon read-replica cold-start commonly takes 500-2000ms even on
// success. Reporting that wake-up as `degraded` would still trigger
// the UI's "Replica DB unavailable" banner (health-gate.tsx maps
// replica `degraded` and `down` to the same neonReplicaDegradedBanner
// copy in v0). A 2500ms threshold lets normal cold-starts read as
// `healthy` while still flagging genuinely-slow probes — the
// operational signal we want to keep alive (codex C6-replica R9 P2).
const REPLICA_DEGRADED_MS = 2500;

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
      setTimeout(() => reject(new Error('replica_check_timeout')), REPLICA_TIMEOUT_MS),
    );
    await Promise.race([db.execute(sql`SELECT 1`), timeout]);
    const latencyMs = Date.now() - t0;
    return {
      configured: true,
      status: latencyMs > REPLICA_DEGRADED_MS ? 'degraded' : 'healthy',
      latencyMs,
    };
  } catch {
    return { configured: true, status: 'down', latencyMs: Date.now() - t0 };
  }
}
