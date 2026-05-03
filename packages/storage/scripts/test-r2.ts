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

console.log('');
console.log('──────────────────────────────────────');
console.log('  ✓ All R2 operations work direct from server');
console.log('  → If browser PUTs still 403, the issue is presigned-URL specific.');
console.log('──────────────────────────────────────');
