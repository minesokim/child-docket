# Brand-Rename Inventory

> Captured 2026-05-15 after the audit-driven rename pass. The brand
> currently rendering in main is **Petal** with email domain
> **petal.tax**. The name is NOT locked — David + Antonio are still
> considering Linden as an alternative, and a revert-to-Docket is on
> the table. This doc is the runbook for flipping the brand cleanly
> when the decision lands.

---

## Status (2026-05-15)

| Aspect | State |
|---|---|
| User-facing brand in main | Petal |
| Email domain in code | petal.tax |
| petal.tax DNS provisioning | NOT provisioned (mailboxes don't resolve) |
| petal.com | Registered earlier, abandoned for petal.tax in `cdb9f7a` |
| Antonio's review on the name | Pending |
| Linden vs Petal vs Docket | TBD |
| `@docket/*` workspace packages | Untouched, still Docket-named |
| Vercel deploy targets | `docket-portal.vercel.app`, `docket-command-room.vercel.app` (unchanged) |

The Petal rename is purely cosmetic copy/wordmark/title work. Zero
functional code was changed. Reverting is `git revert` of the three
commits below.

---

## The three commits that built the Petal state

In chronological order:

| SHA | Subject | Scope |
|---|---|---|
| `cdb9f7a` | `chore(branding): petal.com → petal.tax` | Domain swap (84 refs across 6 files, docs + code) after David registered `petal.tax` |
| `6409fce` | `chore(branding): Docket → Petal on user + stakeholder-facing surfaces` | 10 user-facing files renamed (the first pass) |
| `ab849e7` | `chore(branding): Docket→Petal second pass — 13 missed user-facing surfaces` | The audit-caught files (this session's Task 1) |

**To revert all three:**
```bash
git revert ab849e7 6409fce cdb9f7a --no-edit
```
The three commits touch overlapping files, so expect 2-3 hand-resolved
conflicts. Worst case: cherry-pick the reverts as discrete commits
and resolve each one.

---

## What's INTENTIONALLY still Docket — do NOT touch on the next rename pass

These stayed Docket on purpose. The original scoping rule was
*"only user-facing stuff that matters."* Each of these would require
a full-monorepo refactor for zero user-visible benefit.

### Workspace package names (12)
- `@docket/client-portal`, `@docket/command-room`, `@docket/db`,
  `@docket/discovery-pdf`, `@docket/document-processing`,
  `@docket/docusign-shared`, `@docket/email`, `@docket/mcp-gateway`,
  `@docket/orchestrator`, `@docket/prompts`, `@docket/shared`,
  `@docket/skills`, `@docket/storage`, `@docket/tax-graph`,
  `@docket/test-fixtures`, `@docket/ui`, `@docket/workers`
- These flow through every `import` statement and every `package.json`
  `dependencies` block. Renaming forces a coordinated bump everywhere.

### TypeScript types + functions
- `DocketUser` (type)
- `DocketDb` (type alias for the Drizzle client)
- `getCurrentDocketUser` (function — 25+ call sites)
- `DOCKET_TOKENS` (design tokens object in `packages/ui/src/tokens.ts`)

### Infra naming
- Vercel project names: `docket-portal`, `docket-command-room`
- Vercel URLs: `docket-portal.vercel.app`, `docket-command-room.vercel.app`
- Legacy demo URL: `docket-client-portal.vercel.app`
- Git repo: `github.com/minesokim/child-docket`
- Local repo path: `C:\Users\minse\projects\docket\`
- Database name (`.env.example`): `postgres://docket:docket@localhost:5432/docket`
- R2 bucket name (`.env.example`): `R2_BUCKET=docket-documents`

### Comments
General explanatory comments referencing "Docket" in code context
(not operator-facing setup docs, not user-visible UI strings) were
left alone. Updating them is taste-level, not impact-level.

---

## File-by-file Petal surface (code) — 18 files

### apps/client-portal (6)

| File | Surface | Approx hits |
|---|---|---|
| `apps/client-portal/src/app/layout.tsx` | Browser tab title `Petal · Client Portal` | 1 |
| `apps/client-portal/src/app/scan/page.tsx` | Metadata `<title>` + 2× OG card title + 2 comment lines about brand-domain URL | 5 |
| `apps/client-portal/src/app/scan/scan-landing-client.tsx` | Footer wordmark `PETAL` + 10× mailto `david@petal.tax` + footer comment block + error message body | ~12 |
| `apps/client-portal/src/app/api/scan-intake-stub/route.ts` | User-visible 500-error body + 1 internal comment | 2 |
| `apps/client-portal/src/app/trust/page.tsx` | `<title>` + OG card + body prose + 2× mailto `security@petal.tax` + footer | 7 |
| `apps/client-portal/src/app/(intake)/deposit/deposit-page-inner.tsx` | `never stored on Petal` payment footnote | 1 |

### apps/command-room (8)

| File | Surface | Approx hits |
|---|---|---|
| `apps/command-room/src/app/layout.tsx` | Browser tab title `Petal · Command Room` | 1 |
| `apps/command-room/src/app/sign-in/[[...sign-in]]/page.tsx` | Login screen wordmark `PETAL · COMMAND ROOM` | 1 |
| `apps/command-room/src/components/app-shell.tsx` | Sidebar wordmark `Petal` + avatar letter `P` | 2 |
| `apps/command-room/src/app/calendar/page.tsx` | Empty-state copy "mirror events into Petal" | 1 |
| `apps/command-room/src/app/settings/page.tsx` | `Petal Personality` settings label | 1 |
| `apps/command-room/src/app/settings/notifications/page.tsx` | `How Petal nudges preparers` subhead | 1 |
| `apps/command-room/src/app/settings/credentials/page.tsx` | `integrations Petal drives` subhead | 1 |
| `apps/command-room/src/app/settings/ai-preferences/form.tsx` | `Petal Personality` form label | 1 |

### packages (4)

| File | Surface | Approx hits |
|---|---|---|
| `packages/discovery-pdf/src/DiscoveryScanDocument.tsx` | PDF cover wordmark `PETAL` + footer `Petal Inc.` + methodology copy `Petal's Position Framework agent...` + `<Document author="Petal" />` | ~4 |
| `packages/email/src/index.ts` | Email template HTML wordmark `>PETAL<` + footer `Petal Inc.` + operator config-error string + setup comments | ~4 |
| `packages/discovery-pdf/scripts/smoke-from-scan.ts` | `Petal Position Library v0` in reasoning text passed to PDF | 1 |
| `packages/tax-graph/src/positions.ts` | Comment only — `Petal Position Library v0` | 1 |

**Total code hits: ~50 across 18 files.** Rename is mechanical
search-and-replace with care for capitalization (`Petal` prose vs
`PETAL` wordmark) + the avatar letter `P` in `app-shell.tsx`.

---

## Domain references (`petal.tax`)

Beyond the code mailto hrefs above, `petal.tax` appears in ~84 doc
locations from `cdb9f7a`:

- `docs/pitch-decks/boney-henderson-presentation-deck.md`
- `docs/pitch-decks/cold-outreach-templates.md`
- `docs/pitch-decks/path2-partner-deck.md`
- `docs/pitch-decks/cold-outreach.md`
- `docs/DISCOVERY-SCAN-OPERATIONAL.md`
- `docs/MARKETING-FRAMES.md`
- `docs/COVERAGE-MAP.md`
- `docs/DESIGN-PARTNER-ACQUISITION-PLAN.md`
- `docs/CYBER-INSURANCE-RECOMMENDATION.md`
- `docs/OVERNIGHT-HANDOFF-*.md` (multiple)
- Plus historical handoff/decision logs (append-only audit trail —
  don't rewrite these; let the date carry the context)

If the brand changes, code mailto + doc references should flip
together. Mismatched email domains across pitch decks vs landing
pages = sloppy.

---

## How to flip the brand (mechanical runbook)

### 1. Search-and-replace patterns

Three word forms in code:

| Pattern | Replace with | Where |
|---|---|---|
| `Petal` | `<NewBrand>` | Prose, settings labels, layout titles |
| `PETAL` | `<NEWBRAND>` | Wordmarks (PDF cover, login screen, email template, sidebar all-caps slots) |
| `petal.tax` | `<newbrand>.<tld>` | Mailto hrefs, scan URL refs |

Plus:
- Avatar letter `P` at `app-shell.tsx:79` → first letter of new brand
- `setActive` removal trailer in `login/page.tsx:127` doesn't need touching
- Cover styles preserve the same forest-green oklch + letterSpacing — no design change required

### 2. Edge cases that don't match a simple substitute

| Location | Why it needs care |
|---|---|
| `scan/page.tsx:31-43` | Comments about brand-domain cutover URL — currently say `petal.tax/scan`; update OR delete to "TBD" |
| `scan-landing-client.tsx:1099-1111` | Footer comment block "petal.tax brand link dropped until cutover lands" — same |
| `scan-intake-stub/route.ts:277-285` | Internal comment about `david@petal.tax` as documented recovery channel |
| `DiscoveryScanDocument.tsx:518-543` | Methodology footer copy `Petal's Position Framework agent...` + `Petal's authority library` + final `Petal Inc.` line — three prose-context renames |
| `email/index.ts:62-79` | Setup comments + the runtime config-error string `Set RESEND_FROM_ADDRESS in env (e.g. "Petal <discovery@yourdomain.com>")` — the string is operator-visible |

### 3. Asset surfaces

- No raster brand logo committed (forest-green text wordmarks only)
- No SVG brand mark
- No favicon brand reference
- → Brand change is text-only

### 4. Test after flipping

```bash
pnpm turbo typecheck --filter='./apps/*' \
  --filter='./packages/discovery-pdf' \
  --filter='./packages/email' --filter='./packages/ui'
pnpm --filter @docket/discovery-pdf smoke-from-scan
git grep -n '<OldBrand>\|<oldbrand>\.<tld>' apps/ packages/
# Should return only intentional out-of-scope hits (internal types,
# package names, Vercel project names, .env.example DB name, etc.)
```

### 5. Effort estimate

- Code rename (18 files): ~30 min including typecheck + codex review
- Doc rename (~84 refs across ~20 files): another ~30 min via targeted grep + manual review of context-loaded references
- Asset rename: 5 min (avatar letter only)
- Verification: 10 min
- **Total wall-clock: ~75 min** for a clean rename pass

---

## Decision-pending list (NOT to touch until name is locked)

1. **Brand name itself** — Petal / Linden / Docket / TBD. Antonio's
   take is the gating input per David.
2. **Domain** — `petal.tax` is registered; if name changes it becomes
   a redirect/legacy domain. Don't provision DNS or set up Resend
   until decided.
3. **Mailboxes** — `david@`, `hello@`, `noreply@` at the final
   domain. Provision after brand locks.
4. **Workspace package rename** — `@docket/*` flows through every
   import. Almost certainly defer to v2 regardless of brand decision.
   The internal name is unrelated to the marketing brand.
5. **Vercel project rename** — `docket-portal` is a deployment
   identifier, not a brand surface. Probably leave; cosmetic only.
6. **Repo rename** — `child-docket` → ??? — defer; doesn't affect
   users.
7. **CYBER-INSURANCE-RECOMMENDATION.md** — references "Docket"
   throughout in the underwriting-story section; flip when brand
   locks (the carriers don't care which name is on the policy
   binder as long as it matches the legal entity).

---

## Operator actions queued when name is locked

1. Make the call (David + Antonio session, single decision)
2. Run rename pass on the 18 code files (this doc is the checklist)
3. Run rename pass on the ~20 doc files
4. Provision DNS + Resend domain verification + 3 mailboxes at the
   new domain (Task 14 in the audit punch list)
5. Set Vercel envs: `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`,
   `PUBLIC_SCAN_URL`
6. Verify Discovery Scan PDF smoke renders the new brand
7. Update `CLAUDE.md` L2 (Category positioning) if the brand name
   carries a different positioning frame (likely not — "tax practice
   operating system" framing is brand-agnostic)
8. Update any pitch-deck templates already in flight (Boney-Henderson
   slides, cold-outreach campaigns)
9. Mark this doc as resolved + capture the final rename SHA in
   AUTONOMOUS-DECISIONS.md

---

## Reverse path: if the decision is "back to Docket"

```bash
git revert ab849e7 6409fce cdb9f7a --no-edit
# Hand-resolve 2-3 expected conflicts (overlapping file touches)
pnpm turbo typecheck --filter='./apps/*' --filter='./packages/*'
git commit -m "chore(branding): revert Petal — name decision deferred per Antonio review"
# Push + verify
```

Loss: 23 commits of brand-rename work undone. Effort: ~20 min
hand-resolve + verify. Reversibility: clean.

---

*Last updated: 2026-05-15 (post-audit Task 1). Update when the brand
name is locked + the rename pass completes.*
