-- 0025_deposit_config — firm-wide default deposit amount + per-engagement waiver.
--
-- Per the deposit-flow UX redesign (commit chain following the
-- payments substrate at de4c835):
--   - Settings → "Default deposit amount" lives at firm_profile level
--     (firm_owner sets once; intake reads on every flow)
--   - engagements.deposit_waived lets Antonio waive deposit for
--     specific clients (referral, in-laws, returning client cohort)
--     without skipping the firm-wide default
--
-- The intake /deposit page picks:
--   engagement.deposit_waived = true  → skip the deposit gate
--   engagement.fee_quoted_cents IS NOT NULL → use that
--   else → firm_profile.default_deposit_cents
--   else → 5000 (legacy hardcoded $50)

ALTER TABLE firm_profile
  ADD COLUMN IF NOT EXISTS default_deposit_cents integer NOT NULL DEFAULT 5000;

COMMENT ON COLUMN firm_profile.default_deposit_cents IS
  'Default deposit amount in cents the intake /deposit page mints if the engagement does not override.';

ALTER TABLE engagements
  ADD COLUMN IF NOT EXISTS deposit_waived boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN engagements.deposit_waived IS
  'When true, the intake /deposit page skips the deposit gate. Antonio sets via /clients/[id] toggle for referral / pro-bono engagements.';

-- Optional: track who waived + when, for audit. v0 stores the
-- waiver flag only; auditing of who set it lives in the actions
-- table via the server action (action_class=send-internal,
-- tool_name=engagement.set-deposit-waived). If we later want a
-- queryable waiver history per engagement, add waived_at +
-- waived_by_user_id columns. v1.5.
