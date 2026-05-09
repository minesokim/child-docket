// /settings — practice + integrations + trust-level overview.
//
// Closes the last /settings 404 (CLAUDE.md section 18 known stub).
// Surfaces the firm's current configuration in read-only form for v0:
//   - Tenant info (name, slug, default trust level)
//   - User profile (name, email, role) for the signed-in staff member
//   - Integrations status (Twilio / Square / DocuSign / Gmail
//     credentials present? per-tenant)
//   - Audit chain status (chain length + last-verified timestamp)
//
// Edit forms come in v1.5 — for the down-market segment Antonio + his
// team change tenant settings via direct DB UPDATE today; this page
// is the read-only diagnostic surface that lets him SEE what's set.

import { sql } from 'drizzle-orm';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { withTenant } from '@docket/db';
import type { TenantId } from '@docket/shared';
import { getCurrentDocketUser } from '@/lib/current-user';
import { CommandShell } from '@/components/command-shell';
import './settings.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  default_trust_level: string;
  clerk_org_id: string | null;
  created_at: string;
  [key: string]: unknown;
}

interface IntegrationsStatus {
  twilio: boolean;
  square: boolean;
  docusign: boolean;
  gmail: boolean;
  [key: string]: unknown;
}

interface AuditStatus {
  total_actions: number;
  max_chain_seq: number | null;
  last_action_at: string | null;
  [key: string]: unknown;
}

interface SettingsData {
  tenant: TenantInfo | null;
  integrations: IntegrationsStatus;
  audit: AuditStatus;
}

async function loadSettings(tenantId: string): Promise<SettingsData> {
  return await withTenant(tenantId as TenantId, async (db) => {
    const [tenantRows, credRows, auditRows] = await Promise.all([
      db.execute<TenantInfo>(sql`
        SELECT
          id::text AS id,
          name,
          slug,
          default_trust_level::text AS default_trust_level,
          clerk_org_id,
          to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
        FROM tenants
        WHERE id = ${tenantId}::uuid
      `),
      db.execute<{ kind: string }>(sql`
        SELECT DISTINCT kind FROM tenant_credentials WHERE tenant_id = ${tenantId}::uuid
      `),
      db.execute<AuditStatus>(sql`
        SELECT
          COUNT(*)::int AS total_actions,
          MAX(chain_seq)::int AS max_chain_seq,
          CASE WHEN MAX(created_at) IS NOT NULL
               THEN to_char(MAX(created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
               ELSE NULL END AS last_action_at
        FROM actions
      `),
    ]);

    const kindsPresent = new Set(
      (credRows as unknown as Array<{ kind: string }>).map((r) => r.kind),
    );
    const integrations: IntegrationsStatus = {
      twilio: kindsPresent.has('twilio'),
      square: kindsPresent.has('square'),
      docusign: kindsPresent.has('docusign'),
      gmail: kindsPresent.has('gmail'),
    };

    return {
      tenant: (tenantRows as unknown as TenantInfo[])[0] ?? null,
      integrations,
      audit: (auditRows as unknown as AuditStatus[])[0] ?? {
        total_actions: 0,
        max_chain_seq: null,
        last_action_at: null,
      },
    };
  });
}

const TRUST_LEVEL_DESCRIPTIONS: Record<string, string> = {
  '1': 'L1 — every external send requires preparer approval (conservative starting posture).',
  '2': 'L2 — Tier 1 positions auto-accepted; Tier 2-4 require preparer.',
  '3': 'L3 — Tier 1-2 positions auto-accepted; Tier 3-4 require preparer; weekly L1-2 audit review.',
  '4': 'L4 — Tier 1-2 auto; Tier 3 auto-flags with default 8275 disclosure; Tier 4 EA decides.',
};

const INTEGRATION_LABELS: Record<keyof IntegrationsStatus, { name: string; purpose: string }> = {
  twilio: { name: 'Twilio', purpose: 'SMS invites + bidirectional client messaging' },
  square: { name: 'Square', purpose: '$50 deposit checkout links' },
  docusign: { name: 'DocuSign', purpose: '8879 e-sign with KBA (IRS Pub 1345)' },
  gmail: { name: 'Gmail', purpose: 'Inbound email classification + draft replies' },
};

function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.floor((now - t) / 60_000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export default async function SettingsPage() {
  const user = await getCurrentDocketUser();
  if (!user) redirect('/sign-in');

  let data: SettingsData | null = null;
  let errorMessage: string | null = null;
  try {
    data = await loadSettings(user.tenantId);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'Settings query failed';
  }

  return (
    <CommandShell user={user} tenantName={user.tenantName} activeHref="/settings">
      <div className="settings">
        <header className="settings-header">
          <div className="settings-eyebrow">Practice configuration</div>
          <h1 className="settings-title">Settings</h1>
          <p className="settings-subtitle">
            Read-only diagnostic view of your tenant + integrations + audit
            chain. Edit forms land in v1.5; today, configuration changes go
            through direct DB updates.
          </p>
        </header>

        {errorMessage ? (
          <div className="settings-error" role="alert">
            <div className="settings-error-title">Couldn't load settings</div>
            <div className="settings-error-body">{errorMessage}</div>
          </div>
        ) : data === null ? null : (
          <>
            <section className="settings-section">
              <div className="settings-section-head">
                <h2 className="settings-section-title">Profile</h2>
              </div>
              <dl className="settings-list">
                <div className="settings-row">
                  <dt>Name</dt>
                  <dd>{user.name ?? <em>not set</em>}</dd>
                </div>
                <div className="settings-row">
                  <dt>Email</dt>
                  <dd>{user.email}</dd>
                </div>
                <div className="settings-row">
                  <dt>Role</dt>
                  <dd>
                    <span className="settings-role">{user.role}</span>
                  </dd>
                </div>
                <div className="settings-row">
                  <dt>Avatar</dt>
                  <dd>
                    {user.avatarUrl ? (
                      <span className="settings-mono">{user.avatarUrl.slice(0, 50)}…</span>
                    ) : (
                      <em>using initials fallback</em>
                    )}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="settings-section">
              <div className="settings-section-head">
                <h2 className="settings-section-title">Tenant</h2>
              </div>
              {data.tenant ? (
                <dl className="settings-list">
                  <div className="settings-row">
                    <dt>Name</dt>
                    <dd>{data.tenant.name}</dd>
                  </div>
                  <div className="settings-row">
                    <dt>Slug</dt>
                    <dd>
                      <span className="settings-mono">{data.tenant.slug}</span>
                    </dd>
                  </div>
                  <div className="settings-row">
                    <dt>Tenant ID</dt>
                    <dd>
                      <span className="settings-mono">{data.tenant.id}</span>
                    </dd>
                  </div>
                  <div className="settings-row">
                    <dt>Default trust level</dt>
                    <dd>
                      <div className="settings-trust">
                        <span className="settings-trust-pill">
                          L{data.tenant.default_trust_level}
                        </span>
                        <span className="settings-trust-desc">
                          {TRUST_LEVEL_DESCRIPTIONS[data.tenant.default_trust_level] ??
                            'Unknown trust level'}
                        </span>
                      </div>
                    </dd>
                  </div>
                  <div className="settings-row">
                    <dt>Clerk org link</dt>
                    <dd>
                      {data.tenant.clerk_org_id ? (
                        <span className="settings-mono">{data.tenant.clerk_org_id}</span>
                      ) : (
                        <em>not linked (using email-claim fallback)</em>
                      )}
                    </dd>
                  </div>
                </dl>
              ) : (
                <div className="settings-empty">Tenant row not found.</div>
              )}
            </section>

            <section className="settings-section">
              <div className="settings-section-head">
                <h2 className="settings-section-title">Integrations</h2>
                <Link href="/settings/credentials" className="settings-section-link">
                  Manage credentials →
                </Link>
              </div>
              <ul className="settings-integrations">
                {(Object.keys(INTEGRATION_LABELS) as Array<keyof IntegrationsStatus>).map(
                  (k) => {
                    const meta = INTEGRATION_LABELS[k];
                    if (!meta) return null;
                    const ok = data!.integrations[k];
                    return (
                      <li key={k} className="settings-integ">
                        <div className="settings-integ-main">
                          <div className="settings-integ-name">{meta.name}</div>
                          <div className="settings-integ-purpose">{meta.purpose}</div>
                        </div>
                        <span
                          className={`settings-integ-status ${ok ? 'settings-integ-ok' : 'settings-integ-missing'}`}
                        >
                          {ok ? 'Connected' : 'Not configured'}
                        </span>
                      </li>
                    );
                  },
                )}
              </ul>
            </section>

            <section className="settings-section">
              <div className="settings-section-head">
                <h2 className="settings-section-title">Audit chain</h2>
                <span className="settings-section-meta">migration 0022 trigger</span>
              </div>
              <dl className="settings-list">
                <div className="settings-row">
                  <dt>Total audit actions</dt>
                  <dd className="settings-num">
                    {data.audit.total_actions.toLocaleString()}
                  </dd>
                </div>
                <div className="settings-row">
                  <dt>Latest chain_seq</dt>
                  <dd className="settings-num">
                    {data.audit.max_chain_seq?.toLocaleString() ?? <em>none yet</em>}
                  </dd>
                </div>
                <div className="settings-row">
                  <dt>Last action at</dt>
                  <dd>
                    {data.audit.last_action_at ? (
                      <>
                        {formatRelativeTime(data.audit.last_action_at)}{' '}
                        <span className="settings-time-iso">
                          ({data.audit.last_action_at})
                        </span>
                      </>
                    ) : (
                      <em>no actions recorded</em>
                    )}
                  </dd>
                </div>
                <div className="settings-row">
                  <dt>Verification</dt>
                  <dd>
                    Nightly cron <span className="settings-mono">verify-actions-chain</span> walks
                    the chain at 07:00 UTC and surfaces tampering to Sentry + the audit log itself.
                  </dd>
                </div>
              </dl>
            </section>
          </>
        )}
      </div>
    </CommandShell>
  );
}
