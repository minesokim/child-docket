// Smoke: home-queries (loadHomeData).
// Validates the 3 parallel queries work + return expected shapes.

import { sql } from 'drizzle-orm';
import { getAdminDb } from '@docket/db';
import {
  loadHomeData,
  formatRelativeTime,
  labelForActivity,
  labelForIssueType,
} from '../src/lib/home-queries.js';

async function main() {
  const db = getAdminDb();
  const rows = await db.execute<{ id: string; [k: string]: unknown }>(
    sql`SELECT id::text AS id FROM tenants LIMIT 1`,
  );
  const tenants = rows as unknown as Array<{ id: string }>;
  if (tenants.length === 0) {
    console.log('No tenants on dev DB; nothing to smoke.');
    process.exit(0);
  }
  const tenantId = tenants[0]!.id;
  console.log(`tenant: ${tenantId}`);

  const data = await loadHomeData(tenantId);

  console.log(`\nbrief: ${data.brief.length} unresolved issues`);
  for (const i of data.brief.slice(0, 3)) {
    console.log(
      `  [${i.severity}] ${labelForIssueType(i.type)}: ${i.title.slice(0, 60)} (${formatRelativeTime(i.created_at)})`,
    );
  }

  console.log(`\nstats:`);
  console.log(`  active_clients: ${data.stats.active_clients}`);
  console.log(`  reviews_ready:  ${data.stats.reviews_ready}`);
  console.log(`  notices_due:    ${data.stats.notices_due}`);
  console.log(`  docs_pending:   ${data.stats.docs_pending}`);
  console.log(`  spend_24h_usd:  $${data.stats.spend_24h_usd.toFixed(4)}`);

  console.log(`\nactivity: ${data.activity.length} recent actions`);
  for (const a of data.activity.slice(0, 3)) {
    console.log(
      `  ${labelForActivity(a)} (${a.client_name ?? 'system'}) - ${formatRelativeTime(a.created_at)}`,
    );
  }

  console.log('\nSMOKE OK');
}

main().catch((err) => {
  console.error('smoke-home-queries FAILED:', err);
  process.exit(1);
});
