// Inbox queries — reads issues + linked drafts + client display info
// for the /messages route.
//
// Returns the issues a firm-owner / preparer needs to act on, with
// each issue's draft action (if any) inlined for badge rendering.
// RLS-bound via withTenant.

import { sql } from 'drizzle-orm';
import { withTenant } from '@docket/db';
import type { TenantId } from '@docket/shared';

export type IssueListFilter = 'all' | 'needs-approval' | 'drafted' | 'resolved';

export interface InboxIssueRow {
  id: string;
  type: string;
  severity: 'high' | 'medium' | 'low';
  status: string;
  title: string;
  summary: string;
  ai_confidence: number | null;
  classified_by: string | null;
  created_at: string;
  resolved_at: string | null;
  client_id: string | null;
  client_name: string | null;
  draft_action_id: string | null;
  // Trust-gate verdict pulled from the linked action's tool_input.
  // Inbox-drafter writes { trustGate: { allowed, actionClass, requires?, reason? } }
  // when persisting (see classify-gmail-message — placeholder today).
  trust_gate_allowed: boolean | null;
  trust_gate_requires: string | null;
  draft_preview: string | null;
  [key: string]: unknown;
}

const FILTER_TO_WHERE: Record<IssueListFilter, string> = {
  all: '',
  'needs-approval': "AND a.tool_input->'trustGate'->>'allowed' = 'false'",
  drafted: 'AND a.id IS NOT NULL',
  resolved: "AND i.status = 'resolved'",
};

/**
 * Lists inbox issues for a tenant, joined with their draft action
 * (if any) and the client display name. RLS scopes to the tenant
 * via withTenant.
 *
 * Ordered by severity (high first) then created_at desc.
 */
export async function listInboxIssues(
  tenantId: string,
  filter: IssueListFilter = 'all',
  limit = 50,
): Promise<InboxIssueRow[]> {
  const whereClause = FILTER_TO_WHERE[filter] ?? '';
  return await withTenant(tenantId as TenantId, async (db) => {
    const rows = await db.execute<InboxIssueRow>(sql`
      SELECT
        i.id::text AS id,
        i.type::text AS type,
        i.severity::text AS severity,
        i.status::text AS status,
        i.title,
        i.summary,
        i.ai_confidence,
        i.classified_by,
        to_char(i.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
        CASE WHEN i.resolved_at IS NOT NULL
             THEN to_char(i.resolved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
             ELSE NULL
        END AS resolved_at,
        i.client_id::text AS client_id,
        c.full_name AS client_name,
        a.id::text AS draft_action_id,
        (a.tool_input->'trustGate'->>'allowed')::boolean AS trust_gate_allowed,
        a.tool_input->'trustGate'->>'requires' AS trust_gate_requires,
        SUBSTRING(COALESCE(a.tool_output->>'textPreview', ''), 1, 280) AS draft_preview
      FROM issues i
      LEFT JOIN clients c ON c.id = i.client_id
      LEFT JOIN actions a ON a.id = i.draft_action_id
      WHERE i.status != 'archived'
        ${sql.raw(whereClause)}
      ORDER BY
        CASE i.severity
          WHEN 'high' THEN 0
          WHEN 'medium' THEN 1
          ELSE 2
        END,
        i.created_at DESC
      LIMIT ${limit}
    `);
    return rows as unknown as InboxIssueRow[];
  });
}

export async function countInboxByFilter(tenantId: string): Promise<{
  all: number;
  needsApproval: number;
  drafted: number;
  resolved: number;
}> {
  return await withTenant(tenantId as TenantId, async (db) => {
    const rows = await db.execute<{
      total: number;
      needs_approval: number;
      drafted: number;
      resolved: number;
    }>(sql`
      SELECT
        COUNT(*) FILTER (WHERE i.status != 'archived')::int AS total,
        COUNT(*) FILTER (
          WHERE a.tool_input->'trustGate'->>'allowed' = 'false'
            AND i.status != 'archived'
        )::int AS needs_approval,
        COUNT(*) FILTER (
          WHERE a.id IS NOT NULL AND i.status != 'archived'
        )::int AS drafted,
        COUNT(*) FILTER (WHERE i.status = 'resolved')::int AS resolved
      FROM issues i
      LEFT JOIN actions a ON a.id = i.draft_action_id
    `);
    const r = (rows as unknown as Array<{
      total: number;
      needs_approval: number;
      drafted: number;
      resolved: number;
    }>)[0] ?? { total: 0, needs_approval: 0, drafted: 0, resolved: 0 };
    return {
      all: r.total,
      needsApproval: r.needs_approval,
      drafted: r.drafted,
      resolved: r.resolved,
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

export function labelForIssueType(type: string): string {
  return TYPE_LABEL[type] ?? type;
}
