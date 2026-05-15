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

| Path | Rule disabled | Rationale |
|---|---|---|
| `apps/client-portal/src/app/(intake)/**`, `apps/client-portal/src/app/portal/**`, `packages/ui/src/components/**` | `react-doctor/no-inline-exhaustive-style` | Intake + portal + UI components are inline-style-locked per CLAUDE.md §11 (zero-design-drift rule on taxpayer-facing surfaces). The 100+ inline-style findings on these paths are deliberate; the designer authored every prop. Don't refactor to CSS-in-JS without a `/craft`-reviewed redesign pass. |
| `packages/ui/src/icons/**` | `react-doctor/no-giant-component` | `solar.tsx` is a 7,848-line icon-pack file (known AMBER liability per CLAUDE.md §11; flagged for one-shot transform when convenient). Suppressing on the icons path while we plan the split. DO NOT suppress on regular component files — giant components elsewhere are real findings. |
| `apps/client-portal/src/app/**`, `apps/command-room/src/app/**` | `react-doctor/design-no-em-dash-in-jsx-text` | Em-dashes are part of Antonio's voice per CLAUDE.md §19 (anti-AI-slop discipline forbids generic AI vocabulary like *crucial* / *delve* but ENDORSES em-dashes in copy — the prep-call cadence reads better with them). Our copy is hand-tuned. Suppressing across the app copy surface. |

## Real findings worth fixing (NOT suppressed)

Snapshot from CI run [#25898023171](https://github.com/minesokim/child-docket/actions/runs/25898023171) at sha `ed502b6` (2026-05-14):

| Rule | Count | Where | Next action |
|---|---|---|---|
| `jsx-a11y/click-events-have-key-events` | 14 | mostly `signature.tsx` (8879 signature pad) | react-doctor cleanup batch 2 |
| `jsx-a11y/no-static-element-interactions` | 14 | same source as above | same |
| `react-doctor/no-array-index-as-key` | 8 | several | react-doctor cleanup batch 2 |
| `react-doctor/no-derived-useState` | 2 | NOT the `EncryptedTextField` (already fixed in commit `3423b4e`) — different components | react-doctor cleanup batch 2 |
| `react-doctor/no-cascading-set-state` | 2 | `antonio.tsx` (3 setState calls in one useEffect) | react-doctor cleanup batch 2 |
| `react-doctor/nextjs-missing-metadata` | 33 | many pages lack `export const metadata` | follow-up; SEO + share-card hygiene |
| `react-doctor/server-sequential-independent-await` | 5 | server actions doing sequential awaits that could parallelize | follow-up; performance |
| `react-doctor/nextjs-no-img-element` | 4 | should use `next/image` for optimization | follow-up; performance |

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
