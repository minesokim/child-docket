// Gmail API client — minimal wrapper for the Inngest cron + per-message
// classifier. Three primitives:
//
//   mintAccessToken(refreshToken, clientId, clientSecret)
//     → POST oauth2.googleapis.com/token (refresh_token grant)
//     → returns { accessToken, expiresIn }
//
//   gmailHistoryList(accessToken, startHistoryId)
//     → GET /gmail/v1/users/me/history?startHistoryId=...
//     → returns { messageIds, nextHistoryId, status }
//     → status='ok' | 'history-too-old' (caller bootstraps via getProfile)
//
//   gmailGetMessage(accessToken, messageId)
//     → GET /gmail/v1/users/me/messages/{id}?format=full
//     → returns { from, to, subject, bodyText, receivedAt, historyId }
//
// SECURITY POSTURE
//   These helpers receive ALREADY-DECRYPTED credentials (caller holds the
//   tenant DEK). Helpers do not log secrets; on failure the message is
//   structured (auth-failed | rate-limited | network | unknown) without
//   leaking refresh-token bytes or access-token bytes back through error
//   messages.
//
// COST
//   Free at any reasonable Gmail volume (millions of API units/day per
//   project quota). The cron polls every 10 min × ~6 calls/tenant = ~36
//   units/tenant/hour. Antonio's project quota: 1B units/day. Headroom.

const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

// ────────────────────────────────────────────────────────────────
// Result shapes
// ────────────────────────────────────────────────────────────────

export type MintTokenResult =
  | { ok: true; accessToken: string; expiresInSec: number }
  | {
      ok: false;
      reason: 'auth-failed' | 'rate-limited' | 'network' | 'unknown';
      message: string;
    };

export type HistoryListResult =
  | {
      ok: true;
      status: 'ok';
      messageIds: Array<{ id: string; threadId: string }>;
      nextHistoryId: string | null;
    }
  | {
      ok: true;
      status: 'history-too-old';
      messageIds: never[];
      nextHistoryId: null;
    }
  | {
      ok: false;
      reason: 'auth-failed' | 'rate-limited' | 'network' | 'unknown';
      message: string;
    };

export interface GmailMessage {
  id: string;
  threadId: string;
  historyId: string;
  from: string;
  to: string[];
  subject: string | null;
  bodyText: string;
  receivedAt: string; // ISO timestamp
  /** Internal Gmail labels — useful for skipping SENT/DRAFT/SPAM. */
  labels: string[];
}

export type GetMessageResult =
  | { ok: true; message: GmailMessage }
  | {
      ok: false;
      reason: 'auth-failed' | 'rate-limited' | 'not-found' | 'network' | 'unknown';
      message: string;
    };

// ────────────────────────────────────────────────────────────────
// mintAccessToken — refresh-token exchange
// ────────────────────────────────────────────────────────────────

export async function mintAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<MintTokenResult> {
  const formData = new URLSearchParams();
  formData.append('client_id', clientId);
  formData.append('client_secret', clientSecret);
  formData.append('refresh_token', refreshToken);
  formData.append('grant_type', 'refresh_token');

  let res: Response;
  try {
    res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });
  } catch (err) {
    return {
      ok: false,
      reason: 'network',
      message: err instanceof Error ? err.message : 'fetch failed',
    };
  }

  if (res.status === 429) {
    return {
      ok: false,
      reason: 'rate-limited',
      message: 'Google token endpoint returned 429',
    };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return {
      ok: false,
      reason: 'unknown',
      message: `Token endpoint returned non-JSON body (HTTP ${res.status})`,
    };
  }

  if (!res.ok || typeof body !== 'object' || body === null || !('access_token' in body)) {
    const errCode =
      typeof body === 'object' && body !== null && 'error' in body
        ? String((body as Record<string, unknown>).error)
        : `http_${res.status}`;
    // invalid_grant = refresh token revoked or expired (test apps: 7-day limit)
    // invalid_client = clientId/clientSecret mismatch
    return {
      ok: false,
      reason: 'auth-failed',
      message: `Refresh-token exchange failed: ${errCode}`,
    };
  }

  const data = body as { access_token: string; expires_in: number };
  return {
    ok: true,
    accessToken: data.access_token,
    expiresInSec: data.expires_in,
  };
}

// ────────────────────────────────────────────────────────────────
// gmailHistoryList — fetch new messages since cursor
// ────────────────────────────────────────────────────────────────

export async function gmailHistoryList(
  accessToken: string,
  startHistoryId: string,
): Promise<HistoryListResult> {
  // historyTypes=messageAdded filters to inbound messages only (skip
  // labelAdded/labelRemoved/messageDeleted for the v1 scope).
  const url =
    `${GMAIL_API_BASE}/history?startHistoryId=${encodeURIComponent(startHistoryId)}` +
    `&historyTypes=messageAdded`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (err) {
    return {
      ok: false,
      reason: 'network',
      message: err instanceof Error ? err.message : 'fetch failed',
    };
  }

  if (res.status === 401 || res.status === 403) {
    return { ok: false, reason: 'auth-failed', message: `history.list HTTP ${res.status}` };
  }
  if (res.status === 429) {
    return { ok: false, reason: 'rate-limited', message: 'history.list 429' };
  }
  // Gmail returns 404 when startHistoryId is older than ~7 days (history
  // record has aged out). Caller's recovery is to bootstrap from current
  // historyId via getProfile. Surface as a distinct OK status so the
  // poll function treats it as a recoverable state, not a failure.
  if (res.status === 404) {
    return { ok: true, status: 'history-too-old', messageIds: [], nextHistoryId: null };
  }
  if (!res.ok) {
    return {
      ok: false,
      reason: 'unknown',
      message: `history.list HTTP ${res.status}`,
    };
  }

  const body = (await res.json()) as {
    history?: Array<{
      messages?: Array<{ id: string; threadId: string }>;
      messagesAdded?: Array<{
        message: { id: string; threadId: string; labelIds?: string[] };
      }>;
    }>;
    historyId?: string;
  };

  const messageIds: Array<{ id: string; threadId: string }> = [];
  const seen = new Set<string>();
  for (const h of body.history ?? []) {
    // Newer Gmail responses use messagesAdded with labelIds; older
    // responses just use messages. Handle both for safety.
    for (const ma of h.messagesAdded ?? []) {
      if (!seen.has(ma.message.id)) {
        seen.add(ma.message.id);
        messageIds.push({ id: ma.message.id, threadId: ma.message.threadId });
      }
    }
    for (const m of h.messages ?? []) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        messageIds.push({ id: m.id, threadId: m.threadId });
      }
    }
  }

  return {
    ok: true,
    status: 'ok',
    messageIds,
    nextHistoryId: body.historyId ?? null,
  };
}

// ────────────────────────────────────────────────────────────────
// gmailGetCurrentHistoryId — bootstrap the cursor on first sync
// or after history-too-old. Calls getProfile (cheapest API hit).
// ────────────────────────────────────────────────────────────────

export async function gmailGetCurrentHistoryId(
  accessToken: string,
): Promise<{ ok: true; historyId: string } | { ok: false; reason: string; message: string }> {
  let res: Response;
  try {
    res = await fetch(`${GMAIL_API_BASE}/profile`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (err) {
    return {
      ok: false,
      reason: 'network',
      message: err instanceof Error ? err.message : 'fetch failed',
    };
  }
  if (!res.ok) {
    return {
      ok: false,
      reason: res.status === 401 || res.status === 403 ? 'auth-failed' : 'unknown',
      message: `getProfile HTTP ${res.status}`,
    };
  }
  const body = (await res.json()) as { historyId?: string };
  if (!body.historyId) {
    return { ok: false, reason: 'unknown', message: 'getProfile missing historyId' };
  }
  return { ok: true, historyId: body.historyId };
}

// ────────────────────────────────────────────────────────────────
// gmailGetMessage — full message fetch + parse
// ────────────────────────────────────────────────────────────────

const MAX_BODY_BYTES = 30_000;

export async function gmailGetMessage(
  accessToken: string,
  messageId: string,
): Promise<GetMessageResult> {
  // format=full returns headers + payload tree. Alternative is metadata
  // + raw fetch for body, but that's more API hops. Full is fine for
  // v1 volume (Antonio's mailbox: ~2000 inbound/month).
  const url = `${GMAIL_API_BASE}/messages/${encodeURIComponent(messageId)}?format=full`;

  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  } catch (err) {
    return {
      ok: false,
      reason: 'network',
      message: err instanceof Error ? err.message : 'fetch failed',
    };
  }
  if (res.status === 401 || res.status === 403) {
    return { ok: false, reason: 'auth-failed', message: `messages.get HTTP ${res.status}` };
  }
  if (res.status === 404) {
    // Message deleted between history.list and messages.get — treat as
    // a soft skip (the cron will not retry; Inngest retries handle
    // transient errors but a 404 is permanent for this messageId).
    return { ok: false, reason: 'not-found', message: 'message no longer exists' };
  }
  if (res.status === 429) {
    return { ok: false, reason: 'rate-limited', message: 'messages.get 429' };
  }
  if (!res.ok) {
    return {
      ok: false,
      reason: 'unknown',
      message: `messages.get HTTP ${res.status}`,
    };
  }

  const raw = (await res.json()) as GmailMessageRaw;

  // Extract headers as a map for case-insensitive lookup.
  const headers = new Map<string, string>();
  for (const h of raw.payload?.headers ?? []) {
    headers.set(h.name.toLowerCase(), h.value);
  }
  const fromHeader = headers.get('from') ?? '';
  const toHeader = headers.get('to') ?? '';
  const subject = headers.get('subject') ?? null;

  // receivedAt: prefer "Date" header (when sender sent it); fall back
  // to internalDate (when Gmail received it). internalDate is ms epoch
  // as a string, per Gmail API.
  let receivedAt: string;
  const dateHeader = headers.get('date');
  if (dateHeader) {
    const parsed = new Date(dateHeader);
    receivedAt = isNaN(parsed.getTime()) ? new Date(Number(raw.internalDate)).toISOString() : parsed.toISOString();
  } else {
    receivedAt = new Date(Number(raw.internalDate)).toISOString();
  }

  // Body: walk payload tree, prefer text/plain, fall back to text/html
  // stripped of tags. Truncate to MAX_BODY_BYTES — long messages get
  // snipped to keep model cost predictable + scrubPII bounded.
  let bodyText = extractTextFromPayload(raw.payload).trim();
  if (bodyText.length > MAX_BODY_BYTES) {
    bodyText = bodyText.slice(0, MAX_BODY_BYTES) + '\n\n[…truncated, original was larger]';
  }

  // Parse to-header into array. Real-world to-fields can be
  // "Name <email>, Other <email>" or just "email, email". Split on
  // commas, then extract emails inside angle brackets if present.
  const to = toHeader
    .split(/,(?![^<]*>)/) // split on comma not inside <...>
    .map((s) => s.trim())
    .map((s) => {
      const m = s.match(/<([^>]+)>/);
      // m[1] is guaranteed by the regex (one capture group) when m is truthy.
      return (m && m[1] ? m[1] : s).trim();
    })
    .filter((s) => s.length > 0);

  return {
    ok: true,
    message: {
      id: raw.id,
      threadId: raw.threadId,
      historyId: raw.historyId,
      from: extractEmail(fromHeader),
      to,
      subject,
      bodyText,
      receivedAt,
      labels: raw.labelIds ?? [],
    },
  };
}

// ────────────────────────────────────────────────────────────────
// Internal: payload tree walker. Gmail messages are MIME trees;
// we want the most-likely "what the user wrote" surface. Preference:
// text/plain > text/html (stripped) > whatever is leftmost.
// ────────────────────────────────────────────────────────────────

interface GmailMessageRaw {
  id: string;
  threadId: string;
  historyId: string;
  internalDate: string;
  labelIds?: string[];
  payload?: GmailPayloadPart;
}

interface GmailPayloadPart {
  mimeType?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: { data?: string; size?: number };
  parts?: GmailPayloadPart[];
}

function extractTextFromPayload(payload: GmailPayloadPart | undefined): string {
  if (!payload) return '';

  // Prefer text/plain
  const plain = findFirstPart(payload, 'text/plain');
  if (plain?.body?.data) {
    return decodeBase64Url(plain.body.data);
  }

  // Fall back to text/html, strip tags
  const html = findFirstPart(payload, 'text/html');
  if (html?.body?.data) {
    return stripHtmlTags(decodeBase64Url(html.body.data));
  }

  // Last resort: top-level body
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  // Attachment-only message (PDF/image with no text body) — common
  // for EA workflow (signed 8879 PDFs, scanned 1099s). v1 returns
  // empty here; the triage-classifier sees subject + from but no
  // body. FOLLOWUP: add an "attachment-only" signal that triggers
  // the doc-classifier pipeline against attachment payloads (parts
  // with mimeType=application/pdf or image/*). Tracked as
  // PRODUCTION-READINESS gap; not load-bearing for v0 cohort.
  return '';
}

function findFirstPart(
  part: GmailPayloadPart,
  mimeType: string,
): GmailPayloadPart | null {
  if (part.mimeType === mimeType && part.body?.data) {
    return part;
  }
  for (const child of part.parts ?? []) {
    const found = findFirstPart(child, mimeType);
    if (found) return found;
  }
  return null;
}

function decodeBase64Url(data: string): string {
  // Gmail uses URL-safe base64 with optional missing padding.
  const padded = data.replace(/-/g, '+').replace(/_/g, '/');
  const buf = Buffer.from(padded, 'base64');
  return buf.toString('utf8');
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractEmail(fromHeader: string): string {
  // "Name <email@host>" → "email@host"; bare "email@host" → "email@host".
  const m = fromHeader.match(/<([^>]+)>/);
  return (m && m[1] ? m[1] : fromHeader).trim();
}

// In-step backoff helper deliberately omitted: callers throw on
// transient errors (network, rate-limited, unknown), and Inngest's
// outer retry layer (3x with exponential backoff) handles those at
// the function level. Adding a second backoff layer inside step.run
// would re-execute side effects and double-count cost.
