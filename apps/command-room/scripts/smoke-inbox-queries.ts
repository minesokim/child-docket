// Smoke: inbox-queries (listInboxIssues + countInboxByFilter).
//
// Validates that the issues + actions JOIN works against the dev DB,
// the trust-gate verdict extraction from tool_input doesn't error,
// and the relative-time formatter handles edge cases.

import { sql } from 'drizzle-orm';
import { getAdminDb } from '@docket/db';
import {
  listInboxIssues,
  countInboxByFilter,
  formatRelativeTime,
  labelForIssueType,
} from '../src/lib/inbox-queries.js';

interface TenantRow {
  id: string;
}

async function main() {
  const db = getAdminDb();
  const rows = await db.execute<TenantRow>(sql`
    SELECT id::text AS id FROM tenants LIMIT 1
  `);
  const tenants = rows as unknown as TenantRow[];
  if (tenants.length === 0) {
    console.log('No tenants on dev DB; nothing to smoke.');
    process.exit(0);
  }
  const tenantId = tenants[0]!.id;
  console.log(`tenant: ${tenantId}`);

  // listInboxIssues — all 4 filters
  for (const filter of ['all', 'needs-approval', 'drafted', 'resolved'] as const) {
    const issues = await listInboxIssues(tenantId, filter, 10);
    console.log(`  filter=${filter}: ${issues.length} issues`);
    for (const i of issues.slice(0, 2)) {
      console.log(
        `    [${i.severity}] ${labelForIssueType(i.type)} - ${i.title.slice(0, 60)} (${formatRelativeTime(i.created_at)})`,
      );
      if (i.draft_action_id) {
        console.log(
          `      draft: allowed=${i.trust_gate_allowed} requires=${i.trust_gate_requires}`,
        );
      }
    }
  }

  const counts = await countInboxByFilter(tenantId);
  console.log(`counts: all=${counts.all} needs-approval=${counts.needsApproval} drafted=${counts.drafted} resolved=${counts.resolved}`);

  // Relative-time edge cases
  const now = new Date();
  const cases = [
    { label: 'now', iso: new Date(now.getTime() - 5_000).toISOString() },
    { label: '30s ago', iso: new Date(now.getTime() - 30_000).toISOString() },
    { label: '5m ago', iso: new Date(now.getTime() - 5 * 60_000).toISOString() },
    { label: '3h ago', iso: new Date(now.getTime() - 3 * 60 * 60_000).toISOString() },
    { label: '2d ago', iso: new Date(now.getTime() - 2 * 24 * 60 * 60_000).toISOString() },
    { label: '14d ago', iso: new Date(now.getTime() - 14 * 24 * 60 * 60_000).toISOString() },
  ];
  console.log('relative time:');
  for (const c of cases) {
    console.log(`  ${c.label.padEnd(8)}-> ${formatRelativeTime(c.iso)}`);
  }

  console.log('\nSMOKE OK: inbox-queries returns shapes + trust-gate JSONB extraction works.');
}

main().catch((err) => {
  console.error('smoke-inbox-queries FAILED:', err);
  process.exit(1);
});
