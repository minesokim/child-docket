-- payments — per-tenant record of Square Checkout link state.
--
-- One row per checkout link minted via the createCheckoutLink server
-- action. Tracks the link's lifecycle so the command-room UI can
-- answer "did this client pay?" without round-tripping to Square on
-- every page render.
--
-- Status transitions (driven by refresh-status action OR future webhook):
--   pending   — link created, no payment received yet
--   paid      — Square reports order COMPLETED
--   partial   — multiple tenders, total < quoted (rare)
--   refunded  — Square reports refund event
--   cancelled — link expired or merchant cancelled
--   failed    — checkout attempt failed (e.g., card declined)
--
-- Why a dedicated table (vs querying actions audit-log):
--   1. Status lookup is high-frequency on /clients/[id] page renders;
--      audit log is INSERT-only with chain trigger overhead per write.
--   2. Idempotency: ON CONFLICT (square_payment_link_id) DO NOTHING
--      lets a double-mint return cleanly without duplicating rows.
--   3. Future refund flow needs to UPDATE payments.refund_amount;
--      audit-log is append-only by design.

CREATE TABLE IF NOT EXISTS payments (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id                uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  engagement_id            uuid REFERENCES engagements(id) ON DELETE SET NULL,
  -- Square's payment_link.id (e.g., "lpl_abc123…"). Per-tenant unique
  -- via UNIQUE INDEX below — Square's IDs are globally unique within
  -- their system but we scope by tenant for safety.
  square_payment_link_id   text NOT NULL,
  -- Square's order_id (the underlying Order record). Used for status
  -- polling via GET /v2/orders/{id}.
  square_order_id          text NOT NULL,
  status                   text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'partial', 'refunded', 'cancelled', 'failed')),
  amount_cents             integer NOT NULL,
  collected_cents          integer NOT NULL DEFAULT 0,
  refunded_cents           integer NOT NULL DEFAULT 0,
  currency                 text NOT NULL DEFAULT 'USD',
  -- The hosted checkout URL Square returns. Stored so we can re-send
  -- to the client without re-minting.
  checkout_url             text NOT NULL,
  tax_year                 integer,
  paid_at                  timestamptz,
  refunded_at              timestamptz,
  last_polled_at           timestamptz,
  -- Square API response on the most recent status check. Useful for
  -- debugging "why is this still pending?"
  last_square_status       text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- Tenant-scoped uniqueness on the Square payment_link_id. Same link
-- can't appear twice for one tenant (replay-safe insert) AND a
-- collision across tenants is impossible by Square's global uniqueness.
CREATE UNIQUE INDEX payments_tenant_link_uniq
  ON payments (tenant_id, square_payment_link_id);

CREATE INDEX payments_tenant_client_idx
  ON payments (tenant_id, client_id);

CREATE INDEX payments_tenant_status_idx
  ON payments (tenant_id, status);

CREATE INDEX payments_engagement_idx
  ON payments (tenant_id, engagement_id)
  WHERE engagement_id IS NOT NULL;

-- RLS: app reads through withTenant set app.current_tenant_id;
-- ENABLE + FORCE so policy applies even to table owner.
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;

CREATE POLICY payments_tenant_isolation
  ON payments
  USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY payments_bypass
  ON payments
  USING (current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on');

-- updated_at auto-bump.
CREATE OR REPLACE FUNCTION payments_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payments_touch_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION payments_touch_updated_at();
