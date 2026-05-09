// Smoke: documents-queries (listDocuments + countDocumentsByFilter).
// Validates SQL shape + relative-time formatter against dev DB.

import { sql } from 'drizzle-orm';
import { getAdminDb } from '@docket/db';
import {
  listDocuments,
  countDocumentsByFilter,
  formatRelativeTime,
  formatBytes,
  labelForClassification,
  labelForPhase,
} from '../src/lib/documents-queries.js';

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

  for (const filter of ['all', 'pending', 'classified', 'finalized'] as const) {
    const docs = await listDocuments(tenantId, filter, 10);
    console.log(`  filter=${filter}: ${docs.length} docs`);
    for (const d of docs.slice(0, 2)) {
      console.log(
        `    [${labelForPhase(d.parse_phase)}] ${d.original_filename} (${formatBytes(d.size_bytes)}) ` +
          `cls=${labelForClassification(d.ai_classification)} ` +
          `${formatRelativeTime(d.created_at)}`,
      );
    }
  }

  const counts = await countDocumentsByFilter(tenantId);
  console.log(
    `counts: all=${counts.all} pending=${counts.pending} classified=${counts.classified} finalized=${counts.finalized}`,
  );

  console.log('\nSMOKE OK: documents-queries SQL + formatters all green.');
}

main().catch((err) => {
  console.error('smoke-documents-queries FAILED:', err);
  process.exit(1);
});
