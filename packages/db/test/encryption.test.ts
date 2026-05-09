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

describe('decryptTree — JSONB tree walking', () => {
  test('decrypts encrypted leaves, leaves plain values alone', async () => {
    const { decryptTree, encryptFieldForTenant } = await import('../src/encryption.js');
    const dek = randomBytes(32);
    const tree = {
      personal: {
        fullName: 'David Kim',
        ssn: encryptFieldForTenant('123-45-6789', dek),
      },
      flags: { paid: true, count: 3 },
      tags: ['a', 'b', 'c'],
    };
    const decrypted = decryptTree(tree, dek) as typeof tree;
    expect(decrypted.personal.fullName).toBe('David Kim');
    expect(decrypted.personal.ssn).toBe('123-45-6789');
    expect(decrypted.flags.paid).toBe(true);
    expect(decrypted.flags.count).toBe(3);
    expect(decrypted.tags).toEqual(['a', 'b', 'c']);
  });

  test('walks arrays + decrypts encrypted items', async () => {
    const { decryptTree, encryptFieldForTenant } = await import('../src/encryption.js');
    const dek = randomBytes(32);
    const tree = {
      dependents: {
        list: [
          { fullName: 'Kid A', ssn: encryptFieldForTenant('111-22-3333', dek) },
          { fullName: 'Kid B', ssn: encryptFieldForTenant('444-55-6666', dek) },
        ],
      },
    };
    const decrypted = decryptTree(tree, dek) as typeof tree;
    expect(decrypted.dependents.list[0]?.ssn).toBe('111-22-3333');
    expect(decrypted.dependents.list[1]?.ssn).toBe('444-55-6666');
  });

  test('handles null + undefined + missing keys gracefully', async () => {
    const { decryptTree } = await import('../src/encryption.js');
    const dek = randomBytes(32);
    expect(decryptTree(null, dek)).toBe(null);
    expect(decryptTree(undefined, dek)).toBe(undefined);
    expect(decryptTree({}, dek)).toEqual({});
    expect(decryptTree([], dek)).toEqual([]);
  });

  test('returns a NEW tree (input not mutated)', async () => {
    const { decryptTree, encryptFieldForTenant } = await import('../src/encryption.js');
    const dek = randomBytes(32);
    const tree = {
      personal: { ssn: encryptFieldForTenant('123-45-6789', dek) },
    };
    const original = JSON.stringify(tree);
    decryptTree(tree, dek);
    expect(JSON.stringify(tree)).toBe(original);
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

// ────────────────────────────────────────────────────────────────
// AAD-bound API — ciphertext locked to a (tenantId, clientId, path)
// triple. Defense against ciphertext-relocation attacks.
// ────────────────────────────────────────────────────────────────

describe('AAD-bound encryption — ciphertext relocation defense', () => {
  test('round-trip: same AAD on encrypt + decrypt → plaintext recovered', () => {
    const {
      encryptFieldForTenantWithAAD,
      decryptFieldForTenantWithAAD,
      deriveAAD,
    } = require('../src/encryption.ts');
    const dek = randomBytes(32);
    const aad = deriveAAD({
      tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      clientId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      path: 'personal.ssn',
    });
    const ct = encryptFieldForTenantWithAAD('123-45-6789', dek, aad);
    expect(decryptFieldForTenantWithAAD(ct, dek, aad)).toBe('123-45-6789');
  });

  test('different AAD on decrypt → throws (relocation attack blocked)', () => {
    const {
      encryptFieldForTenantWithAAD,
      decryptFieldForTenantWithAAD,
      deriveAAD,
    } = require('../src/encryption.ts');
    const dek = randomBytes(32);
    const aadOriginal = deriveAAD({
      tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      clientId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      path: 'personal.ssn',
    });
    const aadAttacker = deriveAAD({
      tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      clientId: 'cccccccc-cccc-cccc-cccc-cccccccccccc', // DIFFERENT client
      path: 'personal.ssn',
    });
    const ct = encryptFieldForTenantWithAAD('123-45-6789', dek, aadOriginal);
    // Attacker tries to "paste" the ciphertext into a different client's row.
    // Recompute AAD from THAT row's identity → AAD mismatch → tag check fails.
    expect(() => decryptFieldForTenantWithAAD(ct, dek, aadAttacker)).toThrow();
  });

  test('different path on decrypt → throws (intra-row relocation blocked)', () => {
    const {
      encryptFieldForTenantWithAAD,
      decryptFieldForTenantWithAAD,
      deriveAAD,
    } = require('../src/encryption.ts');
    const dek = randomBytes(32);
    const aadSsn = deriveAAD({
      tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      clientId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      path: 'personal.ssn',
    });
    const aadEin = deriveAAD({
      tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      clientId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      path: 'business.ein', // DIFFERENT path within same client
    });
    const ssnCt = encryptFieldForTenantWithAAD('123-45-6789', dek, aadSsn);
    // Attacker can't move the SSN ciphertext into the EIN slot — same
    // tenant, same client, but path-bound AAD blocks it.
    expect(() => decryptFieldForTenantWithAAD(ssnCt, dek, aadEin)).toThrow();
  });

  test('decryptIfMarkedForTenantWithAAD falls back to AAD-less for legacy data', () => {
    const {
      decryptIfMarkedForTenantWithAAD,
      deriveAAD,
    } = require('../src/encryption.ts');
    const dek = randomBytes(32);
    // Legacy ciphertext: encrypted with tenant DEK but NO AAD.
    const legacyCt = encryptFieldForTenant('legacy-ssn-555-12-3456', dek);
    const aad = deriveAAD({ tenantId: 'tx', clientId: 'cy', path: 'legacy.ssn' });
    // Decrypt with AAD path — should fall back to AAD-less path and succeed.
    expect(decryptIfMarkedForTenantWithAAD(legacyCt, dek, aad)).toBe(
      'legacy-ssn-555-12-3456',
    );
  });

  test('decryptIfMarkedForTenantWithAAD prefers AAD-bound when both work', () => {
    const {
      encryptFieldForTenantWithAAD,
      decryptIfMarkedForTenantWithAAD,
      deriveAAD,
    } = require('../src/encryption.ts');
    const dek = randomBytes(32);
    const aad = deriveAAD({ tenantId: 'tx', clientId: 'cy', path: 'p.x' });
    const ct = encryptFieldForTenantWithAAD('aad-bound-secret', dek, aad);
    expect(decryptIfMarkedForTenantWithAAD(ct, dek, aad)).toBe('aad-bound-secret');
  });

  test('plain non-marker values pass through AAD decryptor unchanged', () => {
    const { decryptIfMarkedForTenantWithAAD, deriveAAD } = require('../src/encryption.ts');
    const dek = randomBytes(32);
    const aad = deriveAAD({ tenantId: 'tx' });
    expect(decryptIfMarkedForTenantWithAAD('plain-string', dek, aad)).toBe('plain-string');
    expect(decryptIfMarkedForTenantWithAAD(42, dek, aad)).toBe(42);
    expect(decryptIfMarkedForTenantWithAAD(null, dek, aad)).toBe(null);
  });

  test('deriveAAD is deterministic + skips empty components', () => {
    const { deriveAAD } = require('../src/encryption.ts');
    const a = deriveAAD({ tenantId: 'tx', clientId: 'cy', path: 'p' });
    const b = deriveAAD({ tenantId: 'tx', clientId: 'cy', path: 'p' });
    expect(a.equals(b)).toBe(true);

    const c = deriveAAD({ tenantId: 'tx' });
    expect(c.toString('utf8')).toBe('tenant:tx');

    const d = deriveAAD({ tenantId: 'tx', clientId: null, path: 'p' });
    expect(d.toString('utf8')).toBe('tenant:tx;path:p');
  });
});
