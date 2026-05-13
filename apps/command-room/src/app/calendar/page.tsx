// /calendar — first-class top-level command-room nav surface.
//
// Per CLAUDE.md §4 Command Room Calendar. Weekly view default, day/
// month toggles. Event types: client meetings (linked to client
// record), filing deadlines, internal reviews, audit milestones,
// year-round planning touchpoints. Two-way sync with Google Calendar
// via the google-calendar MCP server.
//
// V1 PHASE 4 deliverable (full sync + two-way write). For v0 right
// now we ship the route + the empty-state UX so the IA is in place
// and Antonio can navigate to it from the sidebar without hitting
// a 404. The Google OAuth + MCP server land in C14+.
//
// The empty state itself does the work of communicating WHY this is
// here — preparer reads it once and understands what's coming.

import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { withTenant } from '@docket/db';
import type { TenantId } from '@docket/shared';
import { getCurrentDocketUser } from '@/lib/current-user';
import { CommandShell } from '@/components/command-shell';
import { MetricStrip, type Metric } from '@/components/metric-strip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface EventCounts {
  total: number;
  this_week: number;
  filing_deadlines: number;
  meetings: number;
  [key: string]: unknown;
}

async function loadEventCounts(tenantId: string): Promise<EventCounts> {
  return await withTenant(tenantId as TenantId, async (db) => {
    const rows = await db.execute<EventCounts>(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (
          WHERE starts_at >= date_trunc('week', now())
            AND starts_at < date_trunc('week', now()) + INTERVAL '7 days'
        )::int AS this_week,
        COUNT(*) FILTER (WHERE event_type = 'filing_deadline')::int AS filing_deadlines,
        COUNT(*) FILTER (WHERE event_type = 'meeting')::int AS meetings
      FROM calendar_events
    `);
    const arr = rows as unknown as EventCounts[];
    return (
      arr[0] ?? { total: 0, this_week: 0, filing_deadlines: 0, meetings: 0 }
    );
  });
}

export default async function CalendarPage() {
  const user = await getCurrentDocketUser();
  if (!user) redirect('/sign-in');

  let counts: EventCounts = { total: 0, this_week: 0, filing_deadlines: 0, meetings: 0 };
  let errorMessage: string | null = null;
  try {
    counts = await loadEventCounts(user.tenantId);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'Failed to load calendar events';
  }

  const metrics: Metric[] = [
    { label: 'This week', value: counts.this_week, caption: 'events scheduled' },
    {
      label: 'Filing deadlines',
      value: counts.filing_deadlines,
      tone: counts.filing_deadlines > 0 ? 'warning' : 'default',
      caption: 'next 30 days',
    },
    {
      label: 'Client meetings',
      value: counts.meetings,
      caption: 'all upcoming',
    },
    {
      label: 'Total events',
      value: counts.total,
      caption: 'in calendar',
    },
  ];

  return (
    <CommandShell user={user} tenantName={user.tenantName} activeHref="/calendar">
      <div style={{ maxWidth: 1200 }}>
        <header style={{ marginBottom: 24 }}>
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
            Calendar
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
            Client meetings, filing deadlines, internal reviews, audit milestones,
            year-round planning touchpoints. Two-way sync with your Google
            Calendar lands when you connect it under Settings → Integrations →
            Google Calendar.
          </p>
        </header>

        <MetricStrip metrics={metrics} />

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
            Couldn't load events: {errorMessage}
          </div>
        )}

        {counts.total === 0 && !errorMessage && (
          <div
            style={{
              padding: '40px 32px',
              background: 'oklch(99% 0.005 85)',
              border: '1px solid oklch(92% 0.008 85)',
              borderRadius: 12,
              textAlign: 'center',
            }}
          >
            <h2
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: 'oklch(25% 0.01 85)',
                margin: '0 0 8px 0',
              }}
            >
              No calendar events yet
            </h2>
            <p
              style={{
                fontSize: 13,
                color: 'oklch(45% 0.01 85)',
                margin: '0 0 16px 0',
                maxWidth: 480,
                marginLeft: 'auto',
                marginRight: 'auto',
                lineHeight: 1.6,
              }}
            >
              Connect your Google Calendar to mirror events into Docket. Once
              connected, every meeting, filing deadline, and review block
              becomes a first-class client artifact your Discovery + Strategy
              agents can read.
            </p>
            <div
              style={{
                marginTop: 16,
                fontSize: 11,
                color: 'oklch(55% 0.01 85)',
              }}
            >
              Google Calendar integration ships in Phase 4 (Wks 7-8, 6/13 → 6/27).
              For now, calendar entries can be inserted via the API or admin
              tooling for testing.
            </div>
          </div>
        )}
      </div>
    </CommandShell>
  );
}
