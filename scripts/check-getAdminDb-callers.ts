#!/usr/bin/env bun
// scripts/check-getAdminDb-callers.ts
//
// Hard guard on the RLS-bypass surface. `getAdminDb()` returns a
// Drizzle client that bypasses Postgres RLS — useful in a small
// number of legitimate cases (auth chicken-and-egg, webhook tenant
// disambiguation, Inngest crons that operate globally across
// tenants) but a SOC 2 CC6.7 risk if it sprawls.
//
// CLAUDE.md §18 originally claimed `getAdminDb()` was used in ONLY 2
// places. The 2026-05-15 audit (fragility sweep) found 13+ distinct
// caller files. None were inherently wrong — webhooks NEED the
// admin DB before the tenant is disambiguated, Inngest crons NEED
// to iterate tenants globally — but the architecture pattern was
// undocumented and a 14th caller could land in a PR with zero
// friction.
//
// This script is the lint guard. It hardcodes an ALLOWLIST of
// known-safe callers, each with a written justification. It runs
// `git grep` for every actual caller in production code, then
// compares the two sets. Any difference fails the check.
//
// Three failure modes the script catches:
//   1. NEW CALLER appears in production code without an allowlist
//      entry → fails. The author must either add an allowlist entry
//      with a justification OR refactor to use withTenant().
//   2. ALLOWLISTED CALLER missing from production code → fails. The
//      allowlist drifted; either the caller was removed (update the
//      list) or the file moved (update the path).
//   3. CALL-COUNT MISMATCH per file → fails. A file allowlisted for
//      1 call now has 2 — the new call may need its own
//      justification.
//
// USAGE
//   bun run scripts/check-getAdminDb-callers.ts
//
// EXIT CODES
//   0 — all good
//   1 — drift detected; details printed to stderr
//   2 — script crashed (e.g., git unavailable)
//
// CI INTEGRATION (follow-up)
//   This script is invokable standalone. Wire into .github/workflows/
//   ci.yml as a new job alongside `audit` + `protocol-gate` to fail
//   any PR that adds an unjustified RLS-bypass caller. Until that
//   wire-up lands, the script is runnable manually + by reviewers
//   on suspect diffs.

import { execSync } from 'node:child_process';

// ────────────────────────────────────────────────────────────────
// ALLOWLIST — every legitimate getAdminDb() caller, with a written
// justification per site. Adding to this list = explicit founder
// approval per CLAUDE.md §18.
// ────────────────────────────────────────────────────────────────

type CallerEntry = {
  /** Path relative to repo root (forward slashes). */
  file: string;
  /** Expected count of getAdminDb( occurrences in this file. */
  count: number;
  /** Why this caller bypasses RLS. SOC 2 CC6.7 documentation. */
  justification: string;
};

const ALLOWLIST: ReadonlyArray<CallerEntry> = [
  // ─── Auth chicken-and-egg (the two original §18 callers) ───────
  {
    file: 'apps/client-portal/src/lib/intake/auth.ts',
    count: 1,
    justification:
      'Phone → tenant resolution. The client-portal intake flow looks up a tenant by the inbound phone number BEFORE the Clerk session exists. RLS-bypass is required because the request has no tenant context yet — that\'s what this query establishes.',
  },
  {
    file: 'apps/command-room/src/lib/current-user.ts',
    count: 1,
    justification:
      'Clerk session → user/tenant resolution. The command-room session middleware reads the Clerk userId and looks up the corresponding internal user + tenantId BEFORE any tenant-scoped query can fire. RLS-bypass required for the same reason as the intake auth path.',
  },

  // ─── Webhooks (sender authenticated by HMAC, not Clerk) ────────
  {
    file: 'apps/command-room/src/app/api/webhooks/twilio/inbound/route.ts',
    count: 1,
    justification:
      'Twilio inbound SMS webhook. Twilio doesn\'t carry Clerk auth — tenant disambiguation happens by matching the recipient phone number against tenant_credentials.twilio.fromNumber. The X-Twilio-Signature is verified against the matched tenant\'s authToken AFTER disambiguation, before any state-changing query.',
  },
  {
    file: 'apps/command-room/src/app/api/webhooks/square/route.ts',
    count: 1,
    justification:
      'Square payment webhook. Verifies X-Square-HmacSha256-Signature against SQUARE_WEBHOOK_SIGNATURE_KEY before any DB read or write. Tenant disambiguation happens via the customer reference id in the payment payload, scoped after signature verification.',
  },
  {
    file: 'apps/command-room/src/app/api/webhooks/docusign/connect/route.ts',
    count: 1,
    justification:
      'DocuSign Connect webhook. Verifies X-DocuSign-Signature-1 (HMAC-SHA256) against DOCUSIGN_CONNECT_HMAC_KEY before any DB read or write. Envelope id maps to a signatures row + that row carries the tenant scope.',
  },

  // ─── Health probes (no tenant data exposed; binary status only) ─
  {
    file: 'apps/client-portal/src/lib/read-only-mode.ts',
    count: 1,
    justification:
      'Write-failure detection probe. Tries a no-op write under getAdminDb to detect Neon write-availability outages. The probe itself doesn\'t read or write tenant data; it just confirms whether the connection can write. Read-only-mode banner subscribes to the result.',
  },
  {
    file: 'apps/command-room/src/lib/read-only-mode.ts',
    count: 1,
    justification:
      'Same as the client-portal read-only-mode probe. Command-room maintains its own copy to avoid a cross-app import.',
  },
  {
    file: 'packages/db/src/health-probe.ts',
    count: 2,
    justification:
      'Health endpoint probe (/api/health). Reports binary service status (db_writable, db_readable) to the UI status-aware banner. No tenant data exposed; only liveness signals. See header comment for the full posture. Count is 2 because the file header comment includes the literal `getAdminDb()` substring while explaining why the probe bypasses RLS — the matcher catches both the comment reference and the actual call. Both are intentional.',
  },
  {
    file: 'apps/client-portal/src/app/api/health/route.ts',
    count: 1,
    justification:
      'Public /api/health endpoint. Anonymous (no Clerk session), gates the UI status-aware banner. Calls getAdminDb to run the health probe; returns ONLY binary service-status booleans. No tenant data exposed. Same posture as packages/db/src/health-probe.ts; this is the route-level entry point.',
  },
  {
    file: 'apps/command-room/src/app/api/health/route.ts',
    count: 1,
    justification:
      'Public /api/health endpoint for the command-room app. Same posture as the client-portal health route — anonymous, binary status only, no tenant data.',
  },

  // ─── Pre-tenant tables (no RLS by design) ───────────────────────
  {
    file: 'apps/client-portal/src/app/api/scan-intake-stub/route.ts',
    count: 1,
    justification:
      'Discovery Scan prospect intake. Inserts into the `prospects` table which is explicitly NO-RLS per migration 0030 (a pre-tenant lead-capture table). The route is public + unauthenticated by design (cold-traffic landing page); RLS bypass is the only path because no tenant scope exists at the time of insert.',
  },

  // ─── Inngest crons (operate globally across tenants) ────────────
  {
    file: 'services/workers/src/functions/gmail-poll.ts',
    count: 1,
    justification:
      'Gmail polling cron. Iterates ALL tenants that have Gmail OAuth credentials configured, polls each one\'s inbox, and fires per-tenant classify events. Cannot use withTenant() because the iterator IS the tenant-scoping mechanism — it scopes per iteration, not per request.',
  },
  {
    file: 'services/workers/src/functions/verify-actions-chain.ts',
    count: 4,
    justification:
      'Nightly cryptographic audit-chain verification (migration 0022). Iterates ALL tenants, verifies each tenant\'s actions table chain integrity (chain_seq + prev_hash + row_hash), reports tampering. Same global-iteration pattern as gmail-poll. Three real call sites: (1) tenant list query, (2) per-tenant chain read, (3) tamper-report write. Fourth occurrence is a comment reference added 2026-05-15 (Session 4 RLS-posture audit block) — the matcher catches comment mentions identically to real calls; that posture documentation is intentional.',
  },
  {
    file: 'services/workers/src/functions/cost-outlier-alert.ts',
    count: 2,
    justification:
      'Cost-telemetry outlier alarm. Iterates per-tenant cost rows in cost_telemetry to detect single-call cost spikes (>$0.50 threshold). Two call sites: (1) tenant scan, (2) per-tenant detail query.',
  },
  {
    file: 'services/workers/src/functions/cost-spike-alert.ts',
    count: 2,
    justification:
      'Cost-telemetry day-over-day spike alarm. Same pattern as cost-outlier-alert; detects >50% day-over-day cost increases per tenant. Two call sites: (1) tenant scan, (2) per-tenant rollup.',
  },
  {
    file: 'services/workers/src/functions/cost-runaway-alert.ts',
    count: 2,
    justification:
      'Cost-telemetry runaway-spend alarm. Detects sustained high-spend windows per tenant. Two call sites: (1) tenant scan, (2) per-tenant audit trail insert for the alarm event.',
  },

  // ─── Documentation-only mentions (no real call site) ────────────
  {
    file: 'packages/db/src/webhook-dedup.ts',
    count: 1,
    justification:
      'JSDoc-comment reference (2026-05-15, Session 6 webhook audit). The tryRecordWebhookEvent helper takes a DocketDb argument from the caller; this file does NOT itself call getAdminDb(). The docstring mentions getAdminDb() as the typical caller pattern for the webhook routes. The literal-string matcher catches the comment reference — documenting it here keeps the allowlist canonical.',
  },
];

// Sum of expected calls across the allowlist.
const EXPECTED_TOTAL_CALLS = ALLOWLIST.reduce((s, c) => s + c.count, 0);

// ────────────────────────────────────────────────────────────────
// Scanner — runs git grep for getAdminDb( in production code paths
// (excluding test files + dev scripts), tallies per-file counts.
// ────────────────────────────────────────────────────────────────

function listActualCallers(): Map<string, number> {
  // git grep is faster + git-aware vs walking the FS. Excludes
  // test files (*.test.ts) and dev scripts (scripts/) via path
  // spec. We DO want to see calls in packages/db itself (the
  // function lives there but consumers shouldn't typically use it
  // from within the package — health-probe.ts is the documented
  // intra-package exception).
  let out: string;
  try {
    out = execSync(
      // -F: literal string (no regex). -n: line numbers (unused here
      // but useful for debugging). --: separator before path specs.
      // ':(exclude)' globs skip test files + dev scripts + this
      // very script.
      `git grep -F -n "getAdminDb(" -- ` +
        `"*.ts" ` +
        `":(exclude)*.test.ts" ` +
        `":(exclude)*/scripts/*" ` +
        `":(exclude)scripts/*" ` +
        `":(exclude)*.md"`,
      { encoding: 'utf8' },
    );
  } catch (err) {
    // git grep exits 1 when there are no matches OR git is unavailable.
    // For our use case, no matches is a hard failure (production
    // callers must exist) — but we surface the real reason if git is
    // missing.
    const msg = err instanceof Error ? err.message : String(err);
    if (/not a git repo|fatal/i.test(msg)) {
      console.error(`[check-getAdminDb] git unavailable: ${msg}`);
      process.exit(2);
    }
    // Empty grep result means we found zero — the allowlist is non-
    // empty, so this is a regression we should surface.
    out = '';
  }

  const counts = new Map<string, number>();
  for (const line of out.split('\n')) {
    if (!line) continue;
    // git grep output format: <file>:<line>:<content>
    // Take the file part (everything before the FIRST `:`).
    const firstColon = line.indexOf(':');
    if (firstColon < 0) continue;
    let file = line.slice(0, firstColon);
    // Normalize to forward slashes (Windows compat).
    file = file.replace(/\\/g, '/');
    // Skip the function-definition site itself (one call inside
    // packages/db/src/client.ts where the function is exported,
    // not consumed).
    if (file === 'packages/db/src/client.ts') continue;
    counts.set(file, (counts.get(file) ?? 0) + 1);
  }
  return counts;
}

// ────────────────────────────────────────────────────────────────
// Diff the actual against the allowlist + report.
// ────────────────────────────────────────────────────────────────

function diff(): { ok: boolean; messages: string[] } {
  const actual = listActualCallers();
  const allowed = new Map(ALLOWLIST.map((c) => [c.file, c.count]));
  const messages: string[] = [];
  let ok = true;

  // (1) NEW CALLER — appears in actual but not in allowlist.
  for (const [file, count] of actual) {
    if (!allowed.has(file)) {
      ok = false;
      messages.push(
        `❌ NEW UNAUTHORIZED CALLER: ${file} (${count} call${count === 1 ? '' : 's'}).\n` +
          `   getAdminDb() bypasses RLS — every new caller needs an entry in scripts/check-getAdminDb-callers.ts\n` +
          `   ALLOWLIST with a written justification, OR a refactor to use withTenant() instead.`,
      );
    }
  }

  // (2) MISSING ALLOWLISTED CALLER — in allowlist but not in actual.
  for (const [file, expectedCount] of allowed) {
    if (!actual.has(file)) {
      ok = false;
      messages.push(
        `❌ ALLOWLIST STALE: ${file} is allowlisted (${expectedCount} call${expectedCount === 1 ? '' : 's'}) but not found in production code.\n` +
          `   Either the caller was removed (update scripts/check-getAdminDb-callers.ts to drop this entry) or the file path changed (update the entry).`,
      );
    }
  }

  // (3) COUNT MISMATCH — file in both but call count differs.
  for (const [file, expectedCount] of allowed) {
    const actualCount = actual.get(file);
    if (actualCount !== undefined && actualCount !== expectedCount) {
      ok = false;
      messages.push(
        `❌ COUNT MISMATCH: ${file} — allowlist expects ${expectedCount}, actual is ${actualCount}.\n` +
          `   A new getAdminDb() call landed in this file. Each call site needs its own justification — either extend the entry's justification text to cover the new call OR refactor the new call to use withTenant().`,
      );
    }
  }

  if (ok) {
    messages.push(
      `✓ getAdminDb() callers match allowlist: ${actual.size} files / ${[...actual.values()].reduce((s, n) => s + n, 0)} total calls (expected ${EXPECTED_TOTAL_CALLS}).`,
    );
  }

  return { ok, messages };
}

// ────────────────────────────────────────────────────────────────
// Main.
// ────────────────────────────────────────────────────────────────

const { ok, messages } = diff();
const stream = ok ? process.stdout : process.stderr;
for (const msg of messages) stream.write(`${msg}\n`);
process.exit(ok ? 0 : 1);
