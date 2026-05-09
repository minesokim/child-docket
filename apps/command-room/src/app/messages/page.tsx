// /messages — Antonio's inbox of AI-classified issues + drafted replies.
//
// Closes two gaps:
//   1. The /messages 404 (CLAUDE.md §18 known stub).
//   2. The trust-gate UI badge consumer — every draft now shows
//      "Auto-send eligible" / "Needs approval" / "Refused" based on
//      the verdict the inbox-drafter recorded in the action's
//      tool_input.trustGate object.
//
// Per CLAUDE.md §4 + .claude/skills/craft + visual-reference: command-
// room route, operational-modern visual language, CommandShell wrapper,
// Inter sans, soft 1px borders, low-saturation status pills.

import { redirect } from 'next/navigation';
import { getCurrentDocketUser } from '@/lib/current-user';
import { CommandShell } from '@/components/command-shell';
import {
  listInboxIssues,
  countInboxByFilter,
  formatRelativeTime,
  labelForIssueType,
  type IssueListFilter,
  type InboxIssueRow,
} from '@/lib/inbox-queries';
import './inbox.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FILTER_TABS: { key: IssueListFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'needs-approval', label: 'Needs approval' },
  { key: 'drafted', label: 'Drafted' },
  { key: 'resolved', label: 'Resolved' },
];

const ALLOWED_FILTERS = new Set<IssueListFilter>([
  'all',
  'needs-approval',
  'drafted',
  'resolved',
]);

function severityClass(severity: string): string {
  if (severity === 'high') return 'inbox-sev-high';
  if (severity === 'medium') return 'inbox-sev-med';
  return 'inbox-sev-low';
}

function trustBadge(row: InboxIssueRow): { label: string; className: string } | null {
  if (row.draft_action_id === null) return null;
  if (row.trust_gate_allowed === true) {
    return { label: 'Auto-send eligible', className: 'inbox-badge-allowed' };
  }
  if (row.trust_gate_requires === 'refusal') {
    return { label: 'Refused — below floor', className: 'inbox-badge-refused' };
  }
  // Default for any drafted issue without an explicit allowed=true is
  // "needs approval" — the conservative posture per the trust-gate
  // grid (L1 firm, send-external = blocked-for-approval).
  return { label: 'Needs approval', className: 'inbox-badge-approval' };
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await getCurrentDocketUser();
  if (!user) redirect('/sign-in');

  const params = await searchParams;
  const requested = params.filter as IssueListFilter | undefined;
  const filter: IssueListFilter =
    requested && ALLOWED_FILTERS.has(requested) ? requested : 'all';

  let issues: InboxIssueRow[] = [];
  let counts = { all: 0, needsApproval: 0, drafted: 0, resolved: 0 };
  let errorMessage: string | null = null;
  try {
    [issues, counts] = await Promise.all([
      listInboxIssues(user.tenantId, filter, 100),
      countInboxByFilter(user.tenantId),
    ]);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'Inbox query failed';
  }

  return (
    <CommandShell user={user} tenantName={user.tenantName} activeHref="/messages">
      <div className="inbox">
        <header className="inbox-header">
          <div className="inbox-eyebrow">Practice inbox</div>
          <h1 className="inbox-title">Messages</h1>
          <nav className="inbox-tabs" aria-label="Inbox filter">
            {FILTER_TABS.map((tab) => {
              const count =
                tab.key === 'all'
                  ? counts.all
                  : tab.key === 'needs-approval'
                    ? counts.needsApproval
                    : tab.key === 'drafted'
                      ? counts.drafted
                      : counts.resolved;
              return (
                <a
                  key={tab.key}
                  href={`/messages?filter=${tab.key}`}
                  className={`inbox-tab ${tab.key === filter ? 'inbox-tab-active' : ''}`}
                  aria-current={tab.key === filter ? 'page' : undefined}
                >
                  <span>{tab.label}</span>
                  <span className="inbox-tab-count">{count.toLocaleString()}</span>
                </a>
              );
            })}
          </nav>
        </header>

        {errorMessage ? (
          <div className="inbox-error" role="alert">
            <div className="inbox-error-title">Couldn't load inbox</div>
            <div className="inbox-error-body">{errorMessage}</div>
            <a href={`/messages?filter=${filter}`} className="inbox-error-retry">
              Retry
            </a>
          </div>
        ) : issues.length === 0 ? (
          <div className="inbox-empty">
            <div className="inbox-empty-title">
              {filter === 'all'
                ? 'Inbox is empty.'
                : filter === 'needs-approval'
                  ? 'Nothing waiting for your approval.'
                  : filter === 'drafted'
                    ? 'No drafts ready.'
                    : 'No resolved issues yet.'}
            </div>
            <div className="inbox-empty-body">
              {filter === 'all'
                ? 'When new client signals come in (Gmail, SMS, portal chat) the triage classifier surfaces them here.'
                : filter === 'needs-approval'
                  ? 'Drafts that require your approval will appear here when the trust gate flags them.'
                  : filter === 'drafted'
                    ? 'When the inbox-drafter writes a draft, it lands here for review.'
                    : 'Resolved issues stay archived for audit trail.'}
            </div>
          </div>
        ) : (
          <ul className="inbox-list" aria-label="Inbox items">
            {issues.map((row) => {
              const badge = trustBadge(row);
              return (
                <li key={row.id} className="inbox-item">
                  <div className="inbox-item-left">
                    <span className={`inbox-sev ${severityClass(row.severity)}`} aria-label={`Severity ${row.severity}`}>
                      {row.severity}
                    </span>
                  </div>
                  <div className="inbox-item-main">
                    <div className="inbox-item-meta">
                      <span className="inbox-item-type">{labelForIssueType(row.type)}</span>
                      {row.client_name && (
                        <>
                          <span className="inbox-item-sep" aria-hidden="true">·</span>
                          <span className="inbox-item-client">{row.client_name}</span>
                        </>
                      )}
                      <span className="inbox-item-sep" aria-hidden="true">·</span>
                      <span className="inbox-item-time">{formatRelativeTime(row.created_at)}</span>
                    </div>
                    <div className="inbox-item-title">{row.title}</div>
                    <div className="inbox-item-summary">{row.summary}</div>
                    {row.draft_preview && (
                      <div className="inbox-item-draft">
                        <span className="inbox-item-draft-label">Draft</span>
                        <span className="inbox-item-draft-text">{row.draft_preview}</span>
                      </div>
                    )}
                  </div>
                  <div className="inbox-item-right">
                    {badge && (
                      <span className={`inbox-badge ${badge.className}`}>{badge.label}</span>
                    )}
                    {row.ai_confidence !== null && (
                      <span className="inbox-conf" title="AI confidence">
                        {Math.round(row.ai_confidence * 100)}%
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </CommandShell>
  );
}
