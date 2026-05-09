// DocuSign JWT auth — Node-crypto-only minting + token exchange.
//
// Per DocuSign's JWT user-app flow:
//   https://developers.docusign.com/platform/auth/jwt-get-token/
//
// We avoid the `jose` dep by using Node's built-in
// crypto.createSign('RSA-SHA256') for the RS256 signature. Same
// algorithm DocuSign requires; ~30 lines of code vs adding a
// dependency for one signing operation.
//
// FLOW
//   1. Build header { alg: 'RS256', typ: 'JWT' }
//   2. Build payload { iss, sub, iat, exp, aud, scope }
//   3. base64url(header) + '.' + base64url(payload) = signing input
//   4. RSA-SHA256 sign with the firm's private key
//   5. base64url(signature) appended -> assertion
//   6. POST oauth/token with assertion + grant_type
//   7. Receive access_token (1-hour TTL); cache in-process is OK
//      since each Vercel lambda is short-lived

import { createSign } from 'node:crypto';

const TOKEN_TTL_SEC = 3600; // 1h — DocuSign caps user-app JWTs at this

export interface DocuSignJwtInput {
  /** integration_key from creds (acts as JWT issuer). */
  integrationKey: string;
  /** user_id GUID for the impersonated user (JWT subject). */
  userId: string;
  /** RSA private key (PEM string with BEGIN/END markers). */
  privateKey: string;
  /** 'account-d.docusign.com' for sandbox, 'account.docusign.com' for prod. */
  authHost: string;
}

export type DocuSignTokenResult =
  | {
      ok: true;
      accessToken: string;
      expiresAt: number;
      apiBaseUri: string;
    }
  | {
      ok: false;
      reason: 'sign-failed' | 'token-exchange-failed' | 'consent-required' | 'network';
      message: string;
      docusignErrorCode?: string;
    };

function base64url(buf: Buffer | string): string {
  const b = typeof buf === 'string' ? Buffer.from(buf) : buf;
  return b.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function buildAssertion(input: DocuSignJwtInput): string {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(
    JSON.stringify({
      iss: input.integrationKey,
      sub: input.userId,
      iat: now,
      exp: now + TOKEN_TTL_SEC,
      aud: input.authHost,
      scope: 'signature impersonation',
    }),
  );
  const signingInput = `${header}.${payload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = base64url(signer.sign(input.privateKey));
  return `${signingInput}.${signature}`;
}

/**
 * Exchange a JWT assertion for a DocuSign user-app access token.
 * Returns the access_token + the API base URI for subsequent
 * envelope/recipient calls.
 *
 * Failure modes:
 *   - consent-required: the firm hasn't granted the integration
 *     key user-impersonation consent. They visit a consent URL
 *     once; subsequent token requests succeed.
 *   - sign-failed: private key is malformed (caught at sign step)
 *   - token-exchange-failed: DocuSign returned a non-200
 *   - network: fetch threw
 */
export async function getDocuSignAccessToken(
  input: DocuSignJwtInput,
): Promise<DocuSignTokenResult> {
  let assertion: string;
  try {
    assertion = buildAssertion(input);
  } catch (err) {
    return {
      ok: false,
      reason: 'sign-failed',
      message: err instanceof Error ? err.message : 'JWT sign failed',
    };
  }

  const tokenUrl = `https://${input.authHost}/oauth/token`;
  const body = new URLSearchParams();
  body.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  body.append('assertion', assertion);

  let res: Response;
  try {
    res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  } catch (err) {
    return {
      ok: false,
      reason: 'network',
      message: err instanceof Error ? err.message : 'Network error',
    };
  }

  const json = (await res.json()) as
    | { access_token: string; expires_in: number; token_type: string }
    | { error: string; error_description?: string };

  if (!res.ok || !('access_token' in json)) {
    const errCode = 'error' in json ? json.error : 'unknown';
    if (errCode === 'consent_required') {
      return {
        ok: false,
        reason: 'consent-required',
        message:
          'DocuSign integration key requires user-impersonation consent. Visit ' +
          `https://${input.authHost}/oauth/auth?response_type=code&scope=signature impersonation&client_id=${input.integrationKey}&redirect_uri=https://docusign.com to grant.`,
        docusignErrorCode: errCode,
      };
    }
    return {
      ok: false,
      reason: 'token-exchange-failed',
      message:
        'error_description' in json && json.error_description
          ? json.error_description
          : `DocuSign returned ${res.status}: ${errCode}`,
      docusignErrorCode: errCode,
    };
  }

  // The userinfo endpoint tells us which DocuSign API host this
  // account uses (eu / na2 / na3 / na4 / demo). Required for
  // subsequent envelope calls.
  const userInfoRes = await fetch(`https://${input.authHost}/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${json.access_token}` },
  });
  const userInfo = (await userInfoRes.json()) as {
    accounts: Array<{
      account_id: string;
      base_uri: string;
      is_default: boolean;
    }>;
  };
  const account =
    userInfo.accounts.find((a) => a.is_default) ?? userInfo.accounts[0];
  const apiBaseUri = account?.base_uri ?? 'https://demo.docusign.net';

  return {
    ok: true,
    accessToken: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
    apiBaseUri,
  };
}
