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
//   POSTURE GAP — CLOSED in Session 11 (2026-05-16):
//   Pre-Session-11 the cron called SET LOCAL app.bypass_rls on a
//   non-tx-wrapped Drizzle client. postgres-js auto-commits each
//   query so SET LOCAL reverted at the implicit COMMIT boundary,
//   making the GUC effectively dead. Additionally, the RLS policy
//   on `actions` (migration 0001) had no bypass_rls escape clause —
//   it checked tenant_id = current_tenant_id() only. The cron worked
//   in production ONLY because Neon's default `neondb_owner` role
//   carries the BYPASSRLS attribute. A future migration to a non-
//   BYPASSRLS role would have caused the cron to silently report
//   ALL tenants as "intact" with zero rows scanned.
//
//   Session 11 fix (two-part):
//     (a) Migration 0038 adds <table>_bypass policies to all 12
//         0001-era tables (users, clients, ... notice_responses),
//         making bypass_rls a real policy-readable GUC.
//     (b) This file wraps each step's queries in db.transaction()
//         so SET LOCAL takes effect inside the tx + persists for
//         the duration of the queries (apply-38 smoke proves the
//         cross-tenant SELECT path works after the fix).
//
//   The cron is now correct regardless of the connecting role's
//   BYPASSRLS attribute. The docket_app / docket_admin role split
//   from the 0001 design intent remains unimplemented — that's
//   V1.5 work, but no longer load-bearing for the cron's
//   correctness.
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
    // Step 1 — bypass RLS for the admin-cron context. Migration 0038
    // (Session 11) added <table>_bypass policies to the 12 0001-era
    // tables; bypass_rls is now a real policy-readable GUC, not just
    // a comment-level assertion. CRITICAL — we wrap each step's
    // queries in db.transaction() so SET LOCAL persists for the
    // duration of the queries inside. Pre-Session-11 the cron called
    // SET LOCAL on a non-tx-wrapped Drizzle client; postgres-js
    // auto-commits each query so SET LOCAL reverted at the implicit
    // COMMIT boundary, making the bypass GUC effectively dead. The
    // cron worked anyway because Neon's neondb_owner role carries
    // BYPASSRLS at the role level — but if we ever migrated to a
    // non-BYPASSRLS role, the cron would silently report all tenants
    // as "intact" with zero rows scanned. Wrapping in db.transaction
    // makes the bypass GUC actually take effect inside the tx + makes
    // the cron correct regardless of the connecting role's
    // BYPASSRLS attribute.
    const tenants = await step.run('list-all-tenants', async () => {
      const db = getAdminDb();
      return await db.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL app.bypass_rls = 'on'`);
        const rows = await tx
          .select({ id: schema.tenants.id })
          .from(schema.tenants);
        return rows as TenantRow[];
      });
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
        return await db.transaction(async (tx) => {
          await tx.execute(sql`SET LOCAL app.bypass_rls = 'on'`);
          // verify_actions_chain returns the id of the first mismatch
          // (NULL if chain intact). One row, one column. Inside the
          // tx, the bypass_rls GUC is effective + the per-table
          // bypass policies (migration 0038) permit cross-tenant
          // reads. Without the tx wrap, SET LOCAL would be a no-op
          // per the auto-commit boundary — see migration 0038 header
          // + Session 4 audit finding.
          const rows = await tx.execute<{
            verify_actions_chain: string | null;
          }>(
            sql`SELECT verify_actions_chain(${tenant.id}::uuid) AS verify_actions_chain`,
          );
          const brokenRowId = rows[0]?.verify_actions_chain ?? null;
          return { tenant_id: tenant.id, broken_row_id: brokenRowId };
        });
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
          await db.transaction(async (tx) => {
            // The tamper-report INSERT runs under the affected
            // tenant's context so the chain-extension trigger picks
            // up the right per-tenant prev_hash. Bypass also set in
            // case the tenant_isolation policy ever drifts to a
            // shape that wouldn't permit the admin context.
            await tx.execute(sql`SET LOCAL app.bypass_rls = 'on'`);
            await tx.execute(
              sql`SET LOCAL app.current_tenant_id = ${result.tenant_id}::text`,
            );
            await tx.execute(sql`
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
