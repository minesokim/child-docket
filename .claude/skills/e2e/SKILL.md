# /e2e — app-level end-to-end smoke

> *Run periodically (every N feature commits, before any release). Exercises the WHOLE stack — migrations, server actions, Inngest agent fleet, audit chain, cost telemetry — composing as a single user journey. Catches "features pass individually, composition is broken."*

---

## Why this skill exists

User-codified 5/8/2026:

> "is it possible to do end to end testing every once in a while with the app as a whole? not just that segment or the feature. i think that will help solidify context"

Per-feature smoke (`/smoke-test` skill, `services/workers/scripts/smoke-finalize.ts`, `services/workers/scripts/smoke-bedrock.ts`, `packages/db/scripts/smoke-migrations-17-22.ts`) catches local regressions. They MISS:

- Cross-feature wiring gaps (e.g., the audit chain trigger fires when `createClient` actually runs through the server-action layer? Per-feature smoke proves the trigger; only e2e proves the wiring)
- Real-world dataflow (a gmail message landing in `gmail-poll` → `classify-gmail-message` → `triage-classifier` → `actions` audit insert all-the-way through)
- Multi-tenant interactions
- Cost telemetry actually flowing into `actions.tool_input` with the right `prompt.version` stamp
- /api/health serving the right status during real DB pressure

The user said the magic words: **"solidify context."** App-level e2e is the codified version of "did the system actually compose the way the per-feature smokes promised?"

---

## When this fires

Three triggers, any of them:

1. **Every N feature commits.** Default: every 3 feature commits land deploy-READY → run `/e2e` before /keep-going advances.
2. **Before any release.** Before tagging a v1, v1.1, v1.5 milestone — `/e2e` is a release-gate.
3. **After any commit touching cross-feature surfaces.** Migrations, server-action helpers (assertWritable, scrubPII, getPrompt), Inngest function changes — if the diff touches files that compose, run /e2e.

In autonomous mode, the loop counts feature commits via `git log --grep "^(feat|fix)" -<N>` since the last /e2e tag.

---

## The canonical user journey

The e2e script exercises this single flow end-to-end. It's the v1 wedge demo path, expressed as code:

```
1.  Antonio creates a tenant + himself + a client       (DB substrate)
2.  Antonio calls createClient via direct server-action import
       → assertWritable runs (Dim 6: server gates wired)
       → audit chain row inserted
3.  Client (synthetic) saves intake fields via saveIntakeField
       → encryption (per-tenant DEK on SSN field)
       → audit row + chain extension
4.  Client uploads a synthetic doc via confirmUpload
       → R2 mock or skip if R2 unwired in test mode
       → documents row inserted
       → triggers classify-document Inngest function (direct call)
       → doc-classifier agent runs against the placeholder image
       → cost telemetry stamps prompt.version
5.  Synth gmail message → classify-gmail-message function (direct call)
       → scrubPII fires
       → triage-classifier agent runs
       → issue row planned (currently stubbed)
       → inbox-drafter agent drafts a reply
       → cost telemetry on every step
6.  verify_actions_chain(tenantId) returns NULL
       → audit chain intact end-to-end
7.  Cleanup: delete the synthetic tenant + cascade
```

Every step has a PASS/FAIL assertion. Total cost ~$0.05 per run (3 agent calls × Sonnet/Haiku).

---

## What it asserts

Per step:

- DB writes succeed (rules out RLS bugs, encryption regressions)
- Audit chain stays intact across writes (rules out chain-trigger drift)
- Agent outputs validate against zod schemas (rules out prompt regressions silently breaking output shape)
- Cost telemetry includes `promptId` + `promptVersion` (rules out registry misses)
- scrubPII fires on inbound text (rules out import-path regressions)
- assertWritable doesn't throw under healthy DB (rules out false-positive read-only)

Plus aggregate:

- Total cost < $0.10 (cost-discipline guardrail)
- Total duration < 60s (perf regression guardrail)
- Zero unexpected errors in logger output

---

## Where it lives

`services/workers/scripts/e2e-app.ts`. Run via:

```
bun run services/workers/scripts/e2e-app.ts
```

Or wired into the workers `package.json`:

```
pnpm --filter @docket/workers e2e
```

Required env: `DATABASE_URL`, `ANTHROPIC_API_KEY`. Bedrock + R2 credentials are optional (when unset, those steps run in mock mode).

---

## What it intentionally doesn't do

- No Playwright UI testing. UI e2e is Option B in the original conversation; deferred to v1.5 launch-prep.
- No real Clerk OTP. The script bypasses auth via direct DB inserts (synthetic users). Per CLAUDE.md, `getAdminDb()` is the no-RLS path; this script is one of the explicit consumers.
- No real Twilio / DocuSign / Square. Webhooks aren't exercised in this e2e (they have their own per-feature smokes).
- No agent fleet eval — `/eval:classify` and `/eval:draft` are separate harnesses with their own quality gates.

---

## Anti-patterns this skill blocks

### "It works in isolation"
Per-feature smoke is necessary but not sufficient. Composition matters.

### "I'll run e2e before launch"
Too late. By v1 launch the regressions have compounded over weeks. Periodic runs catch drift early.

### "We don't need e2e because we have per-feature smoke"
Wrong frame. e2e is a different layer — it tests COMPOSITION, not features.

### "e2e is expensive so we skip it"
At ~$0.05 per run, e2e is cheap. The expensive thing is finding the composition bug in production.

### "e2e is brittle so we skip it"
The script tests STRUCTURAL invariants (chain intact, audit row count, prompt.version stamped), not exact strings. Brittleness comes from over-specifying; the v1 e2e under-specifies on purpose.

---

## When e2e fails

Three response paths:

1. **A feature commit broke composition** — most common. Bisect via `git log` since last green e2e; the breaking commit identifies the wiring gap. Fix in the next commit; re-run e2e.
2. **e2e itself is wrong** — the script tests an invariant that's no longer true (e.g., we changed the audit chain protocol). Update the e2e to match the new invariant; commit both together.
3. **Real production-only issue** — e2e runs against dev DB; some failures only surface in prod (Vercel cold starts, Neon connection limits). Document as a follow-up; don't block the queue.

---

## Output format

```
/e2e

  PASS  step 1 — tenant + user + client created
  PASS  step 2 — createClient via server action; audit row+chain link
  PASS  step 3 — intake fields saved; per-tenant DEK encryption fired
  PASS  step 4 — doc uploaded; classify-document agent ran
  PASS  step 5 — gmail synth → triage-classifier → inbox-drafter
  PASS  verify_actions_chain returned NULL on intact chain

Total: 6/6 PASS
Cost: $0.0XX
Duration: XXs
```

Failure surfaces a labeled FAIL line + which assertion broke + the diff hint.

---

## What this skill does NOT do

- Replace per-feature smoke (`/smoke-test`)
- Replace agent eval (`/eval:classify` + `/eval:draft`)
- Replace `/score` (production-readiness audit)
- Replace `/align` (mission alignment)
- Replace UI testing (Playwright; v1.5)

---

*Last updated: 2026-05-08. Composition is where features fail. e2e is the gate that catches composition.*
