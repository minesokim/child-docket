# Session Handoff — 2026-05-02

> **Read this AFTER `CLAUDE.md`, BEFORE writing any new code.**
>
> CLAUDE.md describes the project's vision + locked architecture (mostly aspirational).
> This doc describes what's actually in the codebase right now — what shipped this
> session, what's deployed, what's still open, and the decisions the founder has
> made that haven't been encoded into CLAUDE.md yet.
>
> When CLAUDE.md and this doc disagree about state, **this doc wins** until a
> dedicated docs-pass folds it back in.

---

## 1. The 30-second context

- **Founder**: David Kim (legal: Minseo Kim) — `minseodavid@gmail.com`. Signs in via Google.
- **Design partner**: Antonio at Vazant Consulting (CA EA). Hard ship: 5/15/2026.
- **Stage**: post-audit hardening. Two architecture audits + two security audits ran this session. Roughly 30 hours of audit RED/AMBER work has been compressed into ~25 commits across the day.
- **Two apps deployed on Vercel**:
  - `apps/client-portal` → `https://docket-portal.vercel.app` (production rebuild) AND `https://docket-client-portal.vercel.app` (legacy demo with mocks — kept alive for marketing/Loom; do NOT point real flows at it)
  - `apps/command-room` → some Vercel URL the founder set up this session; see his Vercel dashboard for the exact host
- **Database**: Neon (single dev branch). 12 migrations applied. Schema state: post-`0012_actions_allow_fk_cascade_null.sql`.
- **Repo**: `C:\Users\minse\projects\docket\` ↔ `github.com/minesokim/child-docket` (private).

---

## 2. What CLAUDE.md says vs what's actually in the repo

CLAUDE.md is partially aspirational. Both the May 2026 architecture audits flagged this. Reality:

| CLAUDE.md says exists | Actually exists | Notes |
|---|---|---|
| `apps/{client-portal, command-room, admin}` | `apps/{client-portal, command-room}` | **No `admin` app** — likely never needed; command-room covers it |
| `services/{orchestrator, mcp-gateway, browser-workers, ingestion}` | `services/{orchestrator, workers}` | `mcp-gateway` not built. `workers` is Inngest-based, not Playwright-browser-workers |
| `mcp-servers/{ledger, knowledge, gmail, xero, portal, documents, olt, irs-solutions}` | `mcp-servers/` exists but **EMPTY** | None built. Defer to M2+ per the rebuild plan |
| `services/orchestrator` claimed to be "Claude Agent SDK + Docket layer" | One 107-line file calling `@anthropic-ai/sdk` directly | No MCP routing, no approval flow, no trust gate yet. Stub. |
| `packages/{ui, db, tax-graph, agents, playbooks, shared}` | `packages/{ui, db, shared}` | `tax-graph`, `agents`, `playbooks` don't exist |
| 10 mock clients in seed | **No mock clients** (this session removed them) | Seed now: tenant + DEK + Antonio user only |

**Eventually update CLAUDE.md** to reflect this. For now, the next session should believe THIS doc over CLAUDE.md when they conflict.

---

## 3. What this session shipped (21 commits)

Committed in chronological order; commit hashes are stable (pushed to `main`).

### Day 1 — Security audit RED items (acb2d5f base → ee45aac)

1. `61a938e` — browser-side hardening: `console.error` PII strip in auth pages, security headers (HSTS / X-Frame-Options / X-Content-Type-Options / Referrer-Policy / Permissions-Policy / permissive CSP) on both apps, `Cache-Control: no-store` on `/intake/*`, `/portal/*`, `/clients/*`.
2. `25c83af` — auth-claim verification (require Clerk's verified PRIMARY email, not `emailAddresses[0]`); 8879 mock route hard-disabled in production via `NEXT_PUBLIC_ENABLE_MOCK_8879` flag.
3. `ee45aac` — audit trail in `completeIntake()` (was missing per ARCHITECTURE.md claim), `recordIntakeSignature()` server action capturing text-hash + IP + UA + audit row for engagement letter + §7216 consent, **`actions.client_id` FK changed to `ON DELETE SET NULL`** (migration 0008) so CCPA right-to-delete preserves audit history.

### Day 2 — Multi-firm wiring (bedf767, 3857b9d)

4. `bedf767` — `tenants.clerkOrgId` column added (migration 0009), `clients_phone_global_idx` for first-sign-in lookup, seed updated to document the manual Clerk dashboard step (`UPDATE tenants SET clerk_org_id = '<id>' WHERE slug = 'vazant'`).
5. `3857b9d` — **phone-based binding replaces auto-provisioning**. Clients no longer auto-create on phone-OTP completion (Codex flagged this RED). Now: phone must match a pre-seeded `clients` row with `clerk_user_id IS NULL`; on match, binds; on miss, redirects to `/no-access`. `resolveClient()` returns discriminated `{ kind: 'authed' | 'no_invite' | 'no_session' }`. `/no-access` page added. Command-room resolves tenant via `auth().orgId` → `tenants.clerk_org_id`, falls back to email-claim until Antonio sets up the Clerk Org.

### Day 3 — Multi-role (7ccf6ac, d97e0c3)

6. `7ccf6ac` — `userRoleEnum` pgEnum (`firm_owner | preparer | reviewer | admin | assistant`), `Role` type + `USER_ROLES` + `isRole()` in `@docket/shared`. Migration 0010 converts `users.role` from `text` to enum, remaps legacy `'owner'` → `'firm_owner'` (Antonio's seed value). Schema-side rejection of unknown roles.
7. `d97e0c3` — `requireRole()`, `assertRole()`, `hasRole()` helpers in `apps/command-room/src/lib/require-role.ts`. Policy matrix in the file header. `/clients` requires any firm role; `/clients/[id]` requires `firm_owner | preparer | reviewer`.

### Day 4 — Verification + auto-provision (f4c8af0, 9937aa0, aa30600, 9459f8a)

8. `f4c8af0` — Pure helpers (`assertRole`, `hasRole`, `isRole`) moved into `@docket/shared/src/role.ts`; **19 unit tests** added (`packages/shared/src/role.test.ts`). All 112 tests pass via `bun test src` from the package dir.
9. `9937aa0` — Auto-provision path in `command-room/src/lib/current-user.ts`: when a Clerk Org member signs in but has no `users` row, INSERT one with `role: 'preparer'` (safe baseline; firm owner promotes manually).
10. `aa30600` — `drizzle.config.ts` auto-loads `.env.local` via dotenv (uses `process.cwd()`, not `import.meta.url`, because drizzle-kit compiles configs to CJS internally).
11. `9459f8a` — Drizzle journal entries for migrations 0008/0009/0010 (drizzle-kit reads BOTH the journal AND the `__drizzle_migrations` table; missed entries = silent skips).

### Day 4 (cont.) — Firm-owner refactor (872cbd2, b4cc712, 14e27df, d9eaec9)

12. `872cbd2` — `users.avatar_url` column (migration 0011). Captured from Clerk's `imageUrl` on email-claim and auto-provision.
13. `b4cc712` — **Dynamic firm-owner name + avatar everywhere in client portal**. New `TenantDisplayProvider` + `useFirmOwner` / `useTenantName` hooks in `@docket/ui`. Hardcoded "Antonio Vazquez" / `/antonio.webp` replaced with the actual firm_owner of the signed-in client's tenant. AvatarSlot falls back to initials when `avatarUrl` is null. AskAntonioBar shows "Ask {firstName}". `intake/auth.ts` JOINs to firm-owner user in the same round-trip.
14. `14e27df` — Command-room sidebar avatar: AppShell renders `<img>` from `user.avatarUrl` when present, initials fallback. **Lazy backfill** in fast-path: if `avatar_url IS NULL`, fetch Clerk `currentUser()` and one-shot UPDATE the column. Future reads find it set.
15. `d9eaec9` — **Migration 0012**: `actions` append-only trigger now permits FK-cascade SET NULL on `client_id` (was blocking ALL UPDATEs, including legitimate cascade-driven NULL'ing). The two append-only protections (trigger + FK) had been fighting each other; fixed.

### Day 5 — Detail page wiring + field gates (bb95149, f90da3f)

16. `bb95149` — `/clients/[id]` reads + decrypts `intake_responses` (PII masked), `documents`, `signatures`. Three new components: `IntakeSummary` (per-step data), `DocumentsSection`, `SignaturesSection`. Antonio finally sees what real clients filled in.
17. `f90da3f` — **Continue button gating** on intake pages. `canAdvanceFromStep(route, state)` in `intake-flow.ts` reads each step's existing `isComplete()` function. `STEPS_WITHOUT_GATE` = `['docs']` (always passable per founder). New `<IntakeContinueButton>` wrapper used in 19 intake pages. `/services` `isComplete` updated to require `otherSub` when `kind === 'other'` (was a page-local gate; folded into schema-level truth). Skipped: `/quick-start` (multi-stage internal), `/deposit` (submit not Continue), no-requirement pages (welcome/tutorial/services-addons/life-events/appt — their `isComplete` is `() => true`).

### Day 5 (cont.) — Real client onboarding flow (0045ff1, 9e7ac80, bccdfdd, 113a728)

18. `0045ff1` — `createClient(fullName, phone, email?, state?)` server action in command-room (role-gated `firm_owner | preparer | reviewer | admin`). **Name-sync side-effect** in `saveIntakeField`: when path is `personal.fullName`, also UPDATE `clients.full_name` so the preparer's placeholder name is overwritten by the taxpayer's legal name once intake fills it. **Seed minimized**: removed all 10 mock clients + their cascade data; seed.ts now creates only tenant + DEK + Antonio user (idempotent via `onConflictDoNothing`).
19. `9e7ac80` — `/clients/new` page with form + success card (sign-in link + templated SMS message + copy buttons + Share button on mobile). "+ New client" button on `/clients` page header. Empty state on `/clients` ("No clients yet — invite your first"). Phone prefill on `/login`: reads `?phone=` and `?country=` query params at mount, applies to country picker + phone field, strips params from URL via `history.replaceState` (privacy: shoulder-surfing / browser history).
20. `bccdfdd` — **Delete client flow** (CCPA right-to-delete). `deleteClient(clientId, confirmName)` server action — role-gated `firm_owner | admin` only, requires confirm-name match. `<DeleteClientButton>` + GitHub-style confirmation modal (must TYPE the client's full name to enable the destructive button). "Danger zone" footer on `/clients/[id]`. Cascades: intake_responses / documents / messages / engagements / signatures / issues (CASCADE); actions (SET NULL — audit history preserved). Also: `NEXT_PUBLIC_CLIENT_PORTAL_URL` fallback corrected to `docket-portal.vercel.app`.
21. `113a728` — Renamed "Share…" → "Send via SMS" (greyed out with "Coming soon" hint). Documents the eventual flow: per-tenant Twilio creds in a credential vault, server action calls Twilio with the firm's number.

---

## 4. State of the database

### Migrations applied (in order)

| # | File | Purpose |
|---|---|---|
| 0000 | `0000_fancy_vampiro.sql` | Initial schema |
| 0001 | `0001_rls_policies.sql` | RLS ENABLE + FORCE on all tenant-scoped tables, `current_tenant_id()` function |
| 0002–0006 | (drizzle-generated) | Various column additions / no-ops |
| 0007 | `0007_actions_append_only.sql` | Trigger rejects UPDATE/DELETE/TRUNCATE on `actions` |
| 0008 | `0008_actions_clientid_set_null.sql` | `actions.client_id` FK → ON DELETE SET NULL (CCPA + audit preservation) |
| 0009 | `0009_tenants_clerk_org_id.sql` | `tenants.clerk_org_id text UNIQUE`; `clients_phone_global_idx` |
| 0010 | `0010_user_role_enum.sql` | `users.role` from text → `user_role` enum; remaps `'owner'` → `'firm_owner'` |
| 0011 | `0011_users_avatar_url.sql` | `users.avatar_url text` |
| 0012 | `0012_actions_allow_fk_cascade_null.sql` | Trigger function update: allow FK-cascade SET NULL on `client_id` |

### To run migrations against the dev DB

```bash
pnpm --filter @docket/db migrate
```

This works because of `aa30600` — `drizzle.config.ts` auto-loads `.env.local` from repo root.

### Current data state (as of session end)

- `tenants`: 1 row — Vazant Consulting. `clerk_org_id` is **NULL** (Antonio hasn't created the Clerk Org yet; legacy email-claim path is active).
- `users`: 1 row — Antonio Vazquez (display name: "Minseo Kim" after the user's manual UPDATE), `role: firm_owner`, `clerk_user_id` bound to the founder's Clerk identity, `avatar_url` populated from Google profile via lazy backfill.
- `clients`: founder has likely run `DELETE FROM clients;` to start fresh. Empty or near-empty. After they invite themselves via `/clients/new` it'll have one row.
- `actions`: keeps history forever (append-only), `client_id` set to NULL for any client that's been deleted.
- All other tables (intake_responses, documents, messages, engagements, signatures, issues): empty or near-empty.

---

## 5. State of the apps

### `apps/client-portal`

- Mostly done for v0.
- 28 intake pages migrated to Postgres-backed state via `useIntakeField`.
- Phone-OTP auth via Clerk legacy hooks (`useSignIn` / `useSignUp`).
- **Required-field gates** on Continue buttons (skip docs + no-requirement pages).
- Firm-owner name + avatar dynamic via `TenantDisplayProvider` from `@docket/ui`.
- Sensitive fields (SSN/EIN/bank) encrypted at rest with per-tenant DEK; masked on read; revealed only via the rate-limited audit-logged reveal flow.
- 8879 mock route gated behind `NEXT_PUBLIC_ENABLE_MOCK_8879=true`.
- `/no-access` page for unbound phones.
- **Still hardcoded "Vazant Consulting" copy** in `apps/client-portal/src/app/(intake)/welcome/content.tsx` — TODO comment in place; needs `useTenantName()` consumption when tenant #2 onboards.
- **Pre-auth landing/login/otp pages** still show Vazant logo / branding. Same TODO. Not blocking until tenant #2.

### `apps/command-room`

- Bare bones but functional for the v0 demo.
- Routes: `/sign-in`, `/dashboard` (redirect to `/clients`), `/clients`, `/clients/[id]`, `/clients/new`.
- Sidebar nav links to `/messages`, `/documents`, `/settings` — those routes **don't exist yet**. They render 404. Architecture audit flagged. When they're built, add `hasRole()` gating on the sidebar items (e.g., billing → `firm_owner | admin`, settings → `firm_owner` only).
- AppShell renders user avatar from `users.avatar_url` (Clerk `imageUrl`), falls back to initials.
- `/clients` shows the actual roster + "+ New client" CTA + empty state.
- `/clients/[id]` shows: header + intake summary + documents + signatures + engagement + messages + open issues + danger-zone delete (role-gated).
- `/clients/new` is a 2-stage flow: form → success card with copy-link + copy-message + greyed-out "Send via SMS" button.

### What's missing on the command-room side

- **Preparer-side reveal flow** for SSN/EIN. Antonio sees masked values only. The reveal endpoint should mirror `client-portal/src/lib/intake/reveal.ts` but on the preparer side, gated by `assertRole(['firm_owner', 'preparer', 'reviewer'])` (admin + assistant explicitly excluded per the policy matrix), audit-logged with `actionClass: 'read'`. **Not built**. High-leverage v0 feature.
- `/messages`, `/documents`, `/settings` route implementations.
- Kebab-menu delete on `/clients` list rows (currently delete only available from detail page). Easy follow-up.
- Triage queue / inbox / morning brief (CLAUDE.md §9 v0 agents). All deferred to post-5/15.

---

## 6. The May 2026 audit findings

Both Codex and Claude ran two audits this session (architecture + security/SOC 2). The reports lived in conversation only — not on disk. **Key takeaways for the next session:**

### What was RED and is now GREEN (shipped this session)

- ✅ Auth `console.error` raw error objects (PII leak via browser DevTools / kiosk sessions)
- ✅ Missing security headers (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, permissive CSP)
- ✅ `Cache-Control: no-store` on PII-bearing routes
- ✅ 8879 mock route exposed in production with fabricated tax data + claim of cryptographic timestamp
- ✅ `actions.client_id` FK was CASCADE (audit-history-destroying) — now SET NULL
- ✅ Append-only trigger blocked legitimate FK cascades — fixed in 0012
- ✅ `completeIntake()` skipped audit log
- ✅ Engagement letter + §7216 consent stored only booleans (no IP/UA/timestamp/text-hash)
- ✅ Auto-provisioning of any phone-OTP completion into Vazant tenant — closed via phone-binding flow
- ✅ Email-claim path used `emailAddresses[0]` instead of verified primary

### Still RED / AMBER (not shipped)

- ❌ **Trial fonts in production** (Suisse Int'l + FAIRE Octave). Trial license forbids commercial use. `.gitignore:52` documents the 5/14 deadline. Founder said "deferring until pitch day, will license then." If pitch day is BEFORE 5/14, license. If AFTER, the license risk is live for that window.
- ❌ **Stripe placeholder on `/deposit`** (the actual UI page). The `STRIPE_*` env vars were dropped per CLAUDE.md but the page still says "Stripe placeholder form" in copy + comments. Square integration is Day 8–9 of CLAUDE.md §15. Until then, no real money flows but the page is technically lying.
- ❌ **Rate limiter is in-process** (per-Vercel-lambda). `packages/shared/src/rate-limit.ts:8-13` acknowledges the swap to Upstash Redis. `.env.example` already has `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`. Day 9 work per the rebuild plan. Real concern at any meaningful traffic.
- ❌ **Preparer-side SSN reveal** not built (mentioned above).
- ❌ **AAD on AES-GCM** not bound to `(tenant_id, client_id, path)`. Defense-in-depth recommendation. Cost: ~10 lines + one-time re-encryption migration. Do before pre-existing data has scale.
- ❌ **KEK rotation procedure** not documented. Audit flagged as needed for SOC 2.
- ❌ **Master-KEK fallback path** in `encryption.ts:194-215` is still live. Run `pnpm --filter @docket/db reencrypt-legacy --dry-run` before any real client onboards, then for real, then delete the fallback.
- ❌ **Webhook signature verification helper** not built. Inngest / Square / DocuSign / Twilio webhooks all need HMAC verification before any DB write. Build the helper now so each integration uses the same shape.
- ❌ **Policy docs missing**: no `docs/SECURITY.md`, `docs/PRIVACY.md`, `docs/INCIDENT-RESPONSE.md`, `docs/CHANGE-MGMT.md`, `docs/VENDOR-RISK.md`, `docs/AUP.md`, `docs/BACKUP-DRILL-LOG.md`. SOC 2 Type II evidence concerns. CCPA Privacy Policy needed publicly even pre-threshold.
- ❌ **CCPA right-to-know** mechanism not built (only right-to-delete via the new flow).
- ❌ **§7216 consent retention**: text-hash + IP + UA captured ✓, BUT no immutable downloadable PDF artifact for the taxpayer. Audit flagged as AMBER.
- ❌ **Form 8879 KBA** (DocuSign + LexisNexis) — the actual Day 13 work. Mock is hard-disabled until then.
- ❌ **Sentry not signed up** for. Founder hasn't created an account. `Sentry.captureException` calls are no-ops without DSN. Free tier is plenty for v0; recommend setting up before any real PII flows.

### Codex false positive worth knowing about

Codex's security audit flagged "secrets sitting in `.env.local` files in the workspace" as RED. **This is wrong.** Claude verified via `git ls-files` and `git log --all --diff-filter=AD -- '.env*'` that no `.env.local` was ever committed historically. The keys are on the founder's laptop, gitignored, never in any commit. The legitimate concern is informal secret-management practices (no Infisical wired up), but the framing "secrets in repo tree" is a false positive.

---

## 7. Founder preferences + decisions made this session

- **Trial fonts**: deferred until pitch day. Will license when there's a check date. ~10 min PR to swap `public/fonts/trial/` → `public/fonts/licensed/` once the order's in.
- **Sentry**: not signed up for yet. Will set up before real client onboarding (founder's call when).
- **Mock clients**: gone permanently. Seed creates only tenant + DEK + firm-owner user.
- **Antonio is a persona**, the real founder is **David Kim (Minseo Kim)**. The seeded user's `name` was updated manually from "Antonio Vazquez" to "Minseo Kim" via SQL. `SEED_ADMIN_EMAIL=minseodavid@gmail.com` is set on Vercel.
- **Vazant tenant** is the only tenant. `tenants.clerk_org_id` is NULL — Antonio (i.e. Minseo, in his founder role) hasn't created the Clerk Organization yet.
- **Test phone**: `+15622736682` (Minseo's actual phone). Used for end-to-end testing of the client-side intake flow.
- **`/docs` intake page is always passable** (no required-field gate), per founder's explicit ask. `STEPS_WITHOUT_GATE = ['docs']` in `intake-flow.ts`.
- **8879 mock**: hard-disabled in prod via `NEXT_PUBLIC_ENABLE_MOCK_8879`. Set to `'true'` for demo recording, leave unset for prod.
- **Send via SMS** label, not "Share…" — eventual flow uses per-tenant Twilio creds, not a global Docket number.

---

## 8. Vercel env var setup (founder needs to verify)

### Both apps

```
DATABASE_URL=<Neon connection string>
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<Clerk pk>
CLERK_SECRET_KEY=<Clerk sk>
ANTHROPIC_API_KEY=<for orchestrator>
PII_ENCRYPTION_KEY=<32-byte hex>
SEED_ADMIN_EMAIL=minseodavid@gmail.com
```

### `apps/command-room` only

```
NEXT_PUBLIC_CLIENT_PORTAL_URL=https://docket-portal.vercel.app
```

This drives the share link generated in `/clients/new`. **Founder reported this was set to the wrong URL (`docket-client-portal.vercel.app`) at some point — they may need to update it.** The fallback I shipped points at the right URL but env var still wins.

### Optional / not yet wired

- `NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_AUTH_TOKEN` (Sentry — founder hasn't signed up yet)
- `NEXT_PUBLIC_ENABLE_MOCK_8879=true` (only for demo recording)
- All `TWILIO_*`, `SQUARE_*`, `DOCUSIGN_*`, `UPSTASH_REDIS_REST_*`, `R2_*`, `INNGEST_*`, `GOOGLE_*` — none wired yet. Documented in `.env.example`.

---

## 9. How to run things locally

### Migrations

```
pnpm --filter @docket/db migrate
```

### Seed (idempotent)

```
pnpm --filter @docket/db seed
# or to reset first:
pnpm --filter @docket/db seed:reset
```

### Tests

```
cd packages/shared && bun test src
```

(112 tests pass as of session end. The `pnpm` test script uses a glob that doesn't expand on Windows; `bun test src` works directly from the package dir.)

### Typechecks

```
pnpm --filter @docket/<package> exec tsc --noEmit
```

Workspaces: `@docket/db`, `@docket/shared`, `@docket/ui`, `@docket/client-portal`, `@docket/command-room`, `@docket/orchestrator`, `@docket/workers`.

### Dev servers

```
# client-portal
cd apps/client-portal && pnpm dev   # port 3000

# command-room
cd apps/command-room && pnpm dev    # port 3000 (configure to 3001 if running both)
```

---

## 10. Open work — picking what's next

In rough priority order. Don't do all of these next session — pick one or two that matter most for the 5/15 ship.

### High-leverage / explicitly requested

1. **Preparer-side SSN reveal flow.** Mirror `client-portal/lib/intake/reveal.ts` on the command-room side. Server action that decrypts a single field, audit-logs the read, returns plaintext. Gate: `assertRole(['firm_owner', 'preparer', 'reviewer'])`. UI: a tiny "Reveal" button next to each masked value in `IntakeSummary` / `clients/[id]`. **Antonio can't actually do prep work without this.** Probably the next thing to build.
2. **Twilio integration for "Send via SMS"** button. Currently greyed-out placeholder. Per-tenant Twilio creds (need a credential vault — see the audit's flag on Infisical not being wired). Server action POSTs to Twilio's REST API, audit-logs the send. Wires up the rest of the invite flow so preparer doesn't manually copy/paste.
3. **Update CLAUDE.md** to match reality. The architecture audits flagged its aspirational/actual gap. The next session reading it cold gets misled. ~30 min of edits.
4. **Trial fonts** — license OR revert. Founder will make the call when pitch happens. Easy mechanical PR either way.

### Medium-leverage

5. **Kebab-menu delete on `/clients` list page** — small follow-up so founder doesn't have to drill into each client first.
6. **`/messages`, `/documents`, `/settings` routes** in command-room. Currently 404. Sidebar links to them. Even basic placeholder pages would stop the dead links.
7. **Welcome page tenant string** — the TODO in `(intake)/welcome/content.tsx` to consume `useTenantName()` instead of hardcoding "Vazant Consulting." Not load-bearing until tenant #2.
8. **Solar icon split** — 7,848-line single file blocks tree-shaking. Architecture audit flagged AMBER. ~30 min one-shot transform via the existing generator script.

### Day 13-equivalent work (security-hard)

9. **DocuSign + KBA wiring for Form 8879** (LexisNexis under the hood). The hard one. ~3-5 days. Until this lands, no real returns can be filed through Docket.
10. **AAD on AES-GCM** + master-KEK fallback removal — defense-in-depth + clean cryptographic posture before pre-existing data has scale.
11. **Rate limit → Upstash Redis** — required before any real abuse risk.
12. **Webhook signature verification helper** — needed before Square / DocuSign / Twilio / Inngest webhooks land.

### Policy docs (SOC 2 prep)

13. `docs/SECURITY.md`, `docs/PRIVACY.md`, `docs/INCIDENT-RESPONSE.md`, `docs/VENDOR-RISK.md`. ~4 hours.

---

## 11. Things to know before touching the code

### Workspaces

- `@docket/db` — Drizzle schema, migrations, encryption, DEK cache, seed
- `@docket/shared` — `IntakeState`, validation schemas, branded types, role types, masking helpers, scrubber, formatters
- `@docket/ui` — design primitives, tokens, AskAntonio components, AvatarSlot, **TenantDisplayProvider** (cross-package context for firm-owner display)
- `@docket/client-portal` — Next.js taxpayer-facing app
- `@docket/command-room` — Next.js preparer-facing app
- `@docket/orchestrator` — thin Anthropic SDK wrapper (107 lines; not yet a real orchestrator)
- `@docket/workers` — Inngest jobs (Gmail-poll stub; agent factories partially built but plumbing is TODO(week-1))

### Cross-package context pattern

The firm-owner display data flows through `TenantDisplayProvider` (in `@docket/ui`):

1. Layout (`(intake)/layout.tsx`, `portal/layout.tsx`) fetches via `resolveClient()` server-side
2. Wraps children in `<TenantDisplayProvider tenantName={...} firmOwner={...}>`
3. Components in `@docket/ui` consume via `useFirmOwner()` / `useTenantName()` / `initialsOf()`

This avoids prop-drilling firm-owner data through 27+ pages.

### RLS pattern

- All tenant-scoped tables have `ENABLE + FORCE` RLS. Policy: `tenant_id = current_tenant_id()`.
- App reads/writes wrap in `withTenant(tenantId, async (db) => { ... })` which `SET LOCAL app.current_tenant_id` for the transaction.
- `getAdminDb()` BYPASSES RLS — used ONLY in:
  - `apps/client-portal/src/lib/intake/auth.ts` (phone → tenant lookup, chicken-and-egg)
  - `apps/command-room/src/lib/current-user.ts` (Clerk session → user/tenant lookup)
- Both auth paths are intentional. **Don't add a third `getAdminDb()` caller** without a SECURITY.md justification.

### Audit log invariant

- `actions` is append-only. INSERT only. UPDATE/DELETE/TRUNCATE blocked by trigger.
- **One exception** (migration 0012): UPDATE that nulls `client_id` from non-null AND keeps every identity column unchanged is permitted. This is the FK-cascade SET NULL path for CCPA right-to-delete.
- Every state-changing server action (`saveIntakeField`, `revealIntakeField`, `completeIntake`, `recordIntakeSignature`, `createClient`, `deleteClient`) writes an `actions` row in the same transaction. Failed audit = rolled-back data write.
- The audit row records the path / tool name / timestamp / tenant — never the value.

### Encryption boundary

- Master KEK in `PII_ENCRYPTION_KEY` env var (32-byte hex, AES-256-GCM)
- Per-tenant DEK encrypted with master KEK, stored in `tenants.dek_encrypted`
- Sensitive paths (SSN, EIN, bank routing/account, dependent SSN) encrypted with the tenant's DEK before JSONB write
- Server reads decrypt + mask before returning to client by default
- Reveal flow returns plaintext one path at a time, rate-limited (30/min/user), audit-logged
- `SENSITIVE_INTAKE_PATHS` in `packages/shared/src/intake.ts` is the canonical list

### Clerk auth surfaces

- **Two Clerk apps** (one per Vercel project) OR one Clerk app with separate frontend hosts — verify in dashboard
- Client portal: phone-OTP only (Twilio for SMS — Clerk handles)
- Command room: any Clerk strategy (Google OAuth in practice)
- `auth().userId` = Clerk user id, `auth().orgId` = Clerk Org id (set when a user is in an org and has selected it)
- `users.clerk_user_id` is unique; one Clerk user can be in `users` (firm staff) AND `clients` (taxpayer) tables — different rows, same Clerk identity is fine

---

## 12. Tactical: how the next session should start

```bash
# 1. Boot context (all skim-friendly):
cat CLAUDE.md
cat docs/SESSION-HANDOFF-2026-05-02.md  # this doc
git log --oneline -25                    # recent commits

# 2. Check the dev DB state:
# Open Neon SQL editor and run:
SELECT name, role FROM users;
SELECT slug, name, clerk_org_id FROM tenants;
SELECT count(*) FROM clients;

# 3. Verify migrations are caught up:
pnpm --filter @docket/db migrate
# Should see: NOTICE about drizzle schema/table existing, then ✓
# applied successfully, no per-migration spam.

# 4. Skim what's deployed:
# Open https://docket-portal.vercel.app/login → should show login UI
# Open https://<command-room>/clients → should show empty state
#   (assuming clients table has 0 rows)
```

Then ask the founder: "Picking up from the 2026-05-02 session. State summary [from handoff doc]. What do you want to do next?"

---

## 13. Token budget warning

The 2026-05-02 session ran long. The next session should be more focused — pick one or two items from §10 (Open work). Don't try to load every audit finding back into context; this doc is the compressed summary.

Codex was used for parallel reviews this session. Spawn `codex-rescue` or `general-purpose` agents for any deep audit / multi-file investigation that doesn't need to round-trip through the conversation.

---

*End of handoff. Last commit at session end: `113a728`. Next session inherits clean working tree (after the founder runs the nuclear DELETE on clients) + 21 commits ahead of pre-session main. All four engines (Codex + Claude + the user + Vercel) verified working as of session close.*
