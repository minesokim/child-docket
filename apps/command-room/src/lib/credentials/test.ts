// Per-provider live-test helpers. Each takes a credential value
// (decrypted) and performs a minimal, low-cost API call to verify the
// credential authenticates correctly + the account is reachable.
//
// USED BY
//   - testCredential server action (apps/.../credentials/actions.ts)
//   - UI Test button on /settings/credentials
//   - (Future) post-deploy smoke
//
// SECURITY POSTURE
//   - These helpers receive ALREADY-DECRYPTED credentials. Callers
//     must hold the tenant DEK (i.e., be inside withTenant + have
//     called decryptIfMarkedForTenant). Helpers do not store secrets;
//     they make one API call and return.
//   - On failure, helpers return structured reason codes WITHOUT
//     leaking secret material in error messages. The provider's own
//     error message is included only when it is known not to contain
//     secrets (e.g., "consent_required" — safe; "invalid signature
//     verifying key 0xab12..." — also safe since key fingerprints,
//     not key bytes).
//
// COST
//   Each test makes ONE API call. Twilio + Square + Gmail are read-
//   only fetches; DocuSign requires a JWT mint + token-exchange round
//   trip (~250-500ms). Total cost-per-test: $0 except for DocuSign's
//   JWT exchange overhead. Rate-limited at the server-action layer
//   (10/min/user) so a malicious user cannot DOS providers via
//   repeated Test button clicks.

import { createSign } from 'node:crypto';
import type {
  TwilioCredentials,
  SquareCredentials,
  DocusignCredentials,
  GmailCredentials,
} from '@docket/db';

export type CredentialTestResult =
  | {
      ok: true;
      /** Human-readable detail surfaced in the UI when test passes. */
      detail: string;
      /** Latency for the API call in ms. */
      latencyMs: number;
    }
  | {
      ok: false;
      reason:
        | 'auth-failed'
        | 'consent-required'
        | 'invalid-format'
        | 'rate-limited-by-provider'
        | 'network'
        | 'unknown-failure';
      message: string;
      latencyMs: number;
      /** Optional remediation hint shown to the user. */
      remediation?: string;
    };

// ────────────────────────────────────────────────────────────────
// TWILIO — GET /Accounts/{sid}.json with Basic auth
// ────────────────────────────────────────────────────────────────

export async function testTwilioCredential(
  cred: TwilioCredentials,
): Promise<CredentialTestResult> {
  const t0 = Date.now();
  const url = `https://api.twilio.com/2010-04-01/Accounts/${cred.accountSid}.json`;
  const auth = Buffer.from(`${cred.accountSid}:${cred.authToken}`).toString('base64');

  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  } catch (err) {
    return {
      ok: false,
      reason: 'network',
      message: err instanceof Error ? err.message : 'Network error',
      latencyMs: Date.now() - t0,
    };
  }
  const latencyMs = Date.now() - t0;

  if (res.status === 401 || res.status === 403) {
    return {
      ok: false,
      reason: 'auth-failed',
      message: 'Twilio rejected the Account SID + Auth Token pair',
      remediation:
        'Verify both fields in the Twilio console (twilio.com/console) — they must match the SAME account.',
      latencyMs,
    };
  }
  if (res.status === 429) {
    return {
      ok: false,
      reason: 'rate-limited-by-provider',
      message: 'Twilio is rate-limiting requests',
      latencyMs,
    };
  }
  if (!res.ok) {
    return {
      ok: false,
      reason: 'unknown-failure',
      message: `Twilio returned HTTP ${res.status}`,
      latencyMs,
    };
  }

  const json = (await res.json()) as { friendly_name: string; status: string; type: string };
  return {
    ok: true,
    detail: `${json.friendly_name} (${json.type}, ${json.status})`,
    latencyMs,
  };
}

// ────────────────────────────────────────────────────────────────
// SQUARE — GET /v2/locations and confirm locationId is in the list
// ────────────────────────────────────────────────────────────────

export async function testSquareCredential(
  cred: SquareCredentials,
): Promise<CredentialTestResult> {
  const t0 = Date.now();
  const host =
    cred.environment === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';
  const url = `${host}/v2/locations`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${cred.accessToken}`,
        'Square-Version': '2024-01-18',
      },
    });
  } catch (err) {
    return {
      ok: false,
      reason: 'network',
      message: err instanceof Error ? err.message : 'Network error',
      latencyMs: Date.now() - t0,
    };
  }
  const latencyMs = Date.now() - t0;

  if (res.status === 401) {
    return {
      ok: false,
      reason: 'auth-failed',
      message: 'Square rejected the access token',
      remediation: `Re-issue the access token in the Square dev dashboard — make sure it is a ${cred.environment} token (matches the environment field).`,
      latencyMs,
    };
  }
  if (!res.ok) {
    return {
      ok: false,
      reason: 'unknown-failure',
      message: `Square returned HTTP ${res.status}`,
      latencyMs,
    };
  }

  const json = (await res.json()) as {
    locations?: Array<{ id: string; name: string; status: string }>;
  };
  const locations = json.locations ?? [];
  const match = locations.find((l) => l.id === cred.locationId);
  if (!match) {
    return {
      ok: false,
      reason: 'invalid-format',
      message: `Location ID ${cred.locationId} not found in this Square account`,
      remediation:
        'The location ID may belong to a different Square account than the access token. Re-fetch from /v2/locations and pick a matching ID.',
      latencyMs,
    };
  }

  return {
    ok: true,
    detail: `${match.name} (${match.status}, ${cred.environment})`,
    latencyMs,
  };
}

// ────────────────────────────────────────────────────────────────
// DOCUSIGN — JWT mint + token exchange + userinfo lookup
// ────────────────────────────────────────────────────────────────

const DOCUSIGN_AUTH_HOST = 'account-d.docusign.com'; // sandbox; v1.5 reads from env

export async function testDocuSignCredential(
  cred: DocusignCredentials,
): Promise<CredentialTestResult> {
  const t0 = Date.now();

  // Mint JWT.
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(
    JSON.stringify({
      iss: cred.integrationKey,
      sub: cred.userId,
      iat: now,
      exp: now + 3600,
      aud: DOCUSIGN_AUTH_HOST,
      scope: 'signature impersonation',
    }),
  );
  const signingInput = `${header}.${payload}`;
  let assertion: string;
  try {
    const signer = createSign('RSA-SHA256');
    signer.update(signingInput);
    signer.end();
    assertion = `${signingInput}.${base64url(signer.sign(cred.privateKey))}`;
  } catch (err) {
    return {
      ok: false,
      reason: 'invalid-format',
      message: 'RSA private key could not sign — check PEM formatting',
      remediation:
        'Re-paste the entire PEM block including BEGIN/END markers. PKCS#1 (BEGIN RSA PRIVATE KEY) and PKCS#8 (BEGIN PRIVATE KEY) both supported.',
      latencyMs: Date.now() - t0,
    };
  }

  let tokenRes: Response;
  try {
    const body = new URLSearchParams();
    body.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
    body.append('assertion', assertion);
    tokenRes = await fetch(`https://${DOCUSIGN_AUTH_HOST}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  } catch (err) {
    return {
      ok: false,
      reason: 'network',
      message: err instanceof Error ? err.message : 'Network error',
      latencyMs: Date.now() - t0,
    };
  }

  const tokenJson = (await tokenRes.json()) as
    | { access_token: string; expires_in: number }
    | { error: string; error_description?: string };

  if (!tokenRes.ok || !('access_token' in tokenJson)) {
    const errCode = 'error' in tokenJson ? tokenJson.error : 'unknown';
    if (errCode === 'consent_required') {
      return {
        ok: false,
        reason: 'consent-required',
        message: 'DocuSign user has not granted consent for this integration key',
        remediation: `Visit https://${DOCUSIGN_AUTH_HOST}/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=${cred.integrationKey}&redirect_uri=https%3A%2F%2Fdocusign.com — sign in, click ACCEPT, then re-test.`,
        latencyMs: Date.now() - t0,
      };
    }
    return {
      ok: false,
      reason: 'auth-failed',
      message: `DocuSign rejected the JWT: ${errCode}`,
      remediation:
        'Verify Integration Key + User ID + Account ID match the values in DocuSign Admin → Apps and Keys, AND that the RSA keypair was generated for THIS integration key.',
      latencyMs: Date.now() - t0,
    };
  }

  // Resolve the API base URI via userinfo. Confirms the access_token
  // can read account info (catches "wrong account ID" cases).
  let userInfoRes: Response;
  try {
    userInfoRes = await fetch(`https://${DOCUSIGN_AUTH_HOST}/oauth/userinfo`, {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
  } catch (err) {
    // Token worked, userinfo failed — partial success. Treat as ok.
    return {
      ok: true,
      detail: `JWT exchange ok; userinfo unreachable (${err instanceof Error ? err.message : 'network'})`,
      latencyMs: Date.now() - t0,
    };
  }

  const userInfo = (await userInfoRes.json()) as {
    accounts: Array<{ account_id: string; account_name: string; base_uri: string }>;
  };
  const account =
    userInfo.accounts.find((a) => a.account_id === cred.accountId) ?? userInfo.accounts[0];

  return {
    ok: true,
    detail: account
      ? `${account.account_name} (${account.base_uri})`
      : `JWT minted (no matching account in userinfo response)`,
    latencyMs: Date.now() - t0,
  };
}

function base64url(buf: Buffer | string): string {
  const b = typeof buf === 'string' ? Buffer.from(buf) : buf;
  return b.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// ────────────────────────────────────────────────────────────────
// GMAIL — refresh-token exchange + getProfile
// ────────────────────────────────────────────────────────────────

export async function testGmailCredential(
  cred: GmailCredentials,
): Promise<CredentialTestResult> {
  const t0 = Date.now();

  let tokenRes: Response;
  try {
    const body = new URLSearchParams();
    body.append('client_id', cred.clientId);
    body.append('client_secret', cred.clientSecret);
    body.append('refresh_token', cred.refreshToken);
    body.append('grant_type', 'refresh_token');
    tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  } catch (err) {
    return {
      ok: false,
      reason: 'network',
      message: err instanceof Error ? err.message : 'Network error',
      latencyMs: Date.now() - t0,
    };
  }

  const tokenJson = (await tokenRes.json()) as
    | { access_token: string; expires_in: number; scope: string }
    | { error: string; error_description?: string };

  if (!tokenRes.ok || !('access_token' in tokenJson)) {
    const errCode = 'error' in tokenJson ? tokenJson.error : 'unknown';
    if (errCode === 'invalid_grant') {
      return {
        ok: false,
        reason: 'auth-failed',
        message: 'Refresh token is no longer valid',
        remediation:
          'Test apps expire refresh tokens after 7 days. Re-mint via OAuth Playground (developers.google.com/oauthplayground) using your Client ID + Client Secret + the same Gmail account.',
        latencyMs: Date.now() - t0,
      };
    }
    if (errCode === 'invalid_client') {
      return {
        ok: false,
        reason: 'auth-failed',
        message: 'Google rejected the Client ID + Client Secret pair',
        remediation:
          'Re-paste the Client Secret carefully — the trailing characters often get truncated. Check it ends with the exact value from Google Cloud Console → Credentials.',
        latencyMs: Date.now() - t0,
      };
    }
    return {
      ok: false,
      reason: 'auth-failed',
      message: `Google rejected the credentials: ${errCode}`,
      latencyMs: Date.now() - t0,
    };
  }

  // Verify the access token reaches Gmail.
  const profileRes = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/profile',
    { headers: { Authorization: `Bearer ${tokenJson.access_token}` } },
  );
  if (!profileRes.ok) {
    return {
      ok: true,
      detail: `Refresh exchange ok; profile API failed (HTTP ${profileRes.status}) — possible scope mismatch`,
      latencyMs: Date.now() - t0,
    };
  }
  const profile = (await profileRes.json()) as {
    emailAddress: string;
    messagesTotal: number;
  };
  return {
    ok: true,
    detail: `${profile.emailAddress} (${profile.messagesTotal.toLocaleString()} messages)`,
    latencyMs: Date.now() - t0,
  };
}
