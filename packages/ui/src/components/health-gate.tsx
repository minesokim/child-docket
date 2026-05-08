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
  type StatusBannerProps,
  type ServiceStatus,
} from './status-banner.js';

interface HealthBody {
  db: { status: ServiceStatus; latencyMs: number };
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

  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();
    let consecutiveDownCount = 0;

    // Self-scheduling poll with in-flight guard + backoff on `down`.
    // Replaces the naive setInterval which would fire concurrent
    // requests if a probe stalled. During a real outage every client
    // would otherwise hit /api/health every 30s forever; backoff
    // caps that at 1 request per (intervalMs * 2^min(n, 4)) when the
    // DB is down.
    async function poll() {
      let nextDelay = intervalMs;
      try {
        const res = await fetch(endpoint, { signal: controller.signal, cache: 'no-store' });
        const body: unknown = await res.json();
        if (cancelled) return;
        const status = parseDbStatus(body);
        const next = status ?? 'down';
        setDbStatus(next);
        if (next === 'down') {
          consecutiveDownCount += 1;
          // Cap at 16x base interval. With 30s base → 8 min between
          // probes during a sustained outage.
          const factor = Math.min(2 ** Math.min(consecutiveDownCount, 4), 16);
          nextDelay = intervalMs * factor;
        } else {
          consecutiveDownCount = 0;
        }
      } catch (err) {
        if (cancelled || (err as Error).name === 'AbortError') return;
        setDbStatus('down');
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

  // Read-only mode flips ONLY on `down`. `degraded` shows a banner
  // (visible warning) but writes still flow — Neon p99 can spike to
  // 200-400ms in normal operation and we don't want to flap the app
  // into read-only on routine slowness. This pairs with
  // assertWritable() in apps/*/src/lib/read-only-mode.ts which also
  // only blocks on down/timeout.
  const readOnly = dbStatus === 'down';

  // Banner severity follows DB status. Only render when degraded/down.
  let banner: StatusBannerProps | null = null;
  if (dbStatus === 'degraded' || dbStatus === 'down') {
    banner = neonReadOnlyBanner(theme);
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
