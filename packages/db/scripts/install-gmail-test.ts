// One-shot: install Gmail OAuth credential for the Vazant tenant
// + run a live refresh-token exchange to verify it works.
//
// PER USER INSTRUCTION (2026-05-08): user pasted Gmail Client ID +
// Client Secret + refresh_token in chat with explicit "ill refresh
// later just use it" pattern (matches Square install [19] +
// DocuSign install [20]). Treating as temp/expedient setup;
// logged to AUTONOMOUS-DECISIONS as needing rotation post-UI ship.
//
// What this does:
//   1. Reads CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN, SCOPE from
//      env vars (so the script itself does not contain the secret
//      and the secret never appears on the command line).
//   2. Calls setTenantCredential('gmail', {clientId, clientSecret,
//      refreshToken, scope}) for Vazant. Encrypts via tenant DEK.
//   3. Live-tests the refresh by POSTing to oauth2.googleapis.com/
//      token with the refresh_token + client_id + client_secret —
//      if the credential is valid, Google returns a fresh
//      access_token + expires_in. Confirms end-to-end the
//      credential can mint access tokens.

import { sql } from 'drizzle-orm';
import { getAdminDb, setTenantCredential } from '../src/index.js';
import { asTenantId } from '@docket/shared';

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '';
const REFRESH_TOKEN = process.env.GOOGLE_OAUTH_REFRESH_TOKEN ?? '';
const SCOPE = process.env.GOOGLE_OAUTH_SCOPE ?? '';

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN || !SCOPE) {
  console.error('Set all four env vars:');
  console.error('  GOOGLE_OAUTH_CLIENT_ID');
  console.error('  GOOGLE_OAUTH_CLIENT_SECRET');
  console.error('  GOOGLE_OAUTH_REFRESH_TOKEN');
  console.error('  GOOGLE_OAUTH_SCOPE');
  process.exit(1);
}

async function main() {
  console.log('=== Gmail credential install ===');

  // 1. Find the Vazant tenant.
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

  // 2. Install (the validator runs here; will throw if shape wrong).
  console.log('Installing credential into tenant_credentials...');
  await setTenantCredential(db, asTenantId(tenant.id), 'gmail', {
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    refreshToken: REFRESH_TOKEN,
    scope: SCOPE,
  });
  console.log('Credential installed (encrypted via tenant DEK).');

  // 3. Live test: refresh the access token via Google's token endpoint.
  console.log('\nTesting refresh-token exchange against oauth2.googleapis.com...');
  const formData = new URLSearchParams();
  formData.append('client_id', CLIENT_ID);
  formData.append('client_secret', CLIENT_SECRET);
  formData.append('refresh_token', REFRESH_TOKEN);
  formData.append('grant_type', 'refresh_token');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });
  const json = (await res.json()) as
    | { access_token: string; expires_in: number; scope: string; token_type: string }
    | { error: string; error_description?: string };

  if (!res.ok || !('access_token' in json)) {
    const errCode = 'error' in json ? json.error : 'unknown';
    const errDesc = 'error_description' in json ? json.error_description : '';
    console.error(`\nRefresh-token exchange FAILED: ${errCode}`);
    if (errDesc) console.error(`  ${errDesc}`);
    if (errCode === 'invalid_grant') {
      console.error('\nLikely causes:');
      console.error('  - Refresh token revoked or expired (test apps expire after 7 days)');
      console.error('  - Client ID/Secret pair does not match the one that consented');
      console.error('  - User account that authorized was removed from Test Users');
    }
    process.exit(1);
  }

  console.log('Refresh exchange succeeded.');
  console.log(`  access_token: ${json.access_token.slice(0, 20)}... (${json.access_token.length} chars)`);
  console.log(`  expires_in:   ${json.expires_in}s (${Math.floor(json.expires_in / 60)} min)`);
  console.log(`  scope:        ${json.scope}`);
  console.log(`  token_type:   ${json.token_type}`);
  console.log('\nGmail integration is fully wired. The refresh token can mint access tokens; Docket will use the same code path to read inbound + send outbound mail.');

  // 4. (optional) Verify the access token can call the Gmail API by
  // hitting profile endpoint — minimal cost, confirms the scope.
  console.log('\nCalling gmail.users.getProfile to verify the access token works...');
  const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${json.access_token}` },
  });
  if (profileRes.ok) {
    const profile = (await profileRes.json()) as {
      emailAddress: string;
      messagesTotal: number;
      threadsTotal: number;
      historyId: string;
    };
    console.log(`  Authorized email:   ${profile.emailAddress}`);
    console.log(`  Total messages:     ${profile.messagesTotal.toLocaleString()}`);
    console.log(`  Total threads:      ${profile.threadsTotal.toLocaleString()}`);
    console.log('\nEnd-to-end verified. Live Gmail account access is working.');
  } else {
    const profileErr = (await profileRes.json()) as { error?: { message?: string } };
    console.warn(
      `  getProfile call failed: ${profileErr.error?.message ?? `HTTP ${profileRes.status}`}`,
    );
    console.warn('  (Refresh token works; profile call may need additional scope.)');
  }
}

main().catch((err) => {
  console.error('install-gmail-test FAILED:', err);
  process.exit(1);
});
