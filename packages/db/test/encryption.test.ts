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

// ────────────────────────────────────────────────────────────────
// decryptTreeWithAAD — path-aware JSONB walker with AAD verification.
// Pairs with encryptFieldForTenantWithAAD on writes: the writer passes
// deriveAAD({tenantId, clientId, path}); the reader rebuilds the same
// AAD per leaf via the aadBuilder callback. AAD verification fails
// when ciphertext is relocated within the tree.
// ────────────────────────────────────────────────────────────────

describe('decryptTreeWithAAD — path-aware tree decryption', () => {
  const TENANT = 'tenant-aaaa-bbbb-cccc-dddd-eeeeeeeeee01';
  const CLIENT = 'client-aaaa-bbbb-cccc-dddd-22222222ee02';

  function aadFor(path: string): Buffer {
    const { deriveAAD } = require('../src/encryption.ts');
    return deriveAAD({ tenantId: TENANT, clientId: CLIENT, path });
  }

  test('decrypts AAD-bound leaves correctly when AAD matches path', async () => {
    const { decryptTreeWithAAD, encryptFieldForTenantWithAAD, deriveAAD } = await import(
      '../src/encryption.js'
    );
    const dek = randomBytes(32);
    const ssnPath = 'personal.ssn';
    const tree = {
      personal: {
        fullName: 'David Kim',
        ssn: encryptFieldForTenantWithAAD(
          '123-45-6789',
          dek,
          deriveAAD({ tenantId: TENANT, clientId: CLIENT, path: ssnPath }),
        ),
      },
    };
    const out = decryptTreeWithAAD(tree, dek, aadFor) as typeof tree;
    expect(out.personal.fullName).toBe('David Kim');
    expect(out.personal.ssn).toBe('123-45-6789');
  });

  test('walks arrays + decrypts AAD-bound items with index-based paths', async () => {
    const { decryptTreeWithAAD, encryptFieldForTenantWithAAD, deriveAAD } = await import(
      '../src/encryption.js'
    );
    const dek = randomBytes(32);
    const dep0Path = 'dependents.0.ssn';
    const dep1Path = 'dependents.1.ssn';
    const tree = {
      dependents: [
        {
          fullName: 'Kid A',
          ssn: encryptFieldForTenantWithAAD(
            '111-22-3333',
            dek,
            deriveAAD({ tenantId: TENANT, clientId: CLIENT, path: dep0Path }),
          ),
        },
        {
          fullName: 'Kid B',
          ssn: encryptFieldForTenantWithAAD(
            '444-55-6666',
            dek,
            deriveAAD({ tenantId: TENANT, clientId: CLIENT, path: dep1Path }),
          ),
        },
      ],
    };
    const out = decryptTreeWithAAD(tree, dek, aadFor) as typeof tree;
    expect(out.dependents[0]?.ssn).toBe('111-22-3333');
    expect(out.dependents[1]?.ssn).toBe('444-55-6666');
  });

  test('decrypts deeply nested AAD-bound leaf with full dotted path', async () => {
    const { decryptTreeWithAAD, encryptFieldForTenantWithAAD, deriveAAD } = await import(
      '../src/encryption.js'
    );
    const dek = randomBytes(32);
    const deepPath = 'dependents.0.identity.ssn';
    const tree = {
      dependents: [
        {
          identity: {
            ssn: encryptFieldForTenantWithAAD(
              '999-88-7777',
              dek,
              deriveAAD({ tenantId: TENANT, clientId: CLIENT, path: deepPath }),
            ),
          },
        },
      ],
    };
    const out = decryptTreeWithAAD(tree, dek, aadFor) as typeof tree;
    expect(out.dependents[0]?.identity.ssn).toBe('999-88-7777');
  });

  test('falls back to AAD-less decrypt for pre-AAD (legacy DEK) leaves', async () => {
    // Mixed tree: one leaf written WITH AAD, one written WITHOUT (the
    // older code path). The walker handles each independently via the
    // 3-tier fallback in decryptIfMarkedForTenantWithAAD.
    const { decryptTreeWithAAD, encryptFieldForTenantWithAAD, encryptFieldForTenant, deriveAAD } =
      await import('../src/encryption.js');
    const dek = randomBytes(32);
    const tree = {
      personal: {
        ssn: encryptFieldForTenantWithAAD(
          '123-45-6789',
          dek,
          deriveAAD({ tenantId: TENANT, clientId: CLIENT, path: 'personal.ssn' }),
        ),
        ein: encryptFieldForTenant('12-3456789', dek), // legacy AAD-less write
      },
    };
    const out = decryptTreeWithAAD(tree, dek, aadFor) as typeof tree;
    expect(out.personal.ssn).toBe('123-45-6789');
    expect(out.personal.ein).toBe('12-3456789');
  });

  test('falls back to master-KEK for pre-tenant-DEK legacy leaves', async () => {
    // Even older legacy: the master-KEK was used to encrypt the value
    // directly (pre-batch-9 production data). The 3-tier fallback should
    // surface the plaintext via path 3.
    const { decryptTreeWithAAD, encryptField } = await import('../src/encryption.js');
    const dek = randomBytes(32);
    const tree = {
      legacy: {
        value: encryptField('master-encrypted-legacy'),
      },
    };
    const out = decryptTreeWithAAD(tree, dek, aadFor) as typeof tree;
    expect(out.legacy.value).toBe('master-encrypted-legacy');
  });

  test('relocated ciphertext (moved to wrong path) fails decrypt', async () => {
    // This is the security property the AAD provides over relocation
    // attacks. An attacker with DB write access who moves an encrypted
    // SSN from personal.ssn into bank.routingNumber can't recover the
    // plaintext at the new location because the AAD-bound auth tag
    // doesn't match the new path. AAD-less fallback also fails because
    // the GCM tag was generated WITH AAD bytes folded in.
    const { decryptTreeWithAAD, encryptFieldForTenantWithAAD, deriveAAD } = await import(
      '../src/encryption.js'
    );
    const dek = randomBytes(32);
    const ssnAtRightPath = encryptFieldForTenantWithAAD(
      '123-45-6789',
      dek,
      deriveAAD({ tenantId: TENANT, clientId: CLIENT, path: 'personal.ssn' }),
    );
    // Move it.
    const relocated = {
      bank: { routingNumber: ssnAtRightPath },
    };
    expect(() => decryptTreeWithAAD(relocated, dek, aadFor)).toThrow();
  });

  test('passes plain values through unchanged', async () => {
    const { decryptTreeWithAAD } = await import('../src/encryption.js');
    const dek = randomBytes(32);
    const tree = {
      personal: { fullName: 'David', count: 3, opt: null },
      flags: [true, false],
    };
    const out = decryptTreeWithAAD(tree, dek, aadFor) as typeof tree;
    expect(out).toEqual(tree);
  });

  test('handles null + undefined + empty containers', async () => {
    const { decryptTreeWithAAD } = await import('../src/encryption.js');
    const dek = randomBytes(32);
    expect(decryptTreeWithAAD(null, dek, aadFor)).toBe(null);
    expect(decryptTreeWithAAD(undefined, dek, aadFor)).toBe(undefined);
    expect(decryptTreeWithAAD({}, dek, aadFor)).toEqual({});
    expect(decryptTreeWithAAD([], dek, aadFor)).toEqual([]);
  });

  test('does NOT mutate the input tree', async () => {
    const { decryptTreeWithAAD, encryptFieldForTenantWithAAD, deriveAAD } = await import(
      '../src/encryption.js'
    );
    const dek = randomBytes(32);
    const tree = {
      personal: {
        ssn: encryptFieldForTenantWithAAD(
          '123-45-6789',
          dek,
          deriveAAD({ tenantId: TENANT, clientId: CLIENT, path: 'personal.ssn' }),
        ),
      },
    };
    const before = JSON.stringify(tree);
    decryptTreeWithAAD(tree, dek, aadFor);
    expect(JSON.stringify(tree)).toBe(before);
  });

  test('wrong DEK (different tenant) fails all 3 fallback paths', async () => {
    const { decryptTreeWithAAD, encryptFieldForTenantWithAAD, deriveAAD } = await import(
      '../src/encryption.js'
    );
    const dekA = randomBytes(32);
    const dekB = randomBytes(32);
    const tree = {
      personal: {
        ssn: encryptFieldForTenantWithAAD(
          '123-45-6789',
          dekA,
          deriveAAD({ tenantId: TENANT, clientId: CLIENT, path: 'personal.ssn' }),
        ),
      },
    };
    expect(() => decryptTreeWithAAD(tree, dekB, aadFor)).toThrow();
  });

  test('corrupted ciphertext (tampered byte) fails decrypt', async () => {
    const { decryptTreeWithAAD, encryptFieldForTenantWithAAD, deriveAAD } = await import(
      '../src/encryption.js'
    );
    const dek = randomBytes(32);
    const ct = encryptFieldForTenantWithAAD(
      'corruptme',
      dek,
      deriveAAD({ tenantId: TENANT, clientId: CLIENT, path: 'personal.ssn' }),
    );
    // Flip the last byte of the encoded marker.
    const buf = Buffer.from(ct.__enc, 'base64');
    buf[buf.length - 1] = buf[buf.length - 1]! ^ 0xff;
    const tampered = { __enc: buf.toString('base64') };
    const tree = { personal: { ssn: tampered } };
    expect(() => decryptTreeWithAAD(tree, dek, aadFor)).toThrow();
  });

  test('mixed tree (AAD-bound + AAD-less + plaintext) decrypts each leaf correctly', async () => {
    const {
      decryptTreeWithAAD,
      encryptFieldForTenantWithAAD,
      encryptFieldForTenant,
      encryptField,
      deriveAAD,
    } = await import('../src/encryption.js');
    const dek = randomBytes(32);
    const tree = {
      personal: {
        fullName: 'David', // plaintext
        ssn: encryptFieldForTenantWithAAD(
          '123-45-6789',
          dek,
          deriveAAD({ tenantId: TENANT, clientId: CLIENT, path: 'personal.ssn' }),
        ), // AAD-bound
        ein: encryptFieldForTenant('12-3456789', dek), // AAD-less (legacy)
      },
      legacy: {
        value: encryptField('master-only'), // master-KEK (pre-batch-9)
      },
    };
    const out = decryptTreeWithAAD(tree, dek, aadFor) as typeof tree;
    expect(out.personal.fullName).toBe('David');
    expect(out.personal.ssn).toBe('123-45-6789');
    expect(out.personal.ein).toBe('12-3456789');
    expect(out.legacy.value).toBe('master-only');
  });
});

// ────────────────────────────────────────────────────────────────
// Tier 0 invariants — added 2026-05-15 from the strict-protocol
// AES-GCM correctness review. Each test documents a property the
// implementation must hold; if any of these regresses, the failure
// mode is catastrophic (PII exposure, signature-chain integrity,
// tenant isolation). Keep them at the bottom of the file so a
// future contributor sees the high-stakes invariants clearly.
// ────────────────────────────────────────────────────────────────

describe('Tier 0 invariants — IV uniqueness at scale', () => {
  test('1000 encryptions of the same plaintext produce 1000 unique IVs', async () => {
    // GCM is catastrophically broken if the same (key, IV) pair is
    // used twice. Node's randomBytes(12) gives 96-bit IVs with
    // collision probability ~2^-48 over 2^32 encryptions per key
    // (NIST SP 800-38D limit). At 1000 ops we're nowhere near the
    // bound — but verifying uniqueness here catches any future bug
    // that swaps randomBytes for a static / counter-based IV.
    const { encryptFieldForTenant } = await import('../src/encryption.js');
    const dek = randomBytes(32);
    const ivs = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const marker = encryptFieldForTenant('123-45-6789', dek);
      const buf = Buffer.from(marker.__enc, 'base64');
      // First 12 bytes of the encoded blob = the IV.
      const iv = buf.subarray(0, 12).toString('hex');
      ivs.add(iv);
    }
    expect(ivs.size).toBe(1000);
  });
});

describe('Tier 0 invariants — ciphertext never contains plaintext substring', () => {
  test('encrypted SSN does not contain the digits anywhere in the blob', async () => {
    const { encryptFieldForTenant } = await import('../src/encryption.js');
    const dek = randomBytes(32);
    const plaintext = '123-45-6789';
    // Run 50 times because base64 collisions on accidental encoding
    // bugs would appear stochastically. Any leak shows up here.
    for (let i = 0; i < 50; i++) {
      const marker = encryptFieldForTenant(plaintext, dek);
      const blob = marker.__enc;
      const raw = Buffer.from(blob, 'base64').toString('utf8');
      expect(blob).not.toContain('123-45-6789');
      expect(blob).not.toContain('123456789');
      expect(raw).not.toContain('123-45-6789');
      expect(raw).not.toContain('123456789');
    }
  });
});

describe('Tier 0 invariants — empty + edge-case plaintext', () => {
  test('empty string round-trips', async () => {
    const { encryptFieldForTenant, decryptFieldForTenant } = await import(
      '../src/encryption.js'
    );
    const dek = randomBytes(32);
    const encrypted = encryptFieldForTenant('', dek);
    expect(decryptFieldForTenant(encrypted, dek)).toBe('');
  });

  test('single-byte plaintext round-trips', async () => {
    const { encryptFieldForTenant, decryptFieldForTenant } = await import(
      '../src/encryption.js'
    );
    const dek = randomBytes(32);
    const encrypted = encryptFieldForTenant('x', dek);
    expect(decryptFieldForTenant(encrypted, dek)).toBe('x');
  });

  test('plaintext with null byte round-trips', async () => {
    const { encryptFieldForTenant, decryptFieldForTenant } = await import(
      '../src/encryption.js'
    );
    const dek = randomBytes(32);
    const plaintext = 'a\x00b';
    const encrypted = encryptFieldForTenant(plaintext, dek);
    expect(decryptFieldForTenant(encrypted, dek)).toBe(plaintext);
  });
});

describe('Tier 0 invariants — AAD delimiter injection (defense-in-depth)', () => {
  // The AAD construction in deriveAAD joins components with `;` and
  // separates field-name from value with `:`. If a component value
  // ever contains `;` or `:`, two different logical inputs can
  // produce identical AAD bytes — a collision vulnerability.
  //
  // Today's inputs are constrained (UUIDs + numbers + schema-defined
  // paths), so this is a defense-in-depth gap, not an exploitable
  // bug. The tests here verify the validation prevents it.

  test('input containing delimiter character `;` is rejected', async () => {
    const { deriveAAD } = await import('../src/encryption.js');
    expect(() =>
      deriveAAD({ tenantId: 'evil;client:fake' }),
    ).toThrow(/delimiter/i);
  });

  test('input containing delimiter character `:` is rejected', async () => {
    const { deriveAAD } = await import('../src/encryption.js');
    expect(() =>
      deriveAAD({ clientId: 'evil:value' }),
    ).toThrow(/delimiter/i);
  });

  test('path containing `;` is rejected', async () => {
    const { deriveAAD } = await import('../src/encryption.js');
    expect(() =>
      deriveAAD({ tenantId: 'abc', path: 'personal;client:foo.ssn' }),
    ).toThrow(/delimiter/i);
  });

  test('legitimate UUID + dotted path inputs still work', async () => {
    const { deriveAAD } = await import('../src/encryption.js');
    const aad = deriveAAD({
      tenantId: '550e8400-e29b-41d4-a716-446655440000',
      clientId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      taxYear: 2025,
      path: 'dependents.list.0.ssn',
    });
    expect(aad.length).toBeGreaterThan(0);
    expect(aad.toString('utf8')).toBe(
      'tenant:550e8400-e29b-41d4-a716-446655440000;client:6ba7b810-9dad-11d1-80b4-00c04fd430c8;year:2025;path:dependents.list.0.ssn',
    );
  });
});

describe('Tier 0 invariants — migration-window vulnerability (documented + tested)', () => {
  // This test EXPLICITLY demonstrates the known migration-window
  // vulnerability flagged in CLAUDE.md §18: legacy AAD-less ciphertexts
  // can be relocated to any other path/row in the same tenant and
  // decryptIfMarkedForTenantWithAAD will successfully decrypt them via
  // Tier 2 (AAD-less fallback). The fix is the `reencrypt-legacy`
  // walker (Operator Action queued in audit punch list) which rewrites
  // every legacy AAD-less ciphertext as AAD-bound, after which the
  // Tier 2 + Tier 3 fallback paths can be removed entirely.
  //
  // This test exists so the vulnerability is TESTED-AND-KNOWN rather
  // than HIDDEN. When the walker runs prod-wide + the fallbacks get
  // removed, this test should be DELETED (the vulnerability closes
  // when the migration window closes).

  test('LEGACY AAD-less ciphertext successfully relocates via Tier 2 fallback', async () => {
    const {
      encryptFieldForTenant,
      decryptIfMarkedForTenantWithAAD,
      deriveAAD,
    } = await import('../src/encryption.js');
    const dek = randomBytes(32);
    // Step 1: encrypt without AAD (simulating a legacy v0 write).
    const legacy = encryptFieldForTenant('123-45-6789', dek);
    // Step 2: an attacker with DB write access moves this blob from
    // its original (tenant, client, path) to a different one. The
    // caller decrypts using the NEW location's AAD.
    const aadAtNewLocation = deriveAAD({
      tenantId: '550e8400-e29b-41d4-a716-446655440000',
      clientId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      path: 'bank.routingNumber', // wrong path; was 'personal.ssn'
    });
    // VULNERABILITY: this succeeds via Tier 2 (AAD-less fallback)
    // because the original ciphertext was written without AAD, so the
    // GCM auth tag verifies against the empty-AAD baseline regardless
    // of the row context. When the migration completes + fallbacks
    // are removed, this expectation flips to .toThrow().
    const plaintext = decryptIfMarkedForTenantWithAAD(
      legacy,
      dek,
      aadAtNewLocation,
    );
    expect(plaintext).toBe('123-45-6789');
  });

  test('AAD-bound ciphertext CANNOT be relocated (the fix the migration enables)', async () => {
    const {
      encryptFieldForTenantWithAAD,
      decryptIfMarkedForTenantWithAAD,
      deriveAAD,
    } = await import('../src/encryption.js');
    const dek = randomBytes(32);
    // Encrypt AAD-bound at original location.
    const aadOriginal = deriveAAD({
      tenantId: '550e8400-e29b-41d4-a716-446655440000',
      clientId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      path: 'personal.ssn',
    });
    const bound = encryptFieldForTenantWithAAD('123-45-6789', dek, aadOriginal);
    // Relocate.
    const aadAtNewLocation = deriveAAD({
      tenantId: '550e8400-e29b-41d4-a716-446655440000',
      clientId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      path: 'bank.routingNumber',
    });
    // Tier 1 fails (AAD mismatch). Tier 2 fails (auth tag was
    // computed with AAD bytes folded in; no-AAD verify fails). Tier 3
    // fails (wrong key). All three fallbacks throw → decryptor throws.
    expect(() =>
      decryptIfMarkedForTenantWithAAD(bound, dek, aadAtNewLocation),
    ).toThrow();
  });
});
