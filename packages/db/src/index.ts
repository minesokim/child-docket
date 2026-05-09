export * from './schema.js';
export {
  getAdminDb,
  getReadReplicaDb,
  isReadReplicaConfigured,
  withTenant,
  disconnect,
  schema,
  type DocketDb,
} from './client.js';

// Health probes — used by /api/health in both apps + by status-aware
// UX components consuming the response shape.
export {
  checkPrimaryDb,
  checkReadReplica,
  type ServiceStatus as HealthServiceStatus,
  type DbStatusResult,
  type ReplicaStatusResult,
} from './health-probe.js';

// Encryption — two-tier API. Application code touching user PII MUST go
// through the per-tenant variants (encryptFieldForTenant + DEK from
// dek-cache). The single-key variants are deprecated and kept only for
// the orchestrator's non-tenant fixtures.
export {
  // Per-tenant API (preferred — pair with getTenantDek)
  encryptFieldForTenant,
  decryptFieldForTenant,
  decryptIfMarkedForTenant,
  decryptTree,
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

// Per-tenant credential vault — Twilio / Square / DocuSign / Gmail
// secrets, encrypted with the tenant's DEK. See tenant-credentials.ts
// for the per-kind shapes + threat model.
export {
  getTenantCredential,
  setTenantCredential,
  deleteTenantCredential,
  type CredentialKind,
  type TwilioCredentials,
  type SquareCredentials,
  type DocusignCredentials,
  type GmailCredentials,
} from './tenant-credentials.js';

// Agent action audit-trail persistence — canonical onAction handler
// for runDocketAgent. See agent-action-log.ts header for usage +
// threat model.
export {
  persistAgentAction,
  type PersistAgentActionOptions,
} from './agent-action-log.js';

// Authority search — full-text + lookup over authorities +
// authority_chunks. Used by the citation-verifier loop and by
// retrieval-augmented agents (Discovery, notice-drafter).
export {
  searchAuthorities,
  lookupAuthorityByCitation,
  type AuthoritySearchHit,
  type AuthoritySearchOptions,
} from './authority-search.js';
