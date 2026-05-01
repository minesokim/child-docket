export * from './schema.js';
export {
  getAdminDb,
  withTenant,
  withTenantReadOnly,
  disconnect,
  schema,
  type DocketDb,
} from './client.js';
export {
  encryptField,
  decryptField,
  decryptIfMarked,
  isEncrypted,
  generateEncryptionKey,
  type EncryptedMarker,
} from './encryption.js';
