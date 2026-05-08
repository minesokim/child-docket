// Server-side read-only mode gate.
//
// Pairs with the client-side `WriteAction` wrapper (packages/ui).
// `WriteAction` is UX-only — a determined user can DOM-inspect their
// way around the disabled state. This module is the load-bearing
// security check: every server action that performs a write MUST
// call `assertWritable()` before mutating anything.
//
// CONTRACT
//   - assertWritable() throws ReadOnlyModeError if the DB is
//     unreachable / degraded.
//   - Server actions catch ReadOnlyModeError and return a structured
//     error response (e.g., { ok: false, reason: 'read-only' }) so
//     the UI can re-enable inputs once health flips back to healthy.
//
// IMPORTANT: this is best-effort. The check happens at the START of
// the server action; the DB could go down DURING the action's writes.
// That's fine — the underlying drizzle query will fail with a
// connection error and the action's own error handling kicks in.
//
// This gate's job is to fail FAST when we already know the DB is
// degraded, before doing any expensive work (encryption, DEK
// resolution, multi-step transactions).

import { sql } from 'drizzle-orm';
import { getAdminDb } from '@docket/db';

const PROBE_TIMEOUT_MS = 1500;

export class ReadOnlyModeError extends Error {
  override name = 'ReadOnlyModeError';
  constructor(
    public readonly reason: 'down' | 'timeout',
    public readonly latencyMs: number,
  ) {
    super(`Database is ${reason} (latency=${latencyMs}ms); writes blocked`);
  }
}

/**
 * Probes the DB. Returns silently if reachable; throws
 * ReadOnlyModeError ONLY if down or timed out.
 *
 * NOTE: this does NOT throw on slow-but-reachable DB. The /api/health
 * endpoint reports a "degraded" state when latency > 500ms, and
 * HealthStatusGate surfaces a banner for that, but the WRITE path
 * stays open. Two reasons:
 *   1. Neon p99 can hit 200-400ms during normal operation; blocking
 *      writes there would flap the app between read-only and normal
 *      every poll cycle.
 *   2. The actual underlying drizzle write either succeeds or fails;
 *      latency-during-probe is a poor proxy for write availability.
 *
 * Intended call site: top of every server action that writes.
 *
 *   export async function deleteClientAction(...) {
 *     await assertWritable();
 *     // ... actual delete logic
 *   }
 *
 * Cost: ~5-50ms per call when healthy. Acceptable on every write
 * given the alternative (let writes hit a downed DB and fail with
 * cryptic errors mid-transaction).
 */
export async function assertWritable(): Promise<void> {
  const t0 = Date.now();
  try {
    const db = getAdminDb();
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new ReadOnlyModeError('timeout', Date.now() - t0)), PROBE_TIMEOUT_MS),
    );
    await Promise.race([db.execute(sql`SELECT 1`), timeout]);
  } catch (err) {
    if (err instanceof ReadOnlyModeError) throw err;
    throw new ReadOnlyModeError('down', Date.now() - t0);
  }
  // No degraded check here — see comment above.
}

/**
 * Convenience wrapper: returns true if writable, false otherwise.
 * Useful for UI-state queries that don't want to throw.
 *
 *   const writable = await isWritable();
 *   return { ok: true, mode: writable ? 'normal' : 'read-only' };
 */
export async function isWritable(): Promise<boolean> {
  try {
    await assertWritable();
    return true;
  } catch {
    return false;
  }
}
