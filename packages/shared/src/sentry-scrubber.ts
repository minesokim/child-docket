// Sentry beforeSend PII scrubber.
//
// Defense-in-depth: even though the rest of the app is supposed to never
// pass PII to Sentry (intake-actions only logs the path being written, not
// the value), this is the last gate before events leave our servers.
//
// What it catches:
//   1. PII REGEX in any string field (SSN, EIN, email, phone) — replaced
//      with [REDACTED-<KIND>]
//   2. Sensitive-LOOKING field NAMES (ssn / ein / password / token / etc.)
//      — entire value replaced with [REDACTED-FIELD] regardless of content
//
// Walks: event.message, exception messages, breadcrumb data + messages,
// request body/query, extra, contexts. Recurses into nested objects/arrays.

// Structural type for the parts of a Sentry event we walk. Wider than
// the actual Sentry types in places where Sentry uses `T | null | undefined`
// — we accept null too so the structural match holds. Avoids a hard dep on
// `@sentry/types` so this package stays lean.
type ScrubbableEvent = {
  message?: string | null;
  exception?: { values?: Array<{ value?: string | null }> | undefined } | undefined;
  breadcrumbs?:
    | Array<{ message?: string | null; data?: Record<string, unknown> | undefined }>
    | undefined;
  request?: {
    data?: unknown;
    query_string?: unknown;
    cookies?: unknown;
    headers?: Record<string, string> | undefined;
  };
  extra?: Record<string, unknown> | undefined;
  contexts?: Record<string, unknown> | undefined;
  user?: { ip_address?: string | null; email?: string | null } | undefined | null;
};

// ────────────────────────────────────────────────────────────────
// Pattern-based scrubbing — substring redaction inside strings.
// ────────────────────────────────────────────────────────────────

const PII_PATTERNS: ReadonlyArray<{ regex: RegExp; redact: string }> = [
  // SSN: 9 digits with optional dashes (XXX-XX-XXXX or XXXXXXXXX). Word
  // boundaries on both sides to avoid false-positives inside larger numbers.
  { regex: /\b\d{3}-?\d{2}-?\d{4}\b/g, redact: '[REDACTED-SSN]' },
  // EIN: dash REQUIRED (XX-XXXXXXX). The SSN pattern above catches the
  // no-dash 9-digit variant first; both label as redacted, just under
  // a different marker. Same dash-required shape as
  // `pii-scrubber.ts` PII_PATTERNS.EIN.
  { regex: /\b\d{2}-\d{7}\b/g, redact: '[REDACTED-EIN]' },
  // Email — case-insensitive standard pattern.
  { regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, redact: '[REDACTED-EMAIL]' },
  // US-format phone numbers — handles `(951) 555-0234`, `951-555-0234`,
  // `9515550234`, `+1 951 555 0234`, `1-800-555-0234`. The country-code
  // group is its own optional unit so the regex doesn't accidentally
  // consume a leading separator (space, etc.) that was just whitespace.
  // Catches standalone 10-digit numbers too — intentional over-redaction
  // for defense in depth.
  {
    regex: /(?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}/g,
    redact: '[REDACTED-PHONE]',
  },
];

function scrubString(input: string): string {
  let out = input;
  for (const { regex, redact } of PII_PATTERNS) {
    out = out.replace(regex, redact);
  }
  return out;
}

// ────────────────────────────────────────────────────────────────
// Field-name-based scrubbing — redact whole values when the key name
// suggests sensitive content. Fires REGARDLESS of the value's contents
// (so numeric SSNs that bypass the string scrubber still get caught).
// ────────────────────────────────────────────────────────────────

const SENSITIVE_KEY = /^(ssn|ein|password|secret|token|api[_-]?key|bank[_-]?routing|bank[_-]?account|routing|account[_-]?number|owner[_-]?ssn|stripe[_-]?secret|clerk[_-]?secret|pii[_-]?encryption[_-]?key)$/i;

function deepScrub(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === 'string') return scrubString(value);
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(deepScrub);

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(k)) {
      out[k] = '[REDACTED-FIELD]';
    } else {
      out[k] = deepScrub(v);
    }
  }
  return out;
}

// ────────────────────────────────────────────────────────────────
// Public API — Sentry's beforeSend hook signature.
// ────────────────────────────────────────────────────────────────

/**
 * Sentry beforeSend handler. Mutates the event in place and returns it.
 * Returning `null` would drop the event entirely; we never want that —
 * we want the event captured but with PII scrubbed.
 *
 * Generic over T so callers can pass in Sentry's ErrorEvent or
 * TransactionEvent and get the same type back. Structural typing ensures
 * any object with the walked-over fields works.
 */
export function scrubEvent<T extends ScrubbableEvent>(event: T, _hint?: unknown): T {
  if (event.message) {
    event.message = scrubString(event.message);
  }
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value) ex.value = scrubString(ex.value);
    }
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b) => ({
      ...b,
      message: b.message ? scrubString(b.message) : b.message,
      data: b.data ? (deepScrub(b.data) as Record<string, unknown>) : b.data,
    }));
  }
  if (event.request) {
    if (event.request.data !== undefined) {
      event.request.data = deepScrub(event.request.data);
    }
    if (event.request.query_string) {
      event.request.query_string =
        typeof event.request.query_string === 'string'
          ? scrubString(event.request.query_string)
          : event.request.query_string;
    }
    if (event.request.cookies) {
      // Cookies can hold session tokens / auth bits. Redact the whole jar.
      event.request.cookies = '[REDACTED-COOKIES]' as never;
    }
    if (event.request.headers) {
      const h = event.request.headers as Record<string, string>;
      // Authorization / cookie headers are sensitive even if Sentry's
      // default filter usually catches them.
      for (const k of Object.keys(h)) {
        if (/authorization|cookie|x-api-key/i.test(k)) {
          h[k] = '[REDACTED]';
        }
      }
    }
  }
  if (event.extra) {
    event.extra = deepScrub(event.extra) as Record<string, unknown>;
  }
  if (event.contexts) {
    event.contexts = deepScrub(event.contexts) as never;
  }
  // user.ip_address / user.email could leak even though sendDefaultPii
  // is false — defense in depth.
  if (event.user) {
    if ('ip_address' in event.user) event.user.ip_address = '[REDACTED]';
    if ('email' in event.user && event.user.email) event.user.email = '[REDACTED]';
  }
  return event;
}
