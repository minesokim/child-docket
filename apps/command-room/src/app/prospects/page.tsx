// Prospects admin — Session 12 / L16 100-customers-by-8/1
// (must-ship #4: CRM / funnel tracking, 5/18 milestone).
//
// Lists every prospect submitted via the Discovery Scan landing
// page (/scan → /api/scan-intake-stub → prospects table). David's
// daily CRM surface: see new submissions, mark contacted, send
// scans, track converts.
//
// SECURITY
//   - requireRole(['firm_owner']) — only David (and any future
//     platform admin) sees this. The prospects table is platform-
//     global per migration 0030 + Session 5's PLATFORM_TABLES
//     allowlist (no RLS — pre-tenant funnel data).
//
// LAYOUT
//   - Aggregate metric strip at top (per CLAUDE.md §4 "every
//     command-room page opens with aggregate counts"):
//       Total · Submitted · Contacted · Scan sent · Converted · Rejected
//   - Filter chips below the strip (query param ?status=).
//   - Table: most-recent submission first, status badge color-
//     coded, lifecycle-update dropdown per row.
//
// STATUS COLOR CODING
//   submitted   neutral gray   (new — needs contact)
//   contacted   amber          (in flight)
//   scan_sent   forest green   (Discovery Scan delivered)
//   converted   deep green     (engagement letter signed → tenant)
//   rejected    muted red      (out of segment / spam / declined)

import { desc, sql } from 'drizzle-orm';
import { buildTheme } from '@docket/ui';
import { getAdminDb, schema } from '@docket/db';
import { requireRole } from '@/lib/require-role';
import { CommandShell } from '@/components/command-shell';
import { ProspectStatusControl } from './status-control';

export const dynamic = 'force-dynamic';

type Prospect = {
  id: string;
  firstName: string;
  lastName: string;
  firmName: string;
  designation: string;
  firmSize: string;
  taxSoftware: string;
  email: string;
  phone: string | null;
  source: string;
  status: string;
  submittedAt: Date;
  contactedAt: Date | null;
  scanSentAt: Date | null;
  convertedAt: Date | null;
  rejectedAt: Date | null;
};

type StatusCounts = {
  total: number;
  submitted: number;
  contacted: number;
  scan_sent: number;
  converted: number;
  rejected: number;
};

const STATUS_ORDER = [
  'submitted',
  'contacted',
  'scan_sent',
  'converted',
  'rejected',
] as const;

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  contacted: 'Contacted',
  scan_sent: 'Scan sent',
  converted: 'Converted',
  rejected: 'Rejected',
};

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const user = await requireRole(['firm_owner']);

  const params = (await searchParams) ?? {};
  // Validate the status filter against the canonical set so an
  // attacker-supplied ?status=<sql> can't widen the query path.
  const statusFilter =
    params.status && STATUS_ORDER.includes(params.status as never)
      ? params.status
      : null;

  const db = getAdminDb();

  // Aggregate counts BEFORE the filter applies so the metric strip
  // shows the WHOLE funnel + the filter chips reflect total
  // counts per status, not within-filter counts.
  const countsRaw = await db.execute<{
    status: string;
    count: string;
  }>(sql`
    SELECT status, COUNT(*)::text AS count
      FROM ${schema.prospects}
     GROUP BY status
  `);
  const counts: StatusCounts = {
    total: 0,
    submitted: 0,
    contacted: 0,
    scan_sent: 0,
    converted: 0,
    rejected: 0,
  };
  for (const row of countsRaw as unknown as Array<{
    status: string;
    count: string;
  }>) {
    const n = Number(row.count) || 0;
    counts.total += n;
    if (row.status in counts) {
      (counts as unknown as Record<string, number>)[row.status] = n;
    }
  }

  // Per-row read. Filter clause applies only when statusFilter is
  // non-null. Sort: submittedAt DESC so the freshest leads land
  // at the top of David's workday.
  const rowsRaw = await db.execute<Prospect>(
    statusFilter
      ? sql`
          SELECT id::text, first_name AS "firstName", last_name AS "lastName",
                 firm_name AS "firmName", designation, firm_size AS "firmSize",
                 tax_software AS "taxSoftware", email, phone, source, status,
                 submitted_at AS "submittedAt", contacted_at AS "contactedAt",
                 scan_sent_at AS "scanSentAt", converted_at AS "convertedAt",
                 rejected_at AS "rejectedAt"
            FROM ${schema.prospects}
           WHERE status = ${statusFilter}
           ORDER BY submitted_at DESC
           LIMIT 500
        `
      : sql`
          SELECT id::text, first_name AS "firstName", last_name AS "lastName",
                 firm_name AS "firmName", designation, firm_size AS "firmSize",
                 tax_software AS "taxSoftware", email, phone, source, status,
                 submitted_at AS "submittedAt", contacted_at AS "contactedAt",
                 scan_sent_at AS "scanSentAt", converted_at AS "convertedAt",
                 rejected_at AS "rejectedAt"
            FROM ${schema.prospects}
           ORDER BY submitted_at DESC
           LIMIT 500
        `,
  );
  const rows = rowsRaw as unknown as Prospect[];

  const t = buildTheme({ tone: 'minimal', fonts: 'classic' });

  return (
    <CommandShell user={user} tenantName={user.tenantName} activeHref="/prospects">
      <div style={{ padding: '24px 28px 64px', maxWidth: 1280 }}>
        <h1
          style={{
            fontFamily: t.sans,
            fontSize: 24,
            fontWeight: 600,
            color: t.ink,
            margin: 0,
            marginBottom: 4,
          }}
        >
          Prospects
        </h1>
        <p
          style={{
            fontFamily: t.sans,
            fontSize: 14,
            color: t.muted,
            margin: 0,
            marginBottom: 24,
          }}
        >
          Discovery Scan submissions. New leads land here; move them
          through Contacted → Scan sent → Converted as the funnel
          advances. The submission count is what we&apos;re tracking
          against the 100-customer goal.
        </p>

        {/* Aggregate metric strip */}
        <div
          style={{
            display: 'flex',
            gap: 24,
            padding: '14px 18px',
            borderRadius: 10,
            border: `1px solid ${t.borderSoft}`,
            background: t.bg,
            marginBottom: 18,
          }}
        >
          <MetricCell label="Total" value={counts.total} accent={t.ink} />
          <MetricCell
            label="Submitted"
            value={counts.submitted}
            accent={t.muted}
          />
          <MetricCell
            label="Contacted"
            value={counts.contacted}
            accent="#b78a3a"
          />
          <MetricCell
            label="Scan sent"
            value={counts.scan_sent}
            accent={t.ease.forestDark}
          />
          <MetricCell
            label="Converted"
            value={counts.converted}
            accent={t.ease.forestDark}
          />
          <MetricCell
            label="Rejected"
            value={counts.rejected}
            accent="#a13d2c"
          />
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <FilterChip
            href="/prospects"
            label="All"
            active={statusFilter === null}
            t={t}
          />
          {STATUS_ORDER.map((s) => (
            <FilterChip
              key={s}
              href={`/prospects?status=${s}`}
              label={STATUS_LABELS[s]!}
              active={statusFilter === s}
              t={t}
            />
          ))}
        </div>

        {/* Table */}
        {rows.length === 0 ? (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              border: `1px dashed ${t.borderSoft}`,
              borderRadius: 10,
              fontFamily: t.sans,
              color: t.muted,
              fontSize: 14,
            }}
          >
            {statusFilter
              ? `No prospects with status "${STATUS_LABELS[statusFilter] ?? statusFilter}".`
              : 'No Discovery Scan submissions yet. Cold outreach + the landing page are the volume play (per docs/DESIGN-PARTNER-ACQUISITION-PLAN.md Channel 2).'}
          </div>
        ) : (
          <div
            style={{
              border: `1px solid ${t.borderSoft}`,
              borderRadius: 10,
              overflow: 'hidden',
              background: t.bg,
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontFamily: t.sans,
                fontSize: 13,
              }}
            >
              <thead>
                <tr style={{ background: t.bgElev }}>
                  <Th t={t}>Submitted</Th>
                  <Th t={t}>Name</Th>
                  <Th t={t}>Firm</Th>
                  <Th t={t}>Designation</Th>
                  <Th t={t}>Size</Th>
                  <Th t={t}>Software</Th>
                  <Th t={t}>Email</Th>
                  <Th t={t}>Source</Th>
                  <Th t={t}>Status</Th>
                  <Th t={t}>Action</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr
                    key={p.id}
                    style={{ borderTop: `1px solid ${t.borderSoft}` }}
                  >
                    <Td t={t}>{formatSubmittedAt(p.submittedAt)}</Td>
                    <Td t={t}>
                      <strong>
                        {p.firstName} {p.lastName}
                      </strong>
                    </Td>
                    <Td t={t}>{p.firmName}</Td>
                    <Td t={t}>{p.designation}</Td>
                    <Td t={t}>{p.firmSize}</Td>
                    <Td t={t}>{p.taxSoftware}</Td>
                    <Td t={t}>
                      <a
                        href={`mailto:${p.email}`}
                        style={{ color: t.ease.forestDark }}
                      >
                        {p.email}
                      </a>
                    </Td>
                    <Td t={t}>{p.source}</Td>
                    <Td t={t}>
                      <StatusBadge status={p.status} t={t} />
                    </Td>
                    <Td t={t}>
                      <ProspectStatusControl
                        prospectId={p.id}
                        currentStatus={p.status}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </CommandShell>
  );
}

function MetricCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div style={{ minWidth: 76 }}>
      <div
        style={{
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 11,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: 'var(--cmd-muted, #6b7280)',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 22,
          fontWeight: 600,
          color: accent,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function FilterChip({
  href,
  label,
  active,
  t,
}: {
  href: string;
  label: string;
  active: boolean;
  t: ReturnType<typeof buildTheme>;
}) {
  return (
    <a
      href={href}
      style={{
        padding: '6px 12px',
        borderRadius: 999,
        border: `1px solid ${active ? t.ease.forestDark : t.borderSoft}`,
        background: active ? t.ease.forestDark : t.bg,
        color: active ? '#fff' : t.ink,
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 12.5,
        fontWeight: 500,
        textDecoration: 'none',
        letterSpacing: 0.1,
      }}
    >
      {label}
    </a>
  );
}

function StatusBadge({
  status,
  t,
}: {
  status: string;
  t: ReturnType<typeof buildTheme>;
}) {
  const config: Record<
    string,
    { bg: string; fg: string; label: string }
  > = {
    submitted: { bg: t.bgElev, fg: t.muted, label: 'Submitted' },
    contacted: { bg: '#fdf4e3', fg: '#8a6a26', label: 'Contacted' },
    scan_sent: {
      bg: '#e5efe8',
      fg: t.ease.forestDark,
      label: 'Scan sent',
    },
    converted: {
      bg: t.ease.forestDark,
      fg: '#fff',
      label: 'Converted',
    },
    rejected: { bg: '#fbebe7', fg: '#a13d2c', label: 'Rejected' },
  };
  const c = config[status] ?? config.submitted!;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 8px',
        borderRadius: 6,
        background: c.bg,
        color: c.fg,
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.3,
      }}
    >
      {c.label}
    </span>
  );
}

function Th({
  t,
  children,
}: {
  t: ReturnType<typeof buildTheme>;
  children: React.ReactNode;
}) {
  return (
    <th
      style={{
        padding: '10px 12px',
        textAlign: 'left',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        color: t.muted,
        borderBottom: `1px solid ${t.borderSoft}`,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  t,
  children,
}: {
  t: ReturnType<typeof buildTheme>;
  children: React.ReactNode;
}) {
  return (
    <td
      style={{
        padding: '10px 12px',
        verticalAlign: 'middle',
        color: t.ink,
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 13,
      }}
    >
      {children}
    </td>
  );
}

function formatSubmittedAt(d: Date): string {
  // Compact "May 16 · 9:14a" — David scans the list daily so the
  // year is implied; the time of day shows fresh-arrival clusters.
  return new Date(d).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
