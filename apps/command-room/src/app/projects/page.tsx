// /projects — third organizing primitive (alongside per-client and
// per-status Need You queue).
//
// Per CLAUDE.md §4 Command Room Projects: shows the firm's active
// project list with engagement counts per project. Click into a
// project → /projects/[id] (V1.5; for now we surface the
// templates + counts).
//
// v0 scope: template gallery + per-template engagement counts. The
// per-project drill-down ships in C24+ once we have a workflow for
// attaching engagements to projects (currently the join table is
// empty by default).

import { sql } from 'drizzle-orm';
import Link from 'next/link';
import { withTenant } from '@docket/db';
import type { TenantId } from '@docket/shared';
import { requireRole } from '@/lib/require-role';
import { CommandShell } from '@/components/command-shell';
import { SeedProjectsButton } from './seed-button';
import { getCanonicalTemplateMetadata } from './actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ProjectRow {
  id: string;
  kind: string;
  name: string;
  description: string | null;
  is_template: boolean;
  is_active: boolean;
  tax_year: number | null;
  color_hint: string | null;
  engagement_count: number;
  created_at: string;
  [key: string]: unknown;
}

async function loadProjects(tenantId: string): Promise<ProjectRow[]> {
  return await withTenant(tenantId as TenantId, async (db) => {
    const rows = await db.execute<ProjectRow>(sql`
      SELECT
        p.id::text AS id,
        p.kind,
        p.name,
        p.description,
        p.is_template,
        p.is_active,
        p.tax_year,
        p.color_hint,
        COALESCE(c.engagement_count, 0)::int AS engagement_count,
        to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
      FROM projects p
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS engagement_count
        FROM engagement_projects ep
        WHERE ep.project_id = p.id
      ) c ON true
      WHERE p.is_active
      ORDER BY p.is_template DESC, p.kind, p.name
    `);
    return rows as unknown as ProjectRow[];
  });
}

const COLOR_HINT_FILL: Record<string, string> = {
  forest: 'oklch(42% 0.09 150)',
  amber: 'oklch(58% 0.13 75)',
  terra: 'oklch(52% 0.18 28)',
  'ink-blue': 'oklch(42% 0.10 240)',
};

function colorFor(hint: string | null): string {
  if (hint && COLOR_HINT_FILL[hint]) return COLOR_HINT_FILL[hint]!;
  return 'oklch(50% 0.01 85)';
}

export default async function ProjectsPage() {
  const user = await requireRole([
    'firm_owner',
    'preparer',
    'reviewer',
    'admin',
    'assistant',
  ]);

  let rows: ProjectRow[] = [];
  let errorMessage: string | null = null;
  try {
    rows = await loadProjects(user.tenantId);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'Failed to load projects';
  }

  const meta = getCanonicalTemplateMetadata();
  const totalCanonical = Object.keys(meta).length;
  const installedTemplates = rows.filter((r) => r.is_template).length;
  const missingCount = totalCanonical - installedTemplates;
  const canEdit = user.role === 'firm_owner';

  const templates = rows.filter((r) => r.is_template);
  const instances = rows.filter((r) => !r.is_template);

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
        <header style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 12,
              color: 'oklch(48% 0.01 85)',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            Practice
          </div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 600,
              color: 'oklch(20% 0.01 85)',
              margin: '0 0 8px 0',
              letterSpacing: -0.4,
            }}
          >
            Projects
          </h1>
          <p
            style={{
              fontSize: 14,
              color: 'oklch(45% 0.01 85)',
              margin: 0,
              lineHeight: 1.55,
              maxWidth: 720,
            }}
          >
            Recurring workflow types your firm runs many clients through.
            Third lens alongside per-client view and the{' '}
            <Link
              href="/"
              style={{ color: 'oklch(42% 0.09 150)', textDecoration: 'none' }}
            >
              Need You queue
            </Link>
            . Templates ship out-of-the-box; clone + rename to fit your firm.
          </p>
        </header>

        {errorMessage && (
          <div
            style={{
              padding: 12,
              background: 'oklch(96% 0.02 28)',
              border: '1px solid oklch(88% 0.04 28)',
              borderRadius: 10,
              marginBottom: 20,
              fontSize: 13,
              color: 'oklch(35% 0.06 28)',
            }}
          >
            Couldn't load projects: {errorMessage}
          </div>
        )}

        {/* Templates section */}
        <section style={{ marginBottom: 32 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <h2
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: 'oklch(20% 0.01 85)',
                margin: 0,
                letterSpacing: -0.2,
              }}
            >
              Template gallery
            </h2>
            {canEdit && missingCount > 0 && (
              <SeedProjectsButton missingCount={missingCount} />
            )}
          </div>

          {templates.length === 0 ? (
            <EmptyTemplateState canEdit={canEdit} totalCanonical={totalCanonical} />
          ) : (
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 12,
              }}
            >
              {templates.map((p) => (
                <TemplateCard key={p.id} project={p} />
              ))}
            </ul>
          )}
        </section>

        {/* Active instances section */}
        {instances.length > 0 && (
          <section>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: 'oklch(20% 0.01 85)',
                margin: '0 0 12px 0',
                letterSpacing: -0.2,
              }}
            >
              Active projects
            </h2>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {instances.map((p) => (
                <InstanceCard key={p.id} project={p} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </CommandShell>
  );
}

function TemplateCard({ project }: { project: ProjectRow }) {
  const color = colorFor(project.color_hint);
  return (
    <li
      style={{
        padding: '14px 16px',
        background: 'oklch(99% 0.005 85)',
        border: '1px solid oklch(92% 0.008 85)',
        borderTop: `3px solid ${color}`,
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <h3
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'oklch(20% 0.01 85)',
          margin: '0 0 6px 0',
        }}
      >
        {project.name}
      </h3>
      {project.description && (
        <p
          style={{
            fontSize: 12,
            color: 'oklch(45% 0.01 85)',
            margin: '0 0 10px 0',
            lineHeight: 1.55,
            flex: 1,
          }}
        >
          {project.description}
        </p>
      )}
      <div
        style={{
          fontSize: 10,
          color: 'oklch(55% 0.01 85)',
          letterSpacing: 0.2,
          textTransform: 'uppercase',
          marginTop: 'auto',
          paddingTop: 8,
          borderTop: '1px solid oklch(94% 0.008 85)',
        }}
      >
        Template · {project.kind.replace(/_/g, ' ')}
      </div>
    </li>
  );
}

function InstanceCard({ project }: { project: ProjectRow }) {
  const color = colorFor(project.color_hint);
  return (
    <li
      style={{
        padding: '12px 14px',
        background: 'oklch(99% 0.005 85)',
        border: '1px solid oklch(93% 0.008 85)',
        borderLeft: `3px solid ${color}`,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div style={{ flex: 1 }}>
        <h3
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'oklch(20% 0.01 85)',
            margin: '0 0 2px 0',
          }}
        >
          {project.name}
        </h3>
        <div
          style={{
            fontSize: 11,
            color: 'oklch(50% 0.01 85)',
          }}
        >
          {project.kind.replace(/_/g, ' ')}
          {project.tax_year && ` · tax year ${project.tax_year}`}
          {project.engagement_count > 0 &&
            ` · ${project.engagement_count} engagement${project.engagement_count === 1 ? '' : 's'}`}
        </div>
      </div>
      <span
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: project.engagement_count > 0 ? color : 'oklch(60% 0.01 85)',
        }}
      >
        {project.engagement_count}
      </span>
    </li>
  );
}

function EmptyTemplateState({
  canEdit,
  totalCanonical,
}: {
  canEdit: boolean;
  totalCanonical: number;
}) {
  return (
    <div
      style={{
        padding: '28px 22px',
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
          marginBottom: 6,
          fontSize: 14,
        }}
      >
        No project templates installed
      </div>
      <p style={{ margin: '0 0 4px 0' }}>
        Install the canonical gallery with one click. {totalCanonical} templates
        across the recurring workflows your firm runs: Annual Return Prep,
        Discovery Scan, Audit Defense, Notice Response, Quarterly Estimates,
        Incorporation, BOI Annual, Year-Round Planning, Statement of
        Information, Pre-Filing IRS Reconciliation, 8821 Transcript Pulls,
        Client Onboarding.
      </p>
      {!canEdit && (
        <p
          style={{
            margin: '8px 0 0 0',
            fontSize: 12,
            color: 'oklch(55% 0.01 85)',
          }}
        >
          Ask your firm owner to install the templates.
        </p>
      )}
    </div>
  );
}
