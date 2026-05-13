-- Migration 0032 — client_memories table.
--
-- The Memories surface: plain-English bullets of "what we know
-- about this client" rendered as a first-class object on the client
-- page. Slant.app validated this primitive in financial advice;
-- we're applying it to tax. See CLAUDE.md §4 Memories tab + §8
-- Memories section + §9 Memory Curator Agent.
--
-- ──────────────────────────────────────────────────────────────
-- DESIGN PRINCIPLE
--   client_facts (migration 0021) holds STRUCTURED facts with
--   tax-year supersession (e.g., income_w2_2024, dependent_count).
--   client_memories holds UNSTRUCTURED prose ("Daughter Lily starts
--   UC Davis Aug 2026", "Prefers SMS over email"). Different
--   semantics; cleaner to keep separate than to stretch client_facts.
-- ──────────────────────────────────────────────────────────────
--
-- RLS — same shape as the rest of the schema. ENABLE + FORCE so
-- even table-owner roles get filtered. Service-role bypass requires
-- explicit app.bypass_rls = on per existing pattern.

CREATE TABLE IF NOT EXISTS client_memories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  /**
   * client_id with composite FK to (tenant_id, client_id) — matches
   * the pattern from migration 0021 client_facts. Cross-tenant
   * binding impossible by FK validation; cascade on tenant OR
   * client deletion.
   */
  client_id uuid NOT NULL,

  /**
   * The memory text itself. Plain English. ≤500 chars enforced at
   * the application layer (Memory Curator agent contract). UI
   * renders verbatim.
   */
  text text NOT NULL,

  /**
   * Pinned memories surface to the top of the Memories tab and into
   * pre-meeting briefs first. Antonio's manual curation signal.
   */
  pinned boolean NOT NULL DEFAULT false,

  /**
   * Dismissed memories hide from the active Memories list but
   * remain in the audit chain. Re-extraction logic checks dismissed
   * status to avoid resurfacing the same dismissed memory from a
   * new source artifact.
   */
  dismissed boolean NOT NULL DEFAULT false,

  /**
   * Where the memory was extracted from. Drives the UI source label
   * ("From message Apr 14" / "From meeting May 1" / "Manual" / etc.).
   *
   *   manual              — Antonio typed it into the Memories tab
   *   message             — extracted from inbound/outbound message
   *   meeting_transcript  — extracted from Notetaker transcript (V1.5)
   *   intake_response     — extracted from intake form answer
   *   document_parse      — extracted from a doc upload (e.g., W-2 employer name)
   *   inferred            — Memory Curator agent inference from
   *                         multiple sources
   */
  source_kind text NOT NULL DEFAULT 'manual'
    CHECK (source_kind IN (
      'manual',
      'message',
      'meeting_transcript',
      'intake_response',
      'document_parse',
      'inferred'
    )),

  /**
   * Link back to the action that produced this memory. NULL for
   * manual entries. SET NULL on delete — actions is append-only via
   * trigger (migration 0007), but the FK semantics survive future
   * audit-retention deletions cleanly.
   */
  source_action_id uuid REFERENCES actions(id) ON DELETE SET NULL,

  /**
   * Optional reference to the source artifact this memory was
   * extracted from (e.g., a message id, document id, transcript id).
   * Stored as text to support polymorphic references; UI uses
   * source_kind to interpret.
   */
  source_ref text,

  /**
   * Which agent extracted this memory. NULL for manual entries.
   * v0 vocabulary: 'memory-curator'.
   */
  extracted_by_agent text,

  /**
   * 0..1 confidence that the memory is accurate. Manual entries
   * default to 1.0; agent extractions get the agent's confidence
   * score. CHECK at DB layer.
   */
  confidence real NOT NULL DEFAULT 1.0,

  /**
   * When this memory was last surfaced in a UI render (Memories tab
   * load, pre-meeting brief, chat context assembly). Drives the
   * "stale memories" retention policy — memories not referenced in
   * 365+ days get auto-archived (separate cron, V1.5).
   */
  last_referenced_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Composite FK to clients table (cross-tenant safety)
  CONSTRAINT client_memories_tenant_client_fk
    FOREIGN KEY (tenant_id, client_id)
    REFERENCES clients(tenant_id, id)
    ON DELETE CASCADE,

  CONSTRAINT client_memories_confidence_range
    CHECK (confidence >= 0 AND confidence <= 1),

  -- Soft length limit at the DB layer; app enforces ≤500 chars
  -- contract but allow up to 2000 in case of legitimate longer
  -- memories ("the full story of how the IRS auditor handled the
  -- §6651 reasonable-cause request in 2023" type narratives).
  CONSTRAINT client_memories_text_length
    CHECK (char_length(text) > 0 AND char_length(text) <= 2000)
);

-- Active memories per client (excludes dismissed). Most common UI query.
CREATE INDEX IF NOT EXISTS client_memories_active_idx
  ON client_memories(tenant_id, client_id, pinned DESC, created_at DESC)
  WHERE NOT dismissed;

-- All memories for a client (including dismissed) for the audit view.
CREATE INDEX IF NOT EXISTS client_memories_client_idx
  ON client_memories(tenant_id, client_id);

-- Lookups by source action (for Memory Curator agent dedup).
CREATE INDEX IF NOT EXISTS client_memories_source_action_idx
  ON client_memories(source_action_id)
  WHERE source_action_id IS NOT NULL;

-- Recent memories across tenant (for the cross-client pattern view).
CREATE INDEX IF NOT EXISTS client_memories_tenant_recent_idx
  ON client_memories(tenant_id, created_at DESC);

-- RLS
ALTER TABLE client_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_memories FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_client_memories ON client_memories;
CREATE POLICY tenant_isolation_client_memories ON client_memories
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- updated_at trigger
CREATE OR REPLACE FUNCTION client_memories_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS client_memories_updated_at ON client_memories;
CREATE TRIGGER client_memories_updated_at
  BEFORE UPDATE ON client_memories
  FOR EACH ROW
  EXECUTE FUNCTION client_memories_set_updated_at();
