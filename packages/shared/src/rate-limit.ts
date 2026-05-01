// In-process token-bucket rate limiter.
//
// SCOPE
//   v0 protection for our own server actions + API routes. Per-process,
//   not distributed — each Vercel lambda instance has its own bucket
//   map, so the EFFECTIVE global limit scales with the number of warm
//   instances. For Antonio's ~200-client cohort this is fine: the
//   tenant has bounded users, abuse vectors are limited, and Vercel
//   serverless lambda count stays small.
//
//   When traffic + tenant count grow, swap the storage layer for
//   Upstash Redis (set RATE_LIMIT_BACKEND=upstash + provide
//   UPSTASH_REDIS_REST_URL / TOKEN). The public API (consume) stays
//   identical — only the storage swaps.
//
//   Clerk's auth (login + OTP send) has its own per-IP rate limit
//   built into Clerk's infra. We don't reimplement that here.
//
// TYPICAL CALLERS
//   - revealIntakeField  — abuse vector: enumeration of sensitive
//                          plaintext via repeated reveal calls
//   - /api/intake/flush  — abuse vector: large-payload DoS, repeated
//                          batched writes
//   - any new endpoint that's cheap to hit but expensive to serve

type Bucket = {
  tokens: number;
  refillAtMs: number;
};

const buckets = new Map<string, Bucket>();

/**
 * Try to consume one token from the bucket identified by `key`. Returns
 * `{ allowed: true }` if there was a token available, or
 * `{ allowed: false, retryAfterMs }` with the milliseconds until the
 * next refill.
 *
 * Implementation is a simple "fixed window" bucket — the bucket holds
 * `limit` tokens and refills to `limit` after `windowMs` since the last
 * refill. For our use case (deter abuse, not enforce SLAs) the simpler
 * algorithm beats the complexity of a true sliding-window log.
 */
export function consumeRateToken(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: true } | { allowed: false; retryAfterMs: number } {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now >= bucket.refillAtMs) {
    bucket = { tokens: limit, refillAtMs: now + windowMs };
    buckets.set(key, bucket);
  }

  if (bucket.tokens > 0) {
    bucket.tokens -= 1;
    return { allowed: true };
  }

  return { allowed: false, retryAfterMs: bucket.refillAtMs - now };
}

/**
 * Test-only helper. Drops everything from the bucket map so tests can
 * start fresh.
 */
export function clearRateLimits(): void {
  buckets.clear();
}
