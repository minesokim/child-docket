// Pure tree walker for the legacy → tenant-DEK re-encryption migration.
//
// Extracted from scripts/reencrypt-legacy.ts so it can be unit-tested without
// spinning up a Postgres connection. The script wraps this with the per-tenant
// DB I/O; the walker itself is just (tree, dek[, aadBuilder]) → (rewritten
// tree, stats).
//
// Behavior contract:
//   1. Plain (non-EncryptedMarker) values pass through unchanged.
//   2. EncryptedMarker that decrypts with the tenant DEK + AAD (when an
//      aadBuilder is provided): leave as-is. (Already AAD-bound — newest
//      format.)
//   3. EncryptedMarker that decrypts with the tenant DEK alone:
//      leave as-is. (Already on the per-tenant key — nothing to do.)
//   4. EncryptedMarker that fails the tenant DEK but succeeds the master KEK:
//      decrypt + re-encrypt with the tenant DEK. Counts as `changed`. Note:
//      this still re-encrypts WITHOUT AAD in the current pass; a later
//      separate-commit walker enhancement will optionally re-encrypt with
//      AAD when an aadBuilder is provided. v0 fix keeps scope tight: stop
//      misclassifying AAD-bound leaves as errors.
//   5. EncryptedMarker that fails all keys: don't rewrite, increment errors.
//      Possibly tampered or corrupt — leave for manual triage.
//   6. Recursion preserves array order + object key order.
//   7. Idempotent: second-pass on a tree from pass 1 returns identical tree
//      with all `changed: 0`.
//
// AAD-MIGRATION POSTURE
//   When the caller provides an aadBuilder (path → AAD Buffer), the walker
//   tries the AAD-bound decrypt path FIRST. AAD-bound leaves count as
//   `alreadyTenant` (they're on the newest format; no rewrite needed). When
//   no aadBuilder is provided, behavior matches the original API — useful
//   for non-intake migrations + the existing test suite.

import {
  decryptField,
  decryptFieldForTenant,
  decryptFieldForTenantWithAAD,
  encryptFieldForTenant,
  isEncrypted,
  type EncryptedMarker,
} from './encryption.js';

export type WalkCounts = {
  changed: number;       // legacy leaves migrated this walk
  alreadyTenant: number; // leaves that already decrypt with the tenant DEK
                         // (AAD-bound OR AAD-less; both count as up-to-date
                         // for legacy-migration purposes)
  total: number;         // total encrypted leaves observed
  errors: number;        // leaves that failed all keys
};

export type WalkResult = {
  tree: unknown;
} & WalkCounts;

export function walkAndRewrite(
  node: unknown,
  dek: Buffer,
  aadBuilder?: (path: string) => Buffer,
): WalkResult {
  const ctx: WalkCounts = { changed: 0, alreadyTenant: 0, total: 0, errors: 0 };
  const tree = rewriteTree(node, dek, ctx, aadBuilder, '');
  return { tree, ...ctx };
}

function rewriteTree(
  node: unknown,
  dek: Buffer,
  ctx: WalkCounts,
  aadBuilder: ((path: string) => Buffer) | undefined,
  currentPath: string,
): unknown {
  if (node == null || typeof node !== 'object') return node;

  if (isEncrypted(node)) {
    ctx.total += 1;
    const marker = node as EncryptedMarker;

    // 1. AAD-bound decrypt (when aadBuilder provided). If it succeeds, the
    // leaf is already on the newest format — leave as-is.
    if (aadBuilder) {
      try {
        decryptFieldForTenantWithAAD(marker, dek, aadBuilder(currentPath));
        ctx.alreadyTenant += 1;
        return marker;
      } catch {
        // Fall through to AAD-less paths.
      }
    }

    // 2. AAD-less tenant DEK decrypt. If it works, already migrated to
    // per-tenant DEK; leave as-is (this commit doesn't re-encrypt DEK →
    // AAD-bound; deferred to a follow-up).
    try {
      decryptFieldForTenant(marker, dek);
      ctx.alreadyTenant += 1;
      return marker;
    } catch {
      // 3. Master-KEK decrypt. If it works, this is pre-tenant-DEK legacy
      // data — re-encrypt with tenant DEK and bump the counter.
      try {
        const plaintext = decryptField(marker);
        const newMarker = encryptFieldForTenant(plaintext, dek);
        ctx.changed += 1;
        return newMarker;
      } catch {
        // All paths failed — possibly tampered or corrupt. Leave the
        // ciphertext alone and surface via the error counter so the
        // operator can investigate manually before re-running.
        ctx.errors += 1;
        return marker;
      }
    }
  }

  if (Array.isArray(node)) {
    return node.map((item, idx) =>
      rewriteTree(item, dek, ctx, aadBuilder, joinPath(currentPath, String(idx))),
    );
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    out[k] = rewriteTree(v, dek, ctx, aadBuilder, joinPath(currentPath, k));
  }
  return out;
}

function joinPath(base: string, key: string): string {
  return base ? `${base}.${key}` : key;
}
