// PII regex scrubber for inbound text channels.
//
// Per docs/MEMORY-ARCHITECTURE.md §8 ("PII regex scrub before vector
// indexing") and docs/PRODUCTION-READINESS.md §D (V1).
//
// Inbound SMS / email / portal-chat bodies feed this BEFORE the
// artifact gets fact-extracted or vector-indexed. Matched tokens are
// replaced with [REDACTED-<TYPE>] markers. The scrubbed text is what
// goes into embeddings + into prompts to Anthropic. The original
// plaintext is kept in `actions` (encrypted via per-tenant DEK) and
// never embedded.
//
// HOW THIS DIFFERS FROM sentry-scrubber.ts
//   sentry-scrubber.ts redacts BEFORE events leave our processes
//   (last-line defense for the error reporting pipeline).
//   pii-scrubber.ts redacts BEFORE the value reaches the embedding
//   model or the prompt. Both share the same regex shapes; the
//   long-term consolidation is a v1.5 follow-up where `PII_PATTERNS`
//   below becomes the shared registry both files import. For v1
//   the duplication is documented and kept narrow.
//
// PATTERNS
//   SSN: \b\d{3}-?\d{2}-?\d{4}\b
//     Matches 123-45-6789 (dashed) AND 123456789 (no dashes), with
//     word boundaries to avoid catching middle-of-token sequences.
//     Some false positives possible (any 9-digit number); accept as
//     defense-in-depth — better to over-scrub than leak.
//
//   EIN: \b\d{2}-\d{7}\b
//     Dash REQUIRED. Without the dash, EIN is ambiguous with invoice
//     numbers, phone components, etc. The IRS canonical format is
//     XX-XXXXXXX so we anchor on that.
//
//   BANK: context-required. Looks for a digit run preceded by
//     "account" / "acct" / "routing" + optional separator. Avoids
//     catching every 4-17-digit run in the wild (which would scrub
//     order numbers, invoice IDs, dates).
//
// OUT OF SCOPE for v1 (deferred to v1.5 in MEMORY-ARCHITECTURE §9)
//   - Driver license: state-specific patterns; needs config-driven
//     detector. ~50 different state formats.
//   - ITIN: format 9XX-7X-XXXX overlaps with SSN regex; partial
//     coverage already by SSN scrub.
//   - Credit card: 13-19 digits + Luhn checksum; PCI-DSS-flavored
//     surface that's its own scope.
//   - Passport / national ID for non-US clients.

/* eslint-disable security/detect-non-literal-regexp */

export type PIIType = 'SSN' | 'EIN' | 'BANK';

export interface PIIMatch {
  /** Which pattern matched. */
  type: PIIType;
  /**
   * 0-based offset of the match in the ORIGINAL (un-scrubbed) text,
   * measured in JS string code units (UTF-16). Not byte offsets in
   * the UTF-8 encoding — for ASCII text these coincide, but for
   * inputs containing astral characters they differ. Audit logging
   * + re-scanning the encrypted plaintext should both use string
   * indexing (`text.slice(start, end)`), not byte indexing.
   */
  start: number;
  /** Exclusive end offset (UTF-16 code units) in the original text. */
  end: number;
  /** end - start, in UTF-16 code units. */
  length: number;
}

export interface PIIScrubResult {
  /** Original text with each PII match replaced by its REDACTED marker. */
  scrubbed: string;
  /**
   * Match metadata sorted by start position (source order). Positions
   * reference the ORIGINAL text using JS string code-unit offsets
   * (see PIIMatch.start). Useful for audit logging without retaining
   * the value: log `{type, start, length}` to the actions table; the
   * encrypted plaintext (kept in messages.body or similar) can be
   * re-scanned if reconstruction is ever needed.
   */
  matches: PIIMatch[];
  /** Counts per type for quick metrics. */
  counts: Record<PIIType, number>;
}

// ────────────────────────────────────────────────────────────────
// Pattern registry. Exported so a v1.5 follow-up can consolidate
// with sentry-scrubber.ts. Each entry has a fresh-RegExp factory so
// callers don't accidentally share .lastIndex state across calls.
// ────────────────────────────────────────────────────────────────

export const PII_PATTERNS = {
  SSN: () => /\b\d{3}-?\d{2}-?\d{4}\b/g,
  EIN: () => /\b\d{2}-\d{7}\b/g,
  /**
   * Bank account / routing number with required preceding context.
   * Allows internal spaces and dashes so grouped formats redact
   * fully ("1234-5678-9012" rather than just "1234"). Total length
   * 8 to 30 chars, digit-bookended.
   *
   * Matches: "account number: 1234567890", "acct #1234567890",
   *          "routing 026009593", "a/c no 12345678",
   *          "account 1234-5678-9012", "account 1234 5678 9012"
   *
   * Misses (intentionally):
   *   - Standalone digit runs without the context word — accepting
   *     the false negative keeps the false-positive rate low.
   *   - Account numbers with 7 or fewer digits and no separators
   *     (rare; small-credit-union edge case).
   *
   * Side effect: dashed-SSN tokens following an account-context word
   * (e.g., "account 123-45-6789") get labeled BANK instead of SSN.
   * The value is still redacted; the label is less precise. Real
   * production text rarely contains "account <SSN>" by accident.
   */
  BANK: () =>
    /(?<=\b(?:account|acct|a\/c|routing)\s*(?:number|num|no|#)?\.?\s*[:#]?\s*)\d[\d\s\-]{6,28}\d/gi,
} as const satisfies Record<PIIType, () => RegExp>;

const MARKERS: Record<PIIType, string> = {
  SSN: '[REDACTED-SSN]',
  EIN: '[REDACTED-EIN]',
  BANK: '[REDACTED-BANK]',
};

// Order matters. BANK is context-anchored (lookbehind requires
// "account" / "acct" / "routing" / "a/c" preceding the digit run),
// so when context is present we want BANK to claim the bytes ahead
// of SSN's 9-digit no-dash variant. Without that, "routing
// 026009593" gets labeled SSN (a 9-digit no-dash run matches SSN's
// regex).
//
// SSN runs second: catches the dashed XXX-XX-XXXX shape and any
// remaining no-dash 9-digit runs that didn't have bank context.
//
// EIN runs last: dash-required XX-XXXXXXX. Won't collide with SSN
// (which is 3-2-4 dashed) or BANK (which has no dashes), so order
// of EIN relative to others doesn't matter much.
const SCAN_ORDER: PIIType[] = ['BANK', 'SSN', 'EIN'];

/**
 * Scan `text` for PII patterns and return scrubbed text + match
 * metadata. Pure function; no I/O, no side effects. Safe to call
 * from server actions, Inngest steps, browser bundles (no node-only
 * deps).
 *
 * Already-redacted text is idempotent: scrubbing twice produces the
 * same result the second time (markers don't match any pattern).
 *
 * @param text Inbound text. May be empty; multi-line; mixed content.
 * @returns Scrubbed text + match metadata + per-type counts.
 */
export function scrubPII(text: string): PIIScrubResult {
  const counts: Record<PIIType, number> = { SSN: 0, EIN: 0, BANK: 0 };

  if (text.length === 0) {
    return { scrubbed: '', matches: [], counts };
  }

  // Collect all matches against the ORIGINAL text in scan order
  // (BANK, SSN, EIN). Track which code-unit positions are already
  // claimed so later patterns don't double-count overlapping
  // sequences. Uint8Array is sized to text.length (code-unit count,
  // not byte count); each cell maps to one JS string position.
  const claimed = new Uint8Array(text.length);
  const matches: PIIMatch[] = [];

  for (const type of SCAN_ORDER) {
    const re = PII_PATTERNS[type]();
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;

      // Skip if any code-unit position in the range is already
      // claimed by a prior pattern. Boundary-strict — partial
      // overlap also skips.
      let overlaps = false;
      for (let i = start; i < end; i++) {
        if (claimed[i] === 1) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;

      for (let i = start; i < end; i++) claimed[i] = 1;

      matches.push({ type, start, end, length: end - start });
      counts[type]++;
    }
  }

  if (matches.length === 0) {
    return { scrubbed: text, matches: [], counts };
  }

  // Sort by source position. Used for both rebuilding the scrubbed
  // string AND for the returned matches array (consumers expect
  // source order, not scan order).
  matches.sort((a, b) => a.start - b.start);

  let out = '';
  let cursor = 0;
  for (const m of matches) {
    out += text.slice(cursor, m.start);
    out += MARKERS[m.type];
    cursor = m.end;
  }
  out += text.slice(cursor);

  return { scrubbed: out, matches, counts };
}

/**
 * Convenience: scrub and return only the scrubbed text (drop the
 * match metadata). For call sites that don't need to log to the
 * audit table.
 */
export function scrubPIIToText(text: string): string {
  return scrubPII(text).scrubbed;
}
