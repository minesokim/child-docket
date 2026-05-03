// Direct R2 diagnostic — bypasses presigned URLs + browser + CORS.
// Tests whether the R2 credentials in .env.local can actually authenticate
// a PUT to the bucket. If this fails, the issue is credentials. If this
// succeeds but browser PUTs still 403, the issue is presigned-URL specific.
//
// Usage:
//   pnpm --filter @docket/storage exec tsx scripts/test-r2.ts

import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '../../../.env.local'), override: true });

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET = process.env.R2_BUCKET ?? 'docket-documents';

console.log('▸ R2 diagnostic');
console.log('  account_id:', ACCOUNT_ID ? `${ACCOUNT_ID.slice(0, 8)}...` : '✗ MISSING');
console.log('  access_key:', ACCESS_KEY ? `${ACCESS_KEY.slice(0, 8)}...` : '✗ MISSING');
console.log('  secret_key:', SECRET_KEY ? `***${SECRET_KEY.slice(-4)}` : '✗ MISSING');
console.log('  bucket    :', BUCKET);
console.log('');

if (!ACCOUNT_ID || !ACCESS_KEY || !SECRET_KEY) {
  console.error('✗ Missing one or more R2_* env vars in .env.local');
  process.exit(1);
}

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

// ─── 1. Can we see the bucket? ───
console.log('▸ HEAD bucket (does the token have access?)');
try {
  await client.send(new HeadBucketCommand({ Bucket: BUCKET }));
  console.log('  ✓ HEAD ok — bucket accessible');
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('  ✗ HEAD failed:', msg);
  console.error('  → Token likely lacks access to this bucket OR bucket name is wrong.');
  process.exit(1);
}

// ─── 2. Can we list (read access)? ───
console.log('');
console.log('▸ LIST bucket (read permission)');
try {
  const out = await client.send(new ListObjectsV2Command({ Bucket: BUCKET, MaxKeys: 5 }));
  console.log(`  ✓ LIST ok — ${out.KeyCount ?? 0} objects visible (showing first ${out.Contents?.length ?? 0})`);
  if (out.Contents) {
    for (const obj of out.Contents.slice(0, 5)) console.log('    -', obj.Key);
  }
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('  ✗ LIST failed:', msg);
  console.error('  → Token has HEAD but not READ permission.');
  process.exit(1);
}

// ─── 3. Can we PUT (write access)? ───
console.log('');
console.log('▸ PUT object (write permission)');
const testKey = `diagnostic/test-${Date.now()}.txt`;
try {
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: testKey,
      Body: `hello from docket diagnostic — ${new Date().toISOString()}`,
      ContentType: 'text/plain',
    }),
  );
  console.log(`  ✓ PUT ok — wrote ${testKey}`);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('  ✗ PUT failed:', msg);
  console.error('  → Token has READ but not WRITE permission.');
  console.error('  → Cloudflare → R2 → Manage R2 API Tokens → check this token has "Object Read & Write".');
  process.exit(1);
}

// ─── 4. Generate a presigned URL + try PUT-ing to it via fetch ───
//      Replicates what the browser does. If THIS fails, we have R2's
//      actual error body.
console.log('');
console.log('▸ Presigned PUT — simple path');
const presignedKey = `diagnostic/presigned-test-${Date.now()}.txt`;
const presignedCmd = new PutObjectCommand({
  Bucket: BUCKET,
  Key: presignedKey,
});
const presignedUrl = await getSignedUrl(client, presignedCmd, { expiresIn: 60 });
console.log('  url:', presignedUrl);

const res = await fetch(presignedUrl, {
  method: 'PUT',
  headers: { 'Content-Type': 'text/plain' },
  body: 'hello from docket presigned diagnostic',
});

console.log('  status:', res.status, res.statusText);
const body = await res.text();
if (res.ok) {
  console.log('  ✓ Presigned PUT ok (simple path)');
} else {
  console.log('  ✗ Presigned PUT FAILED');
  console.log('  body:', body || '(empty)');
}

// ─── 5. Mimic the production path EXACTLY ───
//      The production browser PUT is to a path like:
//        tenants/{tenantId}/clients/{clientId}/docs/{ulid}-{filename}
//      If THIS path is what makes R2 reject, we'll see the error here.
console.log('');
console.log('▸ Presigned PUT — production-shaped path (deep nesting + UUIDs)');
const fakeTenantId = 'dced49b8-e2ec-459a-98f3-3831ad420f10';
const fakeClientId = '6bbd871c-7b76-49c0-8fa6-265990a7b022';
const fakeUlid = '01KQ' + 'A'.repeat(22);
const productionPathKey = `tenants/${fakeTenantId}/clients/${fakeClientId}/docs/${fakeUlid}-test.jpg`;
const prodCmd = new PutObjectCommand({ Bucket: BUCKET, Key: productionPathKey });
const prodUrl = await getSignedUrl(client, prodCmd, { expiresIn: 60 });
console.log('  url:', prodUrl);

// PUT a binary-ish blob that mimics image bytes
const fakeJpegBytes = Buffer.alloc(1024 * 100, 0xff); // 100KB of 0xff
const prodRes = await fetch(prodUrl, {
  method: 'PUT',
  headers: { 'Content-Type': 'image/jpeg' },
  body: fakeJpegBytes,
});

console.log('  status:', prodRes.status, prodRes.statusText);
const prodBody = await prodRes.text();
if (prodRes.ok) {
  console.log('  ✓ Production-path presigned PUT ok');
} else {
  console.log('  ✗ Production-path presigned PUT FAILED');
  console.log('  body:', prodBody || '(empty)');
}

// ─── 6. CORS preflight test ───
//      Simulate exactly what the browser does before a cross-origin
//      PUT. If R2's CORS policy isn't configured (or doesn't include
//      the right origin / method / headers), THIS is what 403s — and
//      the browser shows the 403 as the underlying PUT failing rather
//      than the OPTIONS, which is why we've been chasing the wrong
//      request.
console.log('');
console.log('▸ OPTIONS preflight (simulates browser CORS check)');
const corsRes = await fetch(prodUrl, {
  method: 'OPTIONS',
  headers: {
    Origin: 'https://docket-portal.vercel.app',
    'Access-Control-Request-Method': 'PUT',
    'Access-Control-Request-Headers': 'content-type',
  },
});
console.log('  status:', corsRes.status, corsRes.statusText);
const aco = corsRes.headers.get('access-control-allow-origin');
const acm = corsRes.headers.get('access-control-allow-methods');
const ach = corsRes.headers.get('access-control-allow-headers');
console.log('  Access-Control-Allow-Origin :', aco ?? '(missing)');
console.log('  Access-Control-Allow-Methods:', acm ?? '(missing)');
console.log('  Access-Control-Allow-Headers:', ach ?? '(missing)');

const corsOk =
  corsRes.ok &&
  (aco === '*' || aco === 'https://docket-portal.vercel.app') &&
  acm?.toLowerCase().includes('put');

if (corsOk) {
  console.log('  ✓ CORS preflight ok — origin + method + headers all allowed');
} else {
  console.log('  ✗ CORS preflight FAILED — bucket CORS policy is wrong or missing');
  console.log('  → This is your 403. Cloudflare → R2 → docket-documents → Settings');
  console.log('    → CORS Policy → confirm policy is saved and includes:');
  console.log('      AllowedOrigins: ["https://docket-portal.vercel.app", ...]');
  console.log('      AllowedMethods: ["PUT", "GET", "HEAD"]');
  console.log('      AllowedHeaders: ["Content-Type", "Content-Length"]');
}

console.log('');
console.log('──────────────────────────────────────');
if (res.ok && prodRes.ok && corsOk) {
  console.log('  ✓ All R2 operations work end-to-end');
} else if (!corsOk) {
  console.log('  ✗ CORS policy on the R2 bucket is the blocker');
  console.log('  → Direct PUTs work fine; browser PUTs fail at preflight.');
} else {
  console.log('  ✗ Presigned URL flow broken');
}
console.log('──────────────────────────────────────');
