// ────────────────────────────────────────────────────────────────
// Per-tenant DEK lookup + cache.
//
// Every encrypted field write/read needs the tenant's Data Encryption Key.
// Going to the database to fetch tenants.dek_encrypted on every PII operation
// would be a 5-10ms tax per field. Cache decrypted DEKs in memory.
//
// Cache properties:
//   - Per-process LRU (each Vercel function instance has its own cache).
//   - Bounded size: 256 tenants. Evicts least-recently-used when full.
//   - TTL: 5 minutes from last access. Forces a re-read if a DEK rotates.
//   - DEK material is held as a Buffer (raw 32 bytes), never as a string.
//
// First-access provisioning:
//   If a tenant row has dek_encrypted IS NULL (legacy row from before this
//   migration, or a row created via direct SQL bypassing application code),
//   getTenantDek will atomically generate + store a fresh DEK, then return it.
//   Concurrent requests on the same NULL row use a UPDATE WHERE IS NULL guard
//   so only one DEK wins; losers re-read the winning DEK.
// ────────────────────────────────────────────────────────────────

import { eq, sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import type { TenantId } from '@docket/shared';
import { tenants } from './schema.js';
import {
  decryptDek,
  encryptDek,
  isEncrypted,
  type EncryptedMarker,
} from './encryption.js';
import type { DocketDb } from './client.js';

const CACHE_MAX_SIZE = 256;
const CACHE_TTL_MS = 5 * 60 * 1000;     // 5 minutes
const DEK_LEN = 32;

type CacheEntry = {
  dek: Buffer;
  expiresAt: number;
};

// Map preserves insertion order; that gives us LRU eviction for free
// (delete + re-set on access bumps the entry to most-recent).
const cache = new Map<string, CacheEntry>();

function readFromCache(tenantId: TenantId): Buffer | null {
  const entry = cache.get(tenantId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(tenantId);
    return null;
  }
  // Touch — move to most-recent end of the Map.
  cache.delete(tenantId);
  cache.set(tenantId, entry);
  return entry.dek;
}

function writeToCache(tenantId: TenantId, dek: Buffer): void {
  if (cache.has(tenantId)) cache.delete(tenantId);
  if (cache.size >= CACHE_MAX_SIZE) {
    // Evict the oldest (first-inserted).
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(tenantId, {
    dek,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

/**
 * Test-only helper. Drops a tenant's cached DEK so the next call re-reads
 * from the DB. Application code should never need this — DEKs don't rotate
 * in v0.
 */
export function invalidateTenantDek(tenantId: TenantId): void {
  cache.delete(tenantId);
}

/**
 * Test-only helper. Drops the entire cache.
 */
export function clearDekCache(): void {
  cache.clear();
}

// ────────────────────────────────────────────────────────────────
// Public API.
// ────────────────────────────────────────────────────────────────

/**
 * Resolve a tenant's DEK. Returns the raw 32-byte Buffer suitable for
 * passing to encryptFieldForTenant/decryptFieldForTenant.
 *
 * The `db` argument MUST be a tenant-scoped Drizzle client (from
 * withTenant or getAdminDb). For first-access provisioning, the function
 * does a tenant_id-targeted UPDATE; RLS will allow the write only when the
 * caller has the matching tenant context set.
 *
 * Throws if:
 *   - The tenant row doesn't exist
 *   - The stored encrypted DEK can't be decrypted (master KEK rotated
 *     without re-encrypting DEKs, or the DEK was tampered with)
 */
export async function getTenantDek(
  db: DocketDb,
  tenantId: TenantId,
): Promise<Buffer> {
  // Fast path: in-memory cache.
  const cached = readFromCache(tenantId);
  if (cached) return cached;

  // Slow path: DB read.
  const [row] = await db
    .select({ dekEncrypted: tenants.dekEncrypted })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!row) {
    throw new Error(
      `getTenantDek: tenant ${tenantId} not found. ` +
        `Did the request set the wrong tenant context?`,
    );
  }

  if (row.dekEncrypted) {
    const marker: EncryptedMarker = { __enc: row.dekEncrypted };
    if (!isEncrypted(marker)) {
      throw new Error(
        `getTenantDek: tenant ${tenantId} has malformed dek_encrypted column`,
      );
    }
    const dek = decryptDek(marker);
    writeToCache(tenantId, dek);
    return dek;
  }

  // First-access provisioning. Generate a fresh DEK, write atomically
  // (UPDATE ... WHERE dek_encrypted IS NULL — only one writer wins on
  // concurrent requests), then re-read to get the canonical winner.
  return await provisionTenantDek(db, tenantId);
}

/**
 * Generate a fresh DEK, store it encrypted, and return the raw bytes.
 * Race-safe: if another request provisions concurrently, this call sees
 * the OTHER request's DEK and returns it. The DEK that wins is the one
 * UPDATE managed to flip dek_encrypted from NULL.
 *
 * Exposed publicly so seed scripts + tenant-onboarding paths can
 * provision DEKs at tenant creation rather than waiting for the lazy
 * first-access path.
 */
export async function provisionTenantDek(
  db: DocketDb,
  tenantId: TenantId,
): Promise<Buffer> {
  const candidateDek = randomBytes(DEK_LEN);
  const candidateEncrypted = encryptDek(candidateDek).__enc;

  // Atomic conditional UPDATE: only sets dek_encrypted if it's currently NULL.
  // Using raw SQL because Drizzle's typed update doesn't have a clean
  // 'IS NULL' predicate composer for nullable columns.
  await db.execute(sql`
    UPDATE ${tenants}
       SET dek_encrypted = ${candidateEncrypted},
           updated_at = NOW()
     WHERE id = ${tenantId}
       AND dek_encrypted IS NULL
  `);

  // Re-read whatever the row holds now. On race, this might be ANOTHER
  // request's DEK (their UPDATE flipped first); we accept that DEK as
  // canonical since the conditional UPDATE guarantees only one winner.
  const [row] = await db
    .select({ dekEncrypted: tenants.dekEncrypted })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!row?.dekEncrypted) {
    throw new Error(
      `provisionTenantDek: tenant ${tenantId} still has NULL dek after UPDATE — ` +
        `RLS misconfiguration or row missing entirely?`,
    );
  }

  const winningDek = decryptDek({ __enc: row.dekEncrypted });
  writeToCache(tenantId, winningDek);
  return winningDek;
}
