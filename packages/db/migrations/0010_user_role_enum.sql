-- Multi-role enforcement (Day 3 of post-audit hardening).
--
-- Convert users.role from `text` to `user_role` enum. Postgres can't
-- auto-cast text → enum if existing values aren't enum members, so the
-- sequence is:
--
--   1. Create the enum type (idempotent via DO/EXCEPTION block)
--   2. Remap legacy values (the seed used 'owner' before this migration)
--   3. Drop the column default (so the type change can run)
--   4. Convert the column type with an explicit USING cast
--   5. Restore the default with the new enum value
--
-- Safe to re-run: the enum-creation block swallows duplicate_object,
-- the data UPDATEs are idempotent, and the column-type ALTER is a no-op
-- if the column is already user_role.

-- 1. Create the enum type if it doesn't already exist.
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
        'firm_owner',
        'preparer',
        'reviewer',
        'admin',
        'assistant'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Remap legacy values BEFORE the type change, otherwise the USING
-- cast below will fail on rows whose `role` text doesn't match an enum
-- member.
--
--   'owner'  → 'firm_owner'   (matches the seed)
--   anything else not in the enum → 'preparer' (safe default; we don't
--   have any such rows today, but a future seed change could introduce
--   one and this keeps the migration ordered correctly).
UPDATE users SET role = 'firm_owner' WHERE role = 'owner';
UPDATE users
   SET role = 'preparer'
 WHERE role NOT IN ('firm_owner', 'preparer', 'reviewer', 'admin', 'assistant');

-- 3. Default value is text-typed and blocks the column conversion.
ALTER TABLE users ALTER COLUMN role DROP DEFAULT;

-- 4. Convert the column type. The USING expression makes the cast
-- explicit so Postgres validates every value against the enum.
ALTER TABLE users
    ALTER COLUMN role TYPE user_role
    USING role::user_role;

-- 5. Restore the default with the enum-typed value.
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'preparer'::user_role;
