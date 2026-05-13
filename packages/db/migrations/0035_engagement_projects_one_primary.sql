-- Migration 0035 — enforce one primary project per engagement.
--
-- Codex round 2 P2 (C25) caught: the v0 setPrimary flow has two
-- UPDATEs (clear then set). Under concurrent promotions across two
-- preparer tabs, the clear can land before the set without atomic
-- protection, leaving the engagement with two primaries (each tab's
-- set succeeded). The application code SELECTs to verify and uses
-- single-statement UPDATEs going forward, but the only true
-- invariant guarantee is at the DB layer.
--
-- Partial unique index: at most one row per engagement_id where
-- is_primary = true. Postgres will raise a unique_violation if two
-- concurrent transactions both try to set is_primary=true on
-- different (engagement_id, project_id) pairs without the prior
-- clear committing first. The application action catches that as
-- a "Another preparer changed this; please retry" error.
--
-- Codex round 3 P1: dedup pre-step. If any environment already has
-- multiple is_primary=true rows for the same engagement (the exact
-- bad state earlier code could create), the CREATE UNIQUE INDEX
-- would abort and block deployment. Dedup first, keeping the most-
-- recently-added primary per engagement. Tie-breaker on id keeps
-- the migration deterministic.

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY engagement_id
           ORDER BY added_at DESC, id DESC
         ) AS rn
    FROM engagement_projects
   WHERE is_primary
)
UPDATE engagement_projects ep
   SET is_primary = false
  FROM ranked r
 WHERE ep.id = r.id
   AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS
  engagement_projects_one_primary_per_engagement_uniq_idx
  ON engagement_projects (engagement_id)
  WHERE is_primary;
