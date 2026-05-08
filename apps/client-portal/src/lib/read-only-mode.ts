// Server-side read-only mode gate (client-portal mirror).
//
// Identical contract to apps/command-room/src/lib/read-only-mode.ts.
// See that file for the full design doc + threat model. Two copies
// because it's < 80 lines and apps don't share lib/ directories;
// factor into packages/db if a third app appears.
//
// Server actions performing writes call `await assertWritable()` at
// the top of their handler. ReadOnlyModeError is thrown if the DB is
// degraded / down / timing out.

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

// Throws ONLY on down/timeout — not on slow-but-reachable. See
// command-room/src/lib/read-only-mode.ts for the rationale.
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
}

export async function isWritable(): Promise<boolean> {
  try {
    await assertWritable();
    return true;
  } catch {
    return false;
  }
}
