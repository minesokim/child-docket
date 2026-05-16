-- webhook_events: replay-protection dedup table.
--
-- Per Session 6 webhook signature audit (2026-05-15). Three Tier-0
-- replay vulnerabilities surfaced across square / docusign / twilio
-- routes:
--
--   1. Square refund.created replay accumulates payments.refundedCents
--      on each replay. The signature verifies (it's a real Square
--      signature from a captured legit event); the handler treats
--      every retry as a new partial refund. Cumulative refundedCents
--      can exceed collectedCents indefinitely.
--   2. DocuSign envelope-completed replay flips signatures.status from
--      'declined' or 'kba-failed' back to 'signed'. An attacker who
--      captured a legitimate envelope-completed webhook can revert
--      a void or decline silently. The signature stays valid; the
--      handler always processes the event idempotently.
--   3. Twilio inbound-SMS replay re-writes an audit row each time.
--      Less catastrophic (audit chain extends; idempotent classifier
--      handling) but still pollutes the actions feed.
--
-- THE FIX
--   A (provider, event_id) primary key on a webhook_events table.
--   Each route handler does, AFTER signature verification + tenant
--   resolution but BEFORE state-changing work:
--
--     INSERT INTO webhook_events (provider, event_id)
--     VALUES ('square', $1)
--     ON CONFLICT (provider, event_id) DO NOTHING
--     RETURNING id;
--
--   If the RETURNING row is non-empty, we're the first to see this
--   event — process. If empty, it's a replay — return 200 + skip
--   the state mutation. The signature must still verify, so this
--   doesn't allow forgery; it ONLY closes the replay window.
--
-- TENANT SCOPING
--   webhook_events is INTENTIONALLY platform-global. Each provider's
--   event_id is globally unique within that provider's namespace
--   (Square event_id is a UUID across the whole webhook stream; same
--   for DocuSign uri; Twilio MessageSid). Tenant-scoping the table
--   would require resolving the tenant before dedup, which defeats
--   the goal of dropping replays as early as possible. The table
--   does NOT contain any tenant-confidential data — just provider +
--   event_id + received_at — so global access is safe.
--
--   The Session 5 RLS coverage test (rls-coverage.test.ts) includes
--   a PLATFORM_TABLES allowlist; this migration adds webhook_events
--   to it in the same commit.
--
-- RETENTION
--   No automatic prune in this migration. v0 volume is small
--   (Antonio's inbound SMS + a handful of envelopes + payments per
--   week); the table will not be a perf concern for many months.
--   A nightly Inngest cron that prunes rows older than 90 days
--   ships in V1.5 once the table volume justifies it.
--
-- INDEXES
--   The PRIMARY KEY on (provider, event_id) is the only index we
--   need. Lookups always hit this index; received_at is a tiebreaker
--   for analytics, not a query path.
--
-- EDGE CASES enumerated 2026-05-15 prior to authoring:
--
--   - First-ever event for a provider: INSERT succeeds, RETURNING
--     row returned, processed.
--   - Replay of a previous event_id: INSERT fails ON CONFLICT,
--     RETURNING empty, handler returns 200 (no state change).
--   - Two concurrent posts of the same event_id from provider's
--     retry: one wins the unique constraint, the other gets ON
--     CONFLICT. Both return 200 to provider. State mutation
--     happens exactly once.
--   - Provider that hasn't been added yet: provider field is text,
--     no enum constraint — adding a new provider (resend, etc.)
--     requires no schema change.
--   - Bad signature: the route handler returns 401 BEFORE the
--     INSERT, so failed-sig events never consume a row. Closes
--     a DoS-via-table-fill attack vector.
--   - Replay AFTER 90-day prune (V1.5): the prune cron runs at
--     a long enough horizon that legit retries (Twilio retries
--     for 4 hours; Square retries for 5 days; DocuSign retries
--     for 24 hours) all fall within the retention window. Risk
--     of a stale replay slipping in post-prune is low + tolerable.

CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  provider text NOT NULL,
  event_id text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT webhook_events_provider_event_unique UNIQUE (provider, event_id),
  CONSTRAINT webhook_events_provider_check CHECK (
    provider IN ('square', 'docusign', 'twilio', 'resend')
  )
);

COMMENT ON TABLE webhook_events IS
  'Replay-protection dedup. INSERT ON CONFLICT DO NOTHING after signature verification.';
COMMENT ON COLUMN webhook_events.provider IS
  'Webhook source. Allowlisted to prevent typos. Add new providers via migration.';
COMMENT ON COLUMN webhook_events.event_id IS
  'Provider-issued unique event id. Square event_id / DocuSign uri / Twilio MessageSid.';

-- No RLS. Platform-global by design. See file header.
-- ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;  -- intentionally not set
