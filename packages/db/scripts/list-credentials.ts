import { sql } from 'drizzle-orm';
import { getAdminDb } from '../src/index.js';

const db = getAdminDb();
const rows = await db.execute<{
  tenant: string;
  slug: string;
  kind: string;
  value_size: number;
  created_at: string;
  updated_at: string;
}>(sql`
  SELECT t.name AS tenant, t.slug, tc.kind, length(tc.data::text) AS value_size,
         to_char(tc.created_at, 'YYYY-MM-DD HH24:MI') AS created_at,
         to_char(tc.updated_at, 'YYYY-MM-DD HH24:MI') AS updated_at
  FROM tenant_credentials tc
  JOIN tenants t ON t.id = tc.tenant_id
  ORDER BY t.name, tc.kind
`);
const all = rows as unknown as Array<{
  tenant: string;
  slug: string;
  kind: string;
  value_size: number;
  created_at: string;
  updated_at: string;
}>;
console.log('configured credentials per tenant:');
for (const r of all) {
  console.log(`  ${r.tenant} (${r.slug}): ${r.kind} — ${r.value_size}B encrypted, updated ${r.updated_at}`);
}
console.log(`\ntotal rows: ${all.length}`);
