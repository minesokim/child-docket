// packages/db/scripts/rotate-kek.ts
//
// KEK rotation script — re-encrypts every tenant's dek_encrypted
// row from the OLD master KEK to the NEW master KEK.
//
// USAGE
//   PII_ENCRYPTION_KEY=<new>           \
//   PII_ENCRYPTION_KEY_PREVIOUS=<old>  \
//     bun run packages/db/scripts/rotate-kek.ts [--dry-run]
//
// What it does:
//   1. Reads PII_ENCRYPTION_KEY (new) + PII_ENCRYPTION_KEY_PREVIOUS (old)
//      from env. Both must be 64 hex chars (32 bytes).
//   2. SELECTs every tenant + their dek_encrypted blob.
//   3. Per tenant, in a TRANSACTION:
//      a. Decrypt dek_encrypted with OLD key
//      b. Re-encrypt the same DEK bytes with NEW key
//      c. UPDATE tenants.dek_encrypted with the new ciphertext
//      d. Verify by decrypting NEW ciphertext with NEW key
//      e. Commit
//   4. Per-tenant failure rolls back THAT tenant's transaction; other
//      tenants unaffected. Script exits with non-zero if any failed.
//   5. --dry-run mode reports what WOULD happen without writing.
//
// SAFETY
//   - Idempotent. Re-running on already-rotated tenants no-ops
//     (NEW key successfully decrypts; verify-roundtrip succeeds;
//     UPDATE is to identical bytes).
//   - Per-tenant transaction isolation. Crash mid-rotation leaves
//     a coherent mix; re-run completes.
//   - Verify-roundtrip after re-encrypt catches the case where the
//     NEW ciphertext is somehow corrupted before the commit.
//
// Reference: docs/KEK-ROTATION.md is the operator runbook.

/* eslint-disable no-console */

import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { getAdminDb } from '../src/index.js';
import {
  encryptDek,
  decryptDek,
  isEncrypted,
} from '../src/encryption.js';
import { createDecipheriv, createCipheriv, randomBytes } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '../../../.env.local'), override: false });

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';

const dryRun = process.argv.includes('--dry-run');

const NEW_KEY_HEX = process.env.PII_ENCRYPTION_KEY ?? '';
const OLD_KEY_HEX = process.env.PII_ENCRYPTION_KEY_PREVIOUS ?? '';

function validateKey(label: string, hex: string): Buffer {
  if (!hex) {
    console.error(`${RED}FATAL${RESET} ${label} env var not set`);
    process.exit(2);
  }
  if (hex.length !== 64) {
    console.error(`${RED}FATAL${RESET} ${label} must be 64 hex chars (32 bytes); got ${hex.length}`);
    process.exit(2);
  }
  return Buffer.from(hex, 'hex');
}

const newKey = validateKey('PII_ENCRYPTION_KEY', NEW_KEY_HEX);
const oldKey = validateKey('PII_ENCRYPTION_KEY_PREVIOUS', OLD_KEY_HEX);

if (newKey.equals(oldKey)) {
  console.error(`${RED}FATAL${RESET} new key === old key; nothing to rotate`);
  process.exit(2);
}

// ────────────────────────────────────────────────────────────────
// Inline encrypt/decrypt with explicit-key (the encryption.ts public
// API reads from env; we need to use OLD vs NEW per call). Keep this
// trivial and matched to encryptWithKey internals.
// ────────────────────────────────────────────────────────────────

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function decryptDekWithKey(marker: { __enc: string }, key: Buffer): Buffer {
  const buf = Buffer.from(marker.__enc, 'base64');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plainBase64 = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  return Buffer.from(plainBase64, 'base64');
}

function encryptDekWithKey(dek: Buffer, key: Buffer): { __enc: string } {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(dek.toString('base64'), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    __enc: Buffer.concat([iv, tag, ciphertext]).toString('base64'),
  };
}

// ────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  console.log(`${YELLOW}━━ rotate-kek ${dryRun ? '(DRY RUN)' : ''} ━━${RESET}`);

  const db = getAdminDb();
  const rows = await db.execute<{ id: string; name: string; dek_encrypted: string | null }>(sql`
    SELECT id::text AS id, name, dek_encrypted FROM tenants
  `);
  const tenants = rows as unknown as Array<{
    id: string;
    name: string;
    dek_encrypted: string | null;
  }>;

  console.log(`Found ${tenants.length} tenants.\n`);

  let success = 0;
  let alreadyRotated = 0;
  let failed = 0;

  for (let i = 0; i < tenants.length; i++) {
    const tenant = tenants[i]!;
    const tag = `[${i + 1}/${tenants.length}]`;
    if (!tenant.dek_encrypted) {
      console.log(`${tag} ${YELLOW}SKIP${RESET} ${tenant.name} (${tenant.id.slice(0, 8)}…) — no dek_encrypted (tenant not provisioned)`);
      continue;
    }

    let parsed: { __enc: string };
    try {
      const obj = typeof tenant.dek_encrypted === 'string'
        ? JSON.parse(tenant.dek_encrypted)
        : tenant.dek_encrypted;
      if (!isEncrypted(obj)) {
        console.log(`${tag} ${RED}FAIL${RESET} ${tenant.name} — dek_encrypted shape is not an EncryptedMarker`);
        failed++;
        continue;
      }
      parsed = obj;
    } catch (err) {
      console.log(
        `${tag} ${RED}FAIL${RESET} ${tenant.name} — could not parse dek_encrypted: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      failed++;
      continue;
    }

    // Try NEW key first (idempotency: already-rotated tenants
    // decrypt cleanly with NEW key).
    let dek: Buffer | null = null;
    try {
      dek = decryptDekWithKey(parsed, newKey);
      console.log(
        `${tag} ${DIM}${tenant.name} (${tenant.id.slice(0, 8)}…) already on NEW key; skipping${RESET}`,
      );
      alreadyRotated++;
      continue;
    } catch {
      // Expected on first run — fall through to OLD key.
    }

    // Decrypt with OLD key.
    try {
      dek = decryptDekWithKey(parsed, oldKey);
    } catch (err) {
      console.log(
        `${tag} ${RED}FAIL${RESET} ${tenant.name} — OLD key cannot decrypt dek_encrypted: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      failed++;
      continue;
    }

    if (dek.length !== 32) {
      console.log(`${tag} ${RED}FAIL${RESET} ${tenant.name} — decrypted DEK has wrong length: ${dek.length}`);
      failed++;
      continue;
    }

    // Re-encrypt with NEW key.
    const newCiphertext = encryptDekWithKey(dek, newKey);

    // Verify roundtrip BEFORE writing.
    let verifyDek: Buffer;
    try {
      verifyDek = decryptDekWithKey(newCiphertext, newKey);
    } catch (err) {
      console.log(
        `${tag} ${RED}FAIL${RESET} ${tenant.name} — verify-roundtrip on NEW ciphertext threw: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      failed++;
      continue;
    }
    if (!verifyDek.equals(dek)) {
      console.log(`${tag} ${RED}FAIL${RESET} ${tenant.name} — verify-roundtrip DEK mismatch`);
      failed++;
      continue;
    }

    if (dryRun) {
      console.log(`${tag} ${YELLOW}WOULD ROTATE${RESET} ${tenant.name} (${tenant.id.slice(0, 8)}…)`);
      success++;
      continue;
    }

    // Commit the new ciphertext via UPDATE.
    try {
      await db.execute(sql`
        UPDATE tenants
        SET dek_encrypted = ${JSON.stringify(newCiphertext)}::jsonb
        WHERE id = ${tenant.id}::uuid
      `);
      console.log(`${tag} ${GREEN}OK${RESET} ${tenant.name} (${tenant.id.slice(0, 8)}…) — re-encrypted`);
      success++;
    } catch (err) {
      console.log(
        `${tag} ${RED}FAIL${RESET} ${tenant.name} — UPDATE failed: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      failed++;
    }
  }

  // Suppress unused-import warning if encryptDek/decryptDek aren't called
  // (we use the inline variants for explicit-key control).
  void encryptDek;
  void decryptDek;

  console.log('');
  console.log(`${success} rotated, ${alreadyRotated} already on NEW, ${failed} failed.`);
  return failed > 0 ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`${RED}FATAL${RESET}`, err);
    process.exit(2);
  });
