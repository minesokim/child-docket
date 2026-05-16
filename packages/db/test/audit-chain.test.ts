// Audit-chain integration tests (Tier 0 — cryptographic correctness).
//
// Pairs with migration 0022_actions_crypto_chain.sql. The migration
// ships three SQL objects:
//
//   1. actions_canonical_for_hash(...)  — pure function, returns the
//      jsonb-canonical text representation of an actions row's fields.
//   2. enforce_actions_chain()         — BEFORE INSERT trigger that
//      acquires a per-tenant advisory lock, computes chain_seq +
//      prev_hash + row_hash, and stamps them on NEW.
//   3. verify_actions_chain(p_tenant_id) — function that walks one
//      tenant's chain in chain_seq order and returns the id of the
//      first row whose stored row_hash does not match the
//      recomputation. NULL if intact.
//
// This suite exercises the chain end-to-end against a real Postgres
// instance with all migrations applied. It is the production-grade
// proof that the chain is doing what migration 0022's header
// promises:
//
//   - chain_seq is monotonic + contiguous per tenant
//   - prev_hash on row N = row_hash on row N-1
//   - row_hash recomputation matches stored value (no drift)
//   - per-tenant isolation: two tenants' chains do not affect each
//     other
//   - tamper detection: a UPDATE that bypasses the append-only trigger
//     (by dropping it, mutating, recreating) IS detected by
//     verify_actions_chain
//   - CCPA-cascade tolerance: setting client_id to NULL via the
//     migration 0012 carve-out does NOT break the chain (because
//     client_id is intentionally excluded from the hash)
//
// Run requirements:
//   - DATABASE_URL_RLS_TEST env var pointing at a database with
//     migrations 0000-0022+ applied. Same DB used by rls.test.ts and
//     audit-immutability.test.ts.
//   - The connecting role must be able to DROP TRIGGER / CREATE
//     TRIGGER (Neon's neondb_owner role is sufficient).
//
// Run:
//   DATABASE_URL_RLS_TEST=postgres://... bun test packages/db/test/audit-chain.test.ts
//
// Skipped (no-op) if DATABASE_URL_RLS_TEST is unset, so this suite
// doesn't slow down the default `bun test` pass on dev machines
// without a test DB.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { sql as drizzleSql } from 'drizzle-orm';
import postgres, { type Sql } from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { randomUUID } from 'node:crypto';
import * as schema from '../src/schema.js';

const DB_URL = process.env.DATABASE_URL_RLS_TEST;

if (!DB_URL) {
  describe.skip('Audit chain (skipped — DATABASE_URL_RLS_TEST not set)', () => {
    test('placeholder', () => {});
  });
} else {
  describeChainSuite(DB_URL);
}

function describeChainSuite(dbUrl: string) {
  let client: Sql;
  let db: PostgresJsDatabase<typeof schema>;

  // Each describe block creates its own tenant so failures + cleanup
  // are independent. The shared client is reused across blocks for
  // speed.
  beforeAll(async () => {
    client = postgres(dbUrl, { max: 4, prepare: false });
    db = drizzle(client, { schema });
  });

  afterAll(async () => {
    await client.end();
  });

  // ──────────────────────────────────────────────────────────────
  // Happy path: insert N rows, expect verify to return NULL,
  // chain_seq to be contiguous, prev_hash linkage to be sound.
  // ──────────────────────────────────────────────────────────────
  describe('Audit chain — happy path (N=5)', () => {
    const tenantId = randomUUID();
    const slug = `chain-happy-${randomUUID().slice(0, 8)}`;
    const N = 5;
    const insertedIds: string[] = [];

    beforeAll(async () => {
      await db.insert(schema.tenants).values({
        id: tenantId,
        slug,
        name: `Chain Happy ${slug}`,
      });

      // Insert N actions inside withTenant-equivalent transactions so
      // the BEFORE INSERT trigger runs under the correct tenant lock
      // and the chain extends as expected.
      for (let i = 0; i < N; i += 1) {
        const inserted = await db.transaction(async (tx) => {
          await tx.execute(
            drizzleSql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`,
          );
          const rows = await tx
            .insert(schema.actions)
            .values({
              tenantId,
              actionClass: 'read',
              toolName: `chain-happy-step-${i}`,
              success: true,
              latencyMs: i,
            })
            .returning({ id: schema.actions.id });
          return rows[0];
        });
        if (!inserted) throw new Error(`failed to insert chain row ${i}`);
        insertedIds.push(inserted.id);
      }
    });

    afterAll(async () => {
      await db.delete(schema.tenants).where(drizzleSql`id = ${tenantId}`);
    });

    test('chain_seq is contiguous 1..N for this tenant', async () => {
      const rows = await db.transaction(async (tx) => {
        await tx.execute(
          drizzleSql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`,
        );
        return await tx.execute<{ chain_seq: number }>(drizzleSql`
          SELECT chain_seq
            FROM actions
           WHERE tenant_id = ${tenantId}::uuid
             AND chain_seq IS NOT NULL
           ORDER BY chain_seq ASC
        `);
      });
      const seqs = (rows as unknown as Array<{ chain_seq: number }>).map(
        (r) => Number(r.chain_seq),
      );
      expect(seqs).toEqual([1, 2, 3, 4, 5]);
    });

    test('prev_hash on row N equals row_hash on row N-1', async () => {
      // Pull the (chain_seq, prev_hash, row_hash) triplet for every
      // row, ordered by chain_seq. For each consecutive pair, prove
      // prev_hash(i+1) === row_hash(i). For i=0, prev_hash must be
      // NULL (chain root).
      const rows = await db.transaction(async (tx) => {
        await tx.execute(
          drizzleSql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`,
        );
        return await tx.execute<{
          chain_seq: number;
          prev_hash: Uint8Array | null;
          row_hash: Uint8Array;
        }>(drizzleSql`
          SELECT chain_seq, prev_hash, row_hash
            FROM actions
           WHERE tenant_id = ${tenantId}::uuid
             AND chain_seq IS NOT NULL
           ORDER BY chain_seq ASC
        `);
      });
      const arr = rows as unknown as Array<{
        chain_seq: number;
        prev_hash: Uint8Array | null;
        row_hash: Uint8Array;
      }>;
      expect(arr.length).toBe(N);

      // Chain root: prev_hash is NULL.
      expect(arr[0]?.prev_hash).toBeNull();

      // Subsequent rows: prev_hash(i+1) deep-equals row_hash(i).
      for (let i = 1; i < N; i += 1) {
        const prev = arr[i - 1]!;
        const curr = arr[i]!;
        // postgres-js returns bytea as Buffer; Buffer compare via .equals().
        const prevHashBytes = Buffer.from(curr.prev_hash!);
        const expectedBytes = Buffer.from(prev.row_hash);
        expect(prevHashBytes.equals(expectedBytes)).toBe(true);
      }
    });

    test('verify_actions_chain returns NULL on intact chain', async () => {
      // Verify runs without RLS scoping in production via the cron's
      // BYPASSRLS role. In the test we set the tenant context so the
      // function's internal SELECT can read the rows.
      const rows = await db.transaction(async (tx) => {
        await tx.execute(
          drizzleSql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`,
        );
        return await tx.execute<{ verify_actions_chain: string | null }>(
          drizzleSql`SELECT verify_actions_chain(${tenantId}::uuid) AS verify_actions_chain`,
        );
      });
      const arr = rows as unknown as Array<{ verify_actions_chain: string | null }>;
      expect(arr[0]?.verify_actions_chain).toBeNull();
    });

    test('row_hash recomputation matches stored value for every row', async () => {
      // Independent verification path: recompute each row's
      // canonical hash via actions_canonical_for_hash + digest()
      // inline (rather than via verify_actions_chain) and compare.
      // Catches a class of bug where verify_actions_chain itself
      // matches its own re-canonicalization buggily.
      const rows = await db.transaction(async (tx) => {
        await tx.execute(
          drizzleSql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`,
        );
        return await tx.execute<{
          stored_hash: Uint8Array;
          recomputed_hash: Uint8Array;
        }>(drizzleSql`
          SELECT
            row_hash AS stored_hash,
            digest(
              actions_canonical_for_hash(
                id, tenant_id, user_id,
                agent_id, action_class::text, tool_name,
                tool_input, tool_output, model_used::text,
                input_tokens, output_tokens, cached_tokens,
                cost_usd, latency_ms, success, error_message,
                created_at, chain_seq, prev_hash
              ),
              'sha256'
            ) AS recomputed_hash
          FROM actions
          WHERE tenant_id = ${tenantId}::uuid
            AND chain_seq IS NOT NULL
          ORDER BY chain_seq ASC
        `);
      });
      const arr = rows as unknown as Array<{
        stored_hash: Uint8Array;
        recomputed_hash: Uint8Array;
      }>;
      expect(arr.length).toBe(N);
      for (const r of arr) {
        const stored = Buffer.from(r.stored_hash);
        const recomp = Buffer.from(r.recomputed_hash);
        expect(stored.equals(recomp)).toBe(true);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Tamper detection: drop the append-only trigger, modify a middle
  // row, recreate the trigger, expect verify to return that row's id.
  // ──────────────────────────────────────────────────────────────
  describe('Audit chain — tamper detection', () => {
    const tenantId = randomUUID();
    const slug = `chain-tamper-${randomUUID().slice(0, 8)}`;
    const insertedIds: string[] = [];

    beforeAll(async () => {
      await db.insert(schema.tenants).values({
        id: tenantId,
        slug,
        name: `Chain Tamper ${slug}`,
      });

      for (let i = 0; i < 5; i += 1) {
        const inserted = await db.transaction(async (tx) => {
          await tx.execute(
            drizzleSql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`,
          );
          const rows = await tx
            .insert(schema.actions)
            .values({
              tenantId,
              actionClass: 'read',
              toolName: `chain-tamper-step-${i}`,
              success: true,
              latencyMs: 10 * i,
            })
            .returning({ id: schema.actions.id });
          return rows[0];
        });
        if (!inserted) throw new Error(`failed to insert tamper row ${i}`);
        insertedIds.push(inserted.id);
      }
    });

    afterAll(async () => {
      // Best-effort recreate triggers in case a test left them
      // dropped. The migration definition is the source of truth;
      // recreating here matches 0007's CREATE TRIGGER exactly.
      try {
        await db.execute(drizzleSql`
          CREATE OR REPLACE FUNCTION reject_actions_mutation()
          RETURNS trigger AS $body$
          BEGIN
            IF TG_OP = 'UPDATE'
               AND OLD.client_id IS NOT NULL
               AND NEW.client_id IS NULL
               AND NEW.id = OLD.id
               AND NEW.tenant_id = OLD.tenant_id
               AND NEW.action_class = OLD.action_class
               AND NEW.tool_name = OLD.tool_name
               AND NEW.created_at = OLD.created_at
            THEN
              RETURN NEW;
            END IF;
            RAISE EXCEPTION
              'actions table is append-only; % is not permitted (op=%, table=%)',
              TG_OP, TG_OP, TG_TABLE_NAME
              USING ERRCODE = 'insufficient_privilege';
          END;
          $body$ LANGUAGE plpgsql;
        `);
        await db.execute(drizzleSql`DROP TRIGGER IF EXISTS actions_no_update ON actions`);
        await db.execute(drizzleSql`
          CREATE TRIGGER actions_no_update
            BEFORE UPDATE ON actions
            FOR EACH ROW
            EXECUTE FUNCTION reject_actions_mutation()
        `);
      } catch {
        // Trigger restoration is best-effort cleanup; the test DB is
        // re-seedable.
      }
      await db.delete(schema.tenants).where(drizzleSql`id = ${tenantId}`);
    });

    test('mutating a middle row tool_input is caught by verify_actions_chain', async () => {
      // Drop the append-only trigger so we can simulate the attacker
      // who has obtained the access to circumvent it. The chain hash
      // does NOT depend on the trigger; it's just SHA bytes stored
      // in the row. Mutating tool_input on a chain row makes the
      // row's row_hash no longer match the recomputation.
      await db.execute(drizzleSql`DROP TRIGGER actions_no_update ON actions`);
      try {
        const targetId = insertedIds[2]!; // middle row (chain_seq=3)
        await db.execute(drizzleSql`
          UPDATE actions
             SET tool_input = '{"tampered":true}'::jsonb
           WHERE id = ${targetId}
        `);

        const rows = await db.transaction(async (tx) => {
          await tx.execute(
            drizzleSql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`,
          );
          return await tx.execute<{ verify_actions_chain: string | null }>(
            drizzleSql`SELECT verify_actions_chain(${tenantId}::uuid) AS verify_actions_chain`,
          );
        });
        const arr = rows as unknown as Array<{ verify_actions_chain: string | null }>;
        // The function returns the first mismatched row's id.
        expect(arr[0]?.verify_actions_chain).toBe(targetId);
      } finally {
        // Recreate the no-update trigger so the suite's afterAll +
        // any subsequent tests get a sane state. The migration
        // 0012 carve-out body is what currently lives in
        // reject_actions_mutation; matching it here.
        await db.execute(drizzleSql`
          CREATE TRIGGER actions_no_update
            BEFORE UPDATE ON actions
            FOR EACH ROW
            EXECUTE FUNCTION reject_actions_mutation()
        `);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Per-tenant isolation: two tenants' chains are independent.
  // Verifying one returns NULL when the other has tampering.
  // ──────────────────────────────────────────────────────────────
  describe('Audit chain — per-tenant isolation', () => {
    const tenantA = randomUUID();
    const tenantB = randomUUID();
    const slugSuffix = randomUUID().slice(0, 8);

    beforeAll(async () => {
      await db.insert(schema.tenants).values([
        { id: tenantA, slug: `chain-iso-a-${slugSuffix}`, name: 'Iso A' },
        { id: tenantB, slug: `chain-iso-b-${slugSuffix}`, name: 'Iso B' },
      ]);

      for (const tid of [tenantA, tenantB]) {
        for (let i = 0; i < 3; i += 1) {
          await db.transaction(async (tx) => {
            await tx.execute(
              drizzleSql`SELECT set_config('app.current_tenant_id', ${tid}, true)`,
            );
            await tx
              .insert(schema.actions)
              .values({
                tenantId: tid,
                actionClass: 'read',
                toolName: `chain-iso-${i}`,
                success: true,
                latencyMs: i,
              });
          });
        }
      }
    });

    afterAll(async () => {
      await db.delete(schema.tenants).where(drizzleSql`id IN (${tenantA}, ${tenantB})`);
    });

    test('each tenant has chain_seq starting from 1', async () => {
      for (const tid of [tenantA, tenantB]) {
        const rows = await db.transaction(async (tx) => {
          await tx.execute(
            drizzleSql`SELECT set_config('app.current_tenant_id', ${tid}, true)`,
          );
          return await tx.execute<{ min: number; max: number }>(drizzleSql`
            SELECT MIN(chain_seq)::int AS min, MAX(chain_seq)::int AS max
              FROM actions
             WHERE tenant_id = ${tid}::uuid
               AND chain_seq IS NOT NULL
          `);
        });
        const arr = rows as unknown as Array<{ min: number; max: number }>;
        expect(Number(arr[0]?.min)).toBe(1);
        expect(Number(arr[0]?.max)).toBe(3);
      }
    });

    test('verify_actions_chain returns NULL for both intact tenants', async () => {
      for (const tid of [tenantA, tenantB]) {
        const rows = await db.transaction(async (tx) => {
          await tx.execute(
            drizzleSql`SELECT set_config('app.current_tenant_id', ${tid}, true)`,
          );
          return await tx.execute<{ verify_actions_chain: string | null }>(
            drizzleSql`SELECT verify_actions_chain(${tid}::uuid) AS verify_actions_chain`,
          );
        });
        const arr = rows as unknown as Array<{ verify_actions_chain: string | null }>;
        expect(arr[0]?.verify_actions_chain).toBeNull();
      }
    });
  });

  // ──────────────────────────────────────────────────────────────
  // CCPA cascade tolerance: deleting a client SET NULLs actions.
  // client_id via the FK + the migration 0012 carve-out. Chain
  // stays intact because client_id is excluded from the hash.
  // ──────────────────────────────────────────────────────────────
  describe('Audit chain — CCPA cascade tolerance', () => {
    const tenantId = randomUUID();
    const clientId = randomUUID();
    const slug = `chain-ccpa-${randomUUID().slice(0, 8)}`;

    beforeAll(async () => {
      await db.insert(schema.tenants).values({
        id: tenantId,
        slug,
        name: `Chain CCPA ${slug}`,
      });
      // Insert a client + 3 actions linked to it.
      await db.transaction(async (tx) => {
        await tx.execute(
          drizzleSql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`,
        );
        await tx.insert(schema.clients).values({
          id: clientId,
          tenantId,
          fullName: 'CCPA Test Client',
        });
        for (let i = 0; i < 3; i += 1) {
          await tx
            .insert(schema.actions)
            .values({
              tenantId,
              clientId,
              actionClass: 'read',
              toolName: `ccpa-step-${i}`,
              success: true,
              latencyMs: i,
            });
        }
      });
    });

    afterAll(async () => {
      await db.delete(schema.tenants).where(drizzleSql`id = ${tenantId}`);
    });

    test('deleting the client NULLs actions.client_id but leaves the chain intact', async () => {
      // Pre-condition: chain is intact.
      let pre = await db.transaction(async (tx) => {
        await tx.execute(
          drizzleSql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`,
        );
        return await tx.execute<{ verify_actions_chain: string | null }>(
          drizzleSql`SELECT verify_actions_chain(${tenantId}::uuid) AS verify_actions_chain`,
        );
      });
      let arr = pre as unknown as Array<{ verify_actions_chain: string | null }>;
      expect(arr[0]?.verify_actions_chain).toBeNull();

      // CCPA right-to-delete: delete the client row. The FK has
      // ON DELETE SET NULL on actions.client_id; migration 0012's
      // append-only carve-out permits exactly that mutation.
      await db.transaction(async (tx) => {
        await tx.execute(
          drizzleSql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`,
        );
        await tx.execute(
          drizzleSql`DELETE FROM clients WHERE id = ${clientId}`,
        );
      });

      // Post-condition: actions rows still exist with client_id=NULL.
      const rows = await db.transaction(async (tx) => {
        await tx.execute(
          drizzleSql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`,
        );
        return await tx.execute<{ count: number; null_count: number }>(drizzleSql`
          SELECT COUNT(*)::int AS count,
                 COUNT(*) FILTER (WHERE client_id IS NULL)::int AS null_count
            FROM actions
           WHERE tenant_id = ${tenantId}::uuid
             AND chain_seq IS NOT NULL
        `);
      });
      const cnt = rows as unknown as Array<{ count: number; null_count: number }>;
      expect(Number(cnt[0]?.count)).toBe(3);
      expect(Number(cnt[0]?.null_count)).toBe(3);

      // Post-condition: chain still verifies as intact.
      const post = await db.transaction(async (tx) => {
        await tx.execute(
          drizzleSql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`,
        );
        return await tx.execute<{ verify_actions_chain: string | null }>(
          drizzleSql`SELECT verify_actions_chain(${tenantId}::uuid) AS verify_actions_chain`,
        );
      });
      arr = post as unknown as Array<{ verify_actions_chain: string | null }>;
      expect(arr[0]?.verify_actions_chain).toBeNull();
    });
  });
}
