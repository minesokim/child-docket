// Audit-chain column-coverage guard (Tier 0 defense-in-depth).
//
// Migration 0022 (`actions_crypto_chain`) ships a per-tenant SHA-256
// chain. Every row's row_hash binds it to the prior row's row_hash. A
// single byte changed anywhere in the chain breaks every subsequent
// row's hash and verify_actions_chain returns the first tampered row.
//
// THE GAP THIS TEST CLOSES
//   The chain only protects columns that are passed into the
//   actions_canonical_for_hash SQL function. Migration 0022 line 141
//   spells this out:
//
//     IMPORTANT: changing this function invalidates every existing chain.
//     New columns added to actions don't auto-flow into the hash; if a
//     new column should be chained, append it to the END of the array
//     (and run the same drop-trigger / backfill / recreate-trigger
//     migration pattern).
//
//   That's a HUMAN-process rule with no automated enforcement. Someone
//   could ship a future migration that adds a new column to `actions`
//   (e.g., `parent_action_id`, `priority`, `idempotency_key`) AND
//   forget to update actions_canonical_for_hash. The new column would
//   be off-chain mutable — an attacker could change it after the row
//   was written without breaking the chain.
//
//   This test fails as soon as any column exists on the Drizzle
//   `actions` table definition that is not in either HASHED_COLUMNS
//   or EXCLUDED_COLUMNS. The failure message points the contributor
//   at this file + migration 0022 so the decision (in or out) is made
//   explicitly.
//
// WHEN TO UPDATE
//   - Adding a column to actions that SHOULD be chained:
//       1. Update actions_canonical_for_hash in a new migration that
//          drops + recreates the trigger.
//       2. Append the new TS field name to HASHED_COLUMNS below.
//   - Adding a column to actions that SHOULD NOT be chained:
//       1. Append to EXCLUDED_COLUMNS with a one-line reason comment.
//       2. Document the rationale in the migration that adds it.
//
// WHEN NOT TO UPDATE
//   - If you find yourself adding to EXCLUDED_COLUMNS without writing
//     the reason, STOP. Exclusion needs a defensible reason. The only
//     existing exclusions are:
//       * clientId — FK-cascade NULL'ing for CCPA per migration 0012
//       * rowHash  — the chain output; including it would be circular

import { describe, expect, test } from 'bun:test';
import { getTableColumns } from 'drizzle-orm';
import { actions } from '../src/schema.js';

// TS field names of every column passed into actions_canonical_for_hash.
// Order intentionally matches the SQL parameter list (migration 0022) so
// a reviewer can scan top-to-bottom and confirm parity. If you reorder
// this list, the test still passes; the ordering is for human review.
const HASHED_COLUMNS = [
  'id',
  'tenantId',
  'userId',
  'agentId',
  'actionClass',
  'toolName',
  'toolInput',
  'toolOutput',
  'modelUsed',
  'inputTokens',
  'outputTokens',
  'cachedTokens',
  'costUsd',
  'latencyMs',
  'success',
  'errorMessage',
  'createdAt',
  'chainSeq',
  'prevHash',
] as const;

// TS field names of every actions column DELIBERATELY left out of the
// chain hash. Each excluded column needs a defensible reason.
const EXCLUDED_COLUMNS = [
  // CCPA right-to-delete must be able to NULL clientId without
  // invalidating the chain. Migration 0012 carves out exactly this
  // mutation in the append-only trigger. Migration 0022 header
  // documents the exclusion + trade-off (a hostile UPDATE setting
  // clientId to NULL is undetected, but the only legal mutation IS
  // non-null -> NULL, and that mutation's own audit row enters the
  // chain at the application layer).
  'clientId',
  // The chain output. Including the row's own row_hash in its hash
  // would be circular (sha256(... rowHash ...)) where rowHash is the
  // value being computed). The chain proves row_hash is correct via
  // recomputation, not by self-reference.
  'rowHash',
] as const;

describe('Audit chain column coverage (Tier 0 defense-in-depth)', () => {
  test('every actions column is either in the chain hash or explicitly excluded', () => {
    const tableColumns = Object.keys(getTableColumns(actions)).sort();
    const covered = new Set<string>([...HASHED_COLUMNS, ...EXCLUDED_COLUMNS]);
    const uncovered = tableColumns.filter((c) => !covered.has(c));

    // If this fails, you added a column to `actions` in schema.ts (and
    // presumably a migration) without deciding whether it belongs in
    // the chain hash. See the WHEN TO UPDATE section at the top of
    // this file.
    expect(uncovered).toEqual([]);
  });

  test('HASHED_COLUMNS and EXCLUDED_COLUMNS do not overlap', () => {
    const hashed = new Set<string>(HASHED_COLUMNS);
    const overlap = EXCLUDED_COLUMNS.filter((c) => hashed.has(c));

    // A column can be hashed XOR excluded, not both. If this fails,
    // someone listed the same column in both arrays; the source-of-
    // truth ambiguity needs to be resolved by deleting from the wrong
    // array.
    expect(overlap).toEqual([]);
  });

  test('every HASHED_COLUMNS / EXCLUDED_COLUMNS entry exists on the actions table', () => {
    const tableColumns = new Set<string>(Object.keys(getTableColumns(actions)));
    const orphaned = [...HASHED_COLUMNS, ...EXCLUDED_COLUMNS].filter(
      (c) => !tableColumns.has(c),
    );

    // Catches stale entries: if you remove a column from `actions` but
    // forget to remove it from HASHED_COLUMNS / EXCLUDED_COLUMNS, this
    // test surfaces the drift.
    expect(orphaned).toEqual([]);
  });

  test('the HASHED_COLUMNS count matches the canonical-function arity', () => {
    // actions_canonical_for_hash (migration 0022) takes 19 parameters:
    // id, tenantId, userId, agentId, actionClass, toolName, toolInput,
    // toolOutput, modelUsed, inputTokens, outputTokens, cachedTokens,
    // costUsd, latencyMs, success, errorMessage, createdAt, chainSeq,
    // prevHash. If this number changes, the SQL function arity has
    // shifted and HASHED_COLUMNS must follow.
    expect(HASHED_COLUMNS.length).toBe(19);
  });
});
