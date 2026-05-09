// Smoke: searchAuthorities + lookupAuthorityByCitation against dev DB.
// Validates the seeded authorities are searchable + the citation-
// lookup verifier returns hits for known cites.

import { sql } from 'drizzle-orm';
import {
  getAdminDb,
  searchAuthorities,
  lookupAuthorityByCitation,
} from '../src/index.js';

async function main() {
  const db = getAdminDb();
  const rows = await db.execute<{ id: string; [k: string]: unknown }>(
    sql`SELECT id::text AS id FROM tenants LIMIT 1`,
  );
  const tenants = rows as unknown as Array<{ id: string }>;
  if (tenants.length === 0) {
    console.log('No tenants on dev DB');
    process.exit(0);
  }
  const tenantId = tenants[0]!.id;
  console.log(`tenant: ${tenantId}\n`);

  // --- Search ---
  const queries = [
    'gross income',
    'home office deduction',
    'qualified business income',
    'KBA Form 8879',
    'CA residency',
    'self-employment $400',
  ];

  for (const q of queries) {
    const hits = await searchAuthorities(tenantId, q, { limit: 3 });
    console.log(`[search] "${q}" -> ${hits.length} hits`);
    for (const h of hits) {
      console.log(
        `   ${h.citation_label.padEnd(22)} rank=${h.rank.toFixed(4)}  ${h.heading?.slice(0, 50) ?? ''}`,
      );
    }
  }

  // Filter by jurisdiction
  console.log();
  const caHits = await searchAuthorities(tenantId, 'residency', {
    limit: 5,
    jurisdiction: 'CA',
  });
  console.log(`[CA-only] "residency" -> ${caHits.length} hits`);
  for (const h of caHits) {
    console.log(`   ${h.citation_label} (${h.jurisdiction})`);
  }

  // Filter by kind
  const ircHits = await searchAuthorities(tenantId, 'expense', {
    limit: 5,
    kinds: ['irc'],
  });
  console.log(`\n[IRC-only] "expense" -> ${ircHits.length} hits`);
  for (const h of ircHits) {
    console.log(`   ${h.citation_label} (${h.kind})`);
  }

  // --- Citation lookup ---
  console.log('\n--- citation lookup ---');
  const lookups = ['IRC §61(a)', 'IRC §199A', 'irc-280a-c', 'IRS Pub 1345', 'fake-cite'];
  for (const cite of lookups) {
    const found = await lookupAuthorityByCitation(tenantId, cite);
    console.log(`  "${cite}" -> ${found ? `${found.citation_label} (${found.kind})` : 'NULL'}`);
  }

  console.log('\nSMOKE OK');
}

main().catch((err) => {
  console.error('smoke-authority-search FAILED:', err);
  process.exit(1);
});
