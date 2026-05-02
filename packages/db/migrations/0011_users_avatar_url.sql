-- Multi-firm display polish (Day 4 wire-up).
--
-- Adds users.avatar_url to surface the firm owner's headshot in the
-- client portal (AskAntonioBar avatar, chat header, AntonioNote,
-- /welcome). Previously the UI hardcoded /antonio.webp; now it
-- reads from this column with initials fallback when NULL.
--
-- Populated from Clerk's user.imageUrl on sign-in claim / auto-provision.
-- Existing rows (Antonio's seed) start NULL and get filled on next
-- sign-in. UI falls back to initials of `name` until that lands.

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text;
