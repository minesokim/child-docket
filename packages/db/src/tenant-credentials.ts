// Per-tenant credential vault — read/write helpers.
//
// One row per (tenant, integration kind). Each row's `data` column is
// an EncryptedMarker ({__enc: base64}) encrypted with that tenant's DEK.
// The same key that protects SSN/EIN/bank in intake_responses also
// protects firm secrets here.
//
// CALL CONTRACT
//   - getTenantCredential(db, tenantId, kind) → decrypted plaintext object,
//     or null if the row doesn't exist
//   - setTenantCredential(db, tenantId, kind, plaintext) → upserts an
//     encrypted row. Idempotent. Bumps rotated_at on every write.
//   - deleteTenantCredential(db, tenantId, kind) → removes a credential
//     (e.g., during firm offboarding or rotation-then-discard flows)
//
// All three accept either a tenant-scoped (`withTenant`) DB or the
// admin DB. They look up the tenant's DEK from the cache themselves;
// callers don't pass DEKs around.
//
// SHAPE VALIDATION
//   Per-kind shape validation lives below in TwilioCredentials etc.
//   The validator runs after decryption so a corrupted blob throws a
//   clear error instead of silently returning the wrong shape.

import { eq, and } from 'drizzle-orm';
import { tenantCredentials } from './schema.js';
import { encryptFieldForTenant, decryptFieldForTenant, isEncrypted } from './encryption.js';
import { getTenantDek } from './dek-cache.js';
import type { DocketDb } from './client.js';
import type { TenantId } from '@docket/shared';

// ────────────────────────────────────────────────────────────────
// Per-kind shape definitions.
//
// When adding a new integration: define the shape, add to KindMap,
// add a validator in CRED_VALIDATORS. The schema doesn't need a
// migration because `kind` is free-text.
// ────────────────────────────────────────────────────────────────

export type TwilioCredentials = {
  /** Twilio Account SID. Public-ish identifier; starts with "AC". */
  accountSid: string;
  /** Twilio Auth Token. The actual secret. Rotate after any leak. */
  authToken: string;
  /** Sending phone number in E.164 (e.g. "+18663592994"). */
  fromNumber: string;
};

export type SquareCredentials = {
  /** Square OAuth access token, or sandbox/personal access token. */
  accessToken: string;
  /** Square Location ID where Checkout links + payments belong. */
  locationId: string;
  /** "production" | "sandbox" — selects Square API host. */
  environment: 'production' | 'sandbox';
};

export type DocusignCredentials = {
  /** DocuSign integration key (aka client_id). */
  integrationKey: string;
  /** DocuSign user GUID for the impersonated account holder. */
  userId: string;
  /** DocuSign account GUID (the firm's account, not Docket's). */
  accountId: string;
  /** RSA private key (PEM string) used for JWT consent flow. */
  privateKey: string;
};

export type GmailCredentials = {
  /** OAuth refresh token (long-lived). Used to mint access tokens. */
  refreshToken: string;
  /** Most-recent access token (short-lived). May be empty until first refresh. */
  accessToken?: string;
  /** Granted scopes (space-separated). */
  scope: string;
};

type KindMap = {
  twilio: TwilioCredentials;
  square: SquareCredentials;
  docusign: DocusignCredentials;
  gmail: GmailCredentials;
};

export type CredentialKind = keyof KindMap;

const KNOWN_KINDS: ReadonlyArray<CredentialKind> = ['twilio', 'square', 'docusign', 'gmail'];

function isCredentialKind(kind: string): kind is CredentialKind {
  return (KNOWN_KINDS as ReadonlyArray<string>).includes(kind);
}

// ────────────────────────────────────────────────────────────────
// Shape validators. Run after decryption so corrupted blobs surface
// a meaningful error instead of being passed to the integration code
// where they'll fail in stranger ways.
// ────────────────────────────────────────────────────────────────

const CRED_VALIDATORS: { [K in CredentialKind]: (value: unknown) => KindMap[K] } = {
  twilio: (value): TwilioCredentials => {
    if (!value || typeof value !== 'object') {
      throw new Error('Twilio credentials: not an object');
    }
    const v = value as Record<string, unknown>;
    if (typeof v.accountSid !== 'string' || !v.accountSid.startsWith('AC')) {
      throw new Error('Twilio credentials: accountSid must be a string starting with "AC"');
    }
    if (typeof v.authToken !== 'string' || v.authToken.length < 16) {
      throw new Error('Twilio credentials: authToken missing or too short');
    }
    if (typeof v.fromNumber !== 'string' || !/^\+[1-9]\d{6,14}$/.test(v.fromNumber)) {
      throw new Error('Twilio credentials: fromNumber must be E.164 (e.g. +18663592994)');
    }
    return { accountSid: v.accountSid, authToken: v.authToken, fromNumber: v.fromNumber };
  },
  square: (value): SquareCredentials => {
    if (!value || typeof value !== 'object') {
      throw new Error('Square credentials: not an object');
    }
    const v = value as Record<string, unknown>;
    if (typeof v.accessToken !== 'string' || v.accessToken.length < 16) {
      throw new Error('Square credentials: accessToken missing or too short');
    }
    if (typeof v.locationId !== 'string') {
      throw new Error('Square credentials: locationId required');
    }
    if (v.environment !== 'production' && v.environment !== 'sandbox') {
      throw new Error('Square credentials: environment must be "production" or "sandbox"');
    }
    return {
      accessToken: v.accessToken,
      locationId: v.locationId,
      environment: v.environment,
    };
  },
  docusign: (value): DocusignCredentials => {
    if (!value || typeof value !== 'object') {
      throw new Error('DocuSign credentials: not an object');
    }
    const v = value as Record<string, unknown>;
    for (const k of ['integrationKey', 'userId', 'accountId', 'privateKey'] as const) {
      if (typeof v[k] !== 'string' || (v[k] as string).length < 4) {
        throw new Error(`DocuSign credentials: ${k} missing or too short`);
      }
    }
    return {
      integrationKey: v.integrationKey as string,
      userId: v.userId as string,
      accountId: v.accountId as string,
      privateKey: v.privateKey as string,
    };
  },
  gmail: (value): GmailCredentials => {
    if (!value || typeof value !== 'object') {
      throw new Error('Gmail credentials: not an object');
    }
    const v = value as Record<string, unknown>;
    if (typeof v.refreshToken !== 'string' || v.refreshToken.length < 16) {
      throw new Error('Gmail credentials: refreshToken missing or too short');
    }
    if (typeof v.scope !== 'string') {
      throw new Error('Gmail credentials: scope required');
    }
    return {
      refreshToken: v.refreshToken,
      accessToken: typeof v.accessToken === 'string' ? v.accessToken : undefined,
      scope: v.scope,
    };
  },
};

// ────────────────────────────────────────────────────────────────
// Public API.
// ────────────────────────────────────────────────────────────────

/**
 * Read a tenant's credentials for a given integration. Returns null
 * if the tenant hasn't set creds for that kind.
 *
 * Throws if:
 *   - kind is not in KNOWN_KINDS (caller bug — typo'd integration name)
 *   - the row exists but ciphertext is corrupt / wrong DEK / tampered
 *   - the decrypted blob doesn't match the per-kind shape validator
 *
 * Caller pattern in a server action:
 *
 *   const creds = await getTenantCredential(db, tenantId, 'twilio');
 *   if (!creds) return { ok: false, error: 'Twilio not configured' };
 *   const response = await fetch('https://api.twilio.com/...', {
 *     headers: { Authorization: 'Basic ' + Buffer.from(
 *       `${creds.accountSid}:${creds.authToken}`).toString('base64') },
 *     ...
 *   });
 */
export async function getTenantCredential<K extends CredentialKind>(
  db: DocketDb,
  tenantId: TenantId,
  kind: K,
): Promise<KindMap[K] | null> {
  if (!isCredentialKind(kind)) {
    throw new Error(`Unknown credential kind: ${kind}`);
  }

  const [row] = await db
    .select({ data: tenantCredentials.data })
    .from(tenantCredentials)
    .where(and(eq(tenantCredentials.tenantId, tenantId), eq(tenantCredentials.kind, kind)))
    .limit(1);

  if (!row) return null;

  if (!isEncrypted(row.data)) {
    throw new Error(
      `tenant_credentials row for tenant=${tenantId} kind=${kind} has unencrypted data — refusing to use. Re-set via the seeder.`,
    );
  }

  const dek = await getTenantDek(db, tenantId);
  const plaintext = decryptFieldForTenant(row.data, dek);

  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    throw new Error(`tenant_credentials row for tenant=${tenantId} kind=${kind} is not valid JSON`);
  }

  return CRED_VALIDATORS[kind](parsed);
}

/**
 * Upsert a credential row. Encrypts before writing. Validates the
 * shape BEFORE encryption so a typo in the seeder fails fast instead
 * of being persisted as a corrupt blob.
 *
 * Sets rotated_at to now() on every call — the column is for
 * "when did the secret last change," and we don't have a no-op path
 * worth distinguishing right now.
 */
export async function setTenantCredential<K extends CredentialKind>(
  db: DocketDb,
  tenantId: TenantId,
  kind: K,
  plaintext: KindMap[K],
): Promise<void> {
  if (!isCredentialKind(kind)) {
    throw new Error(`Unknown credential kind: ${kind}`);
  }

  // Validate input BEFORE encryption — typos surface here, not on
  // the read path months later.
  CRED_VALIDATORS[kind](plaintext as unknown);

  const dek = await getTenantDek(db, tenantId);
  const encrypted = encryptFieldForTenant(JSON.stringify(plaintext), dek);
  const now = new Date();

  await db
    .insert(tenantCredentials)
    .values({
      tenantId,
      kind,
      data: encrypted,
      createdAt: now,
      updatedAt: now,
      rotatedAt: now,
    })
    .onConflictDoUpdate({
      target: [tenantCredentials.tenantId, tenantCredentials.kind],
      set: {
        data: encrypted,
        updatedAt: now,
        rotatedAt: now,
      },
    });
}

/**
 * Remove a credential row entirely. Used during firm offboarding or
 * "rotate-then-discard" flows where a fresh row will be inserted via
 * setTenantCredential right after.
 */
export async function deleteTenantCredential(
  db: DocketDb,
  tenantId: TenantId,
  kind: CredentialKind,
): Promise<void> {
  if (!isCredentialKind(kind)) {
    throw new Error(`Unknown credential kind: ${kind}`);
  }

  await db
    .delete(tenantCredentials)
    .where(and(eq(tenantCredentials.tenantId, tenantId), eq(tenantCredentials.kind, kind)));
}
