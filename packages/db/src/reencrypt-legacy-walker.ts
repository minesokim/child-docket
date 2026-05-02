// Pure tree walker for the legacy → tenant-DEK re-encryption migration.
//
// Extracted from scripts/reencrypt-legacy.ts so it can be unit-tested without
// spinning up a Postgres connection. The script wraps this with the per-tenant
// DB I/O; the walker itself is just (tree, dek) → (rewritten tree, stats).
//
// Behavior contract:
//   1. Plain (non-EncryptedMarker) values pass through unchanged.
//   2. EncryptedMarker that decrypts with the tenant DEK: leave as-is.
//      (Already on the new key — nothing to do.)
//   3. EncryptedMarker that fails the tenant DEK but succeeds the master KEK:
//      decrypt + re-encrypt with the tenant DEK. Counts as `changed`.
//   4. EncryptedMarker that fails BOTH keys: don't rewrite, increment errors.
//      Possibly tampered or corrupt — leave for manual triage.
//   5. Recursion preserves array order + object key order.
//   6. Idempotent: second-pass on a tree from pass 1 returns identical tree
//      with all `changed: 0`.

import {
  decryptField,
  decryptFieldForTenant,
  encryptFieldForTenant,
  isEncrypted,
  type EncryptedMarker,
} from './encryption.js';

export type WalkCounts = {
  changed: number;       // legacy leaves migrated this walk
  alreadyTenant: number; // leaves that already decrypt with the tenant DEK
  total: number;         // total encrypted leaves observed
  errors: number;        // leaves that failed both keys
};

export type WalkResult = {
  tree: unknown;
} & WalkCounts;

export function walkAndRewrite(node: unknown, dek: Buffer): WalkResult {
  const ctx: WalkCounts = { changed: 0, alreadyTenant: 0, total: 0, errors: 0 };
  const tree = rewriteTree(node, dek, ctx);
  return { tree, ...ctx };
}

function rewriteTree(node: unknown, dek: Buffer, ctx: WalkCounts): unknown {
  if (node == null || typeof node !== 'object') return node;

  if (isEncrypted(node)) {
    ctx.total += 1;
    const marker = node as EncryptedMarker;

    // Try tenant DEK first. If it works, leave as-is.
    try {
      decryptFieldForTenant(marker, dek);
      ctx.alreadyTenant += 1;
      return marker;
    } catch {
      // Tenant DEK failed. Try master KEK. If THAT works, this is legacy
      // data — re-encrypt with tenant DEK and bump the counter.
      try {
        const plaintext = decryptField(marker);
        const newMarker = encryptFieldForTenant(plaintext, dek);
        ctx.changed += 1;
        return newMarker;
      } catch {
        // Both keys failed — possibly tampered or corrupt. Leave the
        // ciphertext alone and surface via the error counter so the
        // operator can investigate manually before re-running.
        ctx.errors += 1;
        return marker;
      }
    }
  }

  if (Array.isArray(node)) {
    return node.map((item) => rewriteTree(item, dek, ctx));
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    out[k] = rewriteTree(v, dek, ctx);
  }
  return out;
}
