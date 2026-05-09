// /dashboard/cost — Anthropic-spend visibility for firm owners.
//
// Pull-side companion to the cost-runaway-alert hourly cron (push):
//   - alert fires Sentry/Inngest dashboard warnings on threshold breach
//   - this page shows where the spend went (per-agent, per-model,
//     per-provider, per-day) so Antonio can act
//
// FIRST UI SURFACE in the operational-modern visual language locked
// 2026-05-08. Per CLAUDE.md §11 + .claude/skills/craft/SKILL.md +
// docs/visual-reference/dashboard-2026-05-08/README.md:
//   - Inter sans for both display + body (NOT Fraunces — that's
//     reserved for client-portal editorial-warm)
//   - Faint warm-gray canvas, white card, soft 1px borders
//   - 10-12px radius
//   - Tab-bar-under-title composition
//   - Stats-card row with tinted icon-circle + eyebrow + big number
//     + supporting line + delta
//   - Forest green for accent (NOT iOS blue)
//   - Inline SVG icons (Lucide-react deferred until icon inventory
//     justifies the dep)
//
// AUTH + AUTHZ
//   Clerk middleware enforces sign-in above the route.
//   Page-level role check: only firm_owner sees the data; preparers
//   see an "access restricted" empty state. Tenant-scoped via
//   withTenant — RLS binds the SUM. Even an Antonio with admin
//   Clerk session can't see another firm's spend.
//
// SCOPING
//   ?window=24h | 7d | 30d (default 7d). Tabs under the title
//   switch between them. Server-rendered each request (force-dynamic).

import { redirect } from 'next/navigation';
import { getCurrentDocketUser } from '@/lib/current-user';
import { CommandShell } from '@/components/command-shell';
import {
  loadCostData,
  loadCostAlerts,
  type CostData,
  type CostAlertRow,
  type Window,
  ALLOWED_WINDOWS,
  WINDOW_INTERVAL,
} from '@/lib/cost-rollups';
import './cost-dashboard.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WINDOW_LABEL: Record<Window, string> = {
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
};

function formatUsd(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: n < 1 ? 4 : 2,
    maximumFractionDigits: n < 1 ? 4 : 2,
  });
}

function formatTokens(n: number | bigint): string {
  const num = typeof n === 'bigint' ? Number(n) : n;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return String(num);
}

// Inline SVGs — no Lucide-react dep yet (icon inventory too small to
// justify). Each glyph picked for meaning, not decoration.
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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
function IconCpu() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
    </svg>
  );
}
function IconLayers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 2 9 5-9 5-9-5 9-5z" />
      <path d="m3 17 9 5 9-5" />
      <path d="m3 12 9 5 9-5" />
    </svg>
  );
}
function IconCache() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
      <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
    </svg>
  );
}

// Inline alerts banner. Renders the 1–N most recent
// cost_(runaway|outlier|spike).detected audit rows. Never overrides the
// page; it adds context above the rollup so Antonio sees the spike before
// he reads the chart.
//
// Anti-AI-slop discipline:
//   - No left-border accents (per CLAUDE.md §19)
//   - No decorative icons; one inline SVG warning glyph at the eyebrow
//   - Forest green primary for "ok" tones, ember (clay) for warning
//   - Real numbers in the copy, not "high cost" generic language
function CostAlertsBanner({ alerts }: { alerts: CostAlertRow[] }) {
  return (
    <section className="cd-alerts" aria-live="polite" aria-label="Recent cost alerts">
      <header className="cd-alerts-head">
        <span className="cd-alerts-eyebrow">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
          {alerts.length} {alerts.length === 1 ? 'alert' : 'alerts'} this window
        </span>
        <span className="cd-alerts-meta">Auto-detected by background crons</span>
      </header>
      <ul className="cd-alerts-list">
        {alerts.map((a, i) => (
          <li key={`${a.detected_at}-${i}`} className="cd-alert-row">
            <CostAlertLine alert={a} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CostAlertLine({ alert }: { alert: CostAlertRow }) {
  const detected = new Date(alert.detected_at);
  const ago = formatRelative(detected);

  if (alert.kind === 'cost_runaway.detected') {
    const scope = (alert.payload.scope as string | undefined) ?? '?';
    const total = Number(alert.payload.total_usd ?? 0);
    const threshold = Number(alert.payload.threshold_usd ?? 0);
    return (
      <>
        <span className="cd-alert-kind cd-alert-kind-runaway">Runaway</span>
        <span className="cd-alert-line">
          {scope === 'global' ? 'Global' : 'Per-tenant'} spend hit{' '}
          <strong>{formatUsd(total)}</strong> over 24h (ceiling{' '}
          {formatUsd(threshold)})
        </span>
        <span className="cd-alert-time">{ago}</span>
      </>
    );
  }

  if (alert.kind === 'cost_outlier.detected') {
    const cost = Number(alert.payload.cost_usd ?? 0);
    const threshold = Number(alert.payload.threshold_usd ?? 0);
    const tool = (alert.payload.tool_name as string | undefined) ?? 'unknown call';
    const model = (alert.payload.model_used as string | undefined) ?? null;
    return (
      <>
        <span className="cd-alert-kind cd-alert-kind-outlier">Outlier</span>
        <span className="cd-alert-line">
          One <code>{tool}</code>
          {model ? <> on <code>{model}</code></> : null} cost{' '}
          <strong>{formatUsd(cost)}</strong> (threshold {formatUsd(threshold)})
        </span>
        <span className="cd-alert-time">{ago}</span>
      </>
    );
  }

  if (alert.kind === 'cost_spike.detected') {
    const today = Number(alert.payload.today_usd ?? 0);
    const yesterday = Number(alert.payload.yesterday_usd ?? 0);
    const ratio = Number(alert.payload.ratio ?? 0);
    return (
      <>
        <span className="cd-alert-kind cd-alert-kind-spike">Spike</span>
        <span className="cd-alert-line">
          Today {formatUsd(today)} vs yesterday {formatUsd(yesterday)} —{' '}
          <strong>{ratio.toFixed(2)}× day-over-day</strong>
        </span>
        <span className="cd-alert-time">{ago}</span>
      </>
    );
  }

  return null;
}

function formatRelative(d: Date): string {
  const ms = Date.now() - d.getTime();
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default async function CostDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const user = await getCurrentDocketUser();
  if (!user) redirect('/sign-in');

  const params = await searchParams;
  const requested = params.window as Window | undefined;
  const windowKey: Window =
    requested && ALLOWED_WINDOWS.includes(requested) ? requested : '7d';

  if (user.role !== 'firm_owner') {
    return (
      <CommandShell user={user} tenantName={user.tenantName} activeHref="/dashboard/cost">
        <div className="cost-dashboard">
          <div className="cd-restricted">
            <h1 className="cd-restricted-title">Cost dashboard is firm-owner-only</h1>
            <p className="cd-restricted-body">
              You're signed in as <span className="cd-restricted-role">{user.role}</span>.
              Ask Antonio to grant firm-owner access if you need spend visibility.
            </p>
          </div>
        </div>
      </CommandShell>
    );
  }

  let data: CostData | null = null;
  let alerts: CostAlertRow[] = [];
  let errorMessage: string | null = null;
  try {
    [data, alerts] = await Promise.all([
      loadCostData(user.tenantId, WINDOW_INTERVAL[windowKey]),
      loadCostAlerts(user.tenantId, WINDOW_INTERVAL[windowKey]),
    ]);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'Database unreachable';
  }

  return (
    <CommandShell user={user} tenantName={user.tenantName} activeHref="/dashboard/cost">
    <div className="cost-dashboard">
      <header className="cd-header">
        <div className="cd-eyebrow">Practice spend</div>
        <h1 className="cd-title">Cost</h1>
        <nav className="cd-tabs" aria-label="Time window">
          {ALLOWED_WINDOWS.map((w) => (
            <a
              key={w}
              href={`/dashboard/cost?window=${w}`}
              className={`cd-tab ${w === windowKey ? 'cd-tab-active' : ''}`}
              aria-current={w === windowKey ? 'page' : undefined}
            >
              {WINDOW_LABEL[w]}
            </a>
          ))}
        </nav>
      </header>

      {errorMessage ? (
        <div className="cd-error" role="alert">
          <div className="cd-error-title">Couldn't load cost data</div>
          <div className="cd-error-body">{errorMessage}</div>
          <a href={`/dashboard/cost?window=${windowKey}`} className="cd-error-retry">
            Retry
          </a>
        </div>
      ) : !data || data.totals.call_count === 0 ? (
        <div className="cd-empty">
          <div className="cd-empty-title">Quiet {windowKey === '24h' ? 'day' : 'week'}.</div>
          <div className="cd-empty-body">
            Anthropic spend over the {WINDOW_LABEL[windowKey].toLowerCase()} is $0.0000. No
            agent calls recorded against your tenant.
          </div>
        </div>
      ) : (
        <>
          {alerts.length > 0 ? (
            <CostAlertsBanner alerts={alerts} />
          ) : null}

          {/* Stats-card row — 5 modular cards, tinted icon-circle + eyebrow + big number + supporting */}
          <section className="cd-stats" aria-label="Spend summary">
            <article className="cd-stat">
              <div className="cd-stat-icon cd-stat-icon-forest" aria-hidden="true">
                <IconWallet />
              </div>
              <div className="cd-stat-eyebrow">Total spend</div>
              <div className="cd-stat-value">{formatUsd(data.totals.total_usd)}</div>
              <div className="cd-stat-supporting">
                {WINDOW_LABEL[windowKey].toLowerCase()}
              </div>
            </article>

            <article className="cd-stat">
              <div className="cd-stat-icon cd-stat-icon-clay" aria-hidden="true">
                <IconActivity />
              </div>
              <div className="cd-stat-eyebrow">Agent calls</div>
              <div className="cd-stat-value">{data.totals.call_count.toLocaleString()}</div>
              <div className="cd-stat-supporting">
                {data.perAgent.length} {data.perAgent.length === 1 ? 'agent' : 'agents'}
              </div>
            </article>

            <article className="cd-stat">
              <div className="cd-stat-icon cd-stat-icon-dusk" aria-hidden="true">
                <IconCpu />
              </div>
              <div className="cd-stat-eyebrow">Input tokens</div>
              <div className="cd-stat-value">{formatTokens(data.totals.total_input_tokens)}</div>
              <div className="cd-stat-supporting">across all calls</div>
            </article>

            <article className="cd-stat">
              <div className="cd-stat-icon cd-stat-icon-sand" aria-hidden="true">
                <IconLayers />
              </div>
              <div className="cd-stat-eyebrow">Output tokens</div>
              <div className="cd-stat-value">{formatTokens(data.totals.total_output_tokens)}</div>
              <div className="cd-stat-supporting">model responses</div>
            </article>

            <article className="cd-stat">
              <div className="cd-stat-icon cd-stat-icon-moss" aria-hidden="true">
                <IconCache />
              </div>
              <div className="cd-stat-eyebrow">Cached tokens</div>
              <div className="cd-stat-value">{formatTokens(data.totals.total_cached_tokens)}</div>
              <div className="cd-stat-supporting">
                {(() => {
                  // Cache hit rate as % of total input tokens. Per
                  // Anthropic prompt-caching: cached tokens cost ~10%
                  // of normal input tokens, so this percent maps
                  // directly to cost savings on the input side.
                  // Target: 80%+ for repeated-system-prompt agents
                  // (per COSTS.md anchor).
                  const input = Number(data.totals.total_input_tokens);
                  const cached = Number(data.totals.total_cached_tokens);
                  if (!Number.isFinite(input) || input <= 0) {
                    return 'prompt-cache hits';
                  }
                  const pct = Math.min(100, Math.round((cached / input) * 100));
                  return `${pct}% cache hit on input`;
                })()}
              </div>
            </article>
          </section>

          {/* Two-column body: per-day on left, per-agent + per-model + per-provider on right */}
          <section className="cd-body">
            <div className="cd-card">
              <div className="cd-card-head">
                <h2 className="cd-card-title">Per day</h2>
                <span className="cd-card-meta">
                  {data.perDay.length} {data.perDay.length === 1 ? 'day' : 'days'} of activity
                </span>
              </div>
              <div className="cd-perday">
                {data.perDay.map((row) => {
                  const max = Math.max(...data!.perDay.map((d) => d.total_usd), 0.0001);
                  const pct = (row.total_usd / max) * 100;
                  return (
                    <div className="cd-perday-row" key={row.day}>
                      <span className="cd-perday-day">{row.day}</span>
                      <span className="cd-perday-bar-wrap">
                        <span
                          className="cd-perday-bar"
                          style={{ width: `${Math.max(pct, 2)}%` }}
                          aria-hidden="true"
                        />
                      </span>
                      <span className="cd-perday-amount">{formatUsd(row.total_usd)}</span>
                      <span className="cd-perday-calls">
                        {row.call_count.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="cd-side">
              <div className="cd-card">
                <div className="cd-card-head">
                  <h2 className="cd-card-title">By agent</h2>
                </div>
                <ul className="cd-rollup">
                  {data.perAgent.map((row) => (
                    <li key={String(row.agent_id ?? 'orchestrator')} className="cd-rollup-row">
                      <span className="cd-rollup-label">
                        {row.agent_id ?? <em>orchestrator</em>}
                      </span>
                      <span className="cd-rollup-value">{formatUsd(row.total_usd)}</span>
                      <span className="cd-rollup-calls">{row.call_count}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="cd-card">
                <div className="cd-card-head">
                  <h2 className="cd-card-title">By model</h2>
                </div>
                <ul className="cd-rollup">
                  {data.perModel.map((row) => (
                    <li key={String(row.model_used ?? 'unknown')} className="cd-rollup-row">
                      <span className="cd-rollup-label">
                        {row.model_used ?? <em>unknown</em>}
                      </span>
                      <span className="cd-rollup-value">{formatUsd(row.total_usd)}</span>
                      <span className="cd-rollup-calls">{row.call_count}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="cd-card">
                <div className="cd-card-head">
                  <h2 className="cd-card-title">By provider</h2>
                </div>
                <ul className="cd-rollup">
                  {data.perProvider.map((row) => (
                    <li key={row.provider} className="cd-rollup-row">
                      <span className="cd-rollup-label">{row.provider}</span>
                      <span className="cd-rollup-value">{formatUsd(row.total_usd)}</span>
                      <span className="cd-rollup-calls">{row.call_count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
    </CommandShell>
  );
}
