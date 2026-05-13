// Home-dashboard queries. Aggregates the morning-brief signals for
// the / landing page: top urgent issues + practice stats + recent
// activity feed. Tenant-scoped via withTenant.

import { sql } from 'drizzle-orm';
import { withTenant } from '@docket/db';
import type { TenantId } from '@docket/shared';

export interface BriefIssueRow {
  id: string;
  title: string;
  summary: string;
  severity: 'high' | 'medium' | 'low';
  type: string;
  client_name: string | null;
  created_at: string;
  recommended_action: string | null;
  [key: string]: unknown;
}

export interface PracticeStats {
  active_clients: number;
  reviews_ready: number;
  notices_due: number;
  docs_pending: number;
  spend_24h_usd: number;
}

export interface ActivityRow {
  id: string;
  agent_id: string | null;
  tool_name: string;
  action_class: string;
  client_name: string | null;
  created_at: string;
  cost_usd: number | null;
  [key: string]: unknown;
}

export interface NeedYouLaneClient {
  client_id: string;
  client_name: string;
  engagement_id: string;
  engagement_type: string;
  /** ISO timestamp the engagement entered this lane. */
  entered_lane_at: string;
  /** Optional sub-cue rendered under the client name in the lane row. */
  cue: string | null;
  [key: string]: unknown;
}

export interface NeedYouLanes {
  /**
   * Need You workflow primitive — 4 swim-lanes that organize
   * client engagements by what the preparer needs to DO next.
   * Sharper than generic Pipeline per CLAUDE.md §4. Inherited
   * from the v3 Vazant dashboard IA, locked 2026-05-13.
   *
   * - new_intakes      intake complete, not yet routed to a preparer
   * - ready_to_prep    docs gathered, awaiting workpaper assembly
   * - ready_to_file    return drafted, awaiting EA review + 8879
   * - sign_and_file    8879 signed, awaiting e-file transmission
   *
   * Each lane caps at 5 clients in this v0 query; "View all" link
   * drills to the dedicated filter on /clients.
   */
  new_intakes: NeedYouLaneClient[];
  ready_to_prep: NeedYouLaneClient[];
  ready_to_file: NeedYouLaneClient[];
  sign_and_file: NeedYouLaneClient[];
  /** Total count per lane (for the lane header tile count). */
  counts: {
    new_intakes: number;
    ready_to_prep: number;
    ready_to_file: number;
    sign_and_file: number;
  };
}

export interface NudgeFeedRow {
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

export interface HomeData {
  brief: BriefIssueRow[];
  stats: PracticeStats;
  activity: ActivityRow[];
  needYou: NeedYouLanes;
  /**
   * Pending nudges for the home feed. Per CLAUDE.md §8 Nudges:
   * proactive outreach surface, distinct from Discovery (positions)
   * and Reminders (client-facing chase). Capped at 10 for the
   * home page; full list at /nudges.
   */
  nudges: NudgeFeedRow[];
}

export async function loadHomeData(tenantId: string): Promise<HomeData> {
  return await withTenant(tenantId as TenantId, async (db) => {
    const [briefRows, statsRows, activityRows, needYouRows, needYouCountRows, nudgeRows] =
      await Promise.all([
      // Top unresolved issues by severity, capped at 5. high > medium > low,
      // most-recently-created tie-breaker.
      db.execute<BriefIssueRow>(sql`
        SELECT
          i.id::text AS id,
          i.title,
          i.summary,
          i.severity::text AS severity,
          i.type::text AS type,
          c.full_name AS client_name,
          to_char(i.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
          i.recommended_action
        FROM issues i
        LEFT JOIN clients c ON c.id = i.client_id
        WHERE i.status IN ('open', 'in_progress')
        ORDER BY
          CASE i.severity
            WHEN 'high' THEN 0
            WHEN 'medium' THEN 1
            ELSE 2
          END,
          i.created_at DESC
        LIMIT 5
      `),

      // Practice stats. Single query with FILTER clauses.
      db.execute<{
        active_clients: number;
        reviews_ready: number;
        notices_due: number;
        docs_pending: number;
        spend_24h_usd: number;
      }>(sql`
        SELECT
          (SELECT COUNT(*)::int FROM clients) AS active_clients,
          (SELECT COUNT(*)::int FROM issues
            WHERE status = 'open' AND draft_action_id IS NOT NULL) AS reviews_ready,
          (SELECT COUNT(*)::int FROM issues
            WHERE status IN ('open', 'in_progress') AND type = 'irs_notice') AS notices_due,
          (SELECT COUNT(*)::int FROM documents
            WHERE merged_into_document_id IS NULL
              AND parse_phase IN ('uploaded', 'classifying')) AS docs_pending,
          (SELECT COALESCE(SUM(cost_usd), 0)::float8 FROM actions
            WHERE created_at > now() - interval '24 hours'
              AND cost_usd IS NOT NULL) AS spend_24h_usd
      `),

      // Recent activity — last 10 audit-trail rows. Joined with clients
      // for display; agent_id is enough to label the row even when no
      // client_id is set.
      db.execute<ActivityRow>(sql`
        SELECT
          a.id::text AS id,
          a.agent_id,
          a.tool_name,
          a.action_class::text AS action_class,
          c.full_name AS client_name,
          to_char(a.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
          a.cost_usd
        FROM actions a
        LEFT JOIN clients c ON c.id = a.client_id
        ORDER BY a.created_at DESC
        LIMIT 10
      `),

      // Need You queue — 4 lanes via engagement status. Maps engagement
      // lifecycle to the operational primitive Antonio uses
      // ("what do I do next?"). Each lane returns up to 5 rows; the
      // counts query below gets the totals.
      //
      // Lane mapping (v0):
      //   new_intakes    engagements.status IN ('intake')
      //                  AND clients.intake_completed_at IS NOT NULL
      //   ready_to_prep  engagements.status IN ('docs', 'prep')
      //   ready_to_file  engagements.status = 'review'
      //   sign_and_file  engagements.status = 'signature'
      //
      // Future versions will refine the routing (e.g., new_intakes
      // checks for "intake complete BUT no preparer assigned yet"),
      // but this v0 surfaces immediately-actionable signal.
      db.execute<NeedYouLaneClient & { lane: string }>(sql`
        WITH lanes AS (
          SELECT
            e.id::text AS engagement_id,
            e.client_id::text AS client_id,
            e.type::text AS engagement_type,
            c.full_name AS client_name,
            to_char(e.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS entered_lane_at,
            CASE e.status::text
              WHEN 'intake'    THEN 'new_intakes'
              WHEN 'docs'      THEN 'ready_to_prep'
              WHEN 'prep'      THEN 'ready_to_prep'
              WHEN 'review'    THEN 'ready_to_file'
              WHEN 'signature' THEN 'sign_and_file'
              ELSE NULL
            END AS lane,
            CASE e.status::text
              WHEN 'intake'    THEN 'intake complete'
              WHEN 'docs'      THEN 'docs received'
              WHEN 'prep'      THEN 'workpapers in progress'
              WHEN 'review'    THEN 'awaiting review'
              WHEN 'signature' THEN '8879 sent, awaiting signature'
              ELSE NULL
            END AS cue,
            ROW_NUMBER() OVER (
              PARTITION BY
                CASE e.status::text
                  WHEN 'intake'    THEN 'new_intakes'
                  WHEN 'docs'      THEN 'ready_to_prep'
                  WHEN 'prep'      THEN 'ready_to_prep'
                  WHEN 'review'    THEN 'ready_to_file'
                  WHEN 'signature' THEN 'sign_and_file'
                  ELSE NULL
                END
              ORDER BY e.updated_at DESC
            ) AS row_rank
          FROM engagements e
          JOIN clients c ON c.id = e.client_id
          WHERE e.status::text IN ('intake', 'docs', 'prep', 'review', 'signature')
        )
        SELECT
          engagement_id,
          client_id,
          engagement_type,
          client_name,
          entered_lane_at,
          lane,
          cue
        FROM lanes
        WHERE row_rank <= 5
        ORDER BY lane, entered_lane_at DESC
      `),

      // Per-lane totals for the header tile counts.
      db.execute<{
        new_intakes: number;
        ready_to_prep: number;
        ready_to_file: number;
        sign_and_file: number;
      }>(sql`
        SELECT
          COUNT(*) FILTER (WHERE status::text = 'intake')::int AS new_intakes,
          COUNT(*) FILTER (WHERE status::text IN ('docs', 'prep'))::int AS ready_to_prep,
          COUNT(*) FILTER (WHERE status::text = 'review')::int AS ready_to_file,
          COUNT(*) FILTER (WHERE status::text = 'signature')::int AS sign_and_file
        FROM engagements
      `),

      // Pending Nudges feed — capped at 10 for home page. Per
      // CLAUDE.md §8 Nudges: proactive outreach surface. Tenant-RLS
      // scoped via withTenant. Status filter includes 'edited'
      // (preparer touched the draft but hasn't approved yet).
      db.execute<NudgeFeedRow>(sql`
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
        LIMIT 10
      `),
    ]);

    const stats = (statsRows as unknown as Array<PracticeStats>)[0] ?? {
      active_clients: 0,
      reviews_ready: 0,
      notices_due: 0,
      docs_pending: 0,
      spend_24h_usd: 0,
    };

    // Bucket the Need You rows into lanes.
    type LaneRow = NeedYouLaneClient & { lane: string };
    const needYouLanes: NeedYouLanes = {
      new_intakes: [],
      ready_to_prep: [],
      ready_to_file: [],
      sign_and_file: [],
      counts: (needYouCountRows as unknown as Array<NeedYouLanes['counts']>)[0] ?? {
        new_intakes: 0,
        ready_to_prep: 0,
        ready_to_file: 0,
        sign_and_file: 0,
      },
    };
    for (const r of needYouRows as unknown as LaneRow[]) {
      const { lane, ...rest } = r;
      if (lane === 'new_intakes') needYouLanes.new_intakes.push(rest);
      else if (lane === 'ready_to_prep') needYouLanes.ready_to_prep.push(rest);
      else if (lane === 'ready_to_file') needYouLanes.ready_to_file.push(rest);
      else if (lane === 'sign_and_file') needYouLanes.sign_and_file.push(rest);
    }

    return {
      brief: briefRows as unknown as BriefIssueRow[],
      stats,
      activity: activityRows as unknown as ActivityRow[],
      needYou: needYouLanes,
      nudges: nudgeRows as unknown as NudgeFeedRow[],
    };
  });
}

export function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - t) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const ISSUE_TYPE_LABELS: Record<string, string> = {
  doc_mismatch: 'Doc mismatch',
  doc_gap: 'Doc gap',
  ero_pending: 'ERO pending',
  prep_decision: 'Prep decision',
  signature_pending: 'Signature pending',
  extension_risk: 'Extension risk',
  payment_status: 'Payment status',
  meeting_prep: 'Meeting prep',
  missing_info: 'Missing info',
  quick_reply: 'Quick reply',
  irs_notice: 'IRS notice',
};

export function labelForIssueType(s: string): string {
  return ISSUE_TYPE_LABELS[s] ?? s;
}

const TOOL_LABEL_HINTS: Record<string, string> = {
  'inbox-drafter.via.anthropic': 'Drafted reply',
  'inbox-drafter.via.bedrock': 'Drafted reply',
  'anthropic.messages.create': 'Agent run',
  'bedrock.converse': 'Agent run',
  'recordIntakeSignature': 'Signed legal artifact',
  'cost_runaway.detected': 'Cost-runaway alert',
  'verify_actions_chain.detected_tamper': 'Audit-chain tamper',
  'smoke-persist-agent-action': 'Smoke test',
};

export function labelForActivity(row: ActivityRow): string {
  return TOOL_LABEL_HINTS[row.tool_name] ?? (row.agent_id ?? row.tool_name);
}
