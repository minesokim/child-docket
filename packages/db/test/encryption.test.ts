// Tests for the two-tier encryption hierarchy:
//   Tier 1 — master KEK (env var) used to encrypt/decrypt DEKs only
//   Tier 2 — per-tenant DEK used to encrypt/decrypt PII fields
//
// These tests are crypto-pure (no DB needed). The DEK-cache + tenant-row
// integration is tested separately in test/rls.test.ts which exercises a
// real Postgres + tenants table. This file proves the math.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { randomBytes } from 'node:crypto';
import {
  decryptDek,
  decryptField,
  decryptFieldForTenant,
  decryptIfMarked,
  decryptIfMarkedForTenant,
  encryptDek,
  encryptField,
  encryptFieldForTenant,
  generateEncryptionKey,
  isEncrypted,
  type EncryptedMarker,
} from '../src/encryption.js';

// ────────────────────────────────────────────────────────────────
// Set up a deterministic master KEK for the suite. Each test that needs
// the master key gets a freshly seeded one so tests don't pollute each
// other across the module-scoped key cache.
// ────────────────────────────────────────────────────────────────

const ORIGINAL_KEY = process.env.PII_ENCRYPTION_KEY;

beforeAll(() => {
  // Set a known master KEK. Hex-encoded 32 random bytes. The encryption
  // module caches this per-process, so the first call locks it in for
  // the duration of the suite. That's fine — every test below operates
  // under one master KEK by design.
  process.env.PII_ENCRYPTION_KEY = generateEncryptionKey();
});

afterAll(() => {
  // Restore whatever was set in the runner env so other test files
  // (run later in the same `bun test` invocation) aren't affected.
  if (ORIGINAL_KEY === undefined) {
    delete process.env.PII_ENCRYPTION_KEY;
  } else {
    process.env.PII_ENCRYPTION_KEY = ORIGINAL_KEY;
  }
});

// ────────────────────────────────────────────────────────────────
// Per-tenant API — the path application code MUST use for PII.
// ────────────────────────────────────────────────────────────────

describe('encryptFieldForTenant / decryptFieldForTenant — round-trip', () => {
  const dek = randomBytes(32);

  test('round-trip a typical SSN', () => {
    const plaintext = '123-45-6789';
    const encrypted = encryptFieldForTenant(plaintext, dek);
    expect(isEncrypted(encrypted)).toBe(true);
    expect(encrypted.__enc).not.toContain('123');
    expect(decryptFieldForTenant(encrypted, dek)).toBe(plaintext);
  });

  test('round-trip an EIN', () => {
    const plaintext = '12-3456789';
    const encrypted = encryptFieldForTenant(plaintext, dek);
    expect(decryptFieldForTenant(encrypted, dek)).toBe(plaintext);
  });

  test('round-trip a long string (multi-block)', () => {
    const plaintext = 'A'.repeat(500);
    const encrypted = encryptFieldForTenant(plaintext, dek);
    expect(decryptFieldForTenant(encrypted, dek)).toBe(plaintext);
  });

  test('round-trip with non-ASCII (UTF-8 multibyte)', () => {
    const plaintext = 'Antonio Vázquez · 安东尼奥 · ñoño';
    const encrypted = encryptFieldForTenant(plaintext, dek);
    expect(decryptFieldForTenant(encrypted, dek)).toBe(plaintext);
  });

  test('two encryptions of same plaintext produce DIFFERENT ciphertexts (random IV)', () => {
    const a = encryptFieldForTenant('123-45-6789', dek);
    const b = encryptFieldForTenant('123-45-6789', dek);
    expect(a.__enc).not.toBe(b.__enc);
    // Both still decrypt to the same plaintext.
    expect(decryptFieldForTenant(a, dek)).toBe('123-45-6789');
    expect(decryptFieldForTenant(b, dek)).toBe('123-45-6789');
  });
});

describe('Cross-tenant isolation at the crypto layer', () => {
  test("Tenant B's DEK CANNOT decrypt Tenant A's ciphertext", () => {
    const dekA = randomBytes(32);
    const dekB = randomBytes(32);
    const plaintext = 'super-sensitive-ssn-123-45-6789';

    const ciphertextA = encryptFieldForTenant(plaintext, dekA);

    // Even if attacker has Tenant B's DEK + Tenant A's ciphertext, the
    // GCM auth tag verification fails → throws. Cannot exfiltrate plaintext.
    expect(() => decryptFieldForTenant(ciphertextA, dekB)).toThrow();
  });

  test('Tampered ciphertext fails auth-tag verification', () => {
    const dek = randomBytes(32);
    const ct = encryptFieldForTenant('hello world', dek);

    // Flip a random byte in the encoded marker.
    const buf = Buffer.from(ct.__enc, 'base64');
    buf[buf.length - 1] = buf[buf.length - 1]! ^ 0xff;
    const tampered: EncryptedMarker = { __enc: buf.toString('base64') };

    expect(() => decryptFieldForTenant(tampered, dek)).toThrow();
  });
});

describe('Key length validation', () => {
  test('encryptFieldForTenant rejects a key of wrong length', () => {
    expect(() => encryptFieldForTenant('hi', randomBytes(16))).toThrow(/32-byte key/);
  });

  test('decryptFieldForTenant rejects a key of wrong length', () => {
    const dek = randomBytes(32);
    const ct = encryptFieldForTenant('x', dek);
    expect(() => decryptFieldForTenant(ct, randomBytes(16))).toThrow(/32-byte key/);
  });
});

// ────────────────────────────────────────────────────────────────
// DEK-of-DEK (master KEK encrypting tenant DEKs)
// ────────────────────────────────────────────────────────────────

describe('encryptDek / decryptDek — master-KEK round-trip', () => {
  test('round-trip a 32-byte DEK', () => {
    const dek = randomBytes(32);
    const wrapped = encryptDek(dek);
    expect(isEncrypted(wrapped)).toBe(true);
    const unwrapped = decryptDek(wrapped);
    expect(unwrapped.length).toBe(32);
    expect(unwrapped.equals(dek)).toBe(true);
  });

  test('rejects DEKs of wrong length', () => {
    expect(() => encryptDek(randomBytes(16))).toThrow(/32-byte DEK/);
    expect(() => encryptDek(randomBytes(64))).toThrow(/32-byte DEK/);
  });

  test('end-to-end: master KEK wraps DEK, DEK encrypts SSN', () => {
    // The full production pipeline.
    const dek = randomBytes(32);
    const wrapped = encryptDek(dek);
    // ... wrapped DEK is what gets stored in tenants.dek_encrypted ...

    const unwrapped = decryptDek(wrapped);
    const ssn = '123-45-6789';
    const ciphertext = encryptFieldForTenant(ssn, unwrapped);
    // ... ciphertext is what gets stored in intake_responses.answers ...

    // Read path: unwrap DEK, decrypt SSN.
    const unwrappedAgain = decryptDek(wrapped);
    expect(decryptFieldForTenant(ciphertext, unwrappedAgain)).toBe(ssn);
  });
});

// ────────────────────────────────────────────────────────────────
// isEncrypted predicate
// ────────────────────────────────────────────────────────────────

describe('isEncrypted', () => {
  test('matches an EncryptedMarker', () => {
    const dek = randomBytes(32);
    const ct = encryptFieldForTenant('x', dek);
    expect(isEncrypted(ct)).toBe(true);
  });

  test('rejects plain values', () => {
    expect(isEncrypted('123-45-6789')).toBe(false);
    expect(isEncrypted(123)).toBe(false);
    expect(isEncrypted(null)).toBe(false);
    expect(isEncrypted(undefined)).toBe(false);
    expect(isEncrypted({})).toBe(false);
    expect(isEncrypted({ foo: 'bar' })).toBe(false);
  });

  test('rejects an object with non-string __enc', () => {
    expect(isEncrypted({ __enc: 123 })).toBe(false);
    expect(isEncrypted({ __enc: null })).toBe(false);
  });
});

describe('decryptIfMarkedForTenant — pass-through behavior', () => {
  const dek = randomBytes(32);

  test('decrypts an encrypted marker', () => {
    const ct = encryptFieldForTenant('hello', dek);
    expect(decryptIfMarkedForTenant(ct, dek)).toBe('hello');
  });

  test('passes plain values through unchanged', () => {
    expect(decryptIfMarkedForTenant('plain', dek)).toBe('plain');
    expect(decryptIfMarkedForTenant(42, dek)).toBe(42);
    expect(decryptIfMarkedForTenant(null, dek)).toBe(null);
    expect(decryptIfMarkedForTenant({ foo: 'bar' }, dek)).toEqual({ foo: 'bar' });
  });
});

// ────────────────────────────────────────────────────────────────
// Deprecated single-key API — should still work for backward-compat
// while the orchestrator + tests migrate over.
// ────────────────────────────────────────────────────────────────

describe('Legacy single-key API (deprecated, kept for migration)', () => {
  test('encryptField/decryptField still round-trips with the master KEK', () => {
    const ct = encryptField('legacy-value');
    expect(decryptField(ct)).toBe('legacy-value');
  });

  test('decryptIfMarked passes plain values through', () => {
    expect(decryptIfMarked('plain')).toBe('plain');
    expect(decryptIfMarked(42)).toBe(42);
  });
});

describe('decryptIfMarkedForTenant — legacy master-encrypted fallback', () => {
  test('legacy master-key ciphertext decrypts via fallback when tenant DEK fails', () => {
    // Simulate v0 production data: a value encrypted with the master KEK
    // before per-tenant DEKs shipped. A NEW request comes in with a fresh
    // per-tenant DEK that obviously can't decrypt the legacy ciphertext.
    // The fallback should kick in and recover the plaintext via master.
    const legacy = encryptField('legacy-ssn-123-45-6789');
    const newTenantDek = randomBytes(32);
    const recovered = decryptIfMarkedForTenant(legacy, newTenantDek);
    expect(recovered).toBe('legacy-ssn-123-45-6789');
  });

  test('tenant-encrypted ciphertext still decrypts directly (not via fallback)', () => {
    // Sanity: the fast path (tenant DEK works) is still the primary.
    const dek = randomBytes(32);
    const ct = encryptFieldForTenant('new-ssn-987-65-4321', dek);
    expect(decryptIfMarkedForTenant(ct, dek)).toBe('new-ssn-987-65-4321');
  });

  test('plain values still pass through', () => {
    const dek = randomBytes(32);
    expect(decryptIfMarkedForTenant('not-encrypted', dek)).toBe('not-encrypted');
    expect(decryptIfMarkedForTenant(42, dek)).toBe(42);
    expect(decryptIfMarkedForTenant(null, dek)).toBe(null);
  });

  test('garbage ciphertext (decryptable by neither key) throws', () => {
    const dek = randomBytes(32);
    const garbage = { __enc: Buffer.from('garbage-not-real-ciphertext').toString('base64') };
    expect(() => decryptIfMarkedForTenant(garbage, dek)).toThrow();
  });
});
