// / — Home dashboard. Today's brief + practice stats + recent activity.
//
// First thing Antonio sees on sign-in. Per the user-shared dashboard
// reference (docs/visual-reference/dashboard-2026-05-08), the
// composition is:
//   - "Today's brief" hero block with statement headline + numbered
//     items + per-item action buttons
//   - 5-card stats row with tinted icon-circles
//   - Recent activity feed (right column)
//
// Operational-modern visual language. CommandShell wrapper.
//
// Replaces the prior root which redirected to /dashboard then /clients.
// /dashboard now redirects HERE (so the post-sign-in Clerk fallback
// URL still resolves correctly).

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentDocketUser } from '@/lib/current-user';
import { CommandShell } from '@/components/command-shell';
import {
  loadHomeData,
  formatRelativeTime,
  labelForIssueType,
  labelForActivity,
  type HomeData,
} from '@/lib/home-queries';
import './home.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function severityClass(s: string): string {
  if (s === 'high') return 'home-sev-high';
  if (s === 'medium') return 'home-sev-med';
  return 'home-sev-low';
}

function formatUsd(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: n < 1 ? 4 : 2,
    maximumFractionDigits: n < 1 ? 4 : 2,
  });
}

function nextDeadlineCue(briefCount: number, severity: string | undefined): string {
  if (briefCount === 0) return 'Clear deck. No issues need attention right now.';
  const verb = briefCount === 1 ? 'item needs' : 'items need';
  const tone = severity === 'high' ? 'today' : 'soon';
  return `${briefCount} ${verb} attention ${tone}.`;
}

// Inline SVG icons (Lucide-style line glyphs).
function IconUsers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </svg>
  );
}
function IconCheckCircle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
function IconAlert() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
function IconFile() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
function IconWallet() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
    </svg>
  );
}
function IconActivity() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

export default async function HomePage() {
  const user = await getCurrentDocketUser();
  if (!user) redirect('/sign-in');

  let data: HomeData | null = null;
  let errorMessage: string | null = null;
  try {
    data = await loadHomeData(user.tenantId);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'Home query failed';
  }

  const topSeverity = data?.brief[0]?.severity;
  const headline =
    data === null ? '' : nextDeadlineCue(data.brief.length, topSeverity);

  return (
    <CommandShell user={user} tenantName={user.tenantName} activeHref="/">
      <div className="home">
        <header className="home-header">
          <div className="home-eyebrow">{user.tenantName}</div>
          <h1 className="home-title">Home</h1>
        </header>

        {errorMessage ? (
          <div className="home-error" role="alert">
            <div className="home-error-title">Couldn't load your morning brief</div>
            <div className="home-error-body">{errorMessage}</div>
            <a href="/" className="home-error-retry">
              Retry
            </a>
          </div>
        ) : data === null ? null : (
          <>
            {/* Today's brief — statement headline + numbered items + per-item action */}
            <section className="home-brief">
              <div className="home-brief-head">
                <div className="home-brief-eyebrow">Today's brief</div>
                <span className="home-brief-time">
                  Updated {new Date().toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <h2 className="home-brief-headline">{headline}</h2>
              {data.brief.length === 0 ? (
                <p className="home-brief-body">
                  No urgent issues. Use this time for prep work, deep review, or
                  the Discovery agent (when it's enabled).
                </p>
              ) : (
                <ol className="home-brief-list">
                  {data.brief.map((issue, idx) => (
                    <li key={issue.id} className="home-brief-item">
                      <span className="home-brief-num" aria-hidden="true">
                        {idx + 1}
                      </span>
                      <div className="home-brief-main">
                        <div className="home-brief-meta">
                          <span className={`home-sev ${severityClass(issue.severity)}`}>
                            {issue.severity}
                          </span>
                          <span className="home-brief-type">
                            {labelForIssueType(issue.type)}
                          </span>
                          {issue.client_name && (
                            <>
                              <span className="home-sep" aria-hidden="true">·</span>
                              <span className="home-brief-client">{issue.client_name}</span>
                            </>
                          )}
                          <span className="home-sep" aria-hidden="true">·</span>
                          <span className="home-brief-time">
                            {formatRelativeTime(issue.created_at)}
                          </span>
                        </div>
                        <div className="home-brief-text">{issue.title}</div>
                        {issue.recommended_action && (
                          <div className="home-brief-action">{issue.recommended_action}</div>
                        )}
                      </div>
                      <Link
                        href={`/messages?filter=all`}
                        className="home-brief-cta"
                        aria-label={`Open ${issue.title} in inbox`}
                      >
                        Open
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {/* Stats-card row */}
            <section className="home-stats" aria-label="Practice summary">
              <article className="home-stat">
                <div className="home-stat-icon home-stat-icon-clay" aria-hidden="true">
                  <IconUsers />
                </div>
                <div className="home-stat-eyebrow">Active clients</div>
                <div className="home-stat-value">
                  {data.stats.active_clients.toLocaleString()}
                </div>
                <div className="home-stat-supporting">in the practice</div>
              </article>

              <article className="home-stat">
                <div className="home-stat-icon home-stat-icon-forest" aria-hidden="true">
                  <IconCheckCircle />
                </div>
                <div className="home-stat-eyebrow">Reviews ready</div>
                <div className="home-stat-value">{data.stats.reviews_ready.toLocaleString()}</div>
                <div className="home-stat-supporting">drafts awaiting approval</div>
              </article>

              <article className="home-stat">
                <div className="home-stat-icon home-stat-icon-red" aria-hidden="true">
                  <IconAlert />
                </div>
                <div className="home-stat-eyebrow">Notices due</div>
                <div className="home-stat-value">{data.stats.notices_due.toLocaleString()}</div>
                <div className="home-stat-supporting">IRS notices to respond</div>
              </article>

              <article className="home-stat">
                <div className="home-stat-icon home-stat-icon-dusk" aria-hidden="true">
                  <IconFile />
                </div>
                <div className="home-stat-eyebrow">Docs pending</div>
                <div className="home-stat-value">{data.stats.docs_pending.toLocaleString()}</div>
                <div className="home-stat-supporting">awaiting classification</div>
              </article>

              <article className="home-stat">
                <div className="home-stat-icon home-stat-icon-sand" aria-hidden="true">
                  <IconWallet />
                </div>
                <div className="home-stat-eyebrow">24h spend</div>
                <div className="home-stat-value">{formatUsd(data.stats.spend_24h_usd)}</div>
                <div className="home-stat-supporting">
                  <Link href="/dashboard/cost" className="home-stat-link">
                    Cost detail →
                  </Link>
                </div>
              </article>
            </section>

            {/* Activity feed */}
            <section className="home-activity-block">
              <div className="home-activity-head">
                <h2 className="home-activity-title">Recent activity</h2>
                <span className="home-activity-meta">last 10 actions</span>
              </div>
              {data.activity.length === 0 ? (
                <div className="home-activity-empty">
                  No agent activity yet. The audit trail starts populating when the
                  classifier or drafter runs against real signals.
                </div>
              ) : (
                <ul className="home-activity">
                  {data.activity.map((row) => (
                    <li key={row.id} className="home-activity-row">
                      <span className="home-activity-icon" aria-hidden="true">
                        <IconActivity />
                      </span>
                      <div className="home-activity-main">
                        <div className="home-activity-label">{labelForActivity(row)}</div>
                        <div className="home-activity-sub">
                          {row.client_name ?? <em>system</em>}
                          {row.cost_usd !== null && (
                            <>
                              <span className="home-sep" aria-hidden="true">·</span>
                              {formatUsd(row.cost_usd)}
                            </>
                          )}
                        </div>
                      </div>
                      <span className="home-activity-time">
                        {formatRelativeTime(row.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </CommandShell>
  );
}
