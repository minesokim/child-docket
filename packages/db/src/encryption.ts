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

function encryptWithKey(plaintext: string, key: Buffer): EncryptedMarker {
  if (typeof plaintext !== 'string') {
    throw new TypeError(`encryptWithKey expects string, got ${typeof plaintext}`);
  }
  if (key.length !== KEY_LEN) {
    throw new Error(`encryptWithKey expects a ${KEY_LEN}-byte key, got ${key.length}`);
  }
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    __enc: Buffer.concat([iv, tag, ciphertext]).toString('base64'),
  };
}

function decryptWithKey(value: EncryptedMarker, key: Buffer): string {
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
