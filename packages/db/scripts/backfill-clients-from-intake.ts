// One-off backfill: copy intake-collected email + state into the
// corresponding clients row if the clients column is currently null.
//
// Fixes the pre-Session-17 gap where intake collected
//   personal.email
//   personal.addressState
// but only personal.fullName was mirrored into the clients table.
// Existing client rows whose taxpayer completed intake BEFORE this
// fix have these fields stuck in intake_responses.answers JSON.
//
// Usage:
//   DATABASE_URL=postgresql://... bun run packages/db/scripts/backfill-clients-from-intake.ts
//   DATABASE_URL=postgresql://... bun run packages/db/scripts/backfill-clients-from-intake.ts --dry-run
//
// What it does:
//   1. List all client rows where email IS NULL OR state IS NULL
//   2. For each: look up the most-recent intake_responses row
//   3. Read answers.personal.email + answers.personal.addressState
//   4. Update the clients row, but only fill the column if it's NULL
//      (never overwrite a column the preparer already set in /clients/new)
//   5. Print a summary
//
// SAFETY:
//   - getAdminDb() with explicit tenant_id scoping per row — same posture
//     as verify-actions-chain + send-8879-reminders crons.
//   - UPDATE uses `email = COALESCE(clients.email, $intake_email)` so we
//     never overwrite a non-null value.
//   - Dry-run mode prints the would-be UPDATEs without executing them.
//
// IDEMPOTENT: re-running is a no-op because the COALESCE keeps any value
// already in the column.

/* eslint-disable no-console */

import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { getAdminDb } from '../src/index';

const DRY_RUN = process.argv.includes('--dry-run');

interface CandidateRow {
  tenant_id: string;
  client_id: string;
  current_email: string | null;
  current_state: string | null;
  intake_email: string | null;
  intake_state: string | null;
  // Drizzle's execute<T> expects an index signature for raw-SQL rows.
  [k: string]: unknown;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('FATAL: DATABASE_URL not set');
    process.exit(2);
  }

  console.log(`━━ backfill-clients-from-intake ${DRY_RUN ? '(DRY RUN)' : ''} ━━`);

  const db = getAdminDb();

  // Walk the join inside a single transaction with bypass_rls so we see
  // every tenant's clients + intake_responses. This is operator/admin
  // work — same posture as the cron jobs.
  const candidates = await db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL app.bypass_rls = 'on'`);
    // No SET LOCAL current_tenant_id — we're reading cross-tenant.
    const rows = await tx.execute<CandidateRow>(sql`
      SELECT
        c.tenant_id::text       AS tenant_id,
        c.id::text              AS client_id,
        c.email                 AS current_email,
        c.state                 AS current_state,
        ir.answers->'personal'->>'email'        AS intake_email,
        ir.answers->'personal'->>'addressState' AS intake_state
      FROM clients c
      LEFT JOIN LATERAL (
        SELECT answers
        FROM intake_responses
        WHERE client_id = c.id
          -- Defense-in-depth: belt-and-suspenders on top of the FK
          -- constraint (intake_responses.client_id → clients.id). If
          -- a corrupted row ever held a mismatched tenant_id, this
          -- predicate refuses to surface its data into the backfill.
          -- Codex round-1 finding (Session 17 fix).
          AND tenant_id = c.tenant_id
        ORDER BY started_at DESC
        LIMIT 1
      ) ir ON TRUE
      WHERE c.email IS NULL OR c.state IS NULL
    `);
    return rows as unknown as CandidateRow[];
  });

  console.log(`Candidates: ${candidates.length} clients with a NULL email or state`);

  let plannedEmailUpdates = 0;
  let plannedStateUpdates = 0;
  let skippedNoIntakeData = 0;

  for (const row of candidates) {
    const willFillEmail =
      row.current_email === null && row.intake_email !== null && row.intake_email.length > 0;
    const willFillState =
      row.current_state === null && row.intake_state !== null && row.intake_state.length > 0;

    if (!willFillEmail && !willFillState) {
      skippedNoIntakeData++;
      continue;
    }

    if (willFillEmail) plannedEmailUpdates++;
    if (willFillState) plannedStateUpdates++;

    console.log(
      `  ${row.client_id.slice(0, 8)}…  ` +
        (willFillEmail ? `email=${row.intake_email!.toLowerCase()} ` : '') +
        (willFillState ? `state=${row.intake_state} ` : ''),
    );

    if (!DRY_RUN) {
      const newEmail = willFillEmail ? row.intake_email!.trim().toLowerCase() : null;
      const newState = willFillState ? row.intake_state!.trim() : null;
      await db.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL app.bypass_rls = 'on'`);
        await tx.execute(
          sql`SET LOCAL app.current_tenant_id = ${row.tenant_id}::text`,
        );
        // COALESCE preserves any column the preparer already populated
        // via /clients/new — we only fill NULL columns.
        await tx.execute(sql`
          UPDATE clients
             SET email      = COALESCE(email, ${newEmail}),
                 state      = COALESCE(state, ${newState}),
                 updated_at = now()
           WHERE id = ${row.client_id}::uuid
             AND tenant_id = ${row.tenant_id}::uuid
        `);
      });
    }
  }

  console.log('');
  console.log('━━ summary ━━');
  console.log(`  candidates scanned:     ${candidates.length}`);
  console.log(`  email backfills:        ${plannedEmailUpdates}${DRY_RUN ? ' (planned)' : ''}`);
  console.log(`  state backfills:        ${plannedStateUpdates}${DRY_RUN ? ' (planned)' : ''}`);
  console.log(`  skipped (no intake):    ${skippedNoIntakeData}`);

  if (DRY_RUN) {
    console.log('');
    console.log('No changes applied. Re-run without --dry-run to execute.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('FATAL', e);
    process.exit(1);
  });
