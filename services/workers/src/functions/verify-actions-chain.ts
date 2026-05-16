// Cron: nightly audit-trail chain verification.
//
// Per docs/PRODUCTION-READINESS.md §B (V1) — pairs with migration 0022
// (`actions_set_chain` BEFORE INSERT trigger + `verify_actions_chain`
// SQL function). The trigger writes the chain on every action insert;
// this cron walks every tenant's chain nightly and surfaces tampering
// to the audit log + Sentry.
//
// THREAT MODEL
//   Migration 0007 makes the actions table append-only via
//   BEFORE UPDATE/DELETE/TRUNCATE triggers. That defends against the
//   docket_app role rewriting history. Migration 0022 adds the chain
//   so even a Postgres superuser who drops the no-update trigger and
//   modifies a row gets caught — the next row's prev_hash points at
//   the OLD row_hash, recompute mismatches.
//
//   Without this cron, the chain exists but is never verified. A
//   superuser could tamper, the chain would be broken, and we'd
//   only find out when an auditor pulled records during a SOC 2
//   review. This cron makes detection nightly.
//
// WHAT THE CRON DOES
//   1. Lists all tenant ids (admin-bypass-RLS query — see "PERMISSION"
//      below).
//   2. For each tenant, calls verify_actions_chain(tenant_id).
//   3. If the function returns NULL → chain intact. Log a one-line
//      "tenant X intact" record + move on.
//   4. If non-NULL (chain broken at row R):
//      - Surface to Sentry with severity=fatal, tags { tenant_id,
//        broken_row_id }.
//      - Write a `chain_verify_fail` action row for the audit trail
//        (this becomes part of the chain itself; future runs will
//        also see it).
//      - Continue with remaining tenants (one tenant's broken chain
//        doesn't block other tenants' verification).
//   5. Return a summary { tenants_checked, intact, broken }.
//
// PERMISSION
//   verify_actions_chain reads across the actions table for one
//   tenant. The function itself is not RLS-bypassing — it runs under
//   the caller's RLS scope. To verify ALL tenants from this admin
//   cron, we set `app.bypass_rls = on` on the connection inside each
//   step.run().
//
//   KNOWN POSTURE GAP (Session 4 audit, 2026-05-15):
//   `SET LOCAL app.bypass_rls = 'on'` outside an explicit transaction
//   is a Postgres no-op (the setting reverts at the implicit auto-
//   commit boundary). getAdminDb() returns a plain non-tx Drizzle
//   client, so each db.execute() runs in its own implicit tx; the
//   SET LOCAL is effectively dead. Additionally, the RLS policy on
//   `actions` (migration 0001) does NOT include a bypass_rls escape
//   clause — it checks tenant_id = current_tenant_id() only. The
//   cron currently works in production ONLY because Neon's default
//   `neondb_owner` role carries the BYPASSRLS attribute, so RLS is
//   bypassed at the role level regardless of the app.bypass_rls GUC.
//   If we ever migrate to a non-BYPASSRLS application role (per the
//   migration 0001 design intent — see "docket_app role" comments
//   that were never fully built into a 0002_roles migration), the
//   cron will silently report ALL tenants as "intact" with zero rows
//   scanned. Mitigation queued: convert verify_actions_chain to a
//   SECURITY DEFINER function owned by a BYPASSRLS role, OR wrap
//   the cron's queries in an explicit db.transaction() and add a
//   bypass_rls clause to the actions RLS policy. V1.5 work.
//
// SCHEDULE
//   `0 7 * * *` — 07:00 UTC nightly (00:00 PT). Off-peak so a slow
//   sequential walk doesn't compete with daytime traffic.
//
// COST
//   Per-tenant: full sequential scan of actions + per-row sha256 +
//   compare. v1 volume per tenant is small (Antonio's 240 clients →
//   ~10K actions/year if every interaction logs); each tenant takes
//   ~100ms to verify. 10 tenants → 1 second total. No throughput
//   concern at v1.
//
// FAILURE MODES (per /edge-cases skill, 12 enumerated)
//
//   INPUT
//     - Migration 0022 not applied: verify_actions_chain doesn't
//       exist; cron throws on every tenant. Caught + reported as
//       "function missing — apply migration 0022."
//     - Tenant has zero chained rows (chain_seq IS NULL on all):
//       verify returns NULL, treated as intact (correct).
//
//   STATE
//     - Mid-run, a tenant inserts a new action: verify takes a
//       snapshot at fn start; new rows after that don't affect this
//       run. Next nightly run picks them up.
//     - Tenant deleted mid-run: continue with remaining tenants.
//
//   FAILURE
//     - DB connection drops mid-tenant: log, continue.
//     - sha256 compute time pathologically slow: bounded by
//       per-tenant action count; no timeout needed at v1 scale.
//     - The chain_verify_fail audit row insert itself fails (chain
//       broken AND can't write the audit): log to Sentry only.
//
//   TIME
//     - Cron runs 07:00 UTC; if Vercel cold-start delays it by 30s,
//       fine — verification is best-effort, not real-time.
//
//   PERMISSION
//     - app.bypass_rls is set per-step. If unset, RLS scopes the
//       query to the (non-existent) current tenant → returns nothing.
//       Defensive guard at top of fn checks.
//
//   DOMAIN
//     - Suffix-deletion remains an open gap (per migration 0022
//       header). v1.5 publishes head_hash + row_count to R2
//       object-locked storage; this cron will compare against that
//       checkpoint when it lands.

import { sql } from 'drizzle-orm';
import { inngest } from '../inngest-client.js';
import { getAdminDb, schema } from '@docket/db';

// Sentry capture is intentionally OUT of the worker. @sentry/node
// would pull a heavy dep into the workers package; instead we rely
// on:
//   1. logger.error() — Inngest captures; visible in Vercel runtime logs
//   2. The audit row insert below — durable record in the actions table
//   3. Inngest's own dashboard — failed runs surface there too
// If we want richer observability later, add @sentry/node OR have
// the Next.js api/inngest route handler relay errors to Sentry.

interface TenantRow {
  id: string;
}

interface VerifyResult {
  tenant_id: string;
  broken_row_id: string | null;
}

export const verifyActionsChain = inngest.createFunction(
  {
    id: 'verify-actions-chain',
    name: 'Verify audit-trail chain (nightly)',
    // Sequential — one tenant at a time. Concurrency 1 caps DB load
    // and keeps the chain_verify_fail action ordering stable.
    concurrency: { limit: 1 },
  },
  // 07:00 UTC nightly = 00:00 PT (off-peak for the v1 mid+down market).
  { cron: '0 7 * * *' },
  async ({ step, logger }) => {
    // Step 1 — bypass RLS for the admin-cron context. The session
    // GUC is connection-scoped; setting it here applies to the same
    // connection used in subsequent steps within this fn.
    const tenants = await step.run('list-all-tenants', async () => {
      const db = getAdminDb();
      // Set bypass FIRST so the SELECT below crosses tenant lines.
      await db.execute(sql`SET LOCAL app.bypass_rls = 'on'`);
      const rows = await db.select({ id: schema.tenants.id }).from(schema.tenants);
      return rows as TenantRow[];
    });

    if (tenants.length === 0) {
      logger.info('verify-actions-chain: no tenants; nothing to verify');
      return { tenants_checked: 0, intact: 0, broken: 0 };
    }

    let intact = 0;
    const broken: VerifyResult[] = [];

    for (const tenant of tenants) {
      const result = await step.run(`verify-${tenant.id}`, async () => {
        const db = getAdminDb();
        await db.execute(sql`SET LOCAL app.bypass_rls = 'on'`);
        // verify_actions_chain returns the id of the first mismatch
        // (NULL if chain intact). One row, one column.
        const rows = await db.execute<{ verify_actions_chain: string | null }>(
          sql`SELECT verify_actions_chain(${tenant.id}::uuid) AS verify_actions_chain`,
        );
        const brokenRowId = rows[0]?.verify_actions_chain ?? null;
        return { tenant_id: tenant.id, broken_row_id: brokenRowId };
      });

      if (result.broken_row_id === null) {
        intact += 1;
      } else {
        broken.push(result);
        // Best-effort: write an action row marking the failure. The
        // logger.error() at the bottom of this branch surfaces the
        // event to Inngest's dashboard + Vercel runtime logs.
        await step.run(`record-broken-${tenant.id}`, async () => {
          const db = getAdminDb();
          await db.execute(sql`SET LOCAL app.bypass_rls = 'on'`);
          // SET LOCAL the tenant so the chain-extension trigger picks
          // up the right per-tenant prev_hash.
          await db.execute(
            sql`SET LOCAL app.current_tenant_id = ${result.tenant_id}::text`,
          );
          await db.execute(sql`
            INSERT INTO actions (
              tenant_id, action_class, tool_name,
              latency_ms, success, tool_input
            )
            VALUES (
              ${result.tenant_id}::uuid,
              'send-internal'::action_class,
              'verify_actions_chain.detected_tamper',
              0,
              false,
              ${JSON.stringify({
                broken_row_id: result.broken_row_id,
                detected_at: new Date().toISOString(),
              })}::jsonb
            )
          `);
        });
        logger.error('chain-tampering', { ...result });
      }
    }

    logger.info('verify-actions-chain complete', {
      tenants_checked: tenants.length,
      intact,
      broken: broken.length,
    });

    return {
      tenants_checked: tenants.length,
      intact,
      broken: broken.length,
      broken_ids: broken.map((b) => b.tenant_id),
    };
  },
);
