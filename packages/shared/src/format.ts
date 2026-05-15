// Input-format helpers used across intake pages.
//
// Every numeric / $ / count field needs strict digit-only filtering at the
// onChange boundary. Without it, users can paste arbitrary text into "EIN"
// and end up with `23234234234234234234asdfgsdfgsdfg` in the form state.
// The Zod schema would reject the value at the server boundary, but the
// UI accepts it and gives no feedback — bad UX, bad correctness.
//
// Pattern: each formatter takes a RAW user-typed value and returns the
// SHAPED value to put back into the controlled input. Filtering happens
// in the formatter, not somewhere downstream — what the user sees on
// screen is exactly what got saved.

// ────────────────────────────────────────────────────────────────
// EIN — XX-XXXXXXX (9 digits with auto-inserted dash after the 2nd).
// Pasted text gets all non-digits stripped before formatting.
// ────────────────────────────────────────────────────────────────

export function formatEin(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 9);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}-${d.slice(2)}`;
}

// ────────────────────────────────────────────────────────────────
// Money — `$50,000`. Strips non-digits, formats with comma-grouped
// thousands. Empty input stays empty (avoids showing a lone `$`).
// ────────────────────────────────────────────────────────────────

export function formatMoney(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (!d) return '';
  // parseInt on a digit-string of arbitrary length is safe up to
  // Number.MAX_SAFE_INTEGER (~9 quadrillion). Tax dollar amounts
  // never approach that.
  const n = parseInt(d, 10);
  if (Number.isNaN(n)) return '';
  return `$${n.toLocaleString('en-US')}`;
}

// ────────────────────────────────────────────────────────────────
// Plain digit count — N digits with a max-length cap.
// Used for: months, employees, owner count, ownership %, etc.
// ────────────────────────────────────────────────────────────────

export function formatDigits(raw: string, maxLen: number): string {
  return raw.replace(/\D/g, '').slice(0, maxLen);
}

// ────────────────────────────────────────────────────────────────
// 4-digit year — YYYY. Used for "year acquired" on rentals.
// ────────────────────────────────────────────────────────────────

export function formatYear(raw: string): string {
  return formatDigits(raw, 4);
}

// ────────────────────────────────────────────────────────────────
// ZIP code — 5 digits (or 9 with optional dash, but v0 captures 5).
// ────────────────────────────────────────────────────────────────

export function formatZip(raw: string): string {
  return formatDigits(raw, 5);
}

// ────────────────────────────────────────────────────────────────
// 2-letter state code — uppercase, max 2 letters.
// ────────────────────────────────────────────────────────────────

export function formatStateCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
}

// ────────────────────────────────────────────────────────────────
// State code → full name expansion + reverse lookup.
//
// Antonio's intake feedback (2026-05-14): when a client types "CA" in
// the state field, autofill "California". This helper is the
// canonical mapping; `expandStateCode` does the autofill, `compactState
// Name` does the reverse (for fields that store 2-letter codes but
// accept either form).
//
// Includes 50 states + DC + 5 US territories (PR, GU, VI, AS, MP).
// Covers every state-of-residence the IRS recognizes for tax filing.
// ────────────────────────────────────────────────────────────────

export const US_STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia',
  PR: 'Puerto Rico', GU: 'Guam', VI: 'U.S. Virgin Islands', AS: 'American Samoa',
  MP: 'Northern Mariana Islands',
};

// Reverse map: lowercase full name → 2-letter code. Computed once at
// module load. Lowercased for case-insensitive matching.
const STATE_NAME_TO_CODE: Record<string, string> = Object.entries(US_STATES).reduce(
  (acc, [code, name]) => {
    acc[name.toLowerCase()] = code;
    return acc;
  },
  {} as Record<string, string>,
);

/**
 * Expand a 2-letter state code to its full name.
 *
 * - "CA" → "California"
 * - "ca" → "California" (case-insensitive)
 * - "California" → "California" (already expanded; returns unchanged)
 * - "Calif" → "Calif" (not a 2-letter code, not an exact name match — unchanged)
 * - "XX" → "XX" (unknown code — unchanged so the user can fix the typo)
 *
 * Safe to call on every blur. Idempotent: expandStateCode(expandStateCode(x)) === expandStateCode(x).
 */
export function expandStateCode(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) return input;
  // Try exact 2-letter code first (uppercase, alpha-only).
  const upper = trimmed.toUpperCase().replace(/[^A-Z]/g, '');
  if (upper.length === 2 && US_STATES[upper]) {
    return US_STATES[upper];
  }
  // Already a full name? Return capitalized canonical version.
  const canonical = STATE_NAME_TO_CODE[trimmed.toLowerCase()];
  if (canonical) return US_STATES[canonical] ?? input;
  return input;
}

/**
 * Reverse of expandStateCode: full name → 2-letter code.
 *
 * - "California" → "CA"
 * - "california" → "CA" (case-insensitive)
 * - "CA" → "CA" (already a code; returns unchanged)
 * - "Calif" → "Calif" (not a known name — unchanged)
 *
 * Used by fields that store 2-letter codes (e.g., personal.addressState)
 * but want to accept either input shape on blur.
 */
export function compactStateName(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) return input;
  // Full name → code
  const code = STATE_NAME_TO_CODE[trimmed.toLowerCase()];
  if (code) return code;
  // Already a 2-letter code?
  const upper = trimmed.toUpperCase().replace(/[^A-Z]/g, '');
  if (upper.length === 2 && US_STATES[upper]) return upper;
  return input;
}
