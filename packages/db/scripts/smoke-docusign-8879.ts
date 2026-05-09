// Smoke: DocuSign 8879 + KBA envelope creation + recipient view URL.
//
//   bun run packages/db/scripts/smoke-docusign-8879.ts
//
// Steps (against Vazant's installed sandbox DocuSign cred):
//   1. JWT mint + token exchange (proves cred still valid)
//   2. Build a synthetic 8879-shaped PDF (real %PDF- header so
//      DocuSign accepts; minimal content)
//   3. Create envelope with KBA recipient (clientUserId set →
//      embedded mode)
//   4. Mint recipient view URL (proves the iframe handoff works)
//   5. Cleanup: void the envelope so it doesn't sit in Antonio's
//      sandbox account
//
// COST: $0 (sandbox is free)
// REQUIRED ENV: DATABASE_URL + PII_ENCRYPTION_KEY

/* eslint-disable no-console */

import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { getAdminDb, getTenantCredential, withTenant, type DocusignCredentials } from '../src/index.js';
import { asTenantId } from '@docket/shared';
// Importing from command-room because that's where the helpers live.
// In production these would be in packages/docusign-shared/; for v0
// the smoke imports across app boundary (smoke is a script, not a
// build artifact, so cross-import doesn't break bundling).
import { getDocuSignAccessToken } from '../../../apps/command-room/src/lib/docusign/jwt.js';
import {
  createEnvelope,
  createRecipientView,
} from '../../../apps/command-room/src/lib/docusign/envelope.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '../../../.env.local'), override: true });

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

// Minimal valid PDF (single empty page, ~600 bytes — too small for
// the request-sign-8879 validator which mins at 1KB, but DocuSign
// itself accepts. We pad to 1.5KB with comments to clear that gate
// in case future smoke variants want to call requestSign8879 too).
const MINIMAL_PDF = Buffer.concat([
  Buffer.from(
    '%PDF-1.4\n' +
      '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<<>>>>endobj\n' +
      'xref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000056 00000 n\n0000000101 00000 n\n' +
      'trailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF\n',
    'utf8',
  ),
  // Pad with PDF-comment-prefix so request-sign-8879 size validator
  // accepts (1KB min). Real 8879 PDFs are 50-100KB; this is just a
  // probe payload.
  Buffer.from('%' + 'X'.repeat(1500) + '\n', 'utf8'),
]);

async function main(): Promise<number> {
  console.log(`${YELLOW}━━ smoke-docusign-8879 ━━${RESET}`);
  if (!process.env.DATABASE_URL || !process.env.PII_ENCRYPTION_KEY) {
    console.error(`${RED}FATAL${RESET} DATABASE_URL + PII_ENCRYPTION_KEY required`);
    return 2;
  }

  const adminDb = getAdminDb();
  const tenantRows = await adminDb.execute<{ id: string; name: string }>(sql`
    SELECT id::text AS id, name FROM tenants WHERE slug = 'vazant' LIMIT 1
  `);
  const tenants = tenantRows as unknown as Array<{ id: string; name: string }>;
  if (tenants.length === 0) {
    console.error(`${RED}FATAL${RESET} no Vazant tenant`);
    return 2;
  }
  const tenantId = tenants[0]!.id;
  console.log(`Target tenant: ${tenants[0]!.name} (${tenantId})\n`);

  // Step 1: pull cred via withTenant.
  const creds = await withTenant(asTenantId(tenantId), async (db) => {
    return (await getTenantCredential(
      db,
      asTenantId(tenantId),
      'docusign',
    )) as DocusignCredentials | null;
  });
  if (!creds) {
    step('vazant has docusign credentials', false, 'no row in tenant_credentials');
    return 1;
  }
  step(
    'vazant has docusign credentials',
    true,
    `accountId=${creds.accountId.slice(0, 8)}…`,
  );

  // Step 2: mint access token.
  const tokenResult = await getDocuSignAccessToken({
    integrationKey: creds.integrationKey,
    userId: creds.userId,
    privateKey: creds.privateKey,
    authHost: 'account-d.docusign.com',
  });
  if (!tokenResult.ok) {
    step(
      'jwt mint + token exchange',
      false,
      `${tokenResult.reason}: ${tokenResult.message}`,
    );
    return 1;
  }
  step(
    'jwt mint + token exchange',
    true,
    `apiBaseUri=${tokenResult.apiBaseUri.replace(/^https?:\/\//, '').slice(0, 30)}…`,
  );

  // Step 3: build envelope.
  const pdfBase64 = MINIMAL_PDF.toString('base64');
  // Synthetic signer email — DocuSign sandbox doesn't actually deliver
  // emails for embedded mode (clientUserId set), so this is just for
  // the envelope payload.
  const signerEmail = 'smoke-test@example.com';
  const signerName = 'Smoke Test';
  const last4 = '1234';
  const externalRef = `smoke-${Date.now()}`;
  // Synthetic clientUserId — must match between createEnvelope and
  // createRecipientView. UUID-shaped to match real client IDs.
  const clientUserId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  const envelopeResult = await createEnvelope({
    accessToken: tokenResult.accessToken,
    apiBaseUri: tokenResult.apiBaseUri,
    accountId: creds.accountId,
    emailSubject: 'SMOKE · Form 8879',
    emailBody: 'Smoke test envelope',
    signerName,
    signerEmail,
    signerLast4Ssn: last4,
    documentBase64: pdfBase64,
    documentName: 'smoke-test-8879.pdf',
    clientUserId,
    externalRef,
  });
  if (!envelopeResult.ok) {
    step(
      'envelope creation with KBA + embedded recipient',
      false,
      `${envelopeResult.reason}: ${envelopeResult.message}${envelopeResult.errorCode ? ` (${envelopeResult.errorCode})` : ''}`,
    );
    return 1;
  }
  const envelopeId = envelopeResult.envelopeId;
  step(
    'envelope creation with KBA + embedded recipient',
    true,
    `envelopeId=${envelopeId.slice(0, 12)}… status=${envelopeResult.status}`,
  );

  // Step 4: mint recipient view URL.
  const viewResult = await createRecipientView({
    accessToken: tokenResult.accessToken,
    apiBaseUri: tokenResult.apiBaseUri,
    accountId: creds.accountId,
    envelopeId,
    clientUserId,
    signerName,
    signerEmail,
    returnUrl: 'https://docket-portal.vercel.app/portal/sign-8879/smoke/done',
  });
  if (!viewResult.ok) {
    step(
      'recipient view URL minted',
      false,
      `${viewResult.reason}: ${viewResult.message}`,
    );
  } else {
    step(
      'recipient view URL minted',
      true,
      `url length=${viewResult.signingUrl.length} chars (TTL ~5 min)`,
    );
  }

  // Step 5: cleanup — void the envelope so it doesn't sit in Antonio's
  // sandbox account. Best-effort: failure here doesn't fail the smoke.
  try {
    const voidUrl = `${tokenResult.apiBaseUri}/restapi/v2.1/accounts/${creds.accountId}/envelopes/${envelopeId}`;
    const voidRes = await fetch(voidUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'voided',
        voidedReason: 'smoke test cleanup',
      }),
    });
    step(
      'cleanup: envelope voided',
      voidRes.ok,
      voidRes.ok ? 'sandbox cleaned' : `HTTP ${voidRes.status}`,
    );
  } catch (e) {
    step('cleanup: envelope voided', false, e instanceof Error ? e.message : 'network');
  }

  // Suppress unused-import warning for fs (kept for debug PDF dump).
  void fs;

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
