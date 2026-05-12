// ────────────────────────────────────────────────────────────────
// Field-level encryption for PII at rest — two-level key hierarchy.
//
// LEVEL 1 — Master KEK (Key Encryption Key)
//   Source:  process.env.PII_ENCRYPTION_KEY (32 random bytes hex)
//   Role:    Encrypts the per-tenant DEKs. Never touches user PII directly.
//   Storage: env var (Vercel + .env.local). Future: AWS KMS / GCP KMS / Vault.
//
// LEVEL 2 — Per-tenant DEK (Data Encryption Key)
//   Source:  randomly generated when a tenant is provisioned
//   Role:    Encrypts every PII field inside a tenant's JSONB
//   Storage: tenants.dek_encrypted column (encrypted with master KEK)
//   Cache:   in-memory LRU during process lifetime
//
// THREAT MODEL
//   - DB compromise (alone)        : sees encrypted DEKs, no plaintext
//   - Master KEK compromise (alone): sees ciphertext, can't decrypt without DB
//   - Both compromised             : full plaintext exposure (as in any system)
//   - Cross-tenant data leak       : impossible at the crypto layer — Tenant A
//                                    DEK can't decrypt Tenant B ciphertext
//
// MIGRATION TO KMS
//   getMasterKey() is the only function that reads PII_ENCRYPTION_KEY directly.
//   Replacing it with a KMS lookup is a single-file change. The DEKs themselves
//   stay structurally identical — they're already encrypted blobs in the DB.
// ────────────────────────────────────────────────────────────────

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;   // GCM-recommended 96-bit IV
const TAG_LEN = 16;  // 128-bit auth tag
const KEY_LEN = 32;  // AES-256

// ────────────────────────────────────────────────────────────────
// Master KEK access. Cached at module-scope (per-process) since the value
// is immutable for a deployment's lifetime.
// ────────────────────────────────────────────────────────────────

let masterKeyCache: Buffer | null = null;

function getMasterKey(): Buffer {
  if (masterKeyCache) return masterKeyCache;
  const hex = process.env.PII_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      'PII_ENCRYPTION_KEY env var not set. Generate one with `openssl rand -hex 32` and add to .env.local + Vercel.',
    );
  }
  if (hex.length !== KEY_LEN * 2) {
    throw new Error(
      `PII_ENCRYPTION_KEY must be ${KEY_LEN} bytes (${KEY_LEN * 2} hex chars), got ${hex.length} chars.`,
    );
  }
  masterKeyCache = Buffer.from(hex, 'hex');
  return masterKeyCache;
}

// ────────────────────────────────────────────────────────────────
// Encrypted marker — how an encrypted scalar lives inside JSONB.
//
// Plain JSONB values stay plain. Encrypted values become
// `{"__enc": "<base64>"}`. The marker prefix __enc lets the server action
// detect-and-decrypt without needing to know which paths are sensitive
// at read time.
// ────────────────────────────────────────────────────────────────

export type EncryptedMarker = { __enc: string };

export function isEncrypted(value: unknown): value is EncryptedMarker {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { __enc?: unknown }).__enc === 'string'
  );
}

// ────────────────────────────────────────────────────────────────
// Core primitives — encrypt/decrypt with an arbitrary 32-byte key.
//
// These are the building blocks. Higher-level functions choose WHICH key
// to pass:
//   - The master KEK for encrypting DEKs (encryptDek/decryptDek below)
//   - A tenant DEK for encrypting fields (encryptFieldForTenant)
// ────────────────────────────────────────────────────────────────

function encryptWithKey(plaintext: string, key: Buffer, aad?: Buffer): EncryptedMarker {
  if (typeof plaintext !== 'string') {
    throw new TypeError(`encryptWithKey expects string, got ${typeof plaintext}`);
  }
  if (key.length !== KEY_LEN) {
    throw new Error(`encryptWithKey expects a ${KEY_LEN}-byte key, got ${key.length}`);
  }
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  if (aad && aad.length > 0) {
    // AAD (Additional Authenticated Data) — authenticated but not
    // encrypted. The GCM auth tag covers BOTH the ciphertext AND the
    // AAD, so a swap of the encrypted blob to a different DB location
    // (different tenant_id/client_id/path) fails the decrypt-time
    // auth check because the caller's recomputed AAD wouldn't match
    // the AAD baked into the tag.
    cipher.setAAD(aad);
  }
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    __enc: Buffer.concat([iv, tag, ciphertext]).toString('base64'),
  };
}

function decryptWithKey(value: EncryptedMarker, key: Buffer, aad?: Buffer): string {
  if (key.length !== KEY_LEN) {
    throw new Error(`decryptWithKey expects a ${KEY_LEN}-byte key, got ${key.length}`);
  }
  const buf = Buffer.from(value.__enc, 'base64');
  if (buf.length < IV_LEN + TAG_LEN) {
    throw new Error('Encrypted blob too short — corrupt or wrong format');
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  if (aad && aad.length > 0) {
    decipher.setAAD(aad);
  }
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
    'utf8',
  );
}

// ────────────────────────────────────────────────────────────────
// MASTER-KEK-only API. ONLY used to encrypt/decrypt DEKs.
//
// Application code should NOT call these directly for user PII. Use
// encryptFieldForTenant/decryptFieldForTenant instead. These exist as a
// package-internal API for the DEK provisioner + cache.
// ────────────────────────────────────────────────────────────────

/**
 * Encrypt a 32-byte DEK with the master KEK. Returns an EncryptedMarker
 * suitable for storage in tenants.dek_encrypted.
 *
 * Internal: callers go through dek-cache.ts, not this directly.
 */
export function encryptDek(dek: Buffer): EncryptedMarker {
  if (dek.length !== KEY_LEN) {
    throw new Error(`encryptDek expects a ${KEY_LEN}-byte DEK`);
  }
  // Stored format: encrypt the DEK's base64 representation as a string so
  // the same encryptWithKey primitive works unchanged. Decrypt reverses the
  // base64 step to recover the raw 32-byte DEK.
  return encryptWithKey(dek.toString('base64'), getMasterKey());
}

/**
 * Decrypt a stored DEK marker back to the raw 32-byte Buffer.
 *
 * Internal: callers go through dek-cache.ts, not this directly.
 */
export function decryptDek(marker: EncryptedMarker): Buffer {
  const base64 = decryptWithKey(marker, getMasterKey());
  const dek = Buffer.from(base64, 'base64');
  if (dek.length !== KEY_LEN) {
    throw new Error(`Decrypted DEK has wrong length: ${dek.length} (expected ${KEY_LEN})`);
  }
  return dek;
}

// ────────────────────────────────────────────────────────────────
// PER-TENANT API — what application code uses for PII.
//
// Caller must obtain the tenant's DEK first via getTenantDek (dek-cache.ts).
// Passing the DEK explicitly (rather than a tenantId) keeps this module
// pure (no DB dependency) and makes the call site explicit about which
// tenant's key it's using.
// ────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────
// AAD binding — extra defense against ciphertext-relocation attacks.
//
// Without AAD, an attacker with DB write access could move an
// encrypted blob from one (tenant, client, path) to another and the
// decryption would still succeed — both rows belong to the same
// tenant DEK. AAD binds the ciphertext to a SPECIFIC location:
// decrypt time recomputes the AAD from the row's identity and
// passes it to setAAD(). If the AAD doesn't match what was used at
// encrypt time, the GCM auth tag check fails.
//
// AAD format (canonical):
//   tenant:<uuid>;client:<uuid>;path:<json-path>
//
// The AAD is NOT secret. It just needs to be deterministic. Callers
// reconstruct it from the row's tenant_id + client_id + the JSONB
// path the encrypted leaf lives at.
//
// MIGRATION POSTURE
//   v0 ciphertexts were written WITHOUT AAD. New writes use AAD.
//   decryptIfMarkedForTenantWithAAD tries AAD-bound first, falls
//   back to AAD-less, falls back to master KEK (legacy). Reads
//   keep working across the migration window. The /reencrypt-with-
//   aad script (followup) walks the JSONB tree and re-writes leaves
//   in AAD-bound form.
// ────────────────────────────────────────────────────────────────

/**
 * Build the AAD bytes from row-identity components. Use the same
 * components on encrypt + decrypt; otherwise the auth tag check
 * fails. Empty / undefined components are skipped (so callers can
 * pass partial context — e.g., for a credentials write where the
 * client_id isn't known, just pass tenantId).
 *
 * For intake_responses (keyed by (tenant_id, client_id, tax_year)),
 * callers MUST include taxYear so a sensitive leaf encrypted in TY
 * 2024 can't be relocated into the same client's TY 2025 row and
 * still authenticate. Per-row binding (not just per-tenant) is the
 * point of AAD.
 */
export function deriveAAD(input: {
  tenantId?: string;
  clientId?: string | null;
  taxYear?: number;
  path?: string;
}): Buffer {
  const parts: string[] = [];
  if (input.tenantId) parts.push(`tenant:${input.tenantId}`);
  if (input.clientId) parts.push(`client:${input.clientId}`);
  if (input.taxYear !== undefined && input.taxYear !== null) {
    parts.push(`year:${input.taxYear}`);
  }
  if (input.path) parts.push(`path:${input.path}`);
  return Buffer.from(parts.join(';'), 'utf8');
}

/**
 * Encrypt a plaintext PII field with a tenant-specific DEK plus AAD
 * binding. Use over encryptFieldForTenant for new writes; the AAD
 * makes the ciphertext non-relocatable.
 */
export function encryptFieldForTenantWithAAD(
  plaintext: string,
  dek: Buffer,
  aad: Buffer,
): EncryptedMarker {
  return encryptWithKey(plaintext, dek, aad);
}

/**
 * Decrypt an AAD-bound ciphertext. Throws on AAD mismatch (the GCM
 * auth tag won't validate). Use when you KNOW the row was written
 * with AAD; otherwise use decryptIfMarkedForTenantWithAAD which
 * tries-then-falls-back gracefully.
 */
export function decryptFieldForTenantWithAAD(
  marker: EncryptedMarker,
  dek: Buffer,
  aad: Buffer,
): string {
  return decryptWithKey(marker, dek, aad);
}

/**
 * Tree-walking decrypt that tries AAD-bound first, falls back to
 * AAD-less, then falls back to master-KEK legacy. Used during the
 * AAD-migration window so existing data keeps reading while new
 * writes go AAD-bound.
 *
 * The AAD passed here is the EXPECTED AAD if the row was written
 * with AAD. When AAD doesn't match (legacy write), GCM throws and we
 * try the AAD-less path next.
 */
export function decryptIfMarkedForTenantWithAAD(
  value: unknown,
  dek: Buffer,
  aad: Buffer,
): unknown {
  if (!isEncrypted(value)) return value;
  // 1. Try AAD-bound decrypt (new writes).
  try {
    return decryptFieldForTenantWithAAD(value, dek, aad);
  } catch {
    // 2. Try AAD-less decrypt (pre-AAD writes with tenant DEK).
    try {
      return decryptFieldForTenant(value, dek);
    } catch (errNoAad) {
      // 3. Try master-KEK decrypt (legacy pre-tenant-DEK).
      try {
        return decryptField(value);
      } catch {
        // Surface the no-AAD error — most informative for ops.
        throw errNoAad;
      }
    }
  }
}

/**
 * Walk a JSONB tree and decrypt every encrypted leaf with AAD verification.
 * Path-aware variant of decryptTree.
 *
 * The aadBuilder callback is invoked with the dotted JSONB path of each
 * encrypted leaf (matching the same convention setAtPath in @docket/shared
 * uses for writes). It returns the AAD bytes the leaf was encrypted with —
 * typically deriveAAD({tenantId, clientId, path}).
 *
 * Each leaf goes through decryptIfMarkedForTenantWithAAD's 3-tier
 * fallback (AAD-bound → AAD-less DEK → master-KEK legacy), so a tree
 * with a mix of new (AAD-bound), older (DEK-only), and legacy
 * (master-KEK) leaves all decrypt correctly. That mix is exactly the
 * state of production data during the AAD-migration window.
 *
 * RELOCATION DEFENSE
 *   A leaf encrypted at path A with AAD-A cannot be decrypted at path B
 *   with AAD-B: AAD-bound decrypt fails (AAD mismatch), AAD-less decrypt
 *   also fails (the GCM tag was generated with AAD bytes folded in),
 *   master-KEK decrypt fails (wrong key). All three fallbacks throw.
 *   This is the security property the AAD provides over relocating
 *   ciphertext blobs within JSONB.
 */
export function decryptTreeWithAAD(
  node: unknown,
  dek: Buffer,
  aadBuilder: (path: string) => Buffer,
  currentPath: string = '',
): unknown {
  if (node == null || typeof node !== 'object') return node;
  if (isEncrypted(node)) {
    return decryptIfMarkedForTenantWithAAD(node, dek, aadBuilder(currentPath));
  }
  if (Array.isArray(node)) {
    return node.map((item, idx) =>
      decryptTreeWithAAD(item, dek, aadBuilder, joinPath(currentPath, String(idx))),
    );
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    out[k] = decryptTreeWithAAD(v, dek, aadBuilder, joinPath(currentPath, k));
  }
  return out;
}

function joinPath(base: string, key: string): string {
  return base ? `${base}.${key}` : key;
}

/**
 * Encrypt a plaintext PII field with a tenant-specific DEK. Returns an
 * EncryptedMarker that lives inside the tenant's JSONB (intake_responses,
 * notice_responses, etc.).
 */
export function encryptFieldForTenant(plaintext: string, dek: Buffer): EncryptedMarker {
  return encryptWithKey(plaintext, dek);
}

/**
 * Decrypt a tenant-encrypted field marker. Throws if the marker was
 * encrypted with a different DEK (wrong tenant) or has been tampered with
 * (auth-tag mismatch).
 */
export function decryptFieldForTenant(marker: EncryptedMarker, dek: Buffer): string {
  return decryptWithKey(marker, dek);
}

/**
 * Decrypt-if-marked variant for tree-walking on the read path. If the value
 * isn't an EncryptedMarker, pass-through; otherwise decrypt with the tenant
 * DEK.
 *
 * LEGACY FALLBACK (scheduled for removal)
 *   v0 production data written BEFORE batch 9 (per-tenant DEKs) was
 *   encrypted with the master KEK directly. After per-tenant DEKs shipped,
 *   those legacy values can't be decrypted with a tenant DEK — the GCM
 *   auth-tag check fails ("Unsupported state or unable to authenticate
 *   data"). To avoid breaking existing data, we try the DEK first, and on
 *   auth-tag failure fall back to the master KEK.
 *
 *   Writes always go through the tenant DEK path, so any field the user
 *   touches gets upgraded to the new format on save. Over time the legacy
 *   master-encrypted blobs disappear naturally.
 *
 *   Removal procedure:
 *     1. pnpm --filter @docket/db reencrypt-legacy --dry-run
 *        (confirms how many leaves are still legacy; safe scan, no writes)
 *     2. pnpm --filter @docket/db reencrypt-legacy
 *        (rewrites legacy leaves with the tenant DEK, idempotent)
 *     3. Re-run --dry-run; expect "legacy migrated: 0"
 *     4. Delete the master-KEK fallback below + the deprecated
 *        decryptField / decryptIfMarked exports
 *     5. Run the audit-immutability + RLS suites; both must pass
 */
export function decryptIfMarkedForTenant(value: unknown, dek: Buffer): unknown {
  if (!isEncrypted(value)) return value;
  try {
    return decryptFieldForTenant(value, dek);
  } catch (err) {
    // Likely legacy data encrypted with master KEK (pre-batch-9). Try
    // the master-key path. If THAT also fails, the original tenant-DEK
    // error is the right one to surface — masters this odd shape isn't.
    try {
      return decryptField(value);
    } catch {
      throw err;
    }
  }
}

/**
 * Walk a JSONB tree and decrypt every encrypted leaf using the tenant's
 * DEK. Used on the intake-read path: server fetches an
 * `intake_responses.answers` blob, calls decryptTree to flatten the
 * encrypted markers back to plaintext scalars, then optionally masks
 * sensitive fields before sending to the client.
 *
 * The DEK is passed in (rather than looked up per-leaf) so a single tree
 * walk amortizes one DEK-cache lookup across all encrypted fields.
 *
 * Generic over T so the caller's IntakeState type flows through. The
 * shape of the returned tree mirrors the input — same keys, same nesting,
 * with EncryptedMarker leaves replaced by their plaintext.
 */
export function decryptTree(node: unknown, dek: Buffer): unknown {
  if (node == null || typeof node !== 'object') return node;
  if (isEncrypted(node)) return decryptIfMarkedForTenant(node, dek);
  if (Array.isArray(node)) return node.map((item) => decryptTree(item, dek));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    out[k] = decryptTree(v, dek);
  }
  return out;
}

// ────────────────────────────────────────────────────────────────
// DEPRECATED — single-key API. Retained briefly for the orchestrator's
// non-tenant-scoped fixtures + tests. Application code that touches user
// PII MUST migrate to encryptFieldForTenant. Will be removed in v1+.
// ────────────────────────────────────────────────────────────────

/**
 * @deprecated Use encryptFieldForTenant(plaintext, dek). This function
 * encrypts with the master KEK, which would force a single-tenant model
 * if used at scale. Kept only for tests + fixtures during the migration.
 */
export function encryptField(plaintext: string): EncryptedMarker {
  return encryptWithKey(plaintext, getMasterKey());
}

/** @deprecated Use decryptFieldForTenant(marker, dek). */
export function decryptField(value: EncryptedMarker): string {
  return decryptWithKey(value, getMasterKey());
}

/** @deprecated Use decryptIfMarkedForTenant(value, dek). */
export function decryptIfMarked(value: unknown): unknown {
  if (isEncrypted(value)) return decryptField(value);
  return value;
}

// ────────────────────────────────────────────────────────────────
// Setup helper — generate a fresh key at install time.
// ────────────────────────────────────────────────────────────────

/**
 * Generate a fresh 32-byte AES-256 key (master KEK or DEK). Run once
 * during initial setup for the master KEK, write to PII_ENCRYPTION_KEY
 * env var.
 *
 *   node -e "console.log(require('@docket/db').generateEncryptionKey())"
 */
export function generateEncryptionKey(): string {
  return randomBytes(KEY_LEN).toString('hex');
}
