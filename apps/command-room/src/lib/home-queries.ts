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

export interface HomeData {
  brief: BriefIssueRow[];
  stats: PracticeStats;
  activity: ActivityRow[];
}

export async function loadHomeData(tenantId: string): Promise<HomeData> {
  return await withTenant(tenantId as TenantId, async (db) => {
    const [briefRows, statsRows, activityRows] = await Promise.all([
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
    ]);

    const stats = (statsRows as unknown as Array<PracticeStats>)[0] ?? {
      active_clients: 0,
      reviews_ready: 0,
      notices_due: 0,
      docs_pending: 0,
      spend_24h_usd: 0,
    };

    return {
      brief: briefRows as unknown as BriefIssueRow[],
      stats,
      activity: activityRows as unknown as ActivityRow[],
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
