-- Migration 0031 — settings + calendar layer.
--
-- Adds the per-tenant configuration surfaces the v3 dashboard IA
-- audit surfaced (CLAUDE.md §8 AI Preferences, Automated Reminders,
-- Notifications; §4 Calendar). Five new tables:
--
--   tenant_ai_preferences  — one row/tenant. Tone, insight toggles,
--                            Docket Personality, Quiet Hours.
--   reminder_rules         — one row per (tenant, trigger). Five
--                            canonical triggers seeded per tenant.
--   notification_prefs     — one row per (tenant, category). Four
--                            canonical categories seeded per tenant.
--   calendar_events        — google-calendar mirror, scoped per
--                            tenant, with client_id + engagement_id
--                            FKs so calendar entries are first-class
--                            client artifacts.
--   tenant_settings        — generic JSONB k/v store per tenant.
--                            Holds theme_pref, refund_policy_md,
--                            branding_*, anything else
--                            instance-scoped that doesn't earn its
--                            own column.
--
-- ALL TENANT-SCOPED. RLS ENABLED + FORCED. Same pattern as the
-- rest of the schema. The seeding of canonical rows (5 reminder
-- triggers + 4 notification categories per tenant) is done by the
-- app layer when the firm first opens the settings page — there's
-- no global tenant cursor at migration time so we can't seed in
-- DDL. The settings pages render defaults when no row exists, then
-- INSERT on first edit.

-- ──────────────────────────────────────────────────────────────
-- tenant_ai_preferences — one row per tenant.
-- ──────────────────────────────────────────────────────────────
-- Drives every agent system-prompt assembly + insight-suppression
-- filter. Lives in command-room Settings → Intelligence → AI
-- Preferences. Tone descriptor is a constrained enum so we can
-- pre-compile the prompt fragments; everything else is plain
-- boolean toggles + a free-text "Docket Personality" field.
--
-- Quiet Hours stored as integer minute-of-day pair (0-1440). Local
-- timezone resolved per-tenant via tenants.timezone (already in
-- the existing schema). Inherited by reminder_rules + notification_prefs
-- so the firm doesn't configure it three times.
CREATE TABLE IF NOT EXISTS tenant_ai_preferences (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,

  -- Tone: professional / warm / direct. Drives system-prompt fragments.
  -- v3 dashboard surfaced these three as the canonical set; we honor it.
  tone text NOT NULL DEFAULT 'warm'
    CHECK (tone IN ('professional', 'warm', 'direct')),

  -- Insight surface toggles. All default ON because the value of the
  -- product is the surfacing; firms turn them off if they find a
  -- particular surface too noisy. The agent fleet reads these before
  -- emitting any insight and short-circuits when toggled off.
  discovery_insights boolean NOT NULL DEFAULT true,
  compliance_flags boolean NOT NULL DEFAULT true,
  risk_tier_classification boolean NOT NULL DEFAULT true,
  deadline_alerts boolean NOT NULL DEFAULT true,
  pricing_inconsistency_alerts boolean NOT NULL DEFAULT true,
  churn_risk_alerts boolean NOT NULL DEFAULT true,
  capacity_warnings boolean NOT NULL DEFAULT true,

  -- Free-text firm-specific tone tweak appended to every agent's
  -- system prompt. ≤500 chars enforced at API boundary (not DB —
  -- DDL CHECK on long text is awkward, and firms might legitimately
  -- want a multi-paragraph voice guide).
  personality text NOT NULL DEFAULT '',

  -- Quiet Hours: minute-of-day pair, local-firm-tz. Default 19:00-07:00.
  -- 1140 = 19*60. 420 = 7*60. Wraps overnight when start > end.
  quiet_hours_start_min integer NOT NULL DEFAULT 1140
    CHECK (quiet_hours_start_min >= 0 AND quiet_hours_start_min <= 1440),
  quiet_hours_end_min integer NOT NULL DEFAULT 420
    CHECK (quiet_hours_end_min >= 0 AND quiet_hours_end_min <= 1440),
  quiet_hours_enabled boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tenant_ai_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_ai_preferences FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_tenant_ai_preferences
  ON tenant_ai_preferences;
CREATE POLICY tenant_isolation_tenant_ai_preferences
  ON tenant_ai_preferences
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- updated_at trigger
CREATE OR REPLACE FUNCTION tenant_ai_preferences_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tenant_ai_preferences_updated_at
  ON tenant_ai_preferences;
CREATE TRIGGER tenant_ai_preferences_updated_at
  BEFORE UPDATE ON tenant_ai_preferences
  FOR EACH ROW
  EXECUTE FUNCTION tenant_ai_preferences_set_updated_at();

-- ──────────────────────────────────────────────────────────────
-- reminder_rules — one row per (tenant, trigger).
-- ──────────────────────────────────────────────────────────────
-- Five canonical triggers per CLAUDE.md §8 Automated Reminders.
-- App layer seeds defaults on first Settings → Reminders page
-- visit; no rows = "haven't configured yet, use defaults" is also
-- a valid state.
CREATE TABLE IF NOT EXISTS reminder_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- The five canonical triggers. Enum-style CHECK rather than a
  -- separate enum type to keep migration churn down.
  trigger text NOT NULL
    CHECK (trigger IN (
      'missing_documents',
      'engagement_letter_unsigned',
      'eightyseventynine_pending',
      'outstanding_balance',
      'year_round_planning'
    )),

  enabled boolean NOT NULL DEFAULT true,

  -- Interval between attempts, in hours. The five triggers have
  -- different natural cadences: docs every 72h, 8879 every 24h,
  -- year-round 91d (quarterly) etc. Stored as integer-hours rather
  -- than interval to make the cron scheduler arithmetic obvious.
  interval_hours integer NOT NULL DEFAULT 72
    CHECK (interval_hours > 0 AND interval_hours <= 2160),  -- ≤ 90d

  max_attempts integer NOT NULL DEFAULT 5
    CHECK (max_attempts > 0 AND max_attempts <= 20),

  -- Channel preference. 'auto' = pick best channel per client
  -- (uses channel-availability inline icons heuristic — green
  -- portal first, amber SMS, gray email). Other values force a
  -- specific channel regardless of client availability.
  channel text NOT NULL DEFAULT 'auto'
    CHECK (channel IN ('auto', 'sms', 'email', 'portal', 'all')),

  -- Whether this rule respects tenant_ai_preferences.quiet_hours.
  -- Default true; setting false lets a firm chase a 4/15 8879 at
  -- 11pm if they want to.
  respect_quiet_hours boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, trigger)
);

CREATE INDEX IF NOT EXISTS reminder_rules_tenant_idx
  ON reminder_rules(tenant_id);

ALTER TABLE reminder_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_rules FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_reminder_rules ON reminder_rules;
CREATE POLICY tenant_isolation_reminder_rules ON reminder_rules
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE OR REPLACE FUNCTION reminder_rules_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reminder_rules_updated_at ON reminder_rules;
CREATE TRIGGER reminder_rules_updated_at
  BEFORE UPDATE ON reminder_rules
  FOR EACH ROW
  EXECUTE FUNCTION reminder_rules_set_updated_at();

-- ──────────────────────────────────────────────────────────────
-- notification_prefs — one row per (tenant, category).
-- ──────────────────────────────────────────────────────────────
-- Four canonical categories × three channels per CLAUDE.md §8
-- Notifications. App seeds defaults on first Settings → Notifications
-- visit.
CREATE TABLE IF NOT EXISTS notification_prefs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- The four canonical event categories.
  category text NOT NULL
    CHECK (category IN ('deadlines', 'ai_alerts', 'client_activity', 'system')),

  -- Per-channel toggles. Defaults vary by category — see app-layer
  -- seeder for the matrix. Schema-level defaults are conservative
  -- (deadlines + system on email/in-app; everything else off except
  -- in-app).
  sms boolean NOT NULL DEFAULT false,
  email boolean NOT NULL DEFAULT true,
  in_app boolean NOT NULL DEFAULT true,

  -- Severity threshold. 'all' = surface everything in this category.
  -- 'high' = surface only red/critical. 'medium' = amber+red.
  threshold text NOT NULL DEFAULT 'medium'
    CHECK (threshold IN ('all', 'medium', 'high')),

  -- For deadlines category specifically: days-before-deadline at
  -- which the notification fires. Ignored for other categories.
  deadline_days_before integer NOT NULL DEFAULT 7
    CHECK (deadline_days_before > 0 AND deadline_days_before <= 90),

  respect_quiet_hours boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, category)
);

CREATE INDEX IF NOT EXISTS notification_prefs_tenant_idx
  ON notification_prefs(tenant_id);

ALTER TABLE notification_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_prefs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_notification_prefs ON notification_prefs;
CREATE POLICY tenant_isolation_notification_prefs ON notification_prefs
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE OR REPLACE FUNCTION notification_prefs_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notification_prefs_updated_at ON notification_prefs;
CREATE TRIGGER notification_prefs_updated_at
  BEFORE UPDATE ON notification_prefs
  FOR EACH ROW
  EXECUTE FUNCTION notification_prefs_set_updated_at();

-- ──────────────────────────────────────────────────────────────
-- calendar_events — google-calendar mirror, tenant-scoped.
-- ──────────────────────────────────────────────────────────────
-- Drives the command-room /calendar surface. Two-way sync with
-- Google Calendar via the google-calendar MCP server. client_id +
-- engagement_id FKs make calendar entries queryable as first-class
-- client artifacts (Discovery agent reads them; Strategy agent
-- reads them).
--
-- We mirror Google's event ID + iCal UID for dedup on push/pull.
-- Last-write-wins via updated_at; conflicts surface as a banner.
CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Google Calendar identifiers. external_id is per-calendar unique;
  -- ical_uid is stable across calendar moves. Both nullable for
  -- events created in Docket and pushed up.
  external_id text,        -- Google's eventId
  ical_uid text,           -- Google's iCalUID
  calendar_id text,        -- Google calendarId (firm may have many)

  -- Event type. Drives color coding + filtering on the UI.
  event_type text NOT NULL DEFAULT 'meeting'
    CHECK (event_type IN (
      'meeting',           -- client meeting (zoom / phone / in-person)
      'filing_deadline',   -- IRS or state filing deadline
      'internal_review',   -- partner / senior preparer review block
      'audit_milestone',   -- IRS audit response deadline
      'planning_touchpoint' -- year-round Q-end check-in
    )),

  title text NOT NULL,
  description text,
  location text,

  -- Time range. timestamptz with all-day stored as 00:00 UTC.
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,

  -- Client + engagement linkage. Both nullable: a filing_deadline
  -- might be unlinked (firm-wide). On client/engagement delete,
  -- SET NULL so the calendar entry persists (a meeting that
  -- happened still happened).
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  engagement_id uuid REFERENCES engagements(id) ON DELETE SET NULL,

  -- Attendees + organizer. Minimal payload — full attendee detail
  -- comes from Google on demand.
  attendee_count integer NOT NULL DEFAULT 0,
  organizer_email text,

  -- Status. Mirrors Google Calendar's status enum.
  status text NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'tentative', 'cancelled')),

  -- Last-write-wins sync timestamps.
  external_updated_at timestamptz,  -- when Google last updated it
  synced_at timestamptz,

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Dedup across pull cycles. tenant + external_id is the natural
  -- key for two-way sync.
  UNIQUE (tenant_id, calendar_id, external_id)
);

CREATE INDEX IF NOT EXISTS calendar_events_tenant_starts_idx
  ON calendar_events(tenant_id, starts_at DESC);
CREATE INDEX IF NOT EXISTS calendar_events_client_idx
  ON calendar_events(client_id);
CREATE INDEX IF NOT EXISTS calendar_events_engagement_idx
  ON calendar_events(engagement_id);
CREATE INDEX IF NOT EXISTS calendar_events_event_type_idx
  ON calendar_events(event_type);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_calendar_events ON calendar_events;
CREATE POLICY tenant_isolation_calendar_events ON calendar_events
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE OR REPLACE FUNCTION calendar_events_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS calendar_events_updated_at ON calendar_events;
CREATE TRIGGER calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION calendar_events_set_updated_at();

-- ──────────────────────────────────────────────────────────────
-- tenant_settings — generic per-tenant JSONB k/v store.
-- ──────────────────────────────────────────────────────────────
-- Holds instance-scoped configuration that doesn't earn its own
-- column. Initial keys:
--
--   refund_policy_md     — markdown shown at deposit checkout
--   branding_logo_url    — firm logo URL (R2 reference)
--   branding_hue_offset  — accent-hue offset within 130-165 oklch
--   portal_welcome_md    — custom welcome screen copy
--   portal_videos        — { stage_key: video_r2_url } per
--                          first_time / returning / docs_received /
--                          review_ready / post_filing
--   custom_subdomain     — clients.firm.com CNAME (V1.5)
--
-- Future keys: anything that's tenant-scoped + opt-in + not worth
-- a column migration. The opinion is: prefer a column when you
-- query the field; prefer JSONB when you only render it.
CREATE TABLE IF NOT EXISTS tenant_settings (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,

  -- Theme preference. Stored here so it survives the user record
  -- (firms can set a firm-wide default; users override on
  -- users.theme_pref).
  theme_pref text NOT NULL DEFAULT 'system'
    CHECK (theme_pref IN ('light', 'dark', 'system')),

  -- Markdown refund policy shown inline at deposit checkout.
  -- Empty string = no policy rendered (legacy behavior).
  refund_policy_md text NOT NULL DEFAULT '',

  -- Branding overrides. JSONB so we can add keys without DDL
  -- churn. Schema enforced at API boundary.
  branding jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Portal customization JSON. Holds welcome_md + video URLs +
  -- custom_subdomain + anything else portal-shaped.
  portal jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Catch-all. Use sparingly — prefer named columns when possible.
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_tenant_settings ON tenant_settings;
CREATE POLICY tenant_isolation_tenant_settings ON tenant_settings
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE OR REPLACE FUNCTION tenant_settings_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tenant_settings_updated_at ON tenant_settings;
CREATE TRIGGER tenant_settings_updated_at
  BEFORE UPDATE ON tenant_settings
  FOR EACH ROW
  EXECUTE FUNCTION tenant_settings_set_updated_at();

-- ──────────────────────────────────────────────────────────────
-- Per-user theme preference (extends existing users table).
-- ──────────────────────────────────────────────────────────────
-- Firms set a firm-wide default in tenant_settings.theme_pref;
-- individual users can override here. NULL = inherit firm default.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS theme_pref text
    CHECK (theme_pref IS NULL OR theme_pref IN ('light', 'dark', 'system'));
