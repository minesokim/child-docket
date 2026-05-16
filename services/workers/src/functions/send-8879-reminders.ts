// Cron: hourly walk of pending 8879 signatures, fire reminders per
// each tenant's reminder_rules cadence (CLAUDE.md §8 + migration 0031).
//
// PER CLAUDE.md §8 Automated Reminders table (default for 8879):
//   - Trigger:    8879 awaiting signature
//   - Cadence:    every 24h
//   - Max:        3 attempts
//   - Channel:    SMS + email (email is V1.5 once Resend lands;
//                 today: SMS only)
//   - Quiet hrs:  respected (tenant_ai_preferences.quietHours)
//
// HOW THE CRON RUNS
//   Every hour, the cron:
//     1. Lists all tenants with a `reminder_rules` row for trigger
//        `eightyseventynine_pending` where enabled=true. Tenants
//        without an explicit row are skipped (defaults are surfaced
//        in the Settings UI but the cron requires explicit opt-in).
//     2. Per tenant: scans signatures where type=form_8879 AND
//        status=pending AND sent_at IS NOT NULL.
//     3. Per signature row: counts past send8879Notification audit
//        rows (the initial send + any prior reminders all live in
//        actions). If count >= max_attempts → skip + log.
//     4. Per eligible row: hours since last send >= interval_hours?
//        If yes → fire reminder. Otherwise → skip (not yet time).
//     5. Per fire: respect quiet hours if reminder_rules.respect_
//        quiet_hours=true AND tenant_ai_preferences has quiet-hours
//        configured AND current time falls inside that window.
//     6. Aggregate counts for the run: { tenants_checked, eligible,
//        fired, skipped_attempts, skipped_interval, skipped_quiet,
//        failed }.
//
// ATTEMPT COUNT — derived from actions, not a signatures column
//   The initial send (commit 9f054f8) writes an actions row with
//   tool_input.signatureRowId = <id>. Every reminder writes the
//   same shape. So counting past sends == counting matching actions
//   rows. No migration needed for an attempts counter on signatures.
//
// SCHEDULE
//   Hourly. Granularity matters: a 24h interval_hours rule + an
//   hourly cron means a reminder fires within ~1h of its target
//   time, which is fine for the IRS-deadline-driven cadence. Going
//   tighter (every 15 min) wouldn't change observable behavior and
//   would multiply DB scan cost.
//
// COST + LOAD
//   At 100 customers x 150 active engagements x 1-3 pending 8879s
//   each = ~300-500 rows scanned per cron run during peak season.
//   Cost: ~10ms per tenant for the scan + maybe 1-3 Twilio sends
//   per run on average. Well under $1/month at v1 scale.

import { and, eq, isNull, sql } from 'drizzle-orm';
import { inngest } from '../inngest-client.js';
import {
  getAdminDb,
  schema,
} from '@docket/db';
import { asTenantId, asUserId, type TenantId, type UserId } from '@docket/shared';
import {
  send8879NotificationWorker,
  type Send8879NotificationResult,
} from '../lib/sign-8879-notification.js';

interface TenantWithRule {
  tenant_id: string;
  interval_hours: number;
  max_attempts: number;
  respect_quiet_hours: boolean;
  [k: string]: unknown;
}

interface PendingSignature {
  id: string;
  client_id: string;
  engagement_id: string | null;
  sent_at: string;
  tax_year: number | null;
  [k: string]: unknown;
}

interface AttemptRow {
  count: string;
  last_sent_at: string | null;
  [k: string]: unknown;
}

interface QuietHoursRow {
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
  [k: string]: unknown;
}

interface FirmOwnerRow {
  id: string;
  name: string | null;
  [k: string]: unknown;
}

interface AggregateCounts {
  tenants_checked: number;
  eligible: number;
  fired: number;
  failed: number;
  skipped_attempts: number;
  skipped_interval: number;
  skipped_quiet: number;
}

export const send8879Reminders = inngest.createFunction(
  {
    id: 'send-8879-reminders',
    name: '8879 reminder cadence (hourly)',
    // Sequential: one tenant at a time keeps DB load predictable +
    // the audit-row ordering deterministic if multiple reminders
    // fire in the same minute.
    concurrency: { limit: 1 },
  },
  // Every hour on the hour. The cadence gate inside the function
  // does the real "is it time?" check against interval_hours.
  { cron: '0 * * * *' },
  async ({ step, logger }) => {
    const counts: AggregateCounts = {
      tenants_checked: 0,
      eligible: 0,
      fired: 0,
      failed: 0,
      skipped_attempts: 0,
      skipped_interval: 0,
      skipped_quiet: 0,
    };

    // Step 1 — list tenants with an enabled 8879-reminder rule.
    // bypass_rls + transaction so the cross-tenant SELECT actually
    // gets cross-tenant rows (per Session 11 migration 0038 bypass
    // policies — same pattern as verify-actions-chain.ts).
    const tenantRules = await step.run('list-tenants-with-rule', async () => {
      const db = getAdminDb();
      return await db.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL app.bypass_rls = 'on'`);
        const rows = await tx.execute<TenantWithRule>(sql`
          SELECT tenant_id::text AS tenant_id,
                 interval_hours,
                 max_attempts,
                 respect_quiet_hours
            FROM reminder_rules
           WHERE trigger = 'eightyseventynine_pending'
             AND enabled = true
        `);
        return rows as unknown as TenantWithRule[];
      });
    });

    if (tenantRules.length === 0) {
      logger.info('send-8879-reminders: no tenants with enabled rule; nothing to do');
      return counts;
    }

    // Step 2 — per tenant: scan signatures + fire eligible reminders.
    for (const rule of tenantRules) {
      counts.tenants_checked += 1;
      const tenantId = asTenantId(rule.tenant_id);

      const tenantResult = await step.run(`tenant-${rule.tenant_id}`, async () => {
        return await runForTenant({
          tenantId,
          intervalHours: rule.interval_hours,
          maxAttempts: rule.max_attempts,
          respectQuietHours: rule.respect_quiet_hours,
          now: new Date(),
        });
      });

      counts.eligible += tenantResult.eligible;
      counts.fired += tenantResult.fired;
      counts.failed += tenantResult.failed;
      counts.skipped_attempts += tenantResult.skipped_attempts;
      counts.skipped_interval += tenantResult.skipped_interval;
      counts.skipped_quiet += tenantResult.skipped_quiet;
    }

    logger.info('send-8879-reminders complete', counts);
    return counts;
  },
);

interface RunForTenantInput {
  tenantId: TenantId;
  intervalHours: number;
  maxAttempts: number;
  respectQuietHours: boolean;
  now: Date;
}

interface RunForTenantOutput {
  eligible: number;
  fired: number;
  failed: number;
  skipped_attempts: number;
  skipped_interval: number;
  skipped_quiet: number;
}

async function runForTenant(input: RunForTenantInput): Promise<RunForTenantOutput> {
  const out: RunForTenantOutput = {
    eligible: 0,
    fired: 0,
    failed: 0,
    skipped_attempts: 0,
    skipped_interval: 0,
    skipped_quiet: 0,
  };

  const db = getAdminDb();

  // Scan + fire all wrapped in one tx so the SET LOCAL persists.
  // The notification helper inside the loop ALSO writes to the
  // same tx (audit rows) — they all flush together at COMMIT.
  await db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL app.bypass_rls = 'on'`);
    await tx.execute(sql`SET LOCAL app.current_tenant_id = ${input.tenantId}::text`);

    // 2a. Quiet hours from tenant_ai_preferences (if respect=true).
    let quietHoursStart: number | null = null;
    let quietHoursEnd: number | null = null;
    if (input.respectQuietHours) {
      const quietRow = await tx.execute<QuietHoursRow>(sql`
        SELECT quiet_hours_start, quiet_hours_end
          FROM tenant_ai_preferences
         WHERE tenant_id = ${input.tenantId}::uuid
         LIMIT 1
      `);
      const r = (quietRow as unknown as QuietHoursRow[])[0];
      quietHoursStart = r?.quiet_hours_start ?? null;
      quietHoursEnd = r?.quiet_hours_end ?? null;
    }

    if (input.respectQuietHours && isInsideQuietHours(input.now, quietHoursStart, quietHoursEnd)) {
      // Whole tenant skipped this hour. Don't enumerate signatures.
      // (Inngest will pick them up at the next hour's run.)
      out.skipped_quiet = -1; // sentinel: "tenant-wide quiet skip"
      return;
    }

    // 2b. Pending 8879 signatures.
    const pendingRows = await tx.execute<PendingSignature>(sql`
      SELECT s.id::text AS id,
             s.client_id::text AS client_id,
             s.engagement_id::text AS engagement_id,
             s.sent_at::text AS sent_at,
             (s.audit_payload->>'taxYear')::int AS tax_year
        FROM signatures s
       WHERE s.tenant_id = ${input.tenantId}::uuid
         AND s.type = 'form_8879'
         AND s.status = 'pending'
         AND s.sent_at IS NOT NULL
    `);
    const pending = pendingRows as unknown as PendingSignature[];

    if (pending.length === 0) return;

    // 2c. Firm-owner user id for audit attribution. Cron sends are
    // attributed to the firm_owner role's primary user — same shape
    // used by the gmail-poll cron + other tenant-iterating crons.
    const ownerRows = await tx.execute<FirmOwnerRow>(sql`
      SELECT id::text AS id, name
        FROM users
       WHERE tenant_id = ${input.tenantId}::uuid
         AND role = 'firm_owner'
       ORDER BY created_at ASC
       LIMIT 1
    `);
    const owner = (ownerRows as unknown as FirmOwnerRow[])[0];
    if (!owner) {
      // No firm owner — skip the tenant entirely. The cron can't
      // attribute the send to a real user.
      return;
    }

    // 2d. Per signature row: check attempt count + interval.
    for (const sig of pending) {
      out.eligible += 1;

      const attemptRows = await tx.execute<AttemptRow>(sql`
        SELECT COUNT(*)::text AS count,
               MAX(created_at)::text AS last_sent_at
          FROM actions
         WHERE tenant_id = ${input.tenantId}::uuid
           AND tool_name = 'send8879Notification'
           AND tool_input->>'signatureRowId' = ${sig.id}
           AND success = true
      `);
      const attempts = (attemptRows as unknown as AttemptRow[])[0];
      const attemptCount = Number(attempts?.count ?? '0');

      if (attemptCount >= input.maxAttempts) {
        out.skipped_attempts += 1;
        continue;
      }

      const lastSentAt = attempts?.last_sent_at
        ? new Date(attempts.last_sent_at)
        : new Date(sig.sent_at);
      const hoursSinceLast =
        (input.now.getTime() - lastSentAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLast < input.intervalHours) {
        out.skipped_interval += 1;
        continue;
      }

      // Fire the reminder.
      const taxYear = sig.tax_year ?? input.now.getFullYear();
      const result: Send8879NotificationResult = await send8879NotificationWorker({
        db: tx as unknown as Parameters<typeof send8879NotificationWorker>[0]['db'],
        tenantId: input.tenantId,
        attributedUserId: asUserId(owner.id),
        senderFullName: owner.name,
        signatureRowId: sig.id,
        clientId: sig.client_id,
        taxYear,
        isReminder: true,
        attemptNumber: attemptCount + 1,
      });

      if (result.ok) {
        out.fired += 1;
      } else {
        out.failed += 1;
      }
    }
  });

  // Sentinel collapse: -1 means tenant-wide quiet skip. Convert to
  // a count of pending sigs we would have processed, just for the
  // aggregate log readability.
  if (out.skipped_quiet === -1) {
    out.skipped_quiet = 1;
  }

  return out;
}

/**
 * Quiet hours check.
 *
 * tenant_ai_preferences.quiet_hours_start / quiet_hours_end are
 * minute-of-day integers (0-1440) per the migration 0031 spec. Local
 * to the tenant's timezone — but since v0 has 1 tenant + 1 timezone
 * (Antonio in CA), we use the server's local time. V1.5 wires real
 * per-tenant timezone resolution.
 *
 * If start = 1140 (7pm) and end = 420 (7am), quiet window wraps
 * midnight: current minute matches if currentMin >= start OR
 * currentMin < end.
 */
function isInsideQuietHours(
  now: Date,
  start: number | null,
  end: number | null,
): boolean {
  if (start === null || end === null) return false;
  const currentMin = now.getHours() * 60 + now.getMinutes();
  if (start === end) return false;
  if (start < end) {
    // Non-wrapping window (e.g., 12:00 - 14:00).
    return currentMin >= start && currentMin < end;
  }
  // Wrapping window (e.g., 19:00 - 07:00 next day).
  return currentMin >= start || currentMin < end;
}

// Test-only export for unit tests that exercise the quiet-hours
// math without spinning up the cron.
export const _testOnly = { isInsideQuietHours };
