'use server';

// Credentials-management server actions for /settings/credentials.
//
// All actions:
//   1. Auth: getCurrentDocketUser() — 401 unauthenticated otherwise
//   2. Role: 'firm_owner' only — 403 forbidden otherwise
//   3. Rate-limit: 10/min/user via consumeRateToken
//   4. Validation: per-kind via the existing CRED_VALIDATORS + format
//      checks before encrypting (catches the trailing-hyphen-on-paste
//      bug + similar input-trim issues at the form layer)
//   5. Audit row via persistAgentAction with redacted payload —
//      tool_input never includes secret material; only kind, last-4
//      hint, success/failure
//
// SECRET-HANDLING DISCIPLINE
//   Inputs come from the form (server action body); they're validated
//   in-memory; setTenantCredential encrypts via the tenant DEK
//   immediately. The plaintext lives only on the request stack —
//   no console.log, no toString, no error-message echo of secret
//   bytes. Audit rows include redacted-only fields.

import * as Sentry from '@sentry/nextjs';
import {
  deleteTenantCredential,
  getTenantCredential,
  persistAgentAction,
  setTenantCredential,
  withTenant,
  type CredentialKind,
  type DocusignCredentials,
  type GmailCredentials,
  type SquareCredentials,
  type TwilioCredentials,
} from '@docket/db';
import { asTenantId, asUserId, consumeRateToken } from '@docket/shared';
import { getCurrentDocketUser } from '@/lib/current-user';
import {
  testDocuSignCredential,
  testGmailCredential,
  testSquareCredential,
  testTwilioCredential,
  type CredentialTestResult,
} from './test';

const ALLOWED_ROLES = new Set(['firm_owner']);
const RATE_LIMIT_PER_MIN = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

export type SetCredentialResult =
  | { ok: true; kind: CredentialKind }
  | {
      ok: false;
      reason:
        | 'unauthenticated'
        | 'forbidden'
        | 'rate-limit'
        | 'invalid-format'
        | 'encryption-failed'
        | 'db-error';
      message: string;
      retryAfterMs?: number;
      /** Field name the validator rejected (when reason='invalid-format'). */
      field?: string;
    };

export type DeleteCredentialResult =
  | { ok: true; kind: CredentialKind }
  | {
      ok: false;
      reason:
        | 'unauthenticated'
        | 'forbidden'
        | 'rate-limit'
        | 'not-configured'
        | 'invalid-confirm-token'
        | 'db-error';
      message: string;
      retryAfterMs?: number;
    };

export type TestCredentialActionResult =
  | { ok: true; kind: CredentialKind; test: CredentialTestResult }
  | {
      ok: false;
      reason: 'unauthenticated' | 'forbidden' | 'rate-limit' | 'not-configured' | 'db-error';
      message: string;
      retryAfterMs?: number;
    };

// ────────────────────────────────────────────────────────────────
// Common: auth + role + rate-limit gate. Returns user or error.
// ────────────────────────────────────────────────────────────────

interface AuthGateOk {
  ok: true;
  user: {
    id: string;
    tenantId: string;
    clerkUserId: string;
    role: string;
  };
}

interface AuthGateErr {
  ok: false;
  err:
    | { reason: 'unauthenticated'; message: string }
    | { reason: 'forbidden'; message: string }
    | { reason: 'rate-limit'; message: string; retryAfterMs: number };
}

async function authGate(rateLimitKey: string): Promise<AuthGateOk | AuthGateErr> {
  const user = await getCurrentDocketUser();
  if (!user) {
    return {
      ok: false,
      err: { reason: 'unauthenticated', message: 'Not signed in' },
    };
  }
  if (!ALLOWED_ROLES.has(user.role)) {
    return {
      ok: false,
      err: {
        reason: 'forbidden',
        message: `Role ${user.role} cannot manage credentials. firm_owner only.`,
      },
    };
  }
  const limit = consumeRateToken(rateLimitKey, RATE_LIMIT_PER_MIN, RATE_LIMIT_WINDOW_MS);
  if (!limit.allowed) {
    return {
      ok: false,
      err: {
        reason: 'rate-limit',
        message: `Too many credential requests. Retry in ${Math.ceil(limit.retryAfterMs / 1000)}s.`,
        retryAfterMs: limit.retryAfterMs,
      },
    };
  }
  return {
    ok: true,
    user: {
      id: user.id,
      tenantId: user.tenantId,
      clerkUserId: user.clerkUserId,
      role: user.role,
    },
  };
}

// ────────────────────────────────────────────────────────────────
// Audit helper. Never logs secrets — only safe-display fields.
// ────────────────────────────────────────────────────────────────

async function auditCredentialAction(
  user: { id: string; tenantId: string },
  toolName: string,
  details: Record<string, unknown>,
  success: boolean,
  errorMessage: string | null = null,
): Promise<void> {
  const persist = persistAgentAction({
    extraToolInput: details,
    textPreviewLength: 0,
  });
  try {
    await persist({
      tenantId: asTenantId(user.tenantId),
      clientId: null,
      userId: asUserId(user.id),
      agentId: null,
      actionClass: 'send-internal',
      toolName,
      toolInput: {},
      toolOutput: { success },
      modelUsed: null,
      inputTokens: null,
      outputTokens: null,
      cachedTokens: null,
      costUsd: null,
      latencyMs: 0,
      success,
      errorMessage,
    });
  } catch (auditErr) {
    // Audit-row failure is best-effort.
    console.error(`[credentials/${toolName}] audit-row write failed:`, auditErr);
  }
}

// ────────────────────────────────────────────────────────────────
// SET — one server action per kind (typed inputs).
// ────────────────────────────────────────────────────────────────

export async function setTwilioCredentials(input: {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}): Promise<SetCredentialResult> {
  const user = await getCurrentDocketUser();
  if (!user) return { ok: false, reason: 'unauthenticated', message: 'Not signed in' };
  const gate = await authGate(`creds-set-twilio:${user.clerkUserId}`);
  if (!gate.ok) return { ok: false, ...gate.err } as SetCredentialResult;

  // Trim ALL secret-bearing fields. The trailing-hyphen Gmail bug
  // taught us that input-handling layers strip trailing characters.
  // We trim defensively here so users who paste cleanly are not
  // affected, but users who pasted with leading/trailing whitespace
  // get auto-corrected.
  const accountSid = input.accountSid.trim();
  const authToken = input.authToken.trim();
  const fromNumber = input.fromNumber.trim();

  // Defensive validation BEFORE the encryption + DB write.
  if (!accountSid.startsWith('AC')) {
    return {
      ok: false,
      reason: 'invalid-format',
      message: 'Account SID must start with "AC"',
      field: 'accountSid',
    };
  }
  if (authToken.length < 16) {
    return {
      ok: false,
      reason: 'invalid-format',
      message: 'Auth Token is too short',
      field: 'authToken',
    };
  }
  if (!/^\+[1-9]\d{6,14}$/.test(fromNumber)) {
    return {
      ok: false,
      reason: 'invalid-format',
      message: 'From Number must be E.164 (e.g. +18663592994)',
      field: 'fromNumber',
    };
  }

  try {
    await withTenant(asTenantId(user.tenantId), async (db) => {
      await setTenantCredential(db, asTenantId(user.tenantId), 'twilio', {
        accountSid,
        authToken,
        fromNumber,
      } satisfies TwilioCredentials);
    });
    await auditCredentialAction(
      user,
      'credentials.set.twilio',
      { fromNumberLast4: fromNumber.slice(-4), accountSid },
      true,
    );
    return { ok: true, kind: 'twilio' };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'credentials-set', kind: 'twilio' },
    });
    await auditCredentialAction(
      user,
      'credentials.set.twilio',
      { failure: 'db-error' },
      false,
      err instanceof Error ? err.message : 'unknown',
    );
    return {
      ok: false,
      reason: 'db-error',
      message: err instanceof Error ? err.message : 'Database write failed',
    };
  }
}

export async function setSquareCredentials(input: {
  accessToken: string;
  locationId: string;
  environment: 'sandbox' | 'production';
}): Promise<SetCredentialResult> {
  const user = await getCurrentDocketUser();
  if (!user) return { ok: false, reason: 'unauthenticated', message: 'Not signed in' };
  const gate = await authGate(`creds-set-square:${user.clerkUserId}`);
  if (!gate.ok) return { ok: false, ...gate.err } as SetCredentialResult;

  const accessToken = input.accessToken.trim();
  const locationId = input.locationId.trim();
  const environment = input.environment;

  if (accessToken.length < 16) {
    return {
      ok: false,
      reason: 'invalid-format',
      message: 'Access Token is too short',
      field: 'accessToken',
    };
  }
  if (!/^L[A-Z0-9]+$/.test(locationId)) {
    return {
      ok: false,
      reason: 'invalid-format',
      message: 'Location ID must start with "L" followed by uppercase alphanumerics',
      field: 'locationId',
    };
  }
  if (environment !== 'sandbox' && environment !== 'production') {
    return {
      ok: false,
      reason: 'invalid-format',
      message: 'Environment must be sandbox or production',
      field: 'environment',
    };
  }

  try {
    await withTenant(asTenantId(user.tenantId), async (db) => {
      await setTenantCredential(db, asTenantId(user.tenantId), 'square', {
        accessToken,
        locationId,
        environment,
      } satisfies SquareCredentials);
    });
    await auditCredentialAction(
      user,
      'credentials.set.square',
      { locationId, environment, tokenLast4: accessToken.slice(-4) },
      true,
    );
    return { ok: true, kind: 'square' };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'credentials-set', kind: 'square' },
    });
    await auditCredentialAction(
      user,
      'credentials.set.square',
      { failure: 'db-error' },
      false,
      err instanceof Error ? err.message : 'unknown',
    );
    return {
      ok: false,
      reason: 'db-error',
      message: err instanceof Error ? err.message : 'Database write failed',
    };
  }
}

export async function setDocuSignCredentials(input: {
  integrationKey: string;
  userId: string;
  accountId: string;
  privateKey: string;
}): Promise<SetCredentialResult> {
  const user = await getCurrentDocketUser();
  if (!user) return { ok: false, reason: 'unauthenticated', message: 'Not signed in' };
  const gate = await authGate(`creds-set-docusign:${user.clerkUserId}`);
  if (!gate.ok) return { ok: false, ...gate.err } as SetCredentialResult;

  const integrationKey = input.integrationKey.trim();
  const userIdField = input.userId.trim();
  const accountId = input.accountId.trim();
  // Don't trim PEM — preserves leading/trailing newlines that some
  // PEM parsers care about. But we DO normalize line endings (CRLF → LF)
  // because Windows-paste Notepad sometimes inserts CRLF and node:crypto
  // is forgiving but some downstream tools aren't.
  const privateKey = input.privateKey.replace(/\r\n/g, '\n');

  const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!guidRegex.test(integrationKey)) {
    return {
      ok: false,
      reason: 'invalid-format',
      message: 'Integration Key must be a GUID',
      field: 'integrationKey',
    };
  }
  if (!guidRegex.test(userIdField)) {
    return {
      ok: false,
      reason: 'invalid-format',
      message: 'User ID must be a GUID',
      field: 'userId',
    };
  }
  if (!guidRegex.test(accountId)) {
    return {
      ok: false,
      reason: 'invalid-format',
      message: 'Account ID must be a GUID',
      field: 'accountId',
    };
  }
  if (
    !privateKey.includes('BEGIN RSA PRIVATE KEY') &&
    !privateKey.includes('BEGIN PRIVATE KEY')
  ) {
    return {
      ok: false,
      reason: 'invalid-format',
      message:
        'Private Key must include the BEGIN/END markers (PKCS#1 or PKCS#8). Re-paste the full PEM block.',
      field: 'privateKey',
    };
  }

  try {
    await withTenant(asTenantId(user.tenantId), async (db) => {
      await setTenantCredential(db, asTenantId(user.tenantId), 'docusign', {
        integrationKey,
        userId: userIdField,
        accountId,
        privateKey,
      } satisfies DocusignCredentials);
    });
    await auditCredentialAction(
      user,
      'credentials.set.docusign',
      { integrationKey, accountId, pemBytes: privateKey.length },
      true,
    );
    return { ok: true, kind: 'docusign' };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'credentials-set', kind: 'docusign' },
    });
    await auditCredentialAction(
      user,
      'credentials.set.docusign',
      { failure: 'db-error' },
      false,
      err instanceof Error ? err.message : 'unknown',
    );
    return {
      ok: false,
      reason: 'db-error',
      message: err instanceof Error ? err.message : 'Database write failed',
    };
  }
}

export async function setGmailCredentials(input: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  scope: string;
}): Promise<SetCredentialResult> {
  const user = await getCurrentDocketUser();
  if (!user) return { ok: false, reason: 'unauthenticated', message: 'Not signed in' };
  const gate = await authGate(`creds-set-gmail:${user.clerkUserId}`);
  if (!gate.ok) return { ok: false, ...gate.err } as SetCredentialResult;

  const clientId = input.clientId.trim();
  const clientSecret = input.clientSecret.trim();
  const refreshToken = input.refreshToken.trim();
  const scope = input.scope.trim();

  if (!clientId.endsWith('.apps.googleusercontent.com')) {
    return {
      ok: false,
      reason: 'invalid-format',
      message: 'Client ID must end in .apps.googleusercontent.com',
      field: 'clientId',
    };
  }
  if (!clientSecret.startsWith('GOCSPX-')) {
    return {
      ok: false,
      reason: 'invalid-format',
      message:
        'Client Secret must start with "GOCSPX-" (and watch trailing hyphens — paste carefully)',
      field: 'clientSecret',
    };
  }
  if (refreshToken.length < 16) {
    return {
      ok: false,
      reason: 'invalid-format',
      message: 'Refresh Token is too short — re-mint via OAuth Playground',
      field: 'refreshToken',
    };
  }
  if (!scope.includes('gmail')) {
    return {
      ok: false,
      reason: 'invalid-format',
      message: 'Scope must include at least one Gmail scope',
      field: 'scope',
    };
  }

  try {
    await withTenant(asTenantId(user.tenantId), async (db) => {
      await setTenantCredential(db, asTenantId(user.tenantId), 'gmail', {
        clientId,
        clientSecret,
        refreshToken,
        scope,
      } satisfies GmailCredentials);
    });
    await auditCredentialAction(
      user,
      'credentials.set.gmail',
      {
        clientIdSuffix: clientId.split('-')[0],
        scope,
        refreshTokenLast4: refreshToken.slice(-4),
      },
      true,
    );
    return { ok: true, kind: 'gmail' };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'credentials-set', kind: 'gmail' },
    });
    await auditCredentialAction(
      user,
      'credentials.set.gmail',
      { failure: 'db-error' },
      false,
      err instanceof Error ? err.message : 'unknown',
    );
    return {
      ok: false,
      reason: 'db-error',
      message: err instanceof Error ? err.message : 'Database write failed',
    };
  }
}

// ────────────────────────────────────────────────────────────────
// DELETE — two-step confirmation via confirmToken.
// ────────────────────────────────────────────────────────────────

export async function deleteCredential(
  kind: CredentialKind,
  confirmToken: string,
): Promise<DeleteCredentialResult> {
  const user = await getCurrentDocketUser();
  if (!user) return { ok: false, reason: 'unauthenticated', message: 'Not signed in' };
  const gate = await authGate(`creds-delete:${user.clerkUserId}`);
  if (!gate.ok) return { ok: false, ...gate.err } as DeleteCredentialResult;

  // Two-step pattern: client must echo the kind back as the confirm
  // token. Prevents accidental deletion via stale form action with
  // the wrong kind. Not security against malicious client (the role
  // gate is) — UX safety against fat-finger.
  if (confirmToken !== `delete-${kind}`) {
    return {
      ok: false,
      reason: 'invalid-confirm-token',
      message: `Confirm token mismatch — expected "delete-${kind}"`,
    };
  }

  try {
    let existed = false;
    await withTenant(asTenantId(user.tenantId), async (db) => {
      const existing = await getTenantCredential(db, asTenantId(user.tenantId), kind);
      if (!existing) {
        existed = false;
        return;
      }
      existed = true;
      await deleteTenantCredential(db, asTenantId(user.tenantId), kind);
    });

    if (!existed) {
      return {
        ok: false,
        reason: 'not-configured',
        message: `${kind} credentials are not configured for this tenant`,
      };
    }

    await auditCredentialAction(user, `credentials.delete.${kind}`, { kind }, true);
    return { ok: true, kind };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'credentials-delete', kind },
    });
    await auditCredentialAction(
      user,
      `credentials.delete.${kind}`,
      { failure: 'db-error' },
      false,
      err instanceof Error ? err.message : 'unknown',
    );
    return {
      ok: false,
      reason: 'db-error',
      message: err instanceof Error ? err.message : 'Database delete failed',
    };
  }
}

// ────────────────────────────────────────────────────────────────
// TEST — runs the per-provider live API check.
// ────────────────────────────────────────────────────────────────

export async function testCredential(
  kind: CredentialKind,
): Promise<TestCredentialActionResult> {
  const user = await getCurrentDocketUser();
  if (!user) return { ok: false, reason: 'unauthenticated', message: 'Not signed in' };
  const gate = await authGate(`creds-test:${user.clerkUserId}`);
  if (!gate.ok) return { ok: false, ...gate.err } as TestCredentialActionResult;

  try {
    const result = await withTenant(asTenantId(user.tenantId), async (db) => {
      const cred = await getTenantCredential(db, asTenantId(user.tenantId), kind);
      if (!cred) return null;
      switch (kind) {
        case 'twilio':
          return await testTwilioCredential(cred as TwilioCredentials);
        case 'square':
          return await testSquareCredential(cred as SquareCredentials);
        case 'docusign':
          return await testDocuSignCredential(cred as DocusignCredentials);
        case 'gmail':
          return await testGmailCredential(cred as GmailCredentials);
      }
    });

    if (result === null) {
      return {
        ok: false,
        reason: 'not-configured',
        message: `${kind} credentials are not configured for this tenant`,
      };
    }

    await auditCredentialAction(
      user,
      `credentials.test.${kind}`,
      {
        kind,
        passed: result.ok,
        latencyMs: result.latencyMs,
        ...(result.ok ? {} : { failureReason: result.reason }),
      },
      result.ok,
      result.ok ? null : result.message,
    );
    return { ok: true, kind, test: result };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'credentials-test', kind },
    });
    return {
      ok: false,
      reason: 'db-error',
      message: err instanceof Error ? err.message : 'Test failed',
    };
  }
}
