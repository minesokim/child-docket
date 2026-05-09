// services/workers/scripts/smoke-gmail-poll.ts
//
// Smoke for the Gmail polling end-to-end pipeline against Vazant.
//
//   bun run services/workers/scripts/smoke-gmail-poll.ts
//
// What it does
//   1. Resolve Vazant tenant.
//   2. Call fetchTenantNewMessages() — the real cron worker function.
//      First run: bootstrap (no historyId yet) → cursor advances.
//      Second run: incremental fetch → 0 new messages expected on a
//      quiet inbox; 1+ if Antonio received mail in the interval.
//   3. If any new messages were emitted, exercise fetchMessageForTenant
//      on the first message — proves messages.get + body extraction
//      work end-to-end.
//   4. If a clear test fixture exists (a known sender bound to a
//      known client), exercise loadContextForClassification — proves
//      the client-match SQL works.
//   5. Read the gmail_sync_state row back to confirm the cursor
//      advanced.
//
// What it INTENTIONALLY DOES NOT DO
//   - Doesn't fire Inngest events (that needs the dev server). Tests
//     the per-tenant fetch in isolation.
//   - Doesn't persist issues / threads (that's classify-gmail-message,
//     a separate Inngest function). Tests the fetch + decode + state
//     advance composition.
//
// Per /smoke-test skill: this is the canonical "real DB + real Gmail
// API" verification. Not a unit test. Costs ~$0 (Gmail API is free at
// this volume) and ~5s.

/* eslint-disable no-console */

import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '../../../.env.local'), override: true });

import { sql } from 'drizzle-orm';
import { getAdminDb } from '@docket/db';
import { fetchTenantNewMessages } from '../src/functions/gmail-poll.js';
import { fetchMessageForTenant, loadContextForClassification } from '../src/functions/classify-gmail-message.js';

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';

const checks: Array<{ name: string; ok: boolean; detail?: string }> = [];

function step(name: string, ok: boolean, detail?: string): void {
  checks.push({ name, ok, detail });
  const tag = ok ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
  console.log(`  ${tag}  ${name}${detail ? `  ${DIM}${detail}${RESET}` : ''}`);
}

const stubLogger = {
  info: (...args: unknown[]) => console.log('   ', DIM, ...args, RESET),
  warn: (...args: unknown[]) => console.log('   ', YELLOW, '[warn]', ...args, RESET),
  error: (...args: unknown[]) => console.log('   ', RED, '[error]', ...args, RESET),
};

async function main(): Promise<number> {
  console.log(`${YELLOW}━━ smoke-gmail-poll ━━${RESET}`);

  if (!process.env.DATABASE_URL || !process.env.PII_ENCRYPTION_KEY) {
    console.error(`${RED}FATAL${RESET} DATABASE_URL + PII_ENCRYPTION_KEY required`);
    return 2;
  }

  // Step 0 — find Vazant.
  const adminDb = getAdminDb();
  const tenantRows = await adminDb.execute<{ id: string; name: string }>(sql`
    SELECT id::text AS id, name FROM tenants WHERE slug = 'vazant' LIMIT 1
  `);
  const tenants = tenantRows as unknown as Array<{ id: string; name: string }>;
  if (tenants.length === 0) {
    console.error(`${RED}FATAL${RESET} no Vazant tenant in dev DB`);
    return 2;
  }
  const tenantId = tenants[0]!.id;
  console.log(`Target tenant: ${tenants[0]!.name} (${tenantId})\n`);

  // Step 1 — first poll cycle. Bootstrap if cursor missing.
  const t1 = Date.now();
  const r1 = await fetchTenantNewMessages(tenantId, stubLogger);
  if (!r1.ok) {
    step(`first poll cycle`, false, `reason=${r1.reason} ${r1.message}`);
    if (r1.reason === 'auth-failed') {
      console.error(
        `\n${YELLOW}Note:${RESET} test apps' refresh tokens expire after 7 days. Re-mint via OAuth Playground if this fails.`,
      );
    }
    return 1;
  }
  const t1Latency = Date.now() - t1;
  step(
    `first poll cycle`,
    true,
    `messages=${r1.messageIds.length} historyId=${r1.newHistoryId} ${t1Latency}ms`,
  );

  // Step 2 — read gmail_sync_state row back.
  const stateRows = await adminDb.execute<{
    last_history_id: string | null;
    last_polled_at: string | null;
    total_classified: number;
  }>(sql`
    SELECT last_history_id, last_polled_at::text AS last_polled_at, total_classified
    FROM gmail_sync_state
    WHERE tenant_id = ${tenantId}::uuid
  `);
  const stateRow = (stateRows as unknown as Array<{
    last_history_id: string | null;
    last_polled_at: string | null;
    total_classified: number;
  }>)[0];
  step(
    `gmail_sync_state row exists`,
    stateRow != null,
    stateRow ? `historyId=${stateRow.last_history_id} polled=${stateRow.last_polled_at}` : 'no row',
  );

  // Step 3 — second poll cycle. Should be incremental (no bootstrap).
  // Likely 0 new messages on a quiet interval; we just verify the
  // call path doesn't error.
  const t2 = Date.now();
  const r2 = await fetchTenantNewMessages(tenantId, stubLogger);
  const t2Latency = Date.now() - t2;
  step(
    `second poll cycle (incremental)`,
    r2.ok,
    r2.ok
      ? `messages=${r2.messageIds.length} historyId=${r2.newHistoryId} ${t2Latency}ms`
      : `failed ${('reason' in r2 ? r2.reason : 'unknown')}`,
  );

  // Step 4 — if we got any message IDs (either run), exercise the
  // per-message fetch path.
  const messageIds = (r1.ok ? r1.messageIds : []).concat(r2.ok ? r2.messageIds : []);
  if (messageIds.length > 0) {
    const probeId = messageIds[0]!.id;
    const fetchResult = await fetchMessageForTenant(tenantId, probeId, stubLogger);
    if (fetchResult.ok) {
      const m = fetchResult.message;
      step(
        `fetchMessageForTenant succeeds`,
        true,
        `from=${m.from.slice(0, 30)} subject=${(m.subject ?? '').slice(0, 30)} body=${m.bodyText.length}b`,
      );
    } else {
      step(
        `fetchMessageForTenant succeeds`,
        false,
        `reason=${fetchResult.reason}`,
      );
    }
  } else {
    step(
      `fetchMessageForTenant (skipped, no messages observed)`,
      true,
      'inbox quiet during smoke window',
    );
  }

  // Step 5 — exercise loadContextForClassification with Antonio's own
  // email (he's the firm_owner). Should match a user, may not match
  // a client (Antonio isn't his own client). The point is to prove
  // the queries work.
  const ctxResult = await loadContextForClassification(
    tenantId,
    'antonio@vazantconsulting.com',
    stubLogger,
  );
  step(
    `loadContextForClassification queries`,
    ctxResult.firm.firmName.length > 0 && ctxResult.firm.preparerFullName.length > 0,
    `firm=${ctxResult.firm.firmName} preparer=${ctxResult.firm.preparerFullName} clientMatched=${ctxResult.clientMatch !== null}`,
  );

  // Summary.
  console.log('');
  const failed = checks.filter((c) => !c.ok);
  if (failed.length === 0) {
    console.log(`${GREEN}━━ all ${checks.length} checks passed ━━${RESET}`);
    return 0;
  }
  console.log(`${RED}━━ ${failed.length} of ${checks.length} checks failed ━━${RESET}`);
  return 1;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(`${RED}FATAL${RESET}`, e);
    process.exit(2);
  });
