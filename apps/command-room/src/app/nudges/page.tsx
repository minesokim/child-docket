// /nudges — full-list route beyond the home feed cap of 10.
//
// Shows pending nudges by default. Toggle to surface approved /
// dismissed / sent / expired for audit-trail review. Reuses the
// NudgesFeed component from the home page; adds top-level
// filtering + pagination (when needed; v0 caps at 100).
//
// Per CLAUDE.md §8 Nudges: this is the surface for "I have 30
// pending nudges and want to triage them in one session."

import { sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { withTenant } from '@docket/db';
import type { TenantId } from '@docket/shared';
import { getCurrentDocketUser } from '@/lib/current-user';
import { CommandShell } from '@/components/command-shell';
import { NudgesFeed, type NudgeFeedItem } from '@/components/nudges-feed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface NudgeRow {
  id: string;
  client_id: string;
  client_name: string;
  trigger_class: string;
  trigger_key: string;
  title: string;
  body: string;
  draft_outreach: string | null;
  recommended_channel: 'sms' | 'email' | 'portal_chat' | 'phone_call' | null;
  confidence: number;
  status: 'pending' | 'approved' | 'sent' | 'edited' | 'dismissed' | 'expired';
  expires_at: string | null;
  created_at: string;
  [key: string]: unknown;
}

type FilterStatus = 'pending' | 'approved' | 'sent' | 'dismissed' | 'all';

const FILTER_LABELS: Record<FilterStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  sent: 'Sent',
  dismissed: 'Dismissed',
  all: 'All',
};

const STATUS_CLAUSE_BY_FILTER: Record<FilterStatus, string> = {
  pending: "n.status IN ('pending', 'edited')",
  approved: "n.status = 'approved'",
  sent: "n.status = 'sent'",
  dismissed: "n.status = 'dismissed'",
  all: 'TRUE',
};

async function loadNudges(
  tenantId: string,
  filter: FilterStatus,
): Promise<NudgeRow[]> {
  return await withTenant(tenantId as TenantId, async (db) => {
    // Use a fragment for the WHERE clause based on filter; safe
    // because filter is a closed enum (no user input reaches the
    // SQL builder).
    let rows;
    if (filter === 'pending') {
      rows = await db.execute<NudgeRow>(sql`
        SELECT
          n.id::text AS id,
          n.client_id::text AS client_id,
          c.full_name AS client_name,
          n.trigger_class,
          n.trigger_key,
          n.title,
          n.body,
          n.draft_outreach,
          n.recommended_channel,
          n.confidence,
          n.status,
          to_char(n.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS expires_at,
          to_char(n.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
        FROM nudges n
        JOIN clients c ON c.id = n.client_id
        WHERE n.status IN ('pending', 'edited')
        ORDER BY n.confidence DESC, n.created_at DESC
        LIMIT 100
      `);
    } else if (filter === 'approved') {
      rows = await db.execute<NudgeRow>(sql`
        SELECT
          n.id::text AS id,
          n.client_id::text AS client_id,
          c.full_name AS client_name,
          n.trigger_class,
          n.trigger_key,
          n.title,
          n.body,
          n.draft_outreach,
          n.recommended_channel,
          n.confidence,
          n.status,
          to_char(n.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS expires_at,
          to_char(n.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
        FROM nudges n
        JOIN clients c ON c.id = n.client_id
        WHERE n.status = 'approved'
        ORDER BY n.created_at DESC
        LIMIT 100
      `);
    } else if (filter === 'sent') {
      rows = await db.execute<NudgeRow>(sql`
        SELECT
          n.id::text AS id,
          n.client_id::text AS client_id,
          c.full_name AS client_name,
          n.trigger_class,
          n.trigger_key,
          n.title,
          n.body,
          n.draft_outreach,
          n.recommended_channel,
          n.confidence,
          n.status,
          to_char(n.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS expires_at,
          to_char(n.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
        FROM nudges n
        JOIN clients c ON c.id = n.client_id
        WHERE n.status = 'sent'
        ORDER BY n.sent_at DESC NULLS LAST, n.created_at DESC
        LIMIT 100
      `);
    } else if (filter === 'dismissed') {
      rows = await db.execute<NudgeRow>(sql`
        SELECT
          n.id::text AS id,
          n.client_id::text AS client_id,
          c.full_name AS client_name,
          n.trigger_class,
          n.trigger_key,
          n.title,
          n.body,
          n.draft_outreach,
          n.recommended_channel,
          n.confidence,
          n.status,
          to_char(n.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS expires_at,
          to_char(n.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
        FROM nudges n
        JOIN clients c ON c.id = n.client_id
        WHERE n.status = 'dismissed'
        ORDER BY n.dismissed_at DESC NULLS LAST, n.created_at DESC
        LIMIT 100
      `);
    } else {
      rows = await db.execute<NudgeRow>(sql`
        SELECT
          n.id::text AS id,
          n.client_id::text AS client_id,
          c.full_name AS client_name,
          n.trigger_class,
          n.trigger_key,
          n.title,
          n.body,
          n.draft_outreach,
          n.recommended_channel,
          n.confidence,
          n.status,
          to_char(n.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS expires_at,
          to_char(n.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
        FROM nudges n
        JOIN clients c ON c.id = n.client_id
        ORDER BY n.created_at DESC
        LIMIT 100
      `);
    }
    return rows as unknown as NudgeRow[];
  });
}

async function loadStatusCounts(tenantId: string): Promise<Record<FilterStatus, number>> {
  return await withTenant(tenantId as TenantId, async (db) => {
    const rows = await db.execute<{
      pending: number;
      approved: number;
      sent: number;
      dismissed: number;
      all: number;
    }>(sql`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('pending', 'edited'))::int AS pending,
        COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
        COUNT(*) FILTER (WHERE status = 'sent')::int AS sent,
        COUNT(*) FILTER (WHERE status = 'dismissed')::int AS dismissed,
        COUNT(*)::int AS all
      FROM nudges
    `);
    const arr = rows as unknown as Array<Record<FilterStatus, number>>;
    return (
      arr[0] ?? {
        pending: 0,
        approved: 0,
        sent: 0,
        dismissed: 0,
        all: 0,
      }
    );
  });
}

type PageProps = {
  searchParams: Promise<{ filter?: string }>;
};

export default async function NudgesPage({ searchParams }: PageProps) {
  const user = await getCurrentDocketUser();
  if (!user) redirect('/sign-in');

  const params = await searchParams;
  const rawFilter = (params.filter ?? 'pending').toString();
  const filter: FilterStatus = (
    ['pending', 'approved', 'sent', 'dismissed', 'all'] as const
  ).includes(rawFilter as FilterStatus)
    ? (rawFilter as FilterStatus)
    : 'pending';

  let nudges: NudgeRow[] = [];
  let counts: Record<FilterStatus, number> = {
    pending: 0,
    approved: 0,
    sent: 0,
    dismissed: 0,
    all: 0,
  };
  let errorMessage: string | null = null;
  try {
    [nudges, counts] = await Promise.all([
      loadNudges(user.tenantId, filter),
      loadStatusCounts(user.tenantId),
    ]);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'Failed to load nudges';
  }

  const canEdit = ['firm_owner', 'preparer', 'reviewer'].includes(user.role);

  return (
    <CommandShell user={user} tenantName={user.tenantName} activeHref="/nudges">
      <div style={{ maxWidth: 1200 }}>
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
            Practice
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
            Nudges
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
            Proactive outreach drafts from your enabled nudge rules. Approve,
            edit, or dismiss. Approved nudges route to the send pipeline.{' '}
            <Link
              href="/settings/nudges"
              style={{ color: 'oklch(42% 0.09 150)', textDecoration: 'none' }}
            >
              Configure rules →
            </Link>
          </p>
        </header>

        {/* Filter pills */}
        <nav
          style={{
            display: 'flex',
            gap: 6,
            marginBottom: 24,
            flexWrap: 'wrap',
          }}
          aria-label="Filter by status"
        >
          {(['pending', 'approved', 'sent', 'dismissed', 'all'] as FilterStatus[]).map(
            (key) => {
              const isActive = key === filter;
              return (
                <Link
                  key={key}
                  href={`/nudges?filter=${key}`}
                  style={{
                    padding: '6px 12px',
                    background: isActive
                      ? 'oklch(42% 0.09 150)'
                      : 'oklch(99% 0.005 85)',
                    color: isActive
                      ? 'oklch(98% 0.01 85)'
                      : 'oklch(35% 0.01 85)',
                    border: isActive
                      ? '1px solid oklch(42% 0.09 150)'
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
                  {FILTER_LABELS[key]}
                  <span
                    style={{
                      fontSize: 11,
                      opacity: 0.75,
                      letterSpacing: 0.1,
                    }}
                  >
                    {counts[key]}
                  </span>
                </Link>
              );
            },
          )}
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
            Couldn't load nudges: {errorMessage}
          </div>
        )}

        {filter === 'pending' ? (
          <NudgesFeed
            nudges={nudges.map((n) => ({
              id: n.id,
              clientId: n.client_id,
              clientName: n.client_name,
              triggerClass: n.trigger_class,
              triggerKey: n.trigger_key,
              title: n.title,
              body: n.body,
              draftOutreach: n.draft_outreach,
              recommendedChannel: n.recommended_channel,
              confidence: n.confidence,
              status: n.status,
              expiresAt: n.expires_at,
              createdAt: n.created_at,
            })) as NudgeFeedItem[]}
            canEdit={canEdit}
          />
        ) : (
          <ReadOnlyNudgeList nudges={nudges} />
        )}
      </div>
    </CommandShell>
  );
}

/**
 * Read-only listing for non-pending filters (approved / sent /
 * dismissed / all). Pending uses NudgesFeed (which has action
 * buttons); historical filters render this leaner card view.
 */
function ReadOnlyNudgeList({ nudges }: { nudges: NudgeRow[] }) {
  if (nudges.length === 0) {
    return (
      <div
        style={{
          padding: '24px 18px',
          background: 'oklch(99% 0.005 85)',
          border: '1px dashed oklch(90% 0.008 85)',
          borderRadius: 10,
          fontSize: 13,
          color: 'oklch(45% 0.01 85)',
          lineHeight: 1.55,
        }}
      >
        <div
          style={{
            fontWeight: 500,
            color: 'oklch(30% 0.01 85)',
            marginBottom: 4,
          }}
        >
          Nothing here yet
        </div>
        Nudges with this status will appear here as they progress through the
        lifecycle.
      </div>
    );
  }
  return (
    <ul
      style={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {nudges.map((n) => (
        <li
          key={n.id}
          style={{
            padding: '12px 14px',
            background: 'oklch(99% 0.005 85)',
            border: '1px solid oklch(92% 0.008 85)',
            borderRadius: 10,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: 'oklch(50% 0.01 85)',
                letterSpacing: 0.3,
                textTransform: 'uppercase',
              }}
            >
              {n.trigger_class.replace(/_/g, ' ')} · {n.status}
            </span>
            <span
              style={{
                fontSize: 10,
                color: 'oklch(55% 0.01 85)',
              }}
            >
              {Math.round(n.confidence * 100)}%
            </span>
          </div>
          <h3
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'oklch(20% 0.01 85)',
              margin: '0 0 4px 0',
              lineHeight: 1.4,
            }}
          >
            {n.title}
          </h3>
          <p
            style={{
              fontSize: 12,
              color: 'oklch(40% 0.01 85)',
              margin: 0,
              lineHeight: 1.55,
            }}
          >
            {n.body}
          </p>
        </li>
      ))}
    </ul>
  );
}
