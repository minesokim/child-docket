# @docket/storage

Object storage client + presigned URL helpers for document upload + retrieval.

## What this package is

Thin wrapper around the AWS SDK pointed at Cloudflare R2 (S3-compatible).
The same code works against AWS S3 if we ever need to migrate by setting
the endpoint env var.

## Storage layout

```
{tenantId}/{clientId}/docs/{ulid}-{sanitized-filename}
```

- `tenantId` first so a tenant-scoped key prefix can be used to scope
  R2 API tokens per firm in the future (compliance / multi-region).
- `clientId` next so all of a client's documents land under one prefix
  (CCPA right-to-delete = one prefix-delete).
- `ulid` is sortable by upload time without leaking exact timestamps.

## Env vars

```
R2_ACCOUNT_ID=<from Cloudflare dashboard>
R2_ACCESS_KEY_ID=<from R2 API tokens>
R2_SECRET_ACCESS_KEY=<from R2 API tokens>
R2_BUCKET=docket-documents
```

The endpoint is derived from `R2_ACCOUNT_ID`:
`https://{accountId}.r2.cloudflarestorage.com`. No public-bucket assumptions.

## API

```ts
buildStorageKey({ tenantId, clientId, filename })
  // → "tenants/{tenantId}/clients/{clientId}/docs/{ulid}-w2.pdf"

getPresignedUploadUrl({ storageKey, mimeType, sizeBytes })
  // → { url, expiresAt, method: "PUT", headers }
  //   browser PUTs the bytes directly. Server stays out of the data path.

getPresignedDownloadUrl({ storageKey, expiresIn })
  // → { url, expiresAt }

deleteObject({ storageKey })
  // → void. Used during CCPA right-to-delete cascades.
```
