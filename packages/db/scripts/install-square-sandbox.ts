// One-shot: fetch Square sandbox locationId from the access token,
// install both into tenant_credentials for the Vazant tenant.
//
// PER USER INSTRUCTION (2026-05-08): user pasted the sandbox access
// token in chat with explicit instruction "use it. im going to rotate
// it anyways after." Treating this as a temp/expedient setup; logged
// to AUTONOMOUS-DECISIONS as needing rotation post-UI ship.
//
// What this does:
//   1. GET https://connect.squareupsandbox.com/v2/locations with the
//      access token in Authorization header. Returns the sandbox
//      locations list — first one is the default.
//   2. setTenantCredential('square', { accessToken, locationId,
//      environment: 'sandbox' }) for Vazant tenant. Encrypts via
//      tenant DEK, idempotent upsert.
//   3. Audits via setTenantCredential's existing path (which the UI
//      will use too).

import { sql } from 'drizzle-orm';
import { getAdminDb, setTenantCredential } from '../src/index.js';
import { asTenantId } from '@docket/shared';

// Pasted by user with explicit "use it" instruction. SANDBOX token
// (not production). User committed to rotate post-UI-ship.
const SANDBOX_ACCESS_TOKEN = process.env.SQUARE_SANDBOX_ACCESS_TOKEN ?? '';
if (!SANDBOX_ACCESS_TOKEN) {
  console.error('Set SQUARE_SANDBOX_ACCESS_TOKEN env var before running this script.');
  console.error('Example: SQUARE_SANDBOX_ACCESS_TOKEN=EAAA... bun run packages/db/scripts/install-square-sandbox.ts');
  process.exit(1);
}

async function main() {
  console.log('=== Square sandbox cred install ===');

  // 1. Fetch locations from Square sandbox API.
  console.log('Fetching locations from Square sandbox...');
  const res = await fetch('https://connect.squareupsandbox.com/v2/locations', {
    headers: {
      Authorization: `Bearer ${SANDBOX_ACCESS_TOKEN}`,
      'Square-Version': '2024-01-18',
      'Content-Type': 'application/json',
    },
  });

  const json = (await res.json()) as
    | { locations: Array<{ id: string; name: string; status: string; type: string }> }
    | { errors: Array<{ category: string; code: string; detail: string }> };

  if (!res.ok || !('locations' in json)) {
    const errMsg = 'errors' in json ? json.errors[0]?.detail : `HTTP ${res.status}`;
    console.error(`Square API call failed: ${errMsg}`);
    console.error('Check that the access token is valid + that this is a SANDBOX token (not production).');
    process.exit(1);
  }

  if (!json.locations || json.locations.length === 0) {
    console.error('Square returned 0 locations. Sandbox dashboard should auto-create one — contact Square support.');
    process.exit(1);
  }

  console.log(`Found ${json.locations.length} location(s):`);
  for (const loc of json.locations) {
    console.log(`  ${loc.id}  ${loc.name}  (${loc.type}, ${loc.status})`);
  }

  // Pick the first ACTIVE location, or fall back to the first overall.
  const location = json.locations.find((l) => l.status === 'ACTIVE') ?? json.locations[0]!;
  console.log(`\nSelected: ${location.id} — ${location.name}`);

  // 2. Find the Vazant tenant.
  const db = getAdminDb();
  const tenantRows = await db.execute<{ id: string; name: string }>(sql`
    SELECT id::text AS id, name FROM tenants WHERE slug = 'vazant' LIMIT 1
  `);
  const tenants = tenantRows as unknown as Array<{ id: string; name: string }>;
  if (tenants.length === 0) {
    console.error('No Vazant tenant found (slug=vazant). Aborting.');
    process.exit(1);
  }
  const tenant = tenants[0]!;
  console.log(`\nTenant: ${tenant.name} (${tenant.id})`);

  // 3. Install the credential.
  console.log('Installing Square sandbox credential...');
  await setTenantCredential(db, asTenantId(tenant.id), 'square', {
    accessToken: SANDBOX_ACCESS_TOKEN,
    locationId: location.id,
    environment: 'sandbox',
  });

  console.log('\nSquare sandbox credential installed for Vazant tenant.');
  console.log('Note: encrypted via tenant DEK; the UI will let you rotate it.');
}

main().catch((err) => {
  console.error('install-square-sandbox FAILED:', err);
  process.exit(1);
});
