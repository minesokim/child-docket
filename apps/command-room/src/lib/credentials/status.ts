// Per-kind credential status query for the /settings/credentials page.
//
// Reads the encrypted tenant_credentials rows for the requesting
// tenant, decrypts each one server-side, and returns a sanitized
// status object that the UI renders. Secrets are NEVER included
// in the return shape — only:
//   - whether the kind is configured
//   - last-4 hint (or full where non-secret like email + locationId)
//   - last-updated timestamp
//   - non-secret config fields (Square environment, DocuSign account,
//     Gmail authorized scope)
//
// SCOPING
//   Goes through getTenantCredential which reads under withTenant +
//   tenant DEK. Cross-tenant leak impossible by construction.

import { sql } from 'drizzle-orm';
import {
  getTenantCredential,
  withTenant,
  type TwilioCredentials,
  type SquareCredentials,
  type DocusignCredentials,
  type GmailCredentials,
} from '@docket/db';
import { asTenantId } from '@docket/shared';

export interface CredentialStatus {
  kind: 'twilio' | 'square' | 'docusign' | 'gmail';
  connected: boolean;
  lastUpdatedAt: string | null;
  /** Per-kind safe-display fields. Never secrets. */
  display: {
    /** Twilio: from-number masked except last 4. */
    fromNumberLast4?: string;
    /** Twilio: account SID is non-secret (it's the account identifier). */
    accountSid?: string;
    /** Square: location ID + environment. Non-secret. */
    locationId?: string;
    environment?: 'sandbox' | 'production';
    /** DocuSign: account ID + integration key are non-secret. */
    accountId?: string;
    integrationKey?: string;
    /** Gmail: clientId is non-secret; scope is non-secret. */
    clientIdSuffix?: string;
    scope?: string;
  };
}

export interface CredentialStatuses {
  twilio: CredentialStatus;
  square: CredentialStatus;
  docusign: CredentialStatus;
  gmail: CredentialStatus;
}

interface RowMeta {
  kind: string;
  updated_at: string;
  [key: string]: unknown;
}

/**
 * Returns the credential statuses for the tenant. Only the requesting
 * user's tenant is queried (RLS-bound via withTenant); other tenants'
 * credentials never reach this function.
 */
export async function loadCredentialStatuses(
  tenantId: string,
): Promise<CredentialStatuses> {
  return await withTenant(asTenantId(tenantId), async (db) => {
    // Read row metadata first (kind + updated_at) so we know which
    // kinds exist before paying the decryption cost.
    const rows = await db.execute<RowMeta>(sql`
      SELECT
        kind,
        to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
      FROM tenant_credentials
      WHERE tenant_id = ${tenantId}::uuid
    `);
    const meta = new Map<string, string>();
    for (const r of rows as unknown as RowMeta[]) {
      meta.set(r.kind, r.updated_at);
    }

    const statuses: CredentialStatuses = {
      twilio: emptyStatus('twilio'),
      square: emptyStatus('square'),
      docusign: emptyStatus('docusign'),
      gmail: emptyStatus('gmail'),
    };

    // Twilio
    if (meta.has('twilio')) {
      try {
        const cred = (await getTenantCredential(
          db,
          asTenantId(tenantId),
          'twilio',
        )) as TwilioCredentials | null;
        if (cred) {
          statuses.twilio = {
            kind: 'twilio',
            connected: true,
            lastUpdatedAt: meta.get('twilio') ?? null,
            display: {
              accountSid: cred.accountSid,
              fromNumberLast4: cred.fromNumber.slice(-4),
            },
          };
        }
      } catch (err) {
        console.error('[credentials/status] twilio decrypt failed:', err);
      }
    }

    // Square
    if (meta.has('square')) {
      try {
        const cred = (await getTenantCredential(
          db,
          asTenantId(tenantId),
          'square',
        )) as SquareCredentials | null;
        if (cred) {
          statuses.square = {
            kind: 'square',
            connected: true,
            lastUpdatedAt: meta.get('square') ?? null,
            display: {
              locationId: cred.locationId,
              environment: cred.environment,
            },
          };
        }
      } catch (err) {
        console.error('[credentials/status] square decrypt failed:', err);
      }
    }

    // DocuSign
    if (meta.has('docusign')) {
      try {
        const cred = (await getTenantCredential(
          db,
          asTenantId(tenantId),
          'docusign',
        )) as DocusignCredentials | null;
        if (cred) {
          statuses.docusign = {
            kind: 'docusign',
            connected: true,
            lastUpdatedAt: meta.get('docusign') ?? null,
            display: {
              accountId: cred.accountId,
              integrationKey: cred.integrationKey,
            },
          };
        }
      } catch (err) {
        console.error('[credentials/status] docusign decrypt failed:', err);
      }
    }

    // Gmail
    if (meta.has('gmail')) {
      try {
        const cred = (await getTenantCredential(
          db,
          asTenantId(tenantId),
          'gmail',
        )) as GmailCredentials | null;
        if (cred) {
          // The clientId looks like 12345-abc.apps.googleusercontent.com
          // — show only the project number (before the hyphen) for the UI.
          const clientIdSuffix = cred.clientId.split('-')[0] ?? '';
          statuses.gmail = {
            kind: 'gmail',
            connected: true,
            lastUpdatedAt: meta.get('gmail') ?? null,
            display: {
              clientIdSuffix,
              scope: cred.scope,
            },
          };
        }
      } catch (err) {
        console.error('[credentials/status] gmail decrypt failed:', err);
      }
    }

    return statuses;
  });
}

function emptyStatus(kind: CredentialStatus['kind']): CredentialStatus {
  return { kind, connected: false, lastUpdatedAt: null, display: {} };
}
