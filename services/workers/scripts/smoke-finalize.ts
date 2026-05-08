// services/workers/scripts/smoke-finalize.ts
//
// End-to-end smoke test for the document finalize pipeline. Run
// against PROD or DEV with the appropriate env vars.
//
//   bun run services/workers/scripts/smoke-finalize.ts
//
// What it does:
//   1. Picks the most recent documents row at parse_phase='final'
//      (or accepts a --doc-id <uuid> arg).
//   2. Reads its final_storage_key from the DB.
//   3. statObject() the R2 key — verifies the file exists + size + mime.
//   4. getPresignedDownloadUrl() — generates a 60s URL.
//   5. fetch() the URL — verifies HTTP 200.
//   6. Reads the first 8 bytes — verifies %PDF magic.
//   7. Reads the full body — verifies size matches DB record.
//
// Exit codes:
//   0 = pipeline healthy end-to-end
//   1 = something's broken (each step prints a labeled FAIL line)
//
// Why this exists: this whole evening's bug parade (Inngest step
// output cap, binarize PNG format, Tesseract worker crash, 10s
// lambda timeout, iframe sandbox, R2 key collision) all manifested
// as the same surface symptom — "user clicks doc, sees nothing".
// None of them surfaced until a human did the full upload-to-preview
// loop in production. This script collapses that loop into 5 seconds
// of CLI output. Run it after every finalize-pipeline change and the
// failure modes become visible immediately, not "in 10 minutes when
// David hits refresh."

/* eslint-disable no-console */

import { eq, desc, isNull, and } from 'drizzle-orm';
import { withTenant, getAdminDb, schema } from '@docket/db';
import { asTenantId } from '@docket/shared';
import { statObject, getPresignedDownloadUrl } from '@docket/storage';

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';

type Step = { label: string; ok: boolean; detail?: string };
const steps: Step[] = [];

function logStep(label: string, ok: boolean, detail?: string): void {
  steps.push({ label, ok, detail });
  const tag = ok ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
  console.log(`  ${tag}  ${label}${detail ? `  ${DIM}${detail}${RESET}` : ''}`);
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const docIdArg = args.find((a) => a.startsWith('--doc-id='))?.slice(9);

  console.log(`${YELLOW}━━ smoke-finalize ━━${RESET}`);
  console.log(`Target: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] ?? '<no DB>'}`);
  console.log('');

  // Step 0: load doc row.
  const adminDb = getAdminDb();
  let doc;
  if (docIdArg) {
    [doc] = await adminDb
      .select({
        id: schema.documents.id,
        tenantId: schema.documents.tenantId,
        clientId: schema.documents.clientId,
        parsePhase: schema.documents.parsePhase,
        finalStorageKey: schema.documents.finalStorageKey,
        finalFilename: schema.documents.finalFilename,
        finalSizeBytes: schema.documents.finalSizeBytes,
        finalMimeType: schema.documents.finalMimeType,
      })
      .from(schema.documents)
      .where(eq(schema.documents.id, docIdArg))
      .limit(1);
  } else {
    [doc] = await adminDb
      .select({
        id: schema.documents.id,
        tenantId: schema.documents.tenantId,
        clientId: schema.documents.clientId,
        parsePhase: schema.documents.parsePhase,
        finalStorageKey: schema.documents.finalStorageKey,
        finalFilename: schema.documents.finalFilename,
        finalSizeBytes: schema.documents.finalSizeBytes,
        finalMimeType: schema.documents.finalMimeType,
      })
      .from(schema.documents)
      .where(
        and(
          eq(schema.documents.parsePhase, 'final'),
          isNull(schema.documents.mergedIntoDocumentId),
        ),
      )
      .orderBy(desc(schema.documents.finalizedAt))
      .limit(1);
  }

  if (!doc) {
    console.log(`${RED}FATAL${RESET}  no documents row to test (none at parse_phase='final')`);
    return 1;
  }

  console.log(`Doc: ${doc.id}`);
  console.log(`     phase=${doc.parsePhase}  filename=${doc.finalFilename}  size=${doc.finalSizeBytes}`);
  console.log('');

  logStep(
    'documents row at parse_phase=final',
    doc.parsePhase === 'final',
    `actual=${doc.parsePhase}`,
  );
  logStep(
    'final_storage_key set',
    !!doc.finalStorageKey,
    doc.finalStorageKey ?? '<null>',
  );
  logStep(
    'final_filename set',
    !!doc.finalFilename,
    doc.finalFilename ?? '<null>',
  );
  logStep(
    'final_size_bytes set',
    !!doc.finalSizeBytes && doc.finalSizeBytes > 0,
    `${doc.finalSizeBytes}`,
  );
  logStep(
    'final_mime_type=application/pdf',
    doc.finalMimeType === 'application/pdf',
    doc.finalMimeType ?? '<null>',
  );

  if (!doc.finalStorageKey) {
    console.log('');
    console.log(`${RED}cannot continue — no final_storage_key${RESET}`);
    return 1;
  }

  // Step 1: stat R2.
  let stat;
  try {
    stat = await statObject({ storageKey: doc.finalStorageKey });
    logStep(
      'R2 object exists',
      stat.exists,
      `size=${stat.sizeBytes}  mime=${stat.mimeType}`,
    );
    logStep(
      'R2 mime is application/pdf',
      stat.mimeType === 'application/pdf',
      stat.mimeType ?? '<null>',
    );
    logStep(
      'R2 size matches DB',
      stat.sizeBytes === doc.finalSizeBytes,
      `r2=${stat.sizeBytes} db=${doc.finalSizeBytes}`,
    );
  } catch (e) {
    logStep('R2 statObject', false, (e as Error).message);
    return 1;
  }

  // Step 2: presigned URL.
  let url: string;
  try {
    const presigned = await getPresignedDownloadUrl({
      storageKey: doc.finalStorageKey,
      ttlSeconds: 60,
    });
    url = presigned.url;
    logStep('presigned URL minted', true, `expires in 60s`);
  } catch (e) {
    logStep('presigned URL minted', false, (e as Error).message);
    return 1;
  }

  // Step 3: fetch.
  let resp: Response;
  try {
    resp = await fetch(url);
    logStep(
      `GET returns 2xx`,
      resp.ok,
      `status=${resp.status} content-type=${resp.headers.get('content-type')}`,
    );
  } catch (e) {
    logStep('GET presigned URL', false, (e as Error).message);
    return 1;
  }

  if (!resp.ok) return 1;

  const ctype = resp.headers.get('content-type') ?? '';
  logStep(
    'response Content-Type is application/pdf',
    ctype.startsWith('application/pdf'),
    ctype,
  );

  // Step 4: PDF magic + size.
  const buf = Buffer.from(await resp.arrayBuffer());
  const magic = buf.subarray(0, 4).toString('ascii');
  logStep('PDF magic %PDF', magic === '%PDF', `got "${magic}"`);
  logStep(
    'fetched size matches DB',
    buf.length === doc.finalSizeBytes,
    `got=${buf.length} db=${doc.finalSizeBytes}`,
  );

  // Step 5: tenant-scoped re-read (sanity check that RLS isn't broken).
  try {
    const reread = await withTenant(asTenantId(doc.tenantId), async (db) => {
      const [r] = await db
        .select({ id: schema.documents.id, parsePhase: schema.documents.parsePhase })
        .from(schema.documents)
        .where(eq(schema.documents.id, doc.id))
        .limit(1);
      return r ?? null;
    });
    logStep(
      'withTenant() re-read works',
      !!reread && reread.parsePhase === 'final',
      reread ? `phase=${reread.parsePhase}` : '<not found>',
    );
  } catch (e) {
    logStep('withTenant() re-read', false, (e as Error).message);
  }

  console.log('');
  const failed = steps.filter((s) => !s.ok);
  if (failed.length === 0) {
    console.log(`${GREEN}━━ all ${steps.length} checks passed ━━${RESET}`);
    return 0;
  } else {
    console.log(`${RED}━━ ${failed.length} of ${steps.length} checks failed ━━${RESET}`);
    return 1;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(`${RED}FATAL${RESET}`, e);
    process.exit(2);
  });
