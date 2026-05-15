# React Doctor — configuration rationale

> *Sibling doc to `react-doctor.config.json` at the repo root. JSON
> doesn't support comments cleanly; this file is where the WHY
> lives. Updated whenever the config changes.*

## What's suppressed and why

### Globally disabled

| Rule | Rationale |
|---|---|
| `react-doctor/server-auth-actions` | **False positive against our wrapper convention.** `apps/client-portal/src/lib/intake/auth.ts` (`resolveClient` + `getOrCreateClient`) and `apps/command-room/src/lib/current-user.ts` (`getCurrentDocketUser` + `requireRole`) wrap Clerk `auth()` internally and enforce session checks at the wrapper boundary. Every server action that calls them is auth-gated by transitivity. The rule looks for the literal `auth()` call at the top of every server action and can't see through the wrapper layer. Re-evaluate this suppression if/when we refactor away from the wrapper pattern. |

### Path-scoped overrides

**IMPORTANT**: react-doctor evaluates path globs **workspace-relative**,
not repo-relative. Each workspace is scanned independently. Globs that
include `apps/client-portal/` as a prefix do NOT match — they need to
start with `src/`. Codex caught this on the [#38] adoption commit:
the original repo-relative globs silently no-op'd, which is why the
initial CI score only crept from 69 → 71 instead of dropping
noise-bucket findings. Now corrected.

| Path | Rule disabled | Rationale |
|---|---|---|
| `src/app/**`, `src/components/**` | `react-doctor/no-inline-exhaustive-style` | Intake + portal + UI components are inline-style-locked per CLAUDE.md §11 (zero-design-drift rule on taxpayer-facing surfaces). The 100+ inline-style findings on these paths are deliberate; the designer authored every prop. Don't refactor to CSS-in-JS without a `/craft`-reviewed redesign pass. |
| `src/icons/**` | `react-doctor/no-giant-component` | `solar.tsx` is a 7,848-line icon-pack file (known AMBER liability per CLAUDE.md §11; flagged for one-shot transform when convenient). Suppressing on the icons path while we plan the split. DO NOT suppress on regular component files — giant components elsewhere are real findings. |
| `src/app/**`, `src/components/**` | `react-doctor/design-no-em-dash-in-jsx-text` | Em-dashes are part of Antonio's voice per CLAUDE.md §19 (anti-AI-slop discipline forbids generic AI vocabulary like *crucial* / *delve* but ENDORSES em-dashes in copy — the prep-call cadence reads better with them). Our copy is hand-tuned. Suppressing across the app copy surface. |
| `src/app/(intake)/**`, `src/app/portal/**`, `src/components/**` | `react-doctor/no-tiny-text`, `react-doctor/no-wide-letter-spacing` | Mono labels at 10.5px + 0.9 letter-spacing are the editorial-typography signature of the intake + portal surfaces (per CLAUDE.md §11 design tokens). Caps + tracking on uppercase mono is intentional. Suppressing in the design-locked paths; the rules still fire elsewhere (auth pages, landing pages, command-room) where they'd catch real readability issues. |
| `src/app/(intake)/**`, `src/app/portal/**`, `src/app/(auth)/**` | `react-doctor/nextjs-missing-metadata` | Intake / portal / auth pages are CLIENT components (`'use client'`). Next.js `export const metadata` only applies to server components. The rule fires false-positives on every client page. The root layout (server component) carries the parent metadata. Suppressing where it's a false-positive. The rule still catches missing metadata on actual server pages elsewhere (e.g., command-room dashboard pages). |

## Real findings worth fixing (NOT suppressed)

Snapshot from CI run #25901312883 at sha `6b92feb` (2026-05-15),
post the batch-1/2/3 a11y + array-key + effect-split cleanup. Per-
workspace scores after the broadened config:

- `@docket/client-portal`: 72
- `@docket/command-room`: 71
- `@docket/ui`: 87

| Rule | Count | Where | Status |
|---|---|---|---|
| `jsx-a11y/click-events-have-key-events` | 14 | residual clickable-div sites NOT in signature.tsx / fields.tsx / cards.tsx / antonio.tsx (those got batches 1-3) | partial — investigate which files still emit |
| `jsx-a11y/no-static-element-interactions` | 14 | same source as above | same |
| `react-doctor/no-array-index-as-key` | 8 | several — antonio's word-reveal is suppressed inline, skeleton-docs same; remaining sites need composite or id keys | follow-up batch |
| `react-doctor/no-derived-useState` | 2 | not the EncryptedTextField (fixed in `3423b4e`); different components | follow-up |
| `react-doctor/no-cascading-set-state` | 2 | health-gate.tsx suppressed inline with rationale (polling-with-backoff); antonio.tsx split into two effects in batch 3. Residual ×2 in other files | investigate |
| `react-doctor/server-sequential-independent-await` | 5 | server actions doing sequential awaits that could parallelize | follow-up; performance |
| `react-doctor/nextjs-no-img-element` | 4 | should use `next/image` for optimization | follow-up; performance |
| `react-doctor/react-compiler-destructure-method` | 11 | React Compiler-readiness — calls like `obj.method()` where `obj` is destructured. Optimization for React 19 + RC. | follow-up |
| `react-doctor/async-defer-await` | 9 | async ops that could defer pre-render | follow-up; perf |

## Promotion path to PR-gating

The workflow currently runs with `fail-on: none` (advisory). To flip
to PR-gating per decisions-log `[#36]` §Promotion:

1. Land fixes for the real findings above.
2. Verify the post-fix CI score lands in the 90+ range.
3. Flip `.github/workflows/react-doctor.yml` to `fail-on: warning`.
4. Add a `protocol-gate` row in branch-protection requiring the
   react-doctor job to pass.

## When this config changes

- Update both this doc AND `react-doctor.config.json` in the same
  commit.
- Add a row to the relevant section above (or the "Real findings"
  table if the change is a NEW suppression).
- Don't suppress a rule without writing the rationale here. JSON
  comments aren't a thing; this doc is the audit trail.

---

*Last updated: 2026-05-14 (commit pending).*
