// /projects/[id] — per-project drill-down.
//
// Shows: project metadata + all engagements attached + per-stage
// breakdown + per-tax-year breakdown. Click an engagement row →
// /clients/[clientId].
//
// Templates render differently from instances: templates show
// "this is a template, here are the instances derived from it"
// rather than direct engagement list. Archived projects render
// with an archived badge but still allow viewing.

import { sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { withTenant } from '@docket/db';
import type { TenantId } from '@docket/shared';
import { requireRole } from '@/lib/require-role';
import { CommandShell } from '@/components/command-shell';
import { EngagementProjectNotes } from '@/components/engagement-project-notes';
import { getCanonicalTemplateMetadata } from '../metadata';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COLOR_HINT_FILL: Record<string, string> = {
  forest: 'oklch(42% 0.09 150)',
  amber: 'oklch(58% 0.13 75)',
  terra: 'oklch(52% 0.18 28)',
  'ink-blue': 'oklch(42% 0.10 240)',
};

function colorFor(hint: string | null | undefined): string {
  if (hint && COLOR_HINT_FILL[hint]) return COLOR_HINT_FILL[hint]!;
  return 'oklch(50% 0.01 85)';
}

interface ProjectDetail {
  id: string;
  kind: string;
  name: string;
  description: string | null;
  is_template: boolean;
  is_active: boolean;
  tax_year: number | null;
  color_hint: string | null;
  source_template_id: string | null;
  source_template_name: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

interface AttachedEngagement {
  engagement_id: string;
  client_id: string;
  client_name: string;
  engagement_type: string;
  engagement_status: string;
  tax_year: number | null;
  is_primary: boolean;
  added_at: string;
  notes: string | null;
  [key: string]: unknown;
}

interface DerivedInstance {
  id: string;
  name: string;
  tax_year: number | null;
  is_active: boolean;
  [key: string]: unknown;
}

interface StageCount {
  status: string;
  count: number;
}

/**
 * Phase 1: cheap project-row lookup. Returns project metadata only;
 * no attached-engagement queries. Lets us run the role check BEFORE
 * the expensive attachment load (codex round 3 P3).
 */
async function loadProjectHead(
  tenantId: string,
  projectId: string,
): Promise<ProjectDetail | null> {
  return await withTenant(tenantId as TenantId, async (db) => {
    const projectRows = await db.execute<ProjectDetail>(sql`
      SELECT
        p.id::text AS id,
        p.kind,
        p.name,
        p.description,
        p.is_template,
        p.is_active,
        p.tax_year,
        p.color_hint,
        p.source_template_id::text AS source_template_id,
        st.name AS source_template_name,
        to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
        to_char(p.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
      FROM projects p
      LEFT JOIN projects st ON st.id = p.source_template_id
      WHERE p.id = ${projectId}::uuid
      LIMIT 1
    `);
    return (projectRows as unknown as ProjectDetail[])[0] ?? null;
  });
}

/**
 * Phase 2 (templates): load derived instances. Cheap; no PII.
 */
async function loadDerivedInstances(
  tenantId: string,
  projectId: string,
): Promise<DerivedInstance[]> {
  return await withTenant(tenantId as TenantId, async (db) => {
    const instanceRows = await db.execute<DerivedInstance>(sql`
      SELECT
        id::text AS id,
        name,
        tax_year,
        is_active
      FROM projects
      WHERE source_template_id = ${projectId}::uuid
      ORDER BY tax_year DESC NULLS LAST, name ASC
    `);
    return instanceRows as unknown as DerivedInstance[];
  });
}

/**
 * Phase 2 (instances): load attached-engagements + stage counts.
 * Only called when the caller has cleared the instance role gate
 * (codex round 3 P3). Aggregate query is uncapped; display query
 * caps at 500 rows.
 */
async function loadInstanceAttachments(
  tenantId: string,
  projectId: string,
): Promise<{
  engagements: AttachedEngagement[];
  totalAttached: number;
  stageCounts: StageCount[];
}> {
  return await withTenant(tenantId as TenantId, async (db) => {
    // Codex round 1 P2: stage counts + total come from a separate
    // aggregate query so they don't drop the rows past LIMIT 500.
    const aggRows = await db.execute<{
      engagement_status: string;
      count: number;
    }>(sql`
      SELECT
        e.status::text AS engagement_status,
        COUNT(*)::int AS count
      FROM engagement_projects ep
      JOIN engagements e ON e.id = ep.engagement_id
      WHERE ep.project_id = ${projectId}::uuid
      GROUP BY e.status::text
    `);
    const stageCounts = (aggRows as unknown as Array<{
      engagement_status: string;
      count: number;
    }>).map((r) => ({ status: r.engagement_status, count: r.count }));
    const totalAttached = stageCounts.reduce((sum, s) => sum + s.count, 0);

    // Capped display list (most-recent-primary-first).
    const engagementRows = await db.execute<AttachedEngagement>(sql`
      SELECT
        ep.engagement_id::text AS engagement_id,
        e.client_id::text AS client_id,
        c.full_name AS client_name,
        e.type::text AS engagement_type,
        e.status::text AS engagement_status,
        e.tax_year,
        ep.is_primary,
        to_char(ep.added_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS added_at,
        ep.notes
      FROM engagement_projects ep
      JOIN engagements e ON e.id = ep.engagement_id
      JOIN clients c ON c.id = e.client_id
      WHERE ep.project_id = ${projectId}::uuid
      ORDER BY ep.is_primary DESC, ep.added_at DESC
      LIMIT 500
    `);

    return {
      engagements: engagementRows as unknown as AttachedEngagement[],
      totalAttached,
      stageCounts,
    };
  });
}

const STATUS_ORDER = [
  'intake',
  'docs',
  'prep',
  'review',
  'signature',
  'file',
  'pay',
  'done',
  'extended',
  'on_hold',
] as const;

const STATUS_LABELS: Record<string, string> = {
  intake: 'Intake',
  docs: 'Docs',
  prep: 'Prep',
  review: 'Review',
  signature: 'Signature',
  file: 'File',
  pay: 'Pay',
  done: 'Done',
  extended: 'Extended',
  on_hold: 'On hold',
};

type PageProps = { params: Promise<{ id: string }> };

// RFC 4122 UUID v1-v8 + the v0 (all-zero) edge case Postgres accepts.
// Match before casting to uuid in raw SQL — Postgres throws "invalid
// input syntax for type uuid" on malformed input which surfaces as
// a server 500 instead of the intended notFound() 404. Codex round 2 P2.
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;

  // Outer gate matches /projects (all 5 roles). The instance-only
  // drill-down narrows to firm_owner / preparer / reviewer below,
  // after we know whether the id is a template or an instance —
  // admin + assistant should still be able to view template detail
  // (description + derived-instance names) since they can already
  // browse the template gallery on /projects. Codex round 2 P2.
  const user = await requireRole([
    'firm_owner',
    'preparer',
    'reviewer',
    'admin',
    'assistant',
  ]);

  // Validate the id before any SQL cast. Bad input → 404 not 500.
  if (!UUID_REGEX.test(id)) notFound();

  // Phase 1: cheap project metadata only. Lets us run the inner
  // role gate before the expensive attachment load.
  const project = await loadProjectHead(user.tenantId, id);
  if (!project) notFound();

  // Inner gate: admin + assistant can view template detail (no PII)
  // but NOT instance projects (which render engagement_projects.notes
  // inline + link to /clients/[id] which they can't access).
  // Codex round 1 P1 + round 2 P2 + round 3 P3 (run BEFORE loading
  // attachment data).
  const RESTRICTED_INSTANCE_ROLES = [
    'firm_owner',
    'preparer',
    'reviewer',
  ] as const;
  type RestrictedInstanceRole = (typeof RESTRICTED_INSTANCE_ROLES)[number];
  const canViewInstance = (
    RESTRICTED_INSTANCE_ROLES as readonly string[]
  ).includes(user.role);
  if (!project.is_template && !canViewInstance) {
    notFound();
  }

  // Phase 2: load attachments only after the role gate clears.
  let derivedInstances: DerivedInstance[] = [];
  let engagements: AttachedEngagement[] = [];
  let totalAttached = 0;
  let stageCounts: StageCount[] = [];
  if (project.is_template) {
    derivedInstances = await loadDerivedInstances(user.tenantId, id);
  } else {
    const attached = await loadInstanceAttachments(user.tenantId, id);
    engagements = attached.engagements;
    totalAttached = attached.totalAttached;
    stageCounts = attached.stageCounts;
  }

  const meta = getCanonicalTemplateMetadata();
  const canonicalMeta = meta[project.kind];
  const color = colorFor(project.color_hint);

  // Per-stage counts come from the uncapped aggregate query (above)
  // so the breakdown stays correct even when totalAttached > 500.
  const statusCounts = new Map<string, number>();
  for (const sc of stageCounts) {
    statusCounts.set(sc.status, sc.count);
  }

  return (
    <CommandShell
      user={{ name: user.name, email: user.email, avatarUrl: user.avatarUrl }}
      tenantName={user.tenantName}
      activeHref="/projects"
    >
      <div
        style={{
          padding: '32px 36px 48px',
          maxWidth: 1200,
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <Link
          href="/projects"
          style={{
            fontSize: 13,
            color: 'oklch(42% 0.09 150)',
            textDecoration: 'none',
            marginBottom: 12,
            display: 'inline-block',
          }}
        >
          ← Projects
        </Link>

        <header style={{ marginBottom: 24 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 8,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: 14,
                height: 14,
                borderRadius: 4,
                background: color,
              }}
            />
            <span
              style={{
                fontSize: 11,
                color: 'oklch(50% 0.01 85)',
                letterSpacing: 0.3,
                textTransform: 'uppercase',
              }}
            >
              {project.is_template ? 'Template' : 'Active project'} ·{' '}
              {project.kind.replace(/_/g, ' ')}
              {project.tax_year && ` · tax year ${project.tax_year}`}
              {!project.is_active && ' · archived'}
            </span>
          </div>
          <h1
            style={{
              fontSize: 30,
              fontWeight: 600,
              color: 'oklch(20% 0.01 85)',
              margin: '0 0 10px 0',
              letterSpacing: -0.4,
            }}
          >
            {project.name}
          </h1>
          {project.description && (
            <p
              style={{
                fontSize: 14,
                color: 'oklch(45% 0.01 85)',
                margin: 0,
                lineHeight: 1.55,
                maxWidth: 720,
              }}
            >
              {project.description}
            </p>
          )}
          {!project.description && canonicalMeta && (
            <p
              style={{
                fontSize: 13,
                color: 'oklch(50% 0.01 85)',
                fontStyle: 'italic',
                margin: 0,
                lineHeight: 1.55,
                maxWidth: 720,
              }}
            >
              {canonicalMeta.description}
            </p>
          )}
          {project.source_template_id && project.source_template_name && (
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                color: 'oklch(50% 0.01 85)',
              }}
            >
              Derived from template:{' '}
              <Link
                href={`/projects/${project.source_template_id}`}
                style={{ color: 'oklch(42% 0.09 150)', textDecoration: 'none' }}
              >
                {project.source_template_name}
              </Link>
            </div>
          )}
        </header>

        {/* Template view: show derived instances */}
        {project.is_template ? (
          <section>
            <h2
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: 'oklch(20% 0.01 85)',
                margin: '0 0 12px 0',
              }}
            >
              Instances derived from this template
            </h2>
            {derivedInstances.length === 0 ? (
              <EmptyTemplateState />
            ) : (
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                {derivedInstances.map((inst) => (
                  <DerivedInstanceRow
                    key={inst.id}
                    instance={inst}
                    color={color}
                    canLink={canViewInstance}
                  />
                ))}
              </ul>
            )}
          </section>
        ) : (
          // Instance view: show engagements + per-stage breakdown
          <>
            {engagements.length > 0 && (
              <section style={{ marginBottom: 24 }}>
                <h2
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'oklch(50% 0.01 85)',
                    letterSpacing: 0.3,
                    textTransform: 'uppercase',
                    margin: '0 0 10px 0',
                  }}
                >
                  Stage breakdown
                </h2>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                    gap: 8,
                  }}
                >
                  {STATUS_ORDER.filter((s) => statusCounts.has(s)).map((status) => (
                    <div
                      key={status}
                      style={{
                        padding: '10px 12px',
                        background: 'oklch(99% 0.005 85)',
                        border: '1px solid oklch(93% 0.008 85)',
                        borderRadius: 8,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 22,
                          fontWeight: 600,
                          color,
                          lineHeight: 1.1,
                        }}
                      >
                        {statusCounts.get(status)}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'oklch(50% 0.01 85)',
                          marginTop: 2,
                          letterSpacing: 0.2,
                        }}
                      >
                        {STATUS_LABELS[status] ?? status}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <h2
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: 'oklch(20% 0.01 85)',
                    margin: 0,
                  }}
                >
                  Engagements
                </h2>
                <span
                  style={{
                    fontSize: 11,
                    color: 'oklch(50% 0.01 85)',
                    letterSpacing: 0.2,
                    textTransform: 'uppercase',
                  }}
                >
                  {totalAttached} attached
                  {totalAttached > engagements.length &&
                    ` · showing ${engagements.length}`}
                </span>
              </div>
              {engagements.length === 0 ? (
                <EmptyInstanceState />
              ) : (
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  {engagements.map((e) => (
                    <EngagementRow
                      key={e.engagement_id}
                      engagement={e}
                      color={color}
                      projectId={id}
                      canEdit={canViewInstance}
                    />
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

/**
 * Derived-instance row: renders as a Link only when the caller has
 * permission to view the instance drill-down. For admin / assistant
 * who can browse the template gallery but cannot view instance
 * detail (notes + client jumps), render plain text so we don't
 * advertise navigation that 404s. Codex round 3 P2.
 */
function DerivedInstanceRow({
  instance,
  color,
  canLink,
}: {
  instance: DerivedInstance;
  color: string;
  canLink: boolean;
}) {
  const inner = (
    <>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'oklch(20% 0.01 85)',
            marginBottom: 2,
          }}
        >
          {instance.name}
        </div>
        <div style={{ fontSize: 11, color: 'oklch(50% 0.01 85)' }}>
          {instance.tax_year
            ? `Tax year ${instance.tax_year}`
            : 'No tax year scope'}
          {!instance.is_active && ' · archived'}
        </div>
      </div>
    </>
  );
  const baseStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 14px',
    background: 'oklch(99% 0.005 85)',
    border: '1px solid oklch(93% 0.008 85)',
    borderLeft: `3px solid ${color}`,
    borderRadius: 8,
    textDecoration: 'none',
  };
  if (canLink) {
    return (
      <li>
        <Link href={`/projects/${instance.id}`} style={baseStyle}>
          {inner}
        </Link>
      </li>
    );
  }
  return (
    <li>
      <div style={baseStyle} aria-disabled="true">
        {inner}
      </div>
    </li>
  );
}

function EngagementRow({
  engagement,
  color,
  projectId,
  canEdit,
}: {
  engagement: AttachedEngagement;
  color: string;
  projectId: string;
  canEdit: boolean;
}) {
  // C26: notes moved from an inline ` · ${engagement.notes}` suffix
  // on the secondary text line to a dedicated EngagementProjectNotes
  // component rendered as a sibling below the Link. The notes UI is
  // interactive (textarea + save/cancel) and cannot live inside the
  // wrapping Link without breaking nested-interactive-element
  // accessibility. Visual: card-like grouping via the flex column.
  return (
    <li
      style={{
        background: 'oklch(99% 0.005 85)',
        border: '1px solid oklch(93% 0.008 85)',
        borderLeft: engagement.is_primary
          ? `3px solid ${color}`
          : '1px solid oklch(93% 0.008 85)',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        padding: '10px 14px',
      }}
    >
      <Link
        href={`/clients/${engagement.client_id}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          textDecoration: 'none',
          color: 'inherit',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: 'oklch(20% 0.01 85)',
              marginBottom: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {engagement.client_name}
            {engagement.is_primary && (
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 10,
                  color,
                  letterSpacing: 0.2,
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}
              >
                Primary
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'oklch(50% 0.01 85)',
              letterSpacing: 0.1,
            }}
          >
            {engagement.engagement_type.replace(/_/g, ' ')}
            {' · '}
            {STATUS_LABELS[engagement.engagement_status] ??
              engagement.engagement_status}
            {engagement.tax_year && ` · TY ${engagement.tax_year}`}
          </div>
        </div>
      </Link>
      <EngagementProjectNotes
        engagementId={engagement.engagement_id}
        projectId={projectId}
        initialNotes={engagement.notes}
        canEdit={canEdit}
      />
    </li>
  );
}

function EmptyTemplateState() {
  return (
    <div
      style={{
        padding: '24px 22px',
        background: 'oklch(99% 0.005 85)',
        border: '1px dashed oklch(90% 0.008 85)',
        borderRadius: 10,
        fontSize: 13,
        color: 'oklch(45% 0.01 85)',
        lineHeight: 1.6,
      }}
    >
      <div
        style={{
          fontWeight: 500,
          color: 'oklch(30% 0.01 85)',
          marginBottom: 4,
          fontSize: 14,
        }}
      >
        No instances yet
      </div>
      Templates are reusable workflow definitions. Instances are concrete
      projects that derive from a template — for example, "2026 Annual
      Returns" deriving from the "Annual Return Prep" template. Instance
      creation UI lands in C24.
    </div>
  );
}

function EmptyInstanceState() {
  return (
    <div
      style={{
        padding: '24px 22px',
        background: 'oklch(99% 0.005 85)',
        border: '1px dashed oklch(90% 0.008 85)',
        borderRadius: 10,
        fontSize: 13,
        color: 'oklch(45% 0.01 85)',
        lineHeight: 1.6,
      }}
    >
      <div
        style={{
          fontWeight: 500,
          color: 'oklch(30% 0.01 85)',
          marginBottom: 4,
          fontSize: 14,
        }}
      >
        No engagements attached yet
      </div>
      Attach engagements to this project from the client page (per-client
      project picker, C24). Once attached, this view shows the per-stage
      breakdown plus the engagement list with primary-flag highlight.
    </div>
  );
}
