-- Migration 0034 — projects + engagement_projects tables.
--
-- The Projects surface (CLAUDE.md §4 Command Room — Projects):
-- third organizing primitive alongside per-client view and per-
-- status view (Need You queue). Each project is a recurring
-- workflow type the firm runs many clients through.
--
-- TWO TABLES:
--
--   projects
--     Per-tenant project templates + instantiations. The "template
--     library" is rows where is_template=true; firms customize +
--     re-save as new templates. Each engagement attaches to 0+
--     projects via the join table.
--
--   engagement_projects
--     Many-to-many join. One engagement can belong to multiple
--     projects (e.g., a 1040 return engagement can be in both
--     "Annual Return Prep 2026" AND "Q4 Year-End Planning").
--
-- The Projects view at /projects shows:
--   - List of active projects per tenant + count of engagements in
--     each
--   - Click into a project → list of all engagements in that project
--     + their current status (engagement state machine drives the
--     stage column)
--
-- Slant.app validated this primitive in financial advice (their
-- Projects feature: Onboarding / RMDs / Money Movement / Annual
-- Review templates). We apply to tax with 12 canonical templates.

-- ──────────────────────────────────────────────────────────────
-- Prerequisite: composite FK target on engagements.
--
-- A composite FK like (tenant_id, engagement_id) → engagements
-- (tenant_id, id) requires a UNIQUE constraint on (tenant_id, id).
-- engagements.id is PK so this is redundant but explicit.
-- Idempotent via DO-block; ADD CONSTRAINT doesn't support
-- IF NOT EXISTS.
-- ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'engagements_tenant_id_id_uniq'
  ) THEN
    ALTER TABLE engagements
      ADD CONSTRAINT engagements_tenant_id_id_uniq UNIQUE (tenant_id, id);
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────
-- projects — per-tenant project definitions.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  /**
   * Canonical project kind. Drives default template behavior +
   * filter UX. Free-form text so firms can add custom kinds, but
   * the v0 vocabulary is the 12 canonical kinds we seed by default.
   */
  kind text NOT NULL,

  /**
   * Per-firm name. Default value = canonical kind label; firm can
   * rename (e.g., "Annual Return Prep" → "2026 Returns").
   */
  name text NOT NULL,

  /**
   * Optional description shown on the project card. Helps firm
   * onboarding when multiple preparers share the same project view.
   */
  description text,

  /**
   * Template flag. Templates are the canonical 12; instances are
   * project rows attached to engagements. v0 keeps both in this
   * table; in v1 we may split them if the cardinality demands.
   */
  is_template boolean NOT NULL DEFAULT false,

  /**
   * Optional source_template_id for tracing back to which template
   * an instance derived from. NULL for hand-crafted projects.
   */
  source_template_id uuid REFERENCES projects(id) ON DELETE SET NULL,

  /**
   * Active flag. Archived projects (is_active = false) hide from
   * /projects default view but remain queryable for audit.
   */
  is_active boolean NOT NULL DEFAULT true,

  /**
   * Optional tax year scope. Annual Return Prep is scoped per year;
   * Audit Defense Engagement is scoped per audit (not year). NULL =
   * project applies across years.
   */
  tax_year integer
    CHECK (tax_year IS NULL OR (tax_year >= 2000 AND tax_year <= 2100)),

  /**
   * Color used in the UI. Optional. Defaults to forest at the app
   * layer if NULL.
   */
  color_hint text,

  /**
   * Project metadata: SLA defaults, default assignees, default
   * checklist items, custom fields. JSONB for flexibility.
   */
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Per-tenant uniqueness: same kind + name + tax_year combo
  -- prevents accidental duplicates from re-running the seeder.
  UNIQUE (tenant_id, kind, name, tax_year)
);

CREATE INDEX IF NOT EXISTS projects_tenant_active_idx
  ON projects(tenant_id, kind)
  WHERE is_active AND NOT is_template;

CREATE INDEX IF NOT EXISTS projects_tenant_templates_idx
  ON projects(tenant_id, kind)
  WHERE is_template;

CREATE INDEX IF NOT EXISTS projects_source_template_idx
  ON projects(source_template_id)
  WHERE source_template_id IS NOT NULL;

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_projects ON projects;
CREATE POLICY tenant_isolation_projects ON projects
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE OR REPLACE FUNCTION projects_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS projects_updated_at ON projects;
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION projects_set_updated_at();

-- ──────────────────────────────────────────────────────────────
-- engagement_projects — many-to-many join.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS engagement_projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  engagement_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  /**
   * When this engagement entered this project. Useful for "how long
   * has this engagement been in Annual Return Prep" type queries.
   */
  added_at timestamptz NOT NULL DEFAULT now(),

  /**
   * Optional flag indicating this is the engagement's primary project.
   * UI filtering can prefer primary-project assignment when a single
   * engagement is in multiple projects.
   */
  is_primary boolean NOT NULL DEFAULT false,

  /**
   * Optional notes / sub-stage tag specific to this engagement's
   * place in this project (e.g., "blocked on K-1 receipt" or
   * "fast-track" for high-priority items).
   */
  notes text,

  created_at timestamptz NOT NULL DEFAULT now(),

  -- Composite FK on (tenant_id, engagement_id) for cross-tenant
  -- safety. Same pattern as client_facts + client_memories.
  CONSTRAINT engagement_projects_tenant_engagement_fk
    FOREIGN KEY (tenant_id, engagement_id)
    REFERENCES engagements(tenant_id, id)
    ON DELETE CASCADE,

  -- Each engagement can be in a given project at most once.
  UNIQUE (engagement_id, project_id)
);

CREATE INDEX IF NOT EXISTS engagement_projects_project_idx
  ON engagement_projects(project_id, added_at DESC);

CREATE INDEX IF NOT EXISTS engagement_projects_engagement_idx
  ON engagement_projects(engagement_id);

CREATE INDEX IF NOT EXISTS engagement_projects_tenant_primary_idx
  ON engagement_projects(tenant_id, engagement_id)
  WHERE is_primary;

ALTER TABLE engagement_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_projects FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_engagement_projects ON engagement_projects;
CREATE POLICY tenant_isolation_engagement_projects ON engagement_projects
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
