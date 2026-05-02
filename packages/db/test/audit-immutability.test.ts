// Append-only enforcement tests for the `actions` table.
//
// The actions table is the SOC 2 evidence trail — every tool call, every AI
// inference, every plaintext reveal. Once written, rows must be immutable
// from any non-superuser role. Migration 0007_actions_append_only.sql
// installs BEFORE UPDATE/DELETE/TRUNCATE triggers that raise an exception
// on any mutation attempt.
//
// This suite proves all three triggers fire under the same connection +
// role used by the application.
//
// Run requirements:
//   - DATABASE_URL_RLS_TEST env var pointing at a database with the
//     migrations already applied (same DB used by rls.test.ts).
//
// Run:
//   DATABASE_URL_RLS_TEST=postgres://... bun test packages/db/test/audit-immutability.test.ts
//
// Skipped (no-op) if DATABASE_URL_RLS_TEST is unset.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { sql as drizzleSql } from 'drizzle-orm';
import postgres, { type Sql } from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { randomUUID } from 'node:crypto';
import * as schema from '../src/schema.js';

const DB_URL = process.env.DATABASE_URL_RLS_TEST;

if (!DB_URL) {
  describe.skip('Audit immutability (skipped — DATABASE_URL_RLS_TEST not set)', () => {
    test('placeholder', () => {});
  });
} else {
  describeAuditSuite(DB_URL);
}

function describeAuditSuite(dbUrl: string) {
  let client: Sql;
  let db: PostgresJsDatabase<typeof schema>;

  const SUFFIX = randomUUID().slice(0, 8);
  const tenantId = randomUUID();
  const slug = `audit-test-${SUFFIX}`;
  let actionId: string;

  describe('Actions table is append-only', () => {
    beforeAll(async () => {
      client = postgres(dbUrl, { max: 4, prepare: false });
      db = drizzle(client, { schema });

      // Set up a tenant + insert one action row to attempt to mutate.
      await db.insert(schema.tenants).values({
        id: tenantId,
        slug,
        name: `Audit Test ${SUFFIX}`,
      });

      const inserted = await db.transaction(async (tx) => {
        await tx.execute(drizzleSql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`);
        const rows = await tx
          .insert(schema.actions)
          .values({
            tenantId,
            actionClass: 'read',
            toolName: 'audit-immutability-test',
            success: true,
            latencyMs: 0,
          })
          .returning({ id: schema.actions.id });
        return rows[0];
      });

      if (!inserted) throw new Error('failed to insert seed action row');
      actionId = inserted.id;
    });

    afterAll(async () => {
      // Tenant delete cascades to actions. Tenants is not RLS-scoped.
      await db.delete(schema.tenants).where(drizzleSql`id = ${tenantId}`);
      await client.end();
    });

    test('UPDATE is rejected by trigger', async () => {
      await expect(
        db.transaction(async (tx) => {
          await tx.execute(drizzleSql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`);
          await tx.execute(
            drizzleSql`UPDATE actions SET cost_usd = '0.99' WHERE id = ${actionId}`,
          );
        }),
      ).rejects.toThrow(/append-only/i);
    });

    test('DELETE is rejected by trigger', async () => {
      await expect(
        db.transaction(async (tx) => {
          await tx.execute(drizzleSql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`);
          await tx.execute(drizzleSql`DELETE FROM actions WHERE id = ${actionId}`);
        }),
      ).rejects.toThrow(/append-only/i);
    });

    test('TRUNCATE is rejected by trigger', async () => {
      // TRUNCATE bypasses BEFORE DELETE row triggers. Migration 0007 adds a
      // separate STATEMENT trigger for TRUNCATE — this proves it fires.
      //
      // PRECONDITION: the test role must have TRUNCATE privilege on `actions`.
      // Postgres checks role privilege BEFORE firing BEFORE TRUNCATE triggers,
      // so a role without privilege would error with "permission denied" and
      // never reach the trigger. In Neon dev DBs the migration role owns the
      // table — TRUNCATE works and the trigger fires.
      await expect(
        db.transaction(async (tx) => {
          await tx.execute(drizzleSql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`);
          await tx.execute(drizzleSql`TRUNCATE actions`);
        }),
      ).rejects.toThrow(/append-only/i);
    });

    test('INSERT still works (immutability is not write-blocking)', async () => {
      // Sanity check: we can still write NEW audit entries. The trigger only
      // blocks UPDATE/DELETE/TRUNCATE.
      const inserted = await db.transaction(async (tx) => {
        await tx.execute(drizzleSql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`);
        return await tx
          .insert(schema.actions)
          .values({
            tenantId,
            actionClass: 'read',
            toolName: 'audit-immutability-followup',
            success: true,
            latencyMs: 1,
          })
          .returning({ id: schema.actions.id });
      });

      expect(inserted.length).toBe(1);
      expect(inserted[0]?.id).toBeTruthy();
    });

    test('Original seed row still exists post-mutation-attempts', async () => {
      // Confirms the rejected mutations didn't partially apply.
      const rows = await db.transaction(async (tx) => {
        await tx.execute(drizzleSql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`);
        return await tx
          .select()
          .from(schema.actions)
          .where(drizzleSql`id = ${actionId}`);
      });

      expect(rows.length).toBe(1);
      // costUsd must NOT have been overwritten by the rejected UPDATE.
      expect(rows[0]?.costUsd).toBeNull();
    });
  });
}
