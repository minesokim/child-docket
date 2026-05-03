// Minimal ULID implementation. ULID = 26-char Crockford-base32 sortable
// identifier (48 bits of millisecond timestamp + 80 bits randomness).
//
// We use ULIDs as the unique-per-upload prefix in storage keys. ULIDs
// sort lexicographically by upload time, which makes log-style scans
// (e.g., "list all docs uploaded after X") cheap without leaking exact
// timestamps in user-visible URLs.
//
// Why not import the `ulid` package: avoid a transitive dep for ~30
// lines of code, and we don't need the monotonicity guarantees the
// library version offers (concurrent uploads getting different
// timestamps is fine for our use case).

import { randomBytes } from 'node:crypto';

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32 (no I L O U)

function encodeTime(now: number, len: number): string {
  let out = '';
  let n = now;
  for (let i = len - 1; i >= 0; i--) {
    const mod = n % 32;
    out = ENCODING[mod] + out;
    n = Math.floor(n / 32);
  }
  return out;
}

function encodeRandom(len: number): string {
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) {
    out += ENCODING[bytes[i]! % 32];
  }
  return out;
}

/** Generate a fresh 26-character ULID. */
export function ulid(seedTime?: number): string {
  const now = seedTime ?? Date.now();
  return encodeTime(now, 10) + encodeRandom(16);
}
