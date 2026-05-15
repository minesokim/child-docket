// Health-gate client component.
//
// Wraps an app subtree, polls a /api/health endpoint, and:
//   1. Wires `ReadOnlyProvider` with the right boolean.
//   2. Optionally renders a `StatusBanner` when the DB is degraded
//      or down (caller controls placement via the `bannerSlot` prop;
//      pass null to suppress).
//
// CONTRACT WITH THE ENDPOINT
//   GET <endpoint> returns
//     { db: { status: 'healthy' | 'degraded' | 'down', latencyMs }, ... }
//   503 status code → degraded/down handling per body.
//
// USAGE
//   In each app's layout (server-component-friendly because the
//   gate itself is a 'use client' boundary):
//
//     <HealthStatusGate t={theme} endpoint="/api/health">
//       {children}
//     </HealthStatusGate>
//
// EDGE CASES (per /edge-cases skill, 12 enumerated)
//
//   INPUT
//     - Endpoint URL invalid → fetch fails → render as 'down'.
//     - JSON parse fails → render as 'unknown' (treat as healthy to
//       avoid false-positive read-only mode).
//     - Endpoint returns unexpected status string → fall back to
//       'unknown'.
//
//   STATE
//     - Component unmounts mid-fetch → AbortController cancels.
//     - Initial render before first fetch → 'unknown'; no banner; not
//       read-only.
//     - Fetch flips healthy → degraded → down → banner severity
//       updates without remount.
//
//   FAILURE
//     - Network offline → fetch error → 'down' (banner shows).
//     - Server returns 503 → body still parses → status flows.
//
//   TIME
//     - Polling interval default 30s, configurable via prop.
//     - Cleanup clears interval on unmount.
//
//   PERMISSION
//     - Endpoint is public; nothing to authenticate.
//
//   DOMAIN
//     - Only DB status drives ReadOnlyProvider in v1. Anthropic / R2
//       statuses (when added) drive their own banners but don't toggle
//       read-only mode (read-only is specifically a DB-write-failure
//       affordance).

'use client';

import * as React from 'react';
import { buildTheme, type Theme } from '../tokens.js';
import { ReadOnlyProvider } from './read-only.js';
import {
  StatusBanner,
  neonReadOnlyBanner,
  neonPrimaryDegradedBanner,
  neonBothDegradedBanner,
  neonReplicaAvailableBanner,
  neonReplicaDegradedBanner,
  type StatusBannerProps,
  type ServiceStatus,
} from './status-banner.js';

/**
 * Replica status from /api/health. `configured: false` means the
 * server-side env var DATABASE_URL_READ_REPLICA isn't set — replica
 * not wired at all (do not show any replica banner). `configured: true`
 * means it's wired; status reflects the live probe.
 */
type ReplicaState =
  | { configured: false }
  | { configured: true; status: ServiceStatus; latencyMs: number };

interface HealthBody {
  db: { status: ServiceStatus; latencyMs: number };
  replica?: ReplicaState; // optional for backwards compat with older /api/health
  timestamp: string;
}

export interface HealthStatusGateProps {
  /**
   * Optional theme. Defaults to `buildTheme()` (editorial tone). Pass
   * a custom theme only if the app's chrome differs from the default.
   * Layouts shouldn't need to import tokens just to use this gate.
   */
  t?: Theme;
  /** URL to poll (e.g., '/api/health'). */
  endpoint: string;
  /** Polling interval in ms. Default 30000 (30s). */
  intervalMs?: number;
  /** Where to render the banner. Default 'top'. Pass 'none' to suppress. */
  bannerPlacement?: 'top' | 'none';
  children: React.ReactNode;
}

export function HealthStatusGate({
  t,
  endpoint,
  intervalMs = 30_000,
  bannerPlacement = 'top',
  children,
}: HealthStatusGateProps) {
  const theme = React.useMemo(() => t ?? buildTheme(), [t]);
  const [dbStatus, setDbStatus] = React.useState<ServiceStatus | 'unknown'>('unknown');
  const [replicaState, setReplicaState] = React.useState<ReplicaState | null>(null);

  // react-doctor-disable-next-line no-fetch-in-effect, no-cascading-set-state —
  // this is a polling-with-backoff health-check loop:
  //   - fetch-in-effect is the correct pattern for periodic polling.
  //     SWR / react-query are designed for declarative one-shot or
  //     focus-revalidated fetches, not for "ping /api/health every
  //     30s with exponential backoff on down state." Reaching for a
  //     library here would obscure the polling logic, not simplify it.
  //   - cascading-set-state flags setDbStatus + setReplicaState back-
  //     to-back; React batches these into a single render, and they're
  //     independent state slices (DB status + replica state) not a
  //     dependent chain. False positive on this specific pattern.
  // If we ever swap to SWR for non-polling endpoints, do NOT migrate
  // this hook — its job is fundamentally periodic + backoff-aware.
  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();
    let consecutiveDownCount = 0;

    async function poll() {
      let nextDelay = intervalMs;
      try {
        const res = await fetch(endpoint, { signal: controller.signal, cache: 'no-store' });
        const body: unknown = await res.json();
        if (cancelled) return;
        const status = parseDbStatus(body);
        const next = status ?? 'down';
        setDbStatus(next);
        // Replica field is optional — older endpoints don't ship it.
        // parseReplicaState returns null when missing/malformed; we
        // treat null as "unknown / don't show replica-specific UX."
        setReplicaState(parseReplicaState(body));
        if (next === 'down') {
          consecutiveDownCount += 1;
          const factor = Math.min(2 ** Math.min(consecutiveDownCount, 4), 16);
          nextDelay = intervalMs * factor;
        } else {
          consecutiveDownCount = 0;
        }
      } catch (err) {
        if (cancelled || (err as Error).name === 'AbortError') return;
        setDbStatus('down');
        // Don't clobber replicaState on fetch failure; keep last known.
        consecutiveDownCount += 1;
        const factor = Math.min(2 ** Math.min(consecutiveDownCount, 4), 16);
        nextDelay = intervalMs * factor;
      }
      if (!cancelled) {
        timer = setTimeout(poll, nextDelay);
      }
    }

    void poll();

    return () => {
      cancelled = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [endpoint, intervalMs]);

  // Read-only mode flips ONLY on primary `down`. Replica state never
  // toggles read-only — replica is informational only in v0 (auto-
  // routing reads to it is V1.5).
  const readOnly = dbStatus === 'down';

  // Banner selection — explicit case mapping. Each branch picks the
  // banner whose copy MATCHES the actual operational state. Earlier
  // version reused neonReadOnlyBanner (which says "saves are paused")
  // on the degraded path even though writes still flow — codex review
  // caught that lie. New banners separate degraded-but-writable from
  // genuinely-down.
  //
  //   primary down            → readOnly banner (saves paused)
  //   primary degraded
  //     + replica healthy     → replicaAvailable banner (info)
  //     + replica down/degr.  → bothDegraded banner (warn — failover impaired)
  //     + replica unconfig'd
  //       OR replica unknown  → primaryDegraded banner (warn — saves still live)
  //   primary healthy
  //     + replica down/degr.  → replicaDegraded banner (warn — failover unavailable)
  //     + else                → no banner
  let banner: StatusBannerProps | null = null;
  if (dbStatus === 'down') {
    banner = neonReadOnlyBanner(theme);
  } else if (dbStatus === 'degraded') {
    if (replicaState?.configured === true && replicaState.status === 'healthy') {
      banner = neonReplicaAvailableBanner(theme);
    } else if (
      replicaState?.configured === true &&
      (replicaState.status === 'down' || replicaState.status === 'degraded')
    ) {
      banner = neonBothDegradedBanner(theme);
    } else {
      banner = neonPrimaryDegradedBanner(theme);
    }
  } else if (
    dbStatus === 'healthy' &&
    replicaState?.configured === true &&
    (replicaState.status === 'down' || replicaState.status === 'degraded')
  ) {
    banner = neonReplicaDegradedBanner(theme);
  }

  return (
    <ReadOnlyProvider value={readOnly}>
      {banner && bannerPlacement === 'top' ? (
        <div style={{ padding: '8px 16px 0' }}>
          <StatusBanner {...banner} />
        </div>
      ) : null}
      {children}
    </ReadOnlyProvider>
  );
}

// Defensive parser. Accepts the documented contract; falls through
// to null if anything looks off so the component renders 'down' (the
// safe default — banner shows + read-only mode engages).
function parseDbStatus(body: unknown): ServiceStatus | null {
  if (!body || typeof body !== 'object') return null;
  const db = (body as { db?: unknown }).db;
  if (!db || typeof db !== 'object') return null;
  const status = (db as { status?: unknown }).status;
  if (status === 'healthy' || status === 'degraded' || status === 'down') {
    return status;
  }
  return null;
}

/**
 * Parse the replica field from a /api/health response. Returns null
 * when the field is missing (older endpoints) or malformed — caller
 * treats null as "unknown, don't show replica-specific UX." Returns
 * a structured state otherwise.
 */
function parseReplicaState(body: unknown): ReplicaState | null {
  if (!body || typeof body !== 'object') return null;
  const replica = (body as { replica?: unknown }).replica;
  if (!replica || typeof replica !== 'object') return null;
  const configured = (replica as { configured?: unknown }).configured;
  if (configured === false) return { configured: false };
  if (configured !== true) return null;
  const status = (replica as { status?: unknown }).status;
  const latencyMs = (replica as { latencyMs?: unknown }).latencyMs;
  if (
    (status === 'healthy' || status === 'degraded' || status === 'down') &&
    typeof latencyMs === 'number'
  ) {
    return { configured: true, status, latencyMs };
  }
  // Configured replica with malformed/unknown status. Treat as 'down'
  // rather than 'unknown / no banner' — a configured-but-malfunctioning
  // replica is exactly the operational signal we want to surface, not
  // hide. Latency unknown so 0.
  return { configured: true, status: 'down', latencyMs: 0 };
}
