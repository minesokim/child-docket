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
