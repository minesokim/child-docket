// RLS isolation tests — programmatic proof that cross-tenant data access
// is physically prevented by Postgres Row-Level Security policies.
//
// Why this is non-negotiable: RLS is the central security boundary in a
// multi-tenant tax-prep app. SSNs, EINs, bank routing, signed legal docs
// — all live in tenant-scoped tables. A bug that bypassed RLS would let
// one firm see another firm's clients' tax data. SOC 2 auditors expect
// programmatic evidence the boundary holds.
//
// Run requirements:
//   - DATABASE_URL_RLS_TEST env var pointing at a database with the
//     migrations already applied. Different name from DATABASE_URL so a
//     misconfigured environment can't accidentally write to dev/prod.
//   - The DB is left in its original state (creates two ephemeral tenants
//     and deletes them on teardown — cascades clean up child rows).
//
// Run:
//   DATABASE_URL_RLS_TEST=postgres://... bun test packages/db/test/rls.test.ts
//
// Skipped (no-op) if DATABASE_URL_RLS_TEST is unset, so this file doesn't
// break local dev. CI sets the env var explicitly.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { sql as drizzleSql } from 'drizzle-orm';
import postgres, { type Sql } from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { randomUUID } from 'node:crypto';
import * as schema from '../src/schema.js';

const DB_URL = process.env.DATABASE_URL_RLS_TEST;

// ────────────────────────────────────────────────────────────────
// Skip-when-no-DB scaffold. Bun test doesn't have a `describe.skipIf`,
// so we conditionally register the suite.
// ────────────────────────────────────────────────────────────────

if (!DB_URL) {
  describe.skip('RLS isolation (skipped — DATABASE_URL_RLS_TEST not set)', () => {
    test('placeholder', () => {
      // No-op. Real assertions live in the live-DB suite below.
    });
  });
} else {
  describeRlsSuite(DB_URL);
}

function describeRlsSuite(dbUrl: string) {
  let client: Sql;
  let db: PostgresJsDatabase<typeof schema>;

  // Two ephemeral tenants. Random suffix prevents collisions if a previous
  // test run left fixtures behind.
  const SUFFIX = randomUUID().slice(0, 8);
  const tenantAId = randomUUID();
  const tenantBId = randomUUID();
  const slugA = `rls-test-a-${SUFFIX}`;
  const slugB = `rls-test-b-${SUFFIX}`;

  describe('RLS isolation', () => {
    beforeAll(async () => {
      client = postgres(dbUrl, { max: 4, prepare: false });
      db = drizzle(client, { schema });

      // Insert two tenants directly. Tenants table is NOT RLS-scoped (it
      // IS the tenant directory) so this works without a tenant context.
      await db.insert(schema.tenants).values([
        { id: tenantAId, slug: slugA, name: `RLS Test A ${SUFFIX}` },
        { id: tenantBId, slug: slugB, name: `RLS Test B ${SUFFIX}` },
      ]);

      // Insert one client per tenant. We bypass RLS for setup using
      // SET LOCAL inside transactions per-tenant. This mirrors the
      // production withTenant() pattern.
      await db.transaction(async (tx) => {
        await tx.execute(drizzleSql`SELECT set_config('app.current_tenant_id', ${tenantAId}, true)`);
        await tx.insert(schema.clients).values({
          tenantId: tenantAId,
          fullName: `RLS-A Client`,
          intakeStatus: 'in-progress',
        });
      });

      await db.transaction(async (tx) => {
        await tx.execute(drizzleSql`SELECT set_config('app.current_tenant_id', ${tenantBId}, true)`);
        await tx.insert(schema.clients).values({
          tenantId: tenantBId,
          fullName: `RLS-B Client`,
          intakeStatus: 'in-progress',
        });
      });
    });

    afterAll(async () => {
      // Tear down the ephemeral tenants. ON DELETE CASCADE cleans up the
      // child rows (clients, intake_responses, actions, etc.).
      // Tenants table is not RLS-scoped, so a plain delete works.
      await db.delete(schema.tenants).where(drizzleSql`id = ANY(${[tenantAId, tenantBId]})`);
      await client.end();
    });

    test('Tenant A context only sees Tenant A clients', async () => {
      const rows = await db.transaction(async (tx) => {
        await tx.execute(drizzleSql`SELECT set_config('app.current_tenant_id', ${tenantAId}, true)`);
        return await tx.select().from(schema.clients);
      });

      expect(rows.length).toBe(1);
      expect(rows[0]?.tenantId).toBe(tenantAId);
      expect(rows[0]?.fullName).toBe('RLS-A Client');
    });

    test('Tenant B context only sees Tenant B clients', async () => {
      const rows = await db.transaction(async (tx) => {
        await tx.execute(drizzleSql`SELECT set_config('app.current_tenant_id', ${tenantBId}, true)`);
        return await tx.select().from(schema.clients);
      });

      expect(rows.length).toBe(1);
      expect(rows[0]?.tenantId).toBe(tenantBId);
      expect(rows[0]?.fullName).toBe('RLS-B Client');
    });

    test('No tenant context returns zero rows (fail-closed)', async () => {
      // Without setting app.current_tenant_id, current_tenant_id() returns
      // NULL, RLS predicate (tenant_id = NULL) is FALSE for all rows.
      const rows = await db.select().from(schema.clients);

      // We MAY see rows from other concurrent tests, but we MUST NOT see
      // tenant A's or B's rows. Filter to our test tenants:
      const ourRows = rows.filter(
        (r) => r.tenantId === tenantAId || r.tenantId === tenantBId,
      );
      expect(ourRows.length).toBe(0);
    });

    test('Tenant A cannot INSERT a row claiming Tenant B', async () => {
      // RLS WITH CHECK on writes: if app.current_tenant_id is A, the row's
      // tenant_id MUST equal A. Trying to insert a row with tenantId=B
      // should fail.
      await expect(
        db.transaction(async (tx) => {
          await tx.execute(drizzleSql`SELECT set_config('app.current_tenant_id', ${tenantAId}, true)`);
          await tx.insert(schema.clients).values({
            tenantId: tenantBId,                  // ← lying about which tenant
            fullName: 'Cross-tenant injection attempt',
            intakeStatus: 'in-progress',
          });
        }),
      ).rejects.toThrow();
    });

    test('Tenant A cannot UPDATE a row owned by Tenant B', async () => {
      // RLS USING on UPDATE: tenant A's session can't see tenant B's rows,
      // so UPDATE matches zero rows (silent no-op, not an error). We
      // verify by reading from B's perspective afterwards.
      const updateResult = await db.transaction(async (tx) => {
        await tx.execute(drizzleSql`SELECT set_config('app.current_tenant_id', ${tenantAId}, true)`);
        return await tx
          .update(schema.clients)
          .set({ fullName: 'COMPROMISED' })
          .where(drizzleSql`tenant_id = ${tenantBId}`);
      });

      // postgres-js update returns a count; should be 0 since RLS hid
      // the target row from session A.
      expect(updateResult.count).toBe(0);

      // Verify B's row is intact.
      const bRows = await db.transaction(async (tx) => {
        await tx.execute(drizzleSql`SELECT set_config('app.current_tenant_id', ${tenantBId}, true)`);
        return await tx.select().from(schema.clients);
      });
      expect(bRows[0]?.fullName).toBe('RLS-B Client');
    });

    test('intake_responses is RLS-isolated (the SSN-bearing table)', async () => {
      // Insert one intake_response per tenant, then verify cross-read
      // returns zero. This is the highest-stakes table — JSONB holds
      // encrypted SSN/EIN/bank values.
      const taxYear = 2025;

      const aClientId = await db.transaction(async (tx) => {
        await tx.execute(drizzleSql`SELECT set_config('app.current_tenant_id', ${tenantAId}, true)`);
        const [c] = await tx.select().from(schema.clients).limit(1);
        if (!c) throw new Error('A client missing');
        await tx.insert(schema.intakeResponses).values({
          tenantId: tenantAId,
          clientId: c.id,
          taxYear,
          status: 'in_progress',
          answers: { _meta: { tag: 'A-data' } },
          completedSteps: [],
        });
        return c.id;
      });

      const bClientId = await db.transaction(async (tx) => {
        await tx.execute(drizzleSql`SELECT set_config('app.current_tenant_id', ${tenantBId}, true)`);
        const [c] = await tx.select().from(schema.clients).limit(1);
        if (!c) throw new Error('B client missing');
        await tx.insert(schema.intakeResponses).values({
          tenantId: tenantBId,
          clientId: c.id,
          taxYear,
          status: 'in_progress',
          answers: { _meta: { tag: 'B-data' } },
          completedSteps: [],
        });
        return c.id;
      });

      // From A's perspective: only see A's intake.
      const aRows = await db.transaction(async (tx) => {
        await tx.execute(drizzleSql`SELECT set_config('app.current_tenant_id', ${tenantAId}, true)`);
        return await tx.select().from(schema.intakeResponses);
      });
      expect(aRows.length).toBe(1);
      expect((aRows[0]?.answers as { _meta?: { tag?: string } })._meta?.tag).toBe('A-data');

      // From B's perspective: only see B's intake.
      const bRows = await db.transaction(async (tx) => {
        await tx.execute(drizzleSql`SELECT set_config('app.current_tenant_id', ${tenantBId}, true)`);
        return await tx.select().from(schema.intakeResponses);
      });
      expect(bRows.length).toBe(1);
      expect((bRows[0]?.answers as { _meta?: { tag?: string } })._meta?.tag).toBe('B-data');

      // Direct attempt to read B's intake from A's context:
      const cross = await db.transaction(async (tx) => {
        await tx.execute(drizzleSql`SELECT set_config('app.current_tenant_id', ${tenantAId}, true)`);
        return await tx
          .select()
          .from(schema.intakeResponses)
          .where(drizzleSql`tenant_id = ${tenantBId}`);
      });
      expect(cross.length).toBe(0);

      // suppress unused-var warning — clientIds aren't needed for assertions
      void aClientId;
      void bClientId;
    });
  });
}
