// Unit tests for the legacy → tenant-DEK re-encryption tree walker.
//
// The walker is the brain of the one-time `reencrypt-legacy` admin script. If
// it gets the legacy detection wrong, two failure modes:
//   1. Skip legacy data silently — fallback in encryption.ts stays load-bearing
//      forever, defeating the SOC-2 hygiene goal.
//   2. Destroy good data — tenant-DEK ciphertext mistakenly re-encrypted, then
//      double-wrapped or corrupted.
//
// These tests pin the contract before the script ever runs against prod.
//
// Strategy: build fixtures by encrypting known plaintexts with a fake master
// KEK + a fake tenant DEK, run the walker, assert tree shape + counts.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { randomBytes } from 'node:crypto';
import {
  encryptField,
  encryptFieldForTenant,
  decryptFieldForTenant,
  isEncrypted,
} from '../src/encryption.js';
import { walkAndRewrite } from '../src/reencrypt-legacy-walker.js';

// Set a deterministic master KEK BEFORE encryption module reads it. The
// module caches at first call, so we set the env var at suite start and
// restore at suite end. Each test reuses the cached key.
const MASTER_KEK_HEX = randomBytes(32).toString('hex');
const TENANT_DEK = randomBytes(32);
const SECOND_TENANT_DEK = randomBytes(32);

const ORIGINAL_KEY = process.env.PII_ENCRYPTION_KEY;

beforeAll(() => {
  process.env.PII_ENCRYPTION_KEY = MASTER_KEK_HEX;
});

afterAll(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.PII_ENCRYPTION_KEY;
  else process.env.PII_ENCRYPTION_KEY = ORIGINAL_KEY;
});

describe('walkAndRewrite — legacy → tenant DEK migration', () => {
  test('plain values pass through unchanged', () => {
    const tree = {
      personal: { firstName: 'Antonio', age: 58, hasSpouse: true },
      tags: ['active', 'returning'],
      empty: null,
    };
    const result = walkAndRewrite(tree, TENANT_DEK);
    expect(result.tree).toEqual(tree);
    expect(result.total).toBe(0);
    expect(result.changed).toBe(0);
    expect(result.alreadyTenant).toBe(0);
    expect(result.errors).toBe(0);
  });

  test('tenant-DEK leaves are left as-is (already migrated)', () => {
    const ssn = encryptFieldForTenant('123456789', TENANT_DEK);
    const ein = encryptFieldForTenant('987654321', TENANT_DEK);
    const tree = { personal: { ssn }, business: { ein } };

    const result = walkAndRewrite(tree, TENANT_DEK);
    expect(result.total).toBe(2);
    expect(result.alreadyTenant).toBe(2);
    expect(result.changed).toBe(0);
    expect(result.errors).toBe(0);

    // Object identity preserved on already-migrated leaves: the walker
    // returns the same EncryptedMarker, not a re-wrapped one.
    const out = result.tree as { personal: { ssn: unknown }; business: { ein: unknown } };
    expect(out.personal.ssn).toBe(ssn);
    expect(out.business.ein).toBe(ein);
  });

  test('master-KEK leaves get re-encrypted with the tenant DEK', () => {
    // Legacy data: encrypted with the master KEK directly (pre-batch-9).
    const legacySsn = encryptField('555443333');
    const legacyEin = encryptField('120000123');
    const tree = { personal: { ssn: legacySsn }, business: { ein: legacyEin } };

    const result = walkAndRewrite(tree, TENANT_DEK);
    expect(result.total).toBe(2);
    expect(result.changed).toBe(2);
    expect(result.alreadyTenant).toBe(0);
    expect(result.errors).toBe(0);

    // The leaves are now NEW EncryptedMarkers — different ciphertext, but
    // decrypt with the tenant DEK to the same plaintext.
    const out = result.tree as { personal: { ssn: unknown }; business: { ein: unknown } };
    expect(out.personal.ssn).not.toBe(legacySsn);
    expect(out.business.ein).not.toBe(legacyEin);
    expect(isEncrypted(out.personal.ssn)).toBe(true);
    expect(isEncrypted(out.business.ein)).toBe(true);

    if (!isEncrypted(out.personal.ssn) || !isEncrypted(out.business.ein)) {
      throw new Error('expected migrated leaves to still be EncryptedMarkers');
    }
    expect(decryptFieldForTenant(out.personal.ssn, TENANT_DEK)).toBe('555443333');
    expect(decryptFieldForTenant(out.business.ein, TENANT_DEK)).toBe('120000123');
  });

  test('tampered or wrong-tenant blobs surface as errors (not rewritten)', () => {
    // Encrypted with a DIFFERENT tenant's DEK — neither the target tenant DEK
    // nor the master KEK can decrypt it. Walker should leave it alone and
    // bump the error counter so the operator can investigate.
    const wrongTenant = encryptFieldForTenant('111223333', SECOND_TENANT_DEK);
    const tree = { personal: { ssn: wrongTenant } };

    const result = walkAndRewrite(tree, TENANT_DEK);
    expect(result.total).toBe(1);
    expect(result.errors).toBe(1);
    expect(result.changed).toBe(0);
    expect(result.alreadyTenant).toBe(0);

    // Untouched — the original ciphertext object is preserved by reference.
    const out = result.tree as { personal: { ssn: unknown } };
    expect(out.personal.ssn).toBe(wrongTenant);
  });

  test('mixed plaintext + encrypted nested structures handle correctly', () => {
    const legacySsn = encryptField('123456789');
    const tenantBank = encryptFieldForTenant('028000114', TENANT_DEK);

    const tree = {
      personal: {
        firstName: 'Antonio',          // plain
        ssn: legacySsn,                // legacy → migrate
        spouse: null,                  // plain null
      },
      refund: {
        bankRouting: tenantBank,       // already migrated → stay
        bankAccount: '0000000000',     // plain string (post-mig: should be encrypted, but valid mid-state)
      },
      dependents: {
        list: [
          { firstName: 'Mateo', ssn: encryptField('111223333') },   // legacy → migrate
          { firstName: 'Lucia', ssn: encryptFieldForTenant('444556666', TENANT_DEK) }, // already → stay
        ],
      },
      tags: ['client', 'priority'],
    };

    const result = walkAndRewrite(tree, TENANT_DEK);
    expect(result.total).toBe(4);          // 4 encrypted leaves
    expect(result.changed).toBe(2);        // 2 legacy
    expect(result.alreadyTenant).toBe(2);  // 2 tenant
    expect(result.errors).toBe(0);

    const out = result.tree as typeof tree;
    expect(out.personal.firstName).toBe('Antonio');
    expect(out.personal.spouse).toBeNull();
    expect(out.refund.bankAccount).toBe('0000000000');
    expect(out.tags).toEqual(['client', 'priority']);

    // Migrated SSN decrypts to its original plaintext via the tenant DEK.
    if (!isEncrypted(out.personal.ssn)) throw new Error('ssn should be encrypted');
    expect(decryptFieldForTenant(out.personal.ssn, TENANT_DEK)).toBe('123456789');

    // Already-migrated bank routing has identical reference (untouched).
    expect(out.refund.bankRouting).toBe(tenantBank);

    // Dependent SSNs: first is migrated (new ciphertext), second untouched.
    const dep0Ssn = out.dependents.list[0]?.ssn;
    const dep1Ssn = out.dependents.list[1]?.ssn;
    if (!isEncrypted(dep0Ssn) || !isEncrypted(dep1Ssn)) {
      throw new Error('dependents.list[*].ssn should be encrypted');
    }
    expect(decryptFieldForTenant(dep0Ssn, TENANT_DEK)).toBe('111223333');
    expect(decryptFieldForTenant(dep1Ssn, TENANT_DEK)).toBe('444556666');
  });

  test('idempotent: a second pass on the rewritten tree finds nothing to change', () => {
    const legacy = encryptField('999887777');
    const tree = { personal: { ssn: legacy } };

    const pass1 = walkAndRewrite(tree, TENANT_DEK);
    expect(pass1.changed).toBe(1);
    expect(pass1.alreadyTenant).toBe(0);

    // Run pass 2 against pass 1's output. All leaves should now be
    // tenant-DEK encrypted; nothing changes.
    const pass2 = walkAndRewrite(pass1.tree, TENANT_DEK);
    expect(pass2.total).toBe(1);
    expect(pass2.changed).toBe(0);
    expect(pass2.alreadyTenant).toBe(1);
    expect(pass2.errors).toBe(0);
    expect(pass2.tree).toEqual(pass1.tree);
  });
});
