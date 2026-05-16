// RLS policy coverage guard (Tier 0 defense-in-depth).
//
// Multi-tenant isolation is the central security boundary in Docket.
// SSNs, EINs, bank routing, signed legal docs, audit-chain rows — all
// live in tenant-scoped tables. If a new migration adds a tenant-
// scoped table to the schema but forgets to ENABLE/FORCE RLS + create
// a tenant_isolation policy, that table leaks cross-tenant. The leak
// is silent: regular development never hits it (the dev DB has one
// tenant), but the first multi-tenant query crosses the boundary
// invisibly.
//
// THE GAP THIS TEST CLOSES
//   There is no automated check today that every schema table with a
//   `tenant_id` column has a corresponding RLS policy in some
//   migration. CLAUDE.md §18 + the Session 5 RLS audit surfaced two
//   intentional exceptions (`tenants`, `prospects`) but everything
//   else SHOULD be policied. Without this test, "I forgot to RLS"
//   is a class of regression that ships silently until SOC 2 audit
//   or a multi-tenant prod incident.
//
// WHAT THIS TEST DOES
//   1. Reads every .sql under packages/db/migrations/.
//   2. Greps for `CREATE POLICY ... ON <table>` lines and collects
//      the set of table names that have at least one policy.
//   3. Iterates every pgTable export in schema.ts. For each table:
//      - If it has a `tenantId` column AND is not in
//        PLATFORM_TABLES, it MUST have a policy.
//      - If it has no `tenantId` column AND is not in
//        PLATFORM_TABLES, the test ignores it (e.g., authority
//        tables can have NULL tenant_id for global rows; that's
//        handled by their own RLS policy text).
//   4. Fails with the list of uncovered tables.
//
// PLATFORM_TABLES
//   Tables that are DESIGNED to not have RLS. Each entry needs a
//   one-line justification + a note on the residual security risk.
//
// WHEN TO UPDATE
//   - You added a new tenant-scoped table:
//       1. Add ENABLE / FORCE ROW LEVEL SECURITY in the same migration.
//       2. Add a `CREATE POLICY <name> ON <table>` with USING +
//          WITH CHECK on `tenant_id = current_tenant_id()`.
//       3. This test should now pass without any change here.
//   - You added a platform-level table (no per-tenant scope):
//       1. Add the table name to PLATFORM_TABLES with a comment
//          explaining why no RLS is needed AND what app-layer
//          control protects it.
//       2. Document the residual risk in the commit message.

import { describe, expect, test } from 'bun:test';
import { getTableColumns, getTableName, is, Table } from 'drizzle-orm';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as schema from '../src/schema.js';

const MIGRATIONS_DIR = join(import.meta.dir, '..', 'migrations');

// Tables that BY DESIGN do not have RLS policies. Adding entries here
// requires a defensible reason — these tables are reachable by any
// application connection without per-tenant filtering.
const PLATFORM_TABLES = new Set<string>([
  // The tenant directory itself. The orchestrator must look up a
  // tenant BEFORE knowing which tenant context to set. Access is
  // gated at the application layer.
  // KNOWN POSTURE GAP (Session 5 RLS audit, 2026-05-15): the two-
  // role design in migration 0001 lines 130-144 (docket_app read-
  // only on tenants, docket_admin full write) was never shipped as
  // a 0002_roles.sql. In production, every app connection has
  // identical permissions on `tenants`. Risk is theoretical until
  // tenant #2 onboards; queued for V1.5 alongside the verify-
  // actions-chain cron RLS-posture cleanup.
  'tenants',
  // Pre-tenant lead funnel. Discovery Scan submissions are
  // anonymous (no tenant context exists yet). The
  // `converted_tenant_id` column links a prospect to a tenant only
  // AFTER engagement-letter signing. Access path is admin-only at
  // the application layer (the /scan-intake-stub endpoint INSERTs;
  // /scan-admin reads). PII (email/phone/name) lives here so the
  // app-layer guard must hold. Documented in Session 5; not RLS-
  // protectable by definition (the row exists before any tenant).
  'prospects',
]);

// Helper: get the SQL table name for a Drizzle pgTable export.
function getSqlName(table: unknown): string | null {
  if (!is(table, Table)) return null;
  return getTableName(table);
}

describe('RLS policy coverage (Tier 0 defense-in-depth)', () => {
  test('every schema table with a tenant_id column has a CREATE POLICY in some migration', () => {
    // Scan every .sql migration file for `CREATE POLICY <name> ON <table>`.
    const migrationFiles = readdirSync(MIGRATIONS_DIR).filter(
      (f) => f.endsWith('.sql'),
    );
    const policiedTables = new Set<string>();
    const policyRegex = /CREATE\s+POLICY\s+\S+\s+ON\s+([a-z_][a-z_0-9]*)/gi;
    for (const file of migrationFiles) {
      const sqlText = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      let match: RegExpExecArray | null;
      // Reset regex state — global flag carries lastIndex across exec calls.
      policyRegex.lastIndex = 0;
      while ((match = policyRegex.exec(sqlText)) !== null) {
        policiedTables.add(match[1]!);
      }
    }

    // Iterate every pgTable in schema. A schema entry is "tenant-
    // scoped" iff it has a `tenantId` column.
    const uncovered: string[] = [];
    const inspected: string[] = [];
    for (const value of Object.values(schema)) {
      const sqlName = getSqlName(value);
      if (!sqlName) continue;
      inspected.push(sqlName);
      if (PLATFORM_TABLES.has(sqlName)) continue;
      const cols = getTableColumns(value as Table);
      const hasTenantId = 'tenantId' in cols;
      if (!hasTenantId) continue;
      if (!policiedTables.has(sqlName)) {
        uncovered.push(sqlName);
      }
    }

    // Sanity check: we should have inspected at least 20 tables.
    // If this assertion ever fails, the schema introspection broke
    // (e.g., Drizzle internal shape changed) and the test would
    // silently pass for the wrong reason.
    expect(inspected.length).toBeGreaterThanOrEqual(20);

    // The real check: any tenant-scoped table without a policy?
    expect(uncovered).toEqual([]);
  });

  test('every PLATFORM_TABLES entry actually exists in the schema', () => {
    const schemaTableNames = new Set<string>();
    for (const value of Object.values(schema)) {
      const sqlName = getSqlName(value);
      if (sqlName) schemaTableNames.add(sqlName);
    }
    const orphaned = [...PLATFORM_TABLES].filter(
      (t) => !schemaTableNames.has(t),
    );
    // Catches stale entries: if a platform table is renamed or
    // removed but PLATFORM_TABLES isn't updated, this surfaces it.
    expect(orphaned).toEqual([]);
  });
});
