// /clients/freshness — touchpoint freshness lens on the client book.
//
// Per CLAUDE.md §4 Command Room Touchpoint freshness view: cross-
// channel staleness detection. Distinct from Need You queue (which
// shows clients in active workflow) — this surface catches off-
// workflow relationship drift Slant.app proved is the silent churn
// driver in adjacent verticals.
//
// HOW IT WORKS
//   For each client, compute "days since last meaningful touch"
//   from MAX(created_at) across:
//     - messages (any direction)
//     - actions where action_class IN ('send-external', 'mutate-tax-software')
//     - signatures (sent or signed events)
//     - documents (uploaded by client)
//   Per-engagement-state overdue thresholds:
//     - active engagement (any status before 'done'): ≤14 days
//     - on_hold:                                       ≤30 days
//     - done/no engagement:                            ≤90 days
//   Tier the client:
//     - green:  within threshold
//     - amber:  1-2x threshold
//     - red:    >2x threshold
//
// V0 scope is per-client display + sort + filter. v1.5 adds bulk
// action: select stale clients → "Draft just checking in outreach"
// via Nudges Agent.

import { sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { withTenant } from '@docket/db';
import type { TenantId } from '@docket/shared';
import { requireRole } from '@/lib/require-role';
import { CommandShell } from '@/components/command-shell';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface FreshnessRow {
  client_id: string;
  full_name: string;
  email: string | null;
  engagement_status: string | null;
  last_touch_at: string | null;
  days_since_touch: number | null;
  last_touch_channel: string | null;
  [key: string]: unknown;
}

type Tier = 'green' | 'amber' | 'red' | 'unknown';

interface ClassifiedRow extends FreshnessRow {
  tier: Tier;
  threshold: number;
}

function classifyTier(row: FreshnessRow): { tier: Tier; threshold: number } {
  const threshold =
    row.engagement_status === null || row.engagement_status === 'done'
      ? 90
      : row.engagement_status === 'on_hold'
        ? 30
        : 14;

  if (row.days_since_touch === null) return { tier: 'unknown', threshold };
  const d = row.days_since_touch;
  if (d <= threshold) return { tier: 'green', threshold };
  if (d <= threshold * 2) return { tier: 'amber', threshold };
  return { tier: 'red', threshold };
}

async function loadFreshness(tenantId: string): Promise<FreshnessRow[]> {
  return await withTenant(tenantId as TenantId, async (db) => {
    // Compose last_touch from messages + actions + signatures +
    // documents. UNION ALL on the per-client max per source, then
    // MAX again to get the overall freshest.
    const rows = await db.execute<FreshnessRow>(sql`
      WITH per_client_touches AS (
        -- Messages (any direction)
        SELECT
          client_id,
          MAX(created_at) AS last_touch,
          'message' AS channel
        FROM messages
        WHERE client_id IS NOT NULL
        GROUP BY client_id
        UNION ALL
        -- External actions (sent to client) + tax-software writes
        SELECT
          client_id,
          MAX(created_at) AS last_touch,
          'action' AS channel
        FROM actions
        WHERE client_id IS NOT NULL
          AND action_class::text IN ('send-external', 'mutate-tax-software', 'file')
        GROUP BY client_id
        UNION ALL
        -- Signature events
        SELECT
          client_id,
          MAX(GREATEST(
            COALESCE(created_at, '1970-01-01'::timestamptz),
            COALESCE(sent_at, '1970-01-01'::timestamptz),
            COALESCE(signed_at, '1970-01-01'::timestamptz)
          )) AS last_touch,
          'signature' AS channel
        FROM signatures
        WHERE client_id IS NOT NULL
        GROUP BY client_id
        UNION ALL
        -- Documents uploaded
        SELECT
          client_id,
          MAX(created_at) AS last_touch,
          'document' AS channel
        FROM documents
        WHERE client_id IS NOT NULL
        GROUP BY client_id
      ),
      latest_per_client AS (
        SELECT DISTINCT ON (client_id)
          client_id,
          last_touch,
          channel
        FROM per_client_touches
        ORDER BY client_id, last_touch DESC NULLS LAST
      ),
      latest_engagement AS (
        SELECT DISTINCT ON (client_id)
          client_id,
          status::text AS status
        FROM engagements
        ORDER BY client_id, created_at DESC
      )
      SELECT
        c.id::text AS client_id,
        c.full_name,
        c.email,
        e.status AS engagement_status,
        to_char(t.last_touch AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_touch_at,
        CASE
          WHEN t.last_touch IS NOT NULL
          THEN EXTRACT(DAY FROM now() - t.last_touch)::int
          ELSE NULL
        END AS days_since_touch,
        t.channel AS last_touch_channel
      FROM clients c
      LEFT JOIN latest_per_client t ON t.client_id = c.id
      LEFT JOIN latest_engagement e ON e.client_id = c.id
      ORDER BY days_since_touch DESC NULLS FIRST
    `);
    return rows as unknown as FreshnessRow[];
  });
}

const TIER_COLORS: Record<Tier, { fill: string; soft: string; label: string }> = {
  red: {
    fill: 'oklch(52% 0.18 28)',
    soft: 'oklch(94% 0.07 28)',
    label: 'At risk',
  },
  amber: {
    fill: 'oklch(58% 0.13 75)',
    soft: 'oklch(94% 0.06 75)',
    label: 'Watch',
  },
  green: {
    fill: 'oklch(42% 0.09 150)',
    soft: 'oklch(92% 0.05 150)',
    label: 'On track',
  },
  unknown: {
    fill: 'oklch(55% 0.01 85)',
    soft: 'oklch(94% 0.008 85)',
    label: 'No data',
  },
};

const CHANNEL_LABELS: Record<string, string> = {
  message: 'message',
  action: 'system action',
  signature: 'signature event',
  document: 'doc upload',
};

type PageProps = {
  searchParams: Promise<{ tier?: string }>;
};

export default async function FreshnessPage({ searchParams }: PageProps) {
  const user = await requireRole([
    'firm_owner',
    'preparer',
    'reviewer',
    'admin',
    'assistant',
  ]);

  const params = await searchParams;
  const tierFilter = (params.tier ?? 'all').toString();
  const validTierFilter: 'all' | Tier =
    tierFilter === 'red' || tierFilter === 'amber' || tierFilter === 'green' || tierFilter === 'unknown'
      ? tierFilter
      : 'all';

  let rows: ClassifiedRow[] = [];
  let errorMessage: string | null = null;
  try {
    const raw = await loadFreshness(user.tenantId);
    rows = raw.map((r) => ({ ...r, ...classifyTier(r) }));
  } catch (err) {
    errorMessage =
      err instanceof Error
        ? err.message
        : 'Failed to load touchpoint freshness';
  }

  const counts: Record<'all' | Tier, number> = {
    all: rows.length,
    red: rows.filter((r) => r.tier === 'red').length,
    amber: rows.filter((r) => r.tier === 'amber').length,
    green: rows.filter((r) => r.tier === 'green').length,
    unknown: rows.filter((r) => r.tier === 'unknown').length,
  };

  const visible =
    validTierFilter === 'all'
      ? rows
      : rows.filter((r) => r.tier === validTierFilter);

  return (
    <CommandShell
      user={{ name: user.name, email: user.email, avatarUrl: user.avatarUrl }}
      tenantName={user.tenantName}
      activeHref="/clients"
    >
      <div
        style={{
          padding: '32px 36px 48px',
          maxWidth: 1200,
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <header style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 12,
              color: 'oklch(48% 0.01 85)',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            Clients · Touchpoint freshness
          </div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 600,
              color: 'oklch(20% 0.01 85)',
              margin: '0 0 8px 0',
              letterSpacing: -0.4,
            }}
          >
            Who haven't you talked to lately?
          </h1>
          <p
            style={{
              fontSize: 14,
              color: 'oklch(45% 0.01 85)',
              margin: 0,
              lineHeight: 1.55,
              maxWidth: 720,
            }}
          >
            Cross-channel staleness lens. Counts every meaningful touch
            (message, signature event, doc upload, system action sent to
            client). Per-engagement-state thresholds: 14 days for active
            engagements, 30 days for on-hold, 90 days for off-season.{' '}
            <Link
              href="/clients"
              style={{ color: 'oklch(42% 0.09 150)', textDecoration: 'none' }}
            >
              Back to Clients →
            </Link>
          </p>
        </header>

        {/* Tier filter pills */}
        <nav
          style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}
          aria-label="Filter by tier"
        >
          {(['all', 'red', 'amber', 'green', 'unknown'] as const).map((key) => {
            const isActive = key === validTierFilter;
            const tierColor =
              key === 'all'
                ? { fill: 'oklch(42% 0.09 150)', label: 'All' }
                : { fill: TIER_COLORS[key].fill, label: TIER_COLORS[key].label };
            return (
              <Link
                key={key}
                href={`/clients/freshness?tier=${key}`}
                style={{
                  padding: '6px 12px',
                  background: isActive ? tierColor.fill : 'oklch(99% 0.005 85)',
                  color: isActive
                    ? 'oklch(98% 0.01 85)'
                    : 'oklch(35% 0.01 85)',
                  border: isActive
                    ? `1px solid ${tierColor.fill}`
                    : '1px solid oklch(92% 0.008 85)',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 500,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {tierColor.label}
                <span
                  style={{
                    fontSize: 11,
                    opacity: 0.8,
                  }}
                >
                  {counts[key]}
                </span>
              </Link>
            );
          })}
        </nav>

        {errorMessage && (
          <div
            style={{
              padding: 12,
              background: 'oklch(96% 0.02 28)',
              border: '1px solid oklch(88% 0.04 28)',
              borderRadius: 10,
              marginBottom: 20,
              fontSize: 13,
              color: 'oklch(35% 0.06 28)',
            }}
          >
            Couldn't load freshness data: {errorMessage}
          </div>
        )}

        {/* Client list */}
        {visible.length === 0 ? (
          <div
            style={{
              padding: '24px 18px',
              background: 'oklch(99% 0.005 85)',
              border: '1px dashed oklch(90% 0.008 85)',
              borderRadius: 10,
              fontSize: 13,
              color: 'oklch(45% 0.01 85)',
              lineHeight: 1.55,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontWeight: 500,
                color: 'oklch(30% 0.01 85)',
                marginBottom: 4,
              }}
            >
              {validTierFilter === 'all'
                ? 'No clients yet'
                : `No clients in the ${TIER_COLORS[validTierFilter as Tier].label.toLowerCase()} tier`}
            </div>
            {validTierFilter !== 'all' &&
              'Try a different filter above. Silence here is a good signal.'}
          </div>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {visible.map((row) => (
              <ClientFreshnessRow key={row.client_id} row={row} />
            ))}
          </ul>
        )}
      </div>
    </CommandShell>
  );
}

function ClientFreshnessRow({ row }: { row: ClassifiedRow }) {
  const tierColor = TIER_COLORS[row.tier];
  const channelLabel =
    row.last_touch_channel && CHANNEL_LABELS[row.last_touch_channel];
  return (
    <li>
      <Link
        href={`/clients/${row.client_id}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 14px',
          background: 'oklch(99% 0.005 85)',
          border: '1px solid oklch(93% 0.008 85)',
          borderLeft: `3px solid ${tierColor.fill}`,
          borderRadius: 8,
          textDecoration: 'none',
          transition: 'background 80ms ease',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: tierColor.fill,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: 'oklch(20% 0.01 85)',
              marginBottom: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {row.full_name}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'oklch(50% 0.01 85)',
              letterSpacing: 0.1,
            }}
          >
            {row.engagement_status
              ? `Engagement: ${row.engagement_status}`
              : 'No active engagement'}
            {row.days_since_touch !== null && (
              <>
                {' · '}
                {row.days_since_touch === 0
                  ? 'touched today'
                  : `${row.days_since_touch} day${row.days_since_touch === 1 ? '' : 's'} since last ${channelLabel ?? 'touch'}`}
                {' · threshold '}
                {row.threshold}d
              </>
            )}
            {row.days_since_touch === null && ' · no recorded touches'}
          </div>
        </div>
        <span
          style={{
            padding: '2px 8px',
            background: tierColor.soft,
            color: tierColor.fill,
            border: `1px solid ${tierColor.fill}`,
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: 0.3,
            textTransform: 'uppercase',
            flexShrink: 0,
          }}
        >
          {tierColor.label}
        </span>
      </Link>
    </li>
  );
}
