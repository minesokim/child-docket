// California Secretary of State (CA SoS) BE Public Search API helper.
//
// Antonio's intake feedback (2026-05-14): when a CA-addressed business
// types their legal name, verify the entity's standing live. Catches
// FTB Suspended / Forfeited / Dissolved before Antonio finds out
// mid-engagement. The biggest single Week-2 ask.
//
// API SURFACE
//   Endpoint: calicodev.sos.ca.gov BE Public Search API v1.0.4
//   Auth: subscription key in `Ocp-Apim-Subscription-Key` HTTP header
//        (free tier; signup at calicodev.sos.ca.gov).
//   Returns: up to 150 matches per query — entity name, number, type,
//            status, registered agent, principal address, filing
//            history. We surface only what intake needs: name match,
//            status, entity number.
//
// STATUS VOCABULARY (from CA SoS BE Public Search API Guide v1.0.4)
//   "Active"          — entity in good standing
//   "Suspended (SOS)" — missed SOI; cured via filing + $250 penalty
//   "FTB Suspended"   — FTB suspension mirrored from FTB records
//                       (mirrors within ~30 days; the single most
//                       valuable cross-agency signal — see
//                       docs/architecture-research/CA-STATE-AGENCY-
//                       AUTOMATION-2026-05-14.md §4).
//   "Forfeited"       — administrative dissolution by SoS
//   "FTB Forfeited"   — FTB-driven forfeiture mirrored from FTB
//   "Dissolved"       — voluntary dissolution filed
//   "Cancelled"       — short-window cancellation post-formation
//   "Merged Out"      — entity absorbed via merger
//   "Surrendered"     — foreign LLC withdrew CA registration
//
// GRACEFUL DEGRADATION
//   No subscription key → returns { ok: false, reason: 'unconfigured' }.
//   Network error / timeout → returns { ok: false, reason: 'network' }.
//   No matches → returns { ok: true, status: 'not_found' }.
//   429 rate-limit → returns { ok: false, reason: 'rate_limited' }.
//   The UI surface treats every non-ok result as silent no-op; user
//   continues typing. The intake never blocks on this lookup.
//
// PRIVACY
//   The legal-name query is sent to a CA government endpoint. No PII
//   leaves the firm (entity names are public records). §7216 not
//   applicable — entity registration data is public.

/**
 * Raw entity status strings the CA SoS API returns. The set is
 * documented in the BE Public Search API Guide v1.0.4.
 */
export type CaSoSRawStatus =
  | 'Active'
  | 'Suspended (SOS)'
  | 'FTB Suspended'
  | 'Forfeited'
  | 'FTB Forfeited'
  | 'Dissolved'
  | 'Cancelled'
  | 'Merged Out'
  | 'Surrendered';

/**
 * UI-facing status bucket. Maps the ~9 raw statuses into a small
 * vocabulary the pill component can render with consistent color +
 * copy.
 */
export type CaSoSStatusBucket =
  | 'active'        // green — good standing
  | 'suspended'     // amber — fixable (SoS suspension OR FTB suspension)
  | 'forfeited'    // red — administrative termination
  | 'dissolved'    // gray — voluntarily wound down
  | 'not_found'    // gray — name not found in CA SoS
  | 'unknown';      // gray — fallback for novel status strings

/**
 * Bucket a raw status into one of the five UI-facing buckets.
 * Defensive: unknown future-added statuses bucket to 'unknown' rather
 * than throw, so a CA SoS schema change can't break intake.
 */
export function bucketCaSoSStatus(raw: string): CaSoSStatusBucket {
  switch (raw) {
    case 'Active':
      return 'active';
    case 'Suspended (SOS)':
    case 'FTB Suspended':
      return 'suspended';
    case 'Forfeited':
    case 'FTB Forfeited':
      return 'forfeited';
    case 'Dissolved':
    case 'Cancelled':
    case 'Merged Out':
    case 'Surrendered':
      return 'dissolved';
    default:
      return 'unknown';
  }
}

/**
 * Successful lookup result — the entity was looked up against CA SoS.
 * `status === 'not_found'` means the API call succeeded but no entity
 * matched the queried name.
 */
export type CaSoSLookupOk = {
  ok: true;
  status: CaSoSStatusBucket;
  rawStatus: string | null;       // null when not_found
  entityNumber: string | null;    // CA SoS entity number, null when not_found
  matchedName: string | null;     // canonical name from CA SoS, null when not_found
  entityType: string | null;      // "Corporation", "LLC", "Partnership", null when not_found
};

/**
 * Failure modes. Every failure mode is treated as a silent UI no-op
 * — the user keeps typing. The reason is captured for telemetry +
 * the Antonio audit chain.
 */
export type CaSoSLookupErr = {
  ok: false;
  reason: 'unconfigured' | 'network' | 'rate_limited' | 'invalid_response' | 'bad_request';
};

export type CaSoSLookupResult = CaSoSLookupOk | CaSoSLookupErr;

/**
 * UI-facing display copy for each status bucket. Antonio voice — warm
 * + direct, no jargon. The 'suspended' / 'forfeited' copy intentionally
 * suggests action without being alarmist.
 */
export const CA_SOS_STATUS_COPY: Record<CaSoSStatusBucket, string> = {
  active: 'Active in CA Secretary of State',
  suspended: 'Suspended — let’s fix this before we file',
  forfeited: 'Forfeited — we’ll need to revive this',
  dissolved: 'Dissolved — confirm this matches your records',
  not_found: 'Not found in CA records — double-check the spelling',
  unknown: 'Status unclear — Antonio will verify',
};

/**
 * Normalize the legal name for CA SoS query. CA SoS search is case-
 * insensitive but punctuation-sensitive in surprising ways ("L.L.C."
 * vs "LLC"). Pre-trimming + collapsing whitespace is the documented
 * recommendation in the API guide.
 *
 * Idempotent: normalizeCaSoSQuery(normalizeCaSoSQuery(x)) === normalizeCaSoSQuery(x).
 */
export function normalizeCaSoSQuery(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

/**
 * Shape the API response into our internal result. Exported for unit
 * testing; the production caller is the Route Handler that wraps the
 * HTTP fetch.
 *
 * The CA SoS BE Public Search API returns an array of records under
 * `entities` (per API Guide v1.0.4). We pick the first exact-name
 * match (case-insensitive); if no exact match, the first partial
 * match; if still nothing, return not_found.
 */
export function parseCaSoSResponse(
  json: unknown,
  query: string,
): CaSoSLookupOk | CaSoSLookupErr {
  if (!json || typeof json !== 'object') {
    return { ok: false, reason: 'invalid_response' };
  }
  const body = json as { entities?: unknown };
  const entities = Array.isArray(body.entities) ? body.entities : [];
  if (entities.length === 0) {
    return {
      ok: true,
      status: 'not_found',
      rawStatus: null,
      entityNumber: null,
      matchedName: null,
      entityType: null,
    };
  }

  const normalizedQuery = normalizeCaSoSQuery(query).toLowerCase();

  // Prefer an exact-name (case-insensitive) match over a partial.
  // Filter to non-null object rows FIRST — a CA SoS response with
  // entities: [null] or [undefined] would otherwise throw inside the
  // .find callback. Codex caught this 2026-05-14.
  type EntityRow = {
    entityName?: unknown;
    entityNumber?: unknown;
    entityStatus?: unknown;
    entityType?: unknown;
  };
  const rows: EntityRow[] = entities.filter(
    (e): e is EntityRow => e != null && typeof e === 'object',
  );
  if (rows.length === 0) {
    return {
      ok: true,
      status: 'not_found',
      rawStatus: null,
      entityNumber: null,
      matchedName: null,
      entityType: null,
    };
  }
  const exactMatch =
    rows.find(
      (e) =>
        typeof e.entityName === 'string' &&
        e.entityName.toLowerCase() === normalizedQuery,
    ) ?? rows[0];

  if (!exactMatch) {
    return {
      ok: true,
      status: 'not_found',
      rawStatus: null,
      entityNumber: null,
      matchedName: null,
      entityType: null,
    };
  }

  const rawStatus =
    typeof exactMatch.entityStatus === 'string' ? exactMatch.entityStatus : null;
  return {
    ok: true,
    status: rawStatus ? bucketCaSoSStatus(rawStatus) : 'unknown',
    rawStatus,
    entityNumber:
      typeof exactMatch.entityNumber === 'string' ? exactMatch.entityNumber : null,
    matchedName:
      typeof exactMatch.entityName === 'string' ? exactMatch.entityName : null,
    entityType: typeof exactMatch.entityType === 'string' ? exactMatch.entityType : null,
  };
}

/**
 * Server-only HTTP fetch wrapper around the CA SoS BE Public Search
 * API. Caller passes the subscription key (env var read by the
 * Route Handler — never embed in client bundle).
 *
 * Returns within ~3s on a normal day; rejects to a timeout result if
 * CA SoS is slow (we'd rather drop the lookup than block intake).
 *
 * NEVER call this from client code. The subscription key must never
 * appear in any browser bundle.
 */
export async function fetchCaSoSEntity(
  legalName: string,
  apiKey: string,
  options?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<CaSoSLookupResult> {
  if (!apiKey) return { ok: false, reason: 'unconfigured' };
  const query = normalizeCaSoSQuery(legalName);
  if (query.length < 2) return { ok: false, reason: 'bad_request' };

  const url =
    'https://calicodev.sos.ca.gov/be/public-search/v1/entities?' +
    new URLSearchParams({ name: query, limit: '5' }).toString();

  const timeoutMs = options?.timeoutMs ?? 3000;
  // Bridge the optional external AbortSignal with our timeout signal
  // so callers can also cancel from /business-info debounce restarts.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  options?.signal?.addEventListener('abort', () => controller.abort());

  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Ocp-Apim-Subscription-Key': apiKey,
      },
      signal: controller.signal,
    });
    if (res.status === 429) return { ok: false, reason: 'rate_limited' };
    if (!res.ok) return { ok: false, reason: 'network' };
    const json = (await res.json()) as unknown;
    return parseCaSoSResponse(json, query);
  } catch {
    return { ok: false, reason: 'network' };
  } finally {
    clearTimeout(timeoutId);
  }
}
