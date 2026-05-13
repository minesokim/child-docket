-- Migration 0033 — nudges + nudge_rules tables.
--
-- The Nudges surface (CLAUDE.md §8 Nudges section + §9 Nudges
-- Agent): proactive outreach prompts that surface life events,
-- time-window drift, milestone crossings, and compliance risks
-- BEFORE the client knows they need attention. Slant.app's daily
-- nudge feed is the structural reference; we apply to tax.
--
-- TWO TABLES:
--
--   nudge_rules
--     Per-tenant configuration of WHICH triggers fire as nudges.
--     Firms author + customize. Default rule set seeded per tenant.
--     Disabled rules don't generate nudges; enabled rules run on
--     the daily Nudge agent cron.
--
--   nudges
--     The actual queue of pending preparer-to-client outreach
--     drafts. One row per (client, trigger event, agent run). Has
--     lifecycle: pending → approved → sent OR pending → dismissed
--     OR pending → expired (if not approved within N days).
--
-- The Nudge agent reads nudge_rules + client_facts + engagement
-- state + calendar_events daily; produces nudges rows; preparer
-- approves/edits/dismisses via UI.

-- ──────────────────────────────────────────────────────────────
-- nudge_rules — per-tenant rule definitions.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nudge_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  /**
   * The trigger class. Enum-style CHECK rather than a separate
   * pg_enum type to keep migration churn down. Per CLAUDE.md §8
   * Nudges trigger taxonomy: 6 canonical classes.
   *
   * life_event           child turns 18, marriage, divorce, birth,
   *                      property purchase, business milestone
   * time_window          Q2 estimated payment due, Roth conversion
   *                      window, BOI deadline cohort, RMD age 73
   * drift                W-2 jumped 40% YoY, 1099 income tripled,
   *                      charitable giving doubled
   * milestone            business hits $250K rev (S-corp election),
   *                      LLC formed (BOI deadline starts), entity
   *                      falls out of state standing
   * drift_from_prior     refund dropped 60%, withholding pattern
   *                      changed, deduction posture flipped
   * compliance_risk      Statement of Information overdue, BOI
   *                      not filed within 90 days
   */
  trigger_class text NOT NULL
    CHECK (trigger_class IN (
      'life_event',
      'time_window',
      'drift',
      'milestone',
      'drift_from_prior',
      'compliance_risk'
    )),

  /**
   * Specific trigger key within the class. Free-form text so we
   * don't constrain the trigger universe at the schema level.
   * v1 vocabulary examples:
   *   life_event:        child_starts_college, marriage, spouse_death
   *   time_window:       q2_estimated, q3_estimated, roth_conv_window
   *   drift:             w2_jump_40pct, charitable_doubled
   *   milestone:         business_revenue_250k, llc_formed, entity_out_of_standing
   *   drift_from_prior:  refund_drop_60pct
   *   compliance_risk:   soi_overdue, boi_not_filed_90d
   */
  trigger_key text NOT NULL,

  /**
   * Whether this rule fires when its conditions are met. Firms
   * disable rules they don't want (e.g., a firm that doesn't do
   * estate planning disables life_event/spouse_death).
   */
  enabled boolean NOT NULL DEFAULT true,

  /**
   * Max nudges per client per N days. Prevents over-firing on a
   * client who has many flagged conditions. Default 1 per 7 days
   * per (client, trigger_class) combination.
   */
  max_per_client_per_days integer NOT NULL DEFAULT 7
    CHECK (max_per_client_per_days > 0 AND max_per_client_per_days <= 365),

  /**
   * Whether this rule honors AI Preferences quiet hours. Default
   * true. Setting false would let the agent run during quiet
   * hours (e.g., for compliance_risk rules where SoI suspension
   * is imminent).
   */
  respect_quiet_hours boolean NOT NULL DEFAULT true,

  /**
   * Agent confidence floor. Nudges with confidence below this
   * floor don't surface to the preparer (they go into the audit
   * log but stay hidden). Per-rule because some rule classes are
   * higher-confidence (compliance_risk where the CA SoS API is
   * authoritative) than others (drift where the agent is inferring).
   */
  confidence_floor real NOT NULL DEFAULT 0.7
    CHECK (confidence_floor >= 0 AND confidence_floor <= 1),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, trigger_class, trigger_key)
);

CREATE INDEX IF NOT EXISTS nudge_rules_tenant_idx
  ON nudge_rules(tenant_id)
  WHERE enabled;

CREATE INDEX IF NOT EXISTS nudge_rules_class_idx
  ON nudge_rules(tenant_id, trigger_class)
  WHERE enabled;

ALTER TABLE nudge_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE nudge_rules FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_nudge_rules ON nudge_rules;
CREATE POLICY tenant_isolation_nudge_rules ON nudge_rules
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE OR REPLACE FUNCTION nudge_rules_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nudge_rules_updated_at ON nudge_rules;
CREATE TRIGGER nudge_rules_updated_at
  BEFORE UPDATE ON nudge_rules
  FOR EACH ROW
  EXECUTE FUNCTION nudge_rules_set_updated_at();

-- ──────────────────────────────────────────────────────────────
-- nudges — the pending queue of preparer-to-client outreach drafts.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nudges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,

  /**
   * The rule that produced this nudge (NULL if produced by manual
   * insert / admin tooling).
   */
  rule_id uuid REFERENCES nudge_rules(id) ON DELETE SET NULL,

  /**
   * Denormalized for fast filtering — even if the rule is later
   * deleted, the trigger_class + trigger_key on the nudge survive.
   */
  trigger_class text NOT NULL
    CHECK (trigger_class IN (
      'life_event',
      'time_window',
      'drift',
      'milestone',
      'drift_from_prior',
      'compliance_risk'
    )),
  trigger_key text NOT NULL,

  /**
   * Canonical alert format per CLAUDE.md §8: the title rendered
   * on the home Nudges feed. Format: "{ClientName}'s {situation} ·
   * {quantified impact}". Pre-composed by the agent at extraction
   * time.
   */
  title text NOT NULL,

  /**
   * Long-form explanation: the rationale + which client facts
   * triggered the nudge + suggested outreach approach.
   */
  body text NOT NULL,

  /**
   * Pre-drafted outreach the preparer can approve + send. Caller
   * (Inbox Drafter agent) handles channel selection (SMS/email/portal)
   * separately based on client channel preferences.
   */
  draft_outreach text,

  /**
   * Channel the agent recommends for this nudge. NULL = let the
   * preparer pick at approval time.
   */
  recommended_channel text
    CHECK (recommended_channel IS NULL OR recommended_channel IN (
      'sms', 'email', 'portal_chat', 'phone_call'
    )),

  /**
   * 0..1 confidence. Below the rule's confidence_floor at agent run
   * time means the nudge stays in audit but doesn't surface.
   */
  confidence real NOT NULL DEFAULT 0.7
    CHECK (confidence >= 0 AND confidence <= 1),

  /**
   * Lifecycle:
   *   pending     awaiting preparer review
   *   approved    preparer approved (passes to Inbox Drafter for send)
   *   sent        actually delivered to the client
   *   edited      preparer edited the draft (variant of approved)
   *   dismissed   preparer explicitly dismissed (NOT sent)
   *   expired     not approved within expires_at; auto-archived
   */
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'sent', 'edited', 'dismissed', 'expired')),

  /**
   * Self-imposed deadline for preparer action. Nudges past this
   * date auto-transition to expired. NULL = no expiry (rare).
   */
  expires_at timestamptz,

  /**
   * Audit fields for state transitions.
   */
  approved_at timestamptz,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  dismissed_at timestamptz,
  dismissed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  dismissed_reason text,
  sent_at timestamptz,

  /**
   * Source action that produced this nudge (the agent run audit
   * row). SET NULL on delete — actions is append-only via trigger
   * (migration 0007).
   */
  source_action_id uuid REFERENCES actions(id) ON DELETE SET NULL,

  /**
   * Reasoning trail emitted by the Nudge agent (per CLAUDE.md §9
   * Agent contract). JSONB containing ReasoningStep[].
   */
  reasoning_trail jsonb NOT NULL DEFAULT '[]'::jsonb,

  /**
   * Metadata catch-all (e.g., the specific client_facts rows that
   * triggered, calendar_events references, etc.).
   */
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT nudges_tenant_client_fk
    FOREIGN KEY (tenant_id, client_id)
    REFERENCES clients(tenant_id, id)
    ON DELETE CASCADE,

  CONSTRAINT nudges_title_length
    CHECK (char_length(title) > 0 AND char_length(title) <= 500),
  CONSTRAINT nudges_body_length
    CHECK (char_length(body) > 0)
);

-- Most common UI query: pending nudges for a tenant, ordered by recency.
CREATE INDEX IF NOT EXISTS nudges_pending_idx
  ON nudges(tenant_id, created_at DESC)
  WHERE status = 'pending';

-- Per-client nudge history for the audit view.
CREATE INDEX IF NOT EXISTS nudges_client_idx
  ON nudges(tenant_id, client_id, created_at DESC);

-- Rule-level dedup: (rule_id, client_id) recent windows.
CREATE INDEX IF NOT EXISTS nudges_rule_client_idx
  ON nudges(rule_id, client_id, created_at DESC)
  WHERE rule_id IS NOT NULL;

-- Source-action linkage for agent run audit.
CREATE INDEX IF NOT EXISTS nudges_source_action_idx
  ON nudges(source_action_id)
  WHERE source_action_id IS NOT NULL;

-- Expiry sweeper index.
CREATE INDEX IF NOT EXISTS nudges_expires_idx
  ON nudges(expires_at)
  WHERE status = 'pending' AND expires_at IS NOT NULL;

ALTER TABLE nudges ENABLE ROW LEVEL SECURITY;
ALTER TABLE nudges FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_nudges ON nudges;
CREATE POLICY tenant_isolation_nudges ON nudges
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE OR REPLACE FUNCTION nudges_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nudges_updated_at ON nudges;
CREATE TRIGGER nudges_updated_at
  BEFORE UPDATE ON nudges
  FOR EACH ROW
  EXECUTE FUNCTION nudges_set_updated_at();
