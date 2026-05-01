// ────────────────────────────────────────────────────────────────
// Field-level encryption for PII at rest.
//
// Sensitive intake fields (SSN, EIN, bank routing, bank account) are
// encrypted with AES-256-GCM before being stored in
// `intake_responses.answers` JSONB. On read they're decrypted by the
// authenticated server action, then sent over the (Clerk-authed) HTTPS
// channel to the legitimate session owner.
//
// This is "at-rest" encryption only — defense-in-depth on top of RLS.
// A DB compromise that bypasses RLS still doesn't surface plaintext SSNs.
//
// v0: symmetric key from PII_ENCRYPTION_KEY env var. Single key for all
// tenants.
//
// Migration to KMS later (AWS KMS / GCP KMS / HashiCorp Vault) is a
// single-file change: replace getKey() with a KMS lookup that returns a
// decrypted DEK. Per-tenant DEKs become the obvious extension after that.
// ────────────────────────────────────────────────────────────────

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;   // GCM-recommended 96-bit IV
const TAG_LEN = 16;  // 128-bit auth tag
const KEY_LEN = 32;  // AES-256

let keyCache: Buffer | null = null;

function getKey(): Buffer {
  if (keyCache) return keyCache;
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
  keyCache = Buffer.from(hex, 'hex');
  return keyCache;
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
// Core API — encrypt/decrypt a single string field.
// ────────────────────────────────────────────────────────────────

/**
 * Encrypt a plaintext string into an EncryptedMarker. Suitable for storage
 * in JSONB or a text column.
 *
 * Format on the wire (base64 of):
 *   [12-byte IV][16-byte auth tag][N-byte ciphertext]
 */
export function encryptField(plaintext: string): EncryptedMarker {
  if (typeof plaintext !== 'string') {
    throw new TypeError(`encryptField expects string, got ${typeof plaintext}`);
  }
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    __enc: Buffer.concat([iv, tag, ciphertext]).toString('base64'),
  };
}

/**
 * Decrypt an EncryptedMarker back to the original plaintext. Throws if the
 * blob is malformed or the auth tag fails (wrong key / tampered).
 */
export function decryptField(value: EncryptedMarker): string {
  const buf = Buffer.from(value.__enc, 'base64');
  if (buf.length < IV_LEN + TAG_LEN) {
    throw new Error('Encrypted blob too short — corrupt or wrong format');
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
    'utf8',
  );
}

// ────────────────────────────────────────────────────────────────
// Convenience — encrypt/decrypt-if-marked. Useful for the server action
// pattern "I don't know if this value is sensitive, just round-trip it."
// ────────────────────────────────────────────────────────────────

/**
 * If the input looks like an EncryptedMarker, decrypt and return the
 * plaintext. Otherwise return the input unchanged. Used on the read path
 * to flatten a JSONB blob's encrypted leaves back to scalars.
 */
export function decryptIfMarked(value: unknown): unknown {
  if (isEncrypted(value)) return decryptField(value);
  return value;
}

// ────────────────────────────────────────────────────────────────
// Setup helper — generate a fresh key at install time.
// ────────────────────────────────────────────────────────────────

/**
 * Generate a fresh 32-byte AES-256 key. Run once during initial setup,
 * write the result to `.env.local` (PII_ENCRYPTION_KEY=...) and to Vercel
 * encrypted env vars. Never commit.
 *
 *   node -e "console.log(require('@docket/db').generateEncryptionKey())"
 */
export function generateEncryptionKey(): string {
  return randomBytes(KEY_LEN).toString('hex');
}
