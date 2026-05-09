// One-shot: install DocuSign sandbox credential for the Vazant tenant
// + run a live JWT-exchange test to verify the consent step was done.
//
// PER USER INSTRUCTION (2026-05-08): user pasted the RSA private key
// in chat with explicit "use it" pattern (matches Square install
// 472359e). Treating this as a temp/expedient setup; logged to
// AUTONOMOUS-DECISIONS as needing rotation post-UI ship.
//
// What this does:
//   1. Reads the PEM from DOCUSIGN_PRIVATE_KEY_PATH (file the user
//      saves; the script reads the PEM, never holds it on the
//      command line).
//   2. Calls setTenantCredential('docusign', { integrationKey,
//      userId, accountId, privateKey }) for Vazant. Encrypts via
//      tenant DEK.
//   3. Runs a JWT mint + exchange against
//      https://account-d.docusign.com/oauth/token to verify:
//      - The PEM signs correctly
//      - The user_id / integration_key / scope are valid
//      - The user has granted consent
//      - Returns a usable access_token + apiBaseUri
//   4. Reports the result. consent_required = user hasn't done the
//      consent URL step yet.

import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getAdminDb, setTenantCredential } from '../src/index.js';
import { asTenantId } from '@docket/shared';
import { getDocuSignAccessToken } from '../../../apps/command-room/src/lib/docusign/jwt.js';

const PEM_PATH = process.env.DOCUSIGN_PRIVATE_KEY_PATH ?? '';
const INTEGRATION_KEY = '69aa41d7-bb87-4138-a490-e63b9e7e00cb';
const USER_ID = '1f30debe-f23b-4dba-841f-64a09b1039ba';
const ACCOUNT_ID = '52125d58-5892-4e99-b069-0e4bfe9768fb';

if (!PEM_PATH) {
  console.error('Set DOCUSIGN_PRIVATE_KEY_PATH env var pointing to the PEM file.');
  process.exit(1);
}

async function main() {
  console.log('=== DocuSign sandbox cred install ===');

  // 1. Read the PEM from disk.
  let privateKey: string;
  try {
    privateKey = readFileSync(PEM_PATH, 'utf8');
  } catch (err) {
    console.error(`Failed to read PEM at ${PEM_PATH}: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
  if (!privateKey.includes('BEGIN RSA PRIVATE KEY') && !privateKey.includes('BEGIN PRIVATE KEY')) {
    console.error('PEM file does not contain a PRIVATE KEY block. Aborting.');
    process.exit(1);
  }
  console.log(`Read PEM from ${PEM_PATH} (${privateKey.length} bytes)`);

  // 2. Find the Vazant tenant.
  const db = getAdminDb();
  const tenantRows = await db.execute<{ id: string; name: string }>(sql`
    SELECT id::text AS id, name FROM tenants WHERE slug = 'vazant' LIMIT 1
  `);
  const tenants = tenantRows as unknown as Array<{ id: string; name: string }>;
  if (tenants.length === 0) {
    console.error('No Vazant tenant. Aborting.');
    process.exit(1);
  }
  const tenant = tenants[0]!;
  console.log(`Tenant: ${tenant.name} (${tenant.id})`);

  // 3. Install the credential. Even if JWT test below fails, the row
  //    is in place + the user can fix consent without re-pasting the
  //    PEM.
  console.log('Installing credential into tenant_credentials...');
  await setTenantCredential(db, asTenantId(tenant.id), 'docusign', {
    integrationKey: INTEGRATION_KEY,
    userId: USER_ID,
    accountId: ACCOUNT_ID,
    privateKey,
  });
  console.log('Credential installed (encrypted via tenant DEK).');

  // 4. Live JWT test. Calls the same docusign/jwt.ts helper the
  //    server action uses.
  console.log('\nTesting JWT exchange against account-d.docusign.com...');
  const tokenResult = await getDocuSignAccessToken({
    integrationKey: INTEGRATION_KEY,
    userId: USER_ID,
    privateKey,
    authHost: 'account-d.docusign.com',
  });

  if (tokenResult.ok) {
    console.log('JWT exchange succeeded.');
    console.log(`  access_token: ${tokenResult.accessToken.slice(0, 12)}... (${tokenResult.accessToken.length} chars)`);
    console.log(`  expires_at:   ${new Date(tokenResult.expiresAt).toISOString()}`);
    console.log(`  apiBaseUri:   ${tokenResult.apiBaseUri}`);
    console.log('\nDocuSign integration is fully wired. Consent was already granted.');
  } else {
    console.error(`\nJWT exchange FAILED: ${tokenResult.reason}`);
    console.error(`  ${tokenResult.message}`);
    if (tokenResult.reason === 'consent-required') {
      console.error('\nThe credential is installed but the consent step has not been done.');
      console.error('Visit this URL in a browser, sign in, click ACCEPT:');
      console.error(`  https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=${INTEGRATION_KEY}&redirect_uri=https%3A%2F%2Fdocusign.com`);
      console.error('Then re-run this script (or just call requestSign8879 — JWT will work).');
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('install-docusign-sandbox FAILED:', err);
  process.exit(1);
});
