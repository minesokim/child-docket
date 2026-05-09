// Per-issue queries for /messages/[id]. Reads the full issue +
// the draft action (with parsed trustGate + draft body) + a small
// audit-trail tail for context.

import { sql } from 'drizzle-orm';
import { withTenant } from '@docket/db';
import type { TenantId } from '@docket/shared';

export interface IssueDetail {
  id: string;
  type: string;
  severity: 'high' | 'medium' | 'low';
  status: string;
  title: string;
  summary: string;
  why_this_matters: string | null;
  recommended_action: string | null;
  ai_confidence: number | null;
  classified_by: string | null;
  created_at: string;
  resolved_at: string | null;
  client_id: string | null;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  client_preferred_language: string | null;
  // Draft fields (from joined action row)
  draft_action_id: string | null;
  draft_body: string | null;
  draft_subject: string | null;
  draft_channel: string | null;
  draft_language: string | null;
  draft_confidence: number | null;
  draft_reasoning: string | null;
  trust_gate_allowed: boolean | null;
  trust_gate_action_class: string | null;
  trust_gate_requires: string | null;
  trust_gate_reason: string | null;
  draft_created_at: string | null;
  draft_cost_usd: number | null;
  [key: string]: unknown;
}

export interface IssueAuditRow {
  id: string;
  agent_id: string | null;
  tool_name: string;
  action_class: string;
  created_at: string;
  cost_usd: number | null;
  success: boolean;
  [key: string]: unknown;
}

export async function loadIssueDetail(
  tenantId: string,
  issueId: string,
): Promise<{ issue: IssueDetail | null; audit: IssueAuditRow[] }> {
  return await withTenant(tenantId as TenantId, async (db) => {
    const [issueRows, auditRows] = await Promise.all([
      db.execute<IssueDetail>(sql`
        SELECT
          i.id::text AS id,
          i.type::text AS type,
          i.severity::text AS severity,
          i.status::text AS status,
          i.title,
          i.summary,
          i.why_this_matters,
          i.recommended_action,
          i.ai_confidence,
          i.classified_by,
          to_char(i.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
          CASE WHEN i.resolved_at IS NOT NULL
               THEN to_char(i.resolved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
               ELSE NULL END AS resolved_at,
          i.client_id::text AS client_id,
          c.full_name AS client_name,
          c.phone AS client_phone,
          c.email AS client_email,
          c.preferred_language AS client_preferred_language,
          a.id::text AS draft_action_id,
          a.tool_output->>'body' AS draft_body,
          a.tool_output->>'subject' AS draft_subject,
          a.tool_output->>'channel' AS draft_channel,
          a.tool_output->>'language' AS draft_language,
          (a.tool_output->>'confidence')::float8 AS draft_confidence,
          a.tool_output->>'reasoning' AS draft_reasoning,
          (a.tool_input->'trustGate'->>'allowed')::boolean AS trust_gate_allowed,
          a.tool_input->'trustGate'->>'actionClass' AS trust_gate_action_class,
          a.tool_input->'trustGate'->>'requires' AS trust_gate_requires,
          a.tool_input->'trustGate'->>'reason' AS trust_gate_reason,
          CASE WHEN a.created_at IS NOT NULL
               THEN to_char(a.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
               ELSE NULL END AS draft_created_at,
          a.cost_usd AS draft_cost_usd
        FROM issues i
        LEFT JOIN clients c ON c.id = i.client_id
        LEFT JOIN actions a ON a.id = i.draft_action_id
        WHERE i.id = ${issueId}::uuid
        LIMIT 1
      `),
      db.execute<IssueAuditRow>(sql`
        SELECT
          a.id::text AS id,
          a.agent_id,
          a.tool_name,
          a.action_class::text AS action_class,
          to_char(a.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
          a.cost_usd,
          a.success
        FROM actions a
        WHERE a.client_id = (SELECT client_id FROM issues WHERE id = ${issueId}::uuid)
        ORDER BY a.created_at DESC
        LIMIT 20
      `),
    ]);

    return {
      issue: (issueRows as unknown as IssueDetail[])[0] ?? null,
      audit: auditRows as unknown as IssueAuditRow[],
    };
  });
}

const TYPE_LABEL: Record<string, string> = {
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
  return TYPE_LABEL[s] ?? s;
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
