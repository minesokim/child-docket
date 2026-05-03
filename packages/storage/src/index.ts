// @docket/storage — R2 object storage helpers.
//
// Cloudflare R2 is S3-compatible, so the AWS SDK works unchanged with
// a custom endpoint pointed at `https://{accountId}.r2.cloudflarestorage.com`.
// Auth uses R2 API tokens (access-key / secret-access-key pair from the
// Cloudflare dashboard). No egress fees on R2 — picked specifically for
// the high-volume document use case.
//
// PRESIGNED-UPLOAD FLOW
//   1. Server: generate presigned PUT URL for a fresh storage key
//      (tenant + client + ulid scoped). Return the URL to the browser.
//   2. Browser: PUT the file bytes directly to R2. Server never touches
//      the bytes. Lower latency, lower compute cost.
//   3. Server: confirm the upload by writing the documents row + firing
//      the Inngest classify-document event.
//   4. Worker: read the file from R2, send to Haiku vision, update the
//      documents row with the classification.
//
// SECURITY POSTURE
//   - Storage keys include tenantId as a prefix so future R2 token
//     scoping (per-tenant API tokens for compliance customers) doesn't
//     require a key-rewrite migration.
//   - Presigned URLs default to 5-minute expiry. Long enough for slow
//     mobile uploads, short enough that a leaked URL has limited blast
//     radius.
//   - filename is sanitized into the storage key so a malicious filename
//     (e.g., `../../etc/passwd`) doesn't escape the prefix.

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ulid } from './ulid.js';
import type { TenantId, ClientId } from '@docket/shared';

// ────────────────────────────────────────────────────────────────
// Config + client.
// ────────────────────────────────────────────────────────────────

let _client: S3Client | null = null;

function getR2Config(): {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
} {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET ?? 'docket-documents';

  if (!accountId) throw new Error('R2_ACCOUNT_ID env var not set');
  if (!accessKeyId) throw new Error('R2_ACCESS_KEY_ID env var not set');
  if (!secretAccessKey) throw new Error('R2_SECRET_ACCESS_KEY env var not set');

  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function getClient(): S3Client {
  if (_client) return _client;
  const cfg = getR2Config();
  _client = new S3Client({
    // R2 ignores region but the SDK requires it. "auto" is the convention.
    region: 'auto',
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    // ─── R2 + presigned URL style ───
    // Stay with the default (virtual-hosted: bucket.host/key). The
    // diagnostic script proved this style works end-to-end via Node
    // fetch against a fresh presigned URL. Path-style was tried as
    // a hypothesis fix and didn't help — same 403 from the browser.
    //
    // The earlier virtual-hosted 403s in production were caused by
    // the AWS SDK auto-adding x-amz-checksum-crc32 + content-length
    // to SignedHeaders. Both are now disabled (see config below + the
    // PutObjectCommand below). Virtual-hosted with neither of those
    // signed = browser PUTs go through cleanly.
    // ─── Checksum compatibility with R2 ───
    // Starting in @aws-sdk/client-s3 v3.726+, "flexible checksums" are
    // ON by default. The SDK bakes a placeholder x-amz-checksum-crc32
    // into PRESIGNED URLs (set to AAAAAA== — base64 of 4 zero bytes),
    // then expects the upload body to match that CRC. Browser uploads
    // never match, so R2 returns 403. Cloudflare R2 doesn't fully
    // implement S3's flexible-checksum spec either way, so we disable
    // both directions:
    //   - requestChecksumCalculation: WHEN_REQUIRED — only compute
    //     a checksum when the operation explicitly requires one
    //     (e.g., S3 Object Lock); skip the speculative one
    //   - responseChecksumValidation: WHEN_REQUIRED — same on
    //     downloads
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  return _client;
}

// ────────────────────────────────────────────────────────────────
// Storage key construction.
//
// Layout: tenants/{tenantId}/clients/{clientId}/docs/{ulid}-{sanitized}
//
// `ulid` makes the key lexicographically sortable by upload time without
// leaking the exact second. Sanitization strips path-traversal attempts +
// reserved chars + length-clamps to 80 chars (full key max ~200 chars
// well under R2's 1024-byte limit).
// ────────────────────────────────────────────────────────────────

const SANITIZE_RE = /[^A-Za-z0-9._-]+/g;
const FILENAME_MAX = 80;

export function sanitizeFilename(input: string): string {
  if (!input) return 'file';
  // Strip any directory components first — defense in depth against
  // a filename like "../../etc/passwd" landing in the storage key.
  const base = input.split(/[\/\\]/).pop() ?? input;
  const sanitized = base.replace(SANITIZE_RE, '_').replace(/^_+|_+$/g, '');
  if (!sanitized) return 'file';
  if (sanitized.length <= FILENAME_MAX) return sanitized;
  // Preserve the file extension when truncating.
  const lastDot = sanitized.lastIndexOf('.');
  if (lastDot > 0 && lastDot > sanitized.length - 12) {
    const ext = sanitized.slice(lastDot);
    return sanitized.slice(0, FILENAME_MAX - ext.length) + ext;
  }
  return sanitized.slice(0, FILENAME_MAX);
}

export function buildStorageKey(opts: {
  tenantId: TenantId;
  clientId: ClientId;
  filename: string;
  /** Override the ulid (useful for tests). Production callers omit this. */
  id?: string;
}): string {
  const id = opts.id ?? ulid();
  const safe = sanitizeFilename(opts.filename);
  return `tenants/${opts.tenantId}/clients/${opts.clientId}/docs/${id}-${safe}`;
}

// ────────────────────────────────────────────────────────────────
// Presigned URL helpers.
// ────────────────────────────────────────────────────────────────

const DEFAULT_UPLOAD_TTL_SEC = 5 * 60; // 5 min — long enough for a slow mobile upload
const DEFAULT_DOWNLOAD_TTL_SEC = 10 * 60; // 10 min — long enough for a tab to render

export type PresignedUploadResult = {
  /** PUT this URL with the file bytes as the body. */
  url: string;
  /** Wall-clock UTC ms when the URL stops being valid. */
  expiresAt: number;
  /**
   * Headers the client MUST send on the PUT. Today: just Content-Type.
   * If we ever add server-side encryption metadata, those headers go here.
   */
  headers: Record<string, string>;
  /** The storage key the upload will land at (server-side knows this; client doesn't need to). */
  storageKey: string;
};

/**
 * Generate a presigned PUT URL for a single object upload. The browser
 * does the actual PUT; the server never sees the bytes.
 */
export async function getPresignedUploadUrl(opts: {
  storageKey: string;
  mimeType: string;
  /** Bytes the client is expected to upload. Used for capacity planning + abuse filtering. */
  sizeBytes: number;
  /** Override default expiry (5 min). */
  ttlSeconds?: number;
}): Promise<PresignedUploadResult> {
  const cfg = getR2Config();
  const ttl = opts.ttlSeconds ?? DEFAULT_UPLOAD_TTL_SEC;

  // Do NOT pass ContentLength here even though the caller knows it.
  // When ContentLength is on the PutObjectCommand, the SDK adds
  // `content-length` to SignedHeaders. R2 then strictly validates the
  // request's Content-Length header against the value signed into the
  // URL — a 1-byte difference returns 403. Browser uploads can subtly
  // differ from the size reported by File.size in some edge cases
  // (transfer encoding, multipart boundaries, etc.). Skipping the
  // ContentLength sign + relying on the browser to send the correct
  // Content-Length naturally is the safer R2-compatible posture.
  //
  // Same with ContentType — letting the browser send it as a regular
  // (unsigned) header. We still document Content-Type in the result
  // headers so the client knows to send it; just not signed.
  const cmd = new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: opts.storageKey,
  });

  const url = await getSignedUrl(getClient(), cmd, { expiresIn: ttl });

  return {
    url,
    expiresAt: Date.now() + ttl * 1000,
    headers: { 'Content-Type': opts.mimeType },
    storageKey: opts.storageKey,
  };
}

export type PresignedDownloadResult = {
  url: string;
  expiresAt: number;
};

/**
 * Generate a presigned GET URL for serving a document back to a user.
 * Returns a short-lived URL the browser can fetch directly. The server
 * never proxies file bytes — keeps Vercel functions out of the data path.
 *
 * The Content-Disposition header drives browser behavior:
 *   - `inline` (default): the browser RENDERS the file in place. PDFs
 *     show in the iframe / new-tab viewer; images render as `<img>`.
 *   - `attachment`: the browser DOWNLOADS the file with the suggested
 *     filename. Used by explicit "Download" buttons.
 *
 * Pass `disposition: 'attachment'` + `downloadFilename` to force
 * download. Otherwise leave both undefined and the URL inlines.
 */
export async function getPresignedDownloadUrl(opts: {
  storageKey: string;
  ttlSeconds?: number;
  /** 'inline' (default) renders in browser; 'attachment' triggers download. */
  disposition?: 'inline' | 'attachment';
  /** Suggested filename when disposition === 'attachment'. Ignored otherwise. */
  downloadFilename?: string;
}): Promise<PresignedDownloadResult> {
  const cfg = getR2Config();
  const ttl = opts.ttlSeconds ?? DEFAULT_DOWNLOAD_TTL_SEC;

  let contentDisposition: string | undefined;
  if (opts.disposition === 'attachment') {
    const safe = opts.downloadFilename
      ? sanitizeFilename(opts.downloadFilename)
      : 'document';
    contentDisposition = `attachment; filename="${safe}"`;
  }

  const cmd = new GetObjectCommand({
    Bucket: cfg.bucket,
    Key: opts.storageKey,
    ...(contentDisposition ? { ResponseContentDisposition: contentDisposition } : {}),
  });

  const url = await getSignedUrl(getClient(), cmd, { expiresIn: ttl });

  return {
    url,
    expiresAt: Date.now() + ttl * 1000,
  };
}

/**
 * Fetch the raw bytes for an object. Used by server-side workers
 * (Inngest classify-document) that need to read the file to send to
 * Haiku vision. Browsers never call this — they use presigned download.
 *
 * Returns the bytes as a Buffer. Throws if the object doesn't exist.
 */
export async function getObjectBytes(opts: { storageKey: string }): Promise<Buffer> {
  const cfg = getR2Config();
  const cmd = new GetObjectCommand({
    Bucket: cfg.bucket,
    Key: opts.storageKey,
  });
  const response = await getClient().send(cmd);
  if (!response.Body) {
    throw new Error(`R2 GET returned no body for key=${opts.storageKey}`);
  }
  // SDK returns a stream-like Body. Convert to Buffer.
  const chunks: Uint8Array[] = [];
  const stream = response.Body as AsyncIterable<Uint8Array>;
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Check that an object exists + return its size + content type. Used
 * during the confirm-upload step to verify the browser actually
 * succeeded before writing the documents row.
 */
export async function statObject(opts: { storageKey: string }): Promise<{
  exists: boolean;
  sizeBytes: number;
  mimeType: string | null;
}> {
  const cfg = getR2Config();
  try {
    const response = await getClient().send(
      new HeadObjectCommand({
        Bucket: cfg.bucket,
        Key: opts.storageKey,
      }),
    );
    return {
      exists: true,
      sizeBytes: response.ContentLength ?? 0,
      mimeType: response.ContentType ?? null,
    };
  } catch (err) {
    // S3 SDK throws a NotFound error class on missing objects. Anything
    // else is a real error.
    if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'NotFound') {
      return { exists: false, sizeBytes: 0, mimeType: null };
    }
    throw err;
  }
}

/**
 * Delete an object. Used during CCPA right-to-delete cascades.
 * Idempotent — deleting a missing key is not an error.
 */
export async function deleteObject(opts: { storageKey: string }): Promise<void> {
  const cfg = getR2Config();
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: cfg.bucket,
      Key: opts.storageKey,
    }),
  );
}

/**
 * Server-side direct upload. Used by the finalize-document worker which
 * processes a doc (binarize + PDF) and uploads the result to a new key.
 * Browsers should NOT call this — they go through getPresignedUploadUrl.
 */
export async function putObject(opts: {
  storageKey: string;
  body: Buffer;
  mimeType: string;
}): Promise<void> {
  const cfg = getR2Config();
  await getClient().send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: opts.storageKey,
      Body: opts.body,
      ContentType: opts.mimeType,
      ContentLength: opts.body.length,
    }),
  );
}

// ────────────────────────────────────────────────────────────────
// Re-exports.
// ────────────────────────────────────────────────────────────────
export { ulid } from './ulid.js';
