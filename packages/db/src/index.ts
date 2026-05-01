export * from './schema.js';
export {
  getAdminDb,
  withTenant,
  withTenantReadOnly,
  disconnect,
  schema,
  type DocketDb,
} from './client.js';

// Encryption — two-tier API. Application code touching user PII MUST go
// through the per-tenant variants (encryptFieldForTenant + DEK from
// dek-cache). The single-key variants are deprecated and kept only for
// the orchestrator's non-tenant fixtures.
export {
  // Per-tenant API (preferred — pair with getTenantDek)
  encryptFieldForTenant,
  decryptFieldForTenant,
  decryptIfMarkedForTenant,
  // Master-KEK helpers (internal — used by dek-cache)
  encryptDek,
  decryptDek,
  // Single-key API (DEPRECATED, see encryption.ts header)
  encryptField,
  decryptField,
  decryptIfMarked,
  // Common
  isEncrypted,
  generateEncryptionKey,
  type EncryptedMarker,
} from './encryption.js';

// DEK cache — resolve a tenant's Data Encryption Key, with first-access
// provisioning for legacy tenant rows without a dek_encrypted value yet.
export {
  getTenantDek,
  provisionTenantDek,
  invalidateTenantDek,
  clearDekCache,
} from './dek-cache.js';
