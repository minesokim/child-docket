// Clients list — Server Component. Reads all clients for Antonio's tenant
// via withTenant() so RLS scopes the query to his tenant_id only.
//
// What we show per row: name, intake status, latest engagement type + status,
// last activity timestamp. Click a row → /clients/[id].

import Link from 'next/link';
import { buildTheme } from '@docket/ui';
import { withTenant, schema } from '@docket/db/client';
import { desc, eq, sql } from 'drizzle-orm';
import { requireRole } from '@/lib/require-role';
import { AppShell } from '@/components/app-shell';
import type { TenantId } from '@docket/shared';

type Row = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  state: string | null;
  intakeStatus: string;
  preferredLanguage: string;
  createdAt: Date;
  engagementType: string | null;
  engagementStatus: string | null;
  taxYear: number | null;
  openIssueCount: number;
};

export default async function ClientsPage() {
  // All five firm roles can see the client list — assistant + admin
  // see the same page; future SSN-reveal endpoints will narrow to
  // ['firm_owner', 'preparer', 'reviewer'] via assertRole().
  // See apps/command-room/src/lib/require-role.ts for the policy matrix.
  const user = await requireRole(['firm_owner', 'preparer', 'reviewer', 'admin', 'assistant']);

  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });

  const rows = await withTenant(user.tenantId as TenantId, async (db) => {
    // For each client: latest engagement (by createdAt desc) + count of open issues.
    return db.execute<Row>(sql`
      SELECT
        c.id,
        c.full_name as "fullName",
        c.email,
        c.phone,
        c.state,
        c.intake_status as "intakeStatus",
        c.preferred_language as "preferredLanguage",
        c.created_at as "createdAt",
        e.type as "engagementType",
        e.status as "engagementStatus",
        e.tax_year as "taxYear",
        COALESCE(i.open_count, 0)::int as "openIssueCount"
      FROM ${schema.clients} c
      LEFT JOIN LATERAL (
        SELECT type, status, tax_year
        FROM ${schema.engagements}
        WHERE client_id = c.id
        ORDER BY created_at DESC
        LIMIT 1
      ) e ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) as open_count
        FROM ${schema.issues}
        WHERE client_id = c.id AND status = 'open'
      ) i ON true
      ORDER BY c.full_name ASC
    `);
  });

  return (
    <AppShell user={{ name: user.name, email: user.email }} activeHref="/clients">
      <div style={{ padding: '32px 36px 48px', maxWidth: 1200 }}>
        <header style={{ marginBottom: 28 }}>
          <div
            style={{
              fontFamily: t.mono,
              fontSize: 10.5,
              color: t.muted,
              letterSpacing: 1,
              marginBottom: 8,
            }}
          >
            {user.tenantName.toUpperCase()} · TENANT
          </div>
          <h1
            style={{
              fontFamily: t.serif,
              fontSize: 36,
              color: t.ink,
              letterSpacing: -0.8,
              margin: 0,
              marginBottom: 6,
            }}
          >
            Clients
          </h1>
          <p style={{ fontSize: 14.5, color: t.inkSoft, lineHeight: 1.5, margin: 0 }}>
            {rows.length} {rows.length === 1 ? 'client' : 'clients'} · open issues across all
            engagements:{' '}
            <span style={{ fontFamily: t.mono, color: t.rustInk }}>
              {rows.reduce((sum, r) => sum + (r.openIssueCount || 0), 0)}
            </span>
          </p>
        </header>

        <div
          style={{
            background: t.card,
            border: `1px solid ${t.border}`,
            borderRadius: 14,
            overflow: 'hidden',
          }}
        >
          {/* Table header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1.2fr 1.4fr 1fr 80px',
              gap: 16,
              padding: '12px 20px',
              background: t.bgElev,
              borderBottom: `1px solid ${t.borderSoft}`,
              fontFamily: t.mono,
              fontSize: 10,
              color: t.muted,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
            }}
          >
            <div>Client</div>
            <div>State · Lang</div>
            <div>Engagement</div>
            <div>Intake</div>
            <div style={{ textAlign: 'right' }}>Issues</div>
          </div>

          {/* Rows */}
          {rows.length === 0 ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                fontSize: 14,
                color: t.muted,
              }}
            >
              No clients yet. Run the seed script or onboard a client through intake.
            </div>
          ) : (
            rows.map((row, i) => (
              <Link
                key={row.id}
                href={`/clients/${row.id}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.2fr 1.4fr 1fr 80px',
                  gap: 16,
                  alignItems: 'center',
                  padding: '14px 20px',
                  borderBottom: i < rows.length - 1 ? `1px solid ${t.borderSoft}` : 'none',
                  textDecoration: 'none',
                  color: t.ink,
                  fontFamily: t.sans,
                  transition: 'background 100ms',
                }}
                className="client-row"
              >
                <div>
                  <div
                    style={{
                      fontFamily: t.serif,
                      fontSize: 16,
                      color: t.ink,
                      letterSpacing: -0.2,
                      lineHeight: 1.2,
                    }}
                  >
                    {row.fullName}
                  </div>
                  <div
                    style={{
                      fontFamily: t.mono,
                      fontSize: 11,
                      color: t.muted,
                      marginTop: 2,
                    }}
                  >
                    {row.email ?? row.phone ?? '—'}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: t.inkSoft }}>
                  {row.state ?? '—'}
                  {row.preferredLanguage !== 'en' && (
                    <span
                      style={{
                        marginLeft: 6,
                        fontFamily: t.mono,
                        fontSize: 10,
                        color: t.muted,
                        letterSpacing: 0.4,
                        textTransform: 'uppercase',
                      }}
                    >
                      · {row.preferredLanguage}
                    </span>
                  )}
                </div>
                <div>
                  {row.engagementType ? (
                    <>
                      <div style={{ fontSize: 13, color: t.ink }}>
                        {humanizeEngagementType(row.engagementType)}
                      </div>
                      <div
                        style={{
                          fontFamily: t.mono,
                          fontSize: 10.5,
                          color: t.muted,
                          letterSpacing: 0.4,
                          marginTop: 1,
                          textTransform: 'uppercase',
                        }}
                      >
                        {row.engagementStatus} · TY {row.taxYear ?? '—'}
                      </div>
                    </>
                  ) : (
                    <span style={{ fontSize: 13, color: t.muted }}>No engagement</span>
                  )}
                </div>
                <div>
                  <StatusPill t={t} status={row.intakeStatus} />
                </div>
                <div style={{ textAlign: 'right' }}>
                  {row.openIssueCount > 0 ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 28,
                        height: 22,
                        padding: '0 7px',
                        background: t.rust,
                        color: '#fff',
                        borderRadius: 999,
                        fontFamily: t.mono,
                        fontSize: 11,
                        fontWeight: 500,
                      }}
                    >
                      {row.openIssueCount}
                    </span>
                  ) : (
                    <span style={{ fontFamily: t.mono, fontSize: 11, color: t.muted }}>—</span>
                  )}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Hover effect via inline style not possible; using global tag-scoped style */}
      <style>{`
        a.client-row:hover {
          background: ${t.bgElev};
        }
      `}</style>
    </AppShell>
  );
}

function StatusPill({ t, status }: { t: ReturnType<typeof buildTheme>; status: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    'not-started': { bg: t.borderSoft, fg: t.muted, label: 'Not started' },
    'in-progress': { bg: t.tintAccent, fg: t.rustInk, label: 'In progress' },
    complete: { bg: 'rgba(74, 143, 95, 0.15)', fg: '#2e6b42', label: 'Complete' },
    abandoned: { bg: t.borderSoft, fg: t.muted, label: 'Abandoned' },
  };
  const m = map[status] ?? map['not-started']!;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        background: m.bg,
        color: m.fg,
        borderRadius: 999,
        fontFamily: t.mono,
        fontSize: 10.5,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
      }}
    >
      {m.label}
    </span>
  );
}

const ENGAGEMENT_LABEL: Record<string, string> = {
  return_1040: '1040 individual',
  return_1120s: '1120-S corp',
  return_1065: '1065 partnership',
  return_1120: '1120 C-corp',
  representation: 'Representation',
  advisory: 'Advisory',
  bookkeeping: 'Bookkeeping',
};

function humanizeEngagementType(t: string): string {
  return ENGAGEMENT_LABEL[t] ?? t;
}
