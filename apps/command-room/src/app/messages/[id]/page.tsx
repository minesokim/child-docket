// /messages/[id] — issue detail view.
//
// The Open CTA on /home (Today's brief) and on /messages list rows
// land here. Shows the full issue + its drafted reply (if any) +
// the trust-gate verdict + a 20-row audit trail tail for the same
// client.
//
// Operational-modern visual language. CommandShell wrapper.

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentDocketUser } from '@/lib/current-user';
import { CommandShell } from '@/components/command-shell';
import {
  loadIssueDetail,
  labelForIssueType,
  formatRelativeTime,
  type IssueDetail,
} from '@/lib/issue-detail-queries';
import './issue-detail.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function severityClass(s: string): string {
  if (s === 'high') return 'idtl-sev-high';
  if (s === 'medium') return 'idtl-sev-med';
  return 'idtl-sev-low';
}

function trustBadge(issue: IssueDetail): { label: string; className: string } | null {
  if (!issue.draft_action_id) return null;
  if (issue.trust_gate_allowed === true) {
    return { label: 'Auto-send eligible', className: 'idtl-trust-allowed' };
  }
  if (issue.trust_gate_requires === 'refusal') {
    return { label: 'Refused — below floor', className: 'idtl-trust-refused' };
  }
  return { label: 'Needs your approval', className: 'idtl-trust-approval' };
}

function formatUsd(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: n < 1 ? 4 : 2,
    maximumFractionDigits: n < 1 ? 4 : 2,
  });
}

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentDocketUser();
  if (!user) redirect('/sign-in');

  const { id } = await params;
  const { issue, audit } = await loadIssueDetail(user.tenantId, id);
  if (!issue) notFound();

  const badge = trustBadge(issue);

  return (
    <CommandShell user={user} tenantName={user.tenantName} activeHref="/messages">
      <div className="idtl">
        <Link href="/messages" className="idtl-back">
          ← All messages
        </Link>

        <header className="idtl-header">
          <div className="idtl-meta">
            <span className={`idtl-sev ${severityClass(issue.severity)}`}>
              {issue.severity}
            </span>
            <span className="idtl-type">{labelForIssueType(issue.type)}</span>
            <span className="idtl-sep" aria-hidden="true">·</span>
            <span className="idtl-status">{issue.status}</span>
            {issue.client_name && (
              <>
                <span className="idtl-sep" aria-hidden="true">·</span>
                <Link href={`/clients/${issue.client_id}`} className="idtl-client-link">
                  {issue.client_name}
                </Link>
              </>
            )}
            <span className="idtl-sep" aria-hidden="true">·</span>
            <span className="idtl-time">{formatRelativeTime(issue.created_at)}</span>
            {issue.ai_confidence !== null && (
              <>
                <span className="idtl-sep" aria-hidden="true">·</span>
                <span className="idtl-conf" title="AI classifier confidence">
                  {Math.round(issue.ai_confidence * 100)}% confidence
                </span>
              </>
            )}
          </div>
          <h1 className="idtl-title">{issue.title}</h1>
          <p className="idtl-summary">{issue.summary}</p>
        </header>

        {issue.why_this_matters && (
          <section className="idtl-section">
            <div className="idtl-section-head">
              <h2 className="idtl-section-title">Why this matters</h2>
            </div>
            <div className="idtl-section-body">
              <p>{issue.why_this_matters}</p>
            </div>
          </section>
        )}

        {issue.recommended_action && (
          <section className="idtl-section">
            <div className="idtl-section-head">
              <h2 className="idtl-section-title">Recommended action</h2>
            </div>
            <div className="idtl-section-body">
              <p>{issue.recommended_action}</p>
            </div>
          </section>
        )}

        {issue.draft_action_id && issue.draft_body && (
          <section className="idtl-section idtl-draft">
            <div className="idtl-section-head">
              <div>
                <h2 className="idtl-section-title">AI draft</h2>
                <span className="idtl-section-meta">
                  {issue.draft_channel ?? 'email'}
                  {issue.draft_language && issue.draft_language !== 'en' && (
                    <> · {issue.draft_language}</>
                  )}
                  {issue.draft_confidence !== null && (
                    <> · {Math.round(issue.draft_confidence * 100)}% conf</>
                  )}
                  {issue.draft_cost_usd !== null && <> · {formatUsd(issue.draft_cost_usd)}</>}
                </span>
              </div>
              {badge && <span className={`idtl-trust ${badge.className}`}>{badge.label}</span>}
            </div>
            <div className="idtl-section-body">
              {issue.draft_subject && (
                <div className="idtl-draft-subject">
                  <span className="idtl-draft-label">Subject</span>
                  <span>{issue.draft_subject}</span>
                </div>
              )}
              <div className="idtl-draft-body">{issue.draft_body}</div>
              {issue.draft_reasoning && (
                <details className="idtl-draft-reasoning">
                  <summary>Why the agent wrote it this way</summary>
                  <p>{issue.draft_reasoning}</p>
                </details>
              )}
              {issue.trust_gate_reason && (
                <div className="idtl-trust-explain">
                  <span className="idtl-draft-label">Gate</span>
                  <span>{issue.trust_gate_reason}</span>
                </div>
              )}
              <div className="idtl-draft-actions">
                <button type="button" className="idtl-btn idtl-btn-primary" disabled>
                  Send as Antonio
                </button>
                <button type="button" className="idtl-btn" disabled>
                  Edit
                </button>
                <button type="button" className="idtl-btn idtl-btn-quiet" disabled>
                  Reject
                </button>
                <span className="idtl-actions-note">
                  Action wiring lands when /messages send-handler ships.
                </span>
              </div>
            </div>
          </section>
        )}

        {!issue.draft_action_id && (
          <section className="idtl-section">
            <div className="idtl-section-head">
              <h2 className="idtl-section-title">No draft</h2>
            </div>
            <div className="idtl-section-body">
              <p className="idtl-no-draft">
                The inbox-drafter hasn't run on this issue yet, or this issue type
                ({labelForIssueType(issue.type)}) is internal-only and doesn't produce a
                client-facing draft.
              </p>
            </div>
          </section>
        )}

        {audit.length > 0 && (
          <section className="idtl-section">
            <div className="idtl-section-head">
              <h2 className="idtl-section-title">Recent activity for this client</h2>
              <span className="idtl-section-meta">last {audit.length} actions</span>
            </div>
            <ul className="idtl-audit">
              {audit.map((row) => (
                <li key={row.id} className="idtl-audit-row">
                  <span className="idtl-audit-name">
                    {row.agent_id ?? row.tool_name}
                    {!row.success && (
                      <span className="idtl-audit-fail" title="Action failed">
                        failed
                      </span>
                    )}
                  </span>
                  <span className="idtl-audit-class">{row.action_class}</span>
                  <span className="idtl-audit-cost">
                    {row.cost_usd !== null ? formatUsd(row.cost_usd) : ''}
                  </span>
                  <span className="idtl-audit-time">{formatRelativeTime(row.created_at)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </CommandShell>
  );
}
