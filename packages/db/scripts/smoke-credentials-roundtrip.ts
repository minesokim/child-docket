// Smoke: credentials round-trip — set → read → test → delete →
// re-read for each kind, against the dev DB.
//
// CAREFUL: this script writes to a synthetic tenant created just for
// the smoke. It does NOT touch the Vazant tenant's real credentials.
// The synthetic tenant is created at start, deleted at end (via FK
// cascade on tenants → tenant_credentials).

import { sql } from 'drizzle-orm';
import {
  getAdminDb,
  setTenantCredential,
  getTenantCredential,
  deleteTenantCredential,
} from '../src/index.js';
import { asTenantId } from '@docket/shared';

const SYNTHETIC_TENANT_NAME = 'smoke-test-creds-roundtrip';

interface TenantRow {
  id: string;
  [key: string]: unknown;
}

async function main() {
  const db = getAdminDb();

  // 1. Create synthetic tenant.
  console.log('Creating synthetic tenant...');
  const insertedRows = await db.execute<TenantRow>(sql`
    INSERT INTO tenants (name, slug)
    VALUES (${SYNTHETIC_TENANT_NAME}, ${SYNTHETIC_TENANT_NAME})
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id::text AS id
  `);
  const tenantId = (insertedRows as unknown as TenantRow[])[0]?.id;
  if (!tenantId) {
    console.error('Could not create synthetic tenant');
    process.exit(1);
  }
  console.log(`  tenant_id: ${tenantId}`);

  let allOk = true;

  try {
    // 2. Twilio round-trip.
    console.log('\n--- Twilio ---');
    const twilioTest = {
      accountSid: 'ACfaketestaccountsidthatisvalidatedonly16chars',
      authToken: 'fake-token-at-least-sixteen-chars-please',
      fromNumber: '+18005551234',
    };
    await setTenantCredential(db, asTenantId(tenantId), 'twilio', twilioTest);
    const twilioRead = await getTenantCredential(db, asTenantId(tenantId), 'twilio');
    if (
      !twilioRead ||
      twilioRead.accountSid !== twilioTest.accountSid ||
      twilioRead.authToken !== twilioTest.authToken ||
      twilioRead.fromNumber !== twilioTest.fromNumber
    ) {
      console.error('  FAIL: Twilio round-trip values do not match');
      allOk = false;
    } else {
      console.log('  set + read: PASSED (encrypted, decrypted, fields match)');
    }

    // 3. Square round-trip.
    console.log('\n--- Square ---');
    const squareTest = {
      accessToken: 'EAAA-fake-square-token-sixteen-or-more-chars-here',
      locationId: 'LSMOKETEST123',
      environment: 'sandbox' as const,
    };
    await setTenantCredential(db, asTenantId(tenantId), 'square', squareTest);
    const squareRead = await getTenantCredential(db, asTenantId(tenantId), 'square');
    if (
      !squareRead ||
      squareRead.accessToken !== squareTest.accessToken ||
      squareRead.locationId !== squareTest.locationId ||
      squareRead.environment !== squareTest.environment
    ) {
      console.error('  FAIL: Square round-trip values do not match');
      allOk = false;
    } else {
      console.log('  set + read: PASSED');
    }

    // 4. DocuSign round-trip — note the validator requires a PEM-shaped
    //    privateKey; we use a synthetic one (not a real key) since
    //    encryption is what we are testing, not the JWT path.
    console.log('\n--- DocuSign ---');
    const docusignTest = {
      integrationKey: '00000000-0000-0000-0000-000000000001',
      userId: '00000000-0000-0000-0000-000000000002',
      accountId: '00000000-0000-0000-0000-000000000003',
      privateKey:
        '-----BEGIN RSA PRIVATE KEY-----\nFAKE_PEM_BODY_FOR_SMOKE_TEST\n-----END RSA PRIVATE KEY-----\n',
    };
    await setTenantCredential(db, asTenantId(tenantId), 'docusign', docusignTest);
    const docusignRead = await getTenantCredential(db, asTenantId(tenantId), 'docusign');
    if (
      !docusignRead ||
      docusignRead.integrationKey !== docusignTest.integrationKey ||
      docusignRead.privateKey !== docusignTest.privateKey
    ) {
      console.error('  FAIL: DocuSign round-trip values do not match');
      allOk = false;
    } else {
      console.log('  set + read: PASSED (PEM round-trip preserves whitespace)');
    }

    // 5. Gmail round-trip.
    console.log('\n--- Gmail ---');
    const gmailTest = {
      clientId: '999999999-fakesmoke.apps.googleusercontent.com',
      clientSecret: 'GOCSPX-fakesmoketestsecretvalue',
      refreshToken: '1//0fake-smoke-refresh-token-with-min-16-chars',
      scope: 'https://www.googleapis.com/auth/gmail.readonly',
    };
    await setTenantCredential(db, asTenantId(tenantId), 'gmail', gmailTest);
    const gmailRead = await getTenantCredential(db, asTenantId(tenantId), 'gmail');
    if (
      !gmailRead ||
      gmailRead.clientId !== gmailTest.clientId ||
      gmailRead.clientSecret !== gmailTest.clientSecret ||
      gmailRead.refreshToken !== gmailTest.refreshToken
    ) {
      console.error('  FAIL: Gmail round-trip values do not match');
      allOk = false;
    } else {
      console.log('  set + read: PASSED');
    }

    // 6. Idempotent re-set (rotation simulation).
    console.log('\n--- Idempotency / rotation ---');
    const twilioRotated = { ...twilioTest, authToken: 'rotated-fake-token-also-sixteen-plus' };
    await setTenantCredential(db, asTenantId(tenantId), 'twilio', twilioRotated);
    const twilioReread = await getTenantCredential(db, asTenantId(tenantId), 'twilio');
    if (twilioReread?.authToken !== twilioRotated.authToken) {
      console.error('  FAIL: rotation did not update authToken');
      allOk = false;
    } else {
      console.log('  rotate: PASSED (new value replaces old; encryption rerun)');
    }

    // 7. Delete + re-read should return null.
    console.log('\n--- Delete ---');
    for (const kind of ['twilio', 'square', 'docusign', 'gmail'] as const) {
      await deleteTenantCredential(db, asTenantId(tenantId), kind);
      const reread = await getTenantCredential(db, asTenantId(tenantId), kind);
      if (reread !== null) {
        console.error(`  FAIL: ${kind} still exists after delete`);
        allOk = false;
      } else {
        console.log(`  ${kind}: deleted, re-read returns null`);
      }
    }

    // 8. Validator-rejection branch.
    console.log('\n--- Validator rejection ---');
    let threw = false;
    try {
      await setTenantCredential(db, asTenantId(tenantId), 'twilio', {
        accountSid: 'NOT-AN-AC-PREFIX',
        authToken: 'fake-token-at-least-sixteen-chars',
        fromNumber: '+18005551234',
      });
    } catch (err) {
      threw = true;
      console.log(
        `  validator threw on bad accountSid: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
    if (!threw) {
      console.error('  FAIL: validator did not reject bad accountSid');
      allOk = false;
    }
  } finally {
    // Cleanup: delete the synthetic tenant. Cascade removes any
    // remaining credentials (the delete branch above should have
    // emptied them, but this is belt-and-suspenders).
    console.log('\nCleaning up synthetic tenant...');
    await db.execute(sql`DELETE FROM tenants WHERE id = ${tenantId}::uuid`);
    console.log('  synthetic tenant + cascaded credential rows removed');
  }

  console.log(allOk ? '\nSMOKE OK' : '\nSMOKE FAILED');
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error('smoke-credentials-roundtrip FAILED:', err);
  process.exit(1);
});
