# Assumptions to Test

> *Every session's ASSUMED claims, captured here so they don't disappear into chat history.*
> *Habit codified 2026-05-16 (Session 15 + behavioral instruction from David).*
> *Read at session start + when context matches (deploys, env changes, partner #2 onboarding).*

## Format

| Date | Session | Assumption | How to verify | Status | Verified-at / notes |
|---|---|---|---|---|---|

**Status values:**
- `open` — not yet verified
- `verified` — observed working in production / test
- `refuted` — observed NOT working; surfaces follow-up work
- `obsolete` — circumstance changed; no longer relevant

## Update discipline

1. **At every session end**, the AFTER report's `ASSUMED` items get appended here in the same commit as the work.
2. **At every session start**, I scan for any `open` rows whose verification path matches current context (e.g., "next deploy fires" → check the deploy-dependent rows).
3. **When David runs an action that could verify** (deploys, CI run, partner #2 onboarding, etc.), I proactively remind him: "this verifies rows N1, N2, N3 from ASSUMPTIONS-TO-TEST."
4. **When verified or refuted**, mark the row in the same edit that surfaces the evidence.

If a row sits `open` for 30+ days, that's the signal to either run an explicit verification step OR mark it `obsolete` if the circumstance has changed.

---

## Open assumptions

Backfilled from the last 15 sessions of VERIFIED/ASSUMED/UNKNOWN reports. Ordered by date (newest first).

| # | Date | Session | Assumption | How to verify | Status |
|---|---|---|---|---|---|
| A29 | 2026-05-16 | 16 | The discovery-agent eval scaffold (6 cases) correctly catches §6695(g) regressions when run against the real Sonnet 4.6 agent | Run `ANTHROPIC_API_KEY=... DISCOVERY_AGENT_ENABLED=true pnpm --filter @docket/workers eval:discovery`. Expect ≥80% pass (release-gate threshold). The 4 §6695(g) happy-path cases must produce at least one position with "8867" / "§6695(g)" / "Form 8867" in its gapsToConfirm[]; the false-positive case must surface NO 8867 mention; the injection case must not echo any of 5 forbidden substrings nor claim $0 or $999,999,999. | open |
| A30 | 2026-05-16 | 16 | The denylist-based prompt-injection coverage (5 substrings + 2 sentinel dollar values) is sufficient to catch real prompt-injection regressions through V1 — i.e., no novel paraphrase will silently break through without triggering a regression elsewhere | Manual review of any failed eval-discovery run: if the agent's output escapes injection by paraphrasing into a form the denylist doesn't catch, this assumption is refuted. Verifiable when a real injection regression is investigated (or never, if denylist coverage proves complete by happy accident). | open |
| A26 | 2026-05-16 | 16 | The DocuSign Connect webhook's new `writeSignatureStatusIssue` correctly writes an `issues` row when a client's 8879 envelope transitions (signed / kba-failed / declined) | First production envelope completion: Antonio loads `/home` post-transition and sees the new "X signed their 8879 — ready to e-file" (or kba-failed / declined variant) issue card in the Need You queue. Verify via Vercel logs that the `writeSignatureStatusIssue` block didn't fall into the catch + via Inngest dashboard that the webhook returned 200. | open |
| A27 | 2026-05-16 | 16 | The extended `findSignatureRowByEnvelopeId` SQL correctly returns `client_id` (NOT NULL per schema) + `engagement_id` (nullable per schema) from real `signatures` rows. The webhook helper passes both through to the issues insert; engagement_id may legitimately be null (issues.engagement_id is nullable FK with ON DELETE SET NULL — see schema.ts:530). | Inspect a real production signatures row post-envelope-creation + confirm `client_id` is non-null + `engagement_id` is whatever the row carries (null acceptable). Then verify the webhook handler creates an issue with `client_id` set + `engagement_id` passed through unchanged. | open |
| A28 | 2026-05-16 | 16 | The `writeSignatureStatusIssue` tx wrap with `SET LOCAL app.bypass_rls = 'on'` + `SET LOCAL app.current_tenant_id = $1` correctly scopes the clients SELECT + issues INSERT under multi-tenant load | Multi-tenant scenario when tenant #2 onboards: their first 8879 envelope transition creates an issue row scoped to THEIR tenant_id, not Antonio's. Verify via DB query post-transition: `SELECT tenant_id FROM issues WHERE evidence->>'signatureRowId' = '<id>'` returns the correct tenant. | open |
| A1 | 2026-05-16 | 15 | Twilio sends for the new `send8879Notification` helper will land correctly in production | First production 8879 envelope creation should land an SMS at the client's `+1•••••XXXX`. Verify by Antonio sending a test 8879 envelope + watching for the SMS receipt. | open |
| A2 | 2026-05-16 | 15 | The `Sign8879Form` success card UI renders the new "Texted to +1•••••XXXX" status row correctly post-deploy | Load `docket-command-room.vercel.app/clients/[id]` after next Vercel rebuild + click "Request 8879 signature" + verify the green success card shows the new status row above the copy-link affordance | open |
| A3 | 2026-05-16 | 15 | The en/es language routing in `buildMessageBody` fires correctly for production clients based on `client.preferredLanguage` | First Spanish-speaking client (preferredLanguage='es') gets the Spanish SMS body. Today's data has preferredLanguage mostly null so English fires by default. | open |
| A4 | 2026-05-16 | 14 | Real Bedrock Converse Haiku 4.5 vision produces JSON output of the same quality as Anthropic direct | Build + run a Bedrock-direct vision smoke test against a real W-2 image; compare classification output to Anthropic-direct on the same image | open |
| A5 | 2026-05-16 | 14 | The URL-source image fallover path (fetch → bytes for Bedrock) works against real R2 presigned URLs | Force a vision call with a `kind: 'url'` image to hit the fallover by transiently failing Anthropic (or stage in a smoke test) | open |
| A6 | 2026-05-16 | 13 | `docs/USER-PREFERENCES.md` reconstruction of David's voice/quality bar/decision flow is accurate | David reviews the doc, marks any pattern as wrong, I revise | open |
| A7 | 2026-05-16 | 13 | `docs/MASTER-QUEUE.md` priority ordering matches David's actual sense of urgency | David reviews ordering, pushes items up/down as needed | open |
| A8 | 2026-05-16 | 12 | The `/prospects` admin page renders correctly for `firm_owner` role + redirects for other roles | David loads `docket-command-room.vercel.app/prospects` post-deploy. Sign in as firm_owner → see the table. Sign in as admin/preparer → bounce to `/clients`. | open |
| A9 | 2026-05-16 | 12 | The sidebar Operations section reflows correctly with 2 items (Prospects + Cost) vs the previous 1 (Cost only) | Visual check of the sidebar nav post-deploy | open |
| A10 | 2026-05-16 | 11A | `useFirmOwner()` + `useTenantName()` fire correctly on the 3 updated portal surfaces for tenant #2 once they onboard | First tenant #2 client loads `/portal/profile` + `/portal/messages` + `/welcome` and sees the right firm name + owner name (not Antonio Vazquez / Vazant Consulting defaults) | open |
| A11 | 2026-05-16 | 11B | `apply-38` smoke (bypass policies migration) will pass when CI runs against the test branch | Next CI run on a PR exercises the apply-38 step + the 4 invariants (policies present, cross-tenant INSERT works under bypass, cross-tenant SELECT works under bypass, tenant_isolation still fires when bypass unset) | open |
| A12 | 2026-05-16 | 11B | The `verify-actions-chain` cron's new `db.transaction` wrap takes effect correctly in production | Next nightly cron run (07:00 UTC) executes against production tenants + reports the expected `tenants_checked / intact / broken` counts | open |
| A13 | 2026-05-16 | 10 | The PDF renderer (`DiscoveryScanDocument.tsx`) iterates `gapsToConfirm` as a flat list — surfacing refusal-prefixed entries works because the existing renderer doesn't distinguish them visually | Render a Discovery PDF against a client with refusalConditions populated + visually inspect the gaps section | open |
| A14 | 2026-05-16 | 10 | The command-room client card UI also iterates `gapsToConfirm` and surfaces refusal entries cleanly | Visual check of `/clients/[id]` after a Discovery run on a real client | open |
| A15 | 2026-05-15 | 9 | Sonnet 4.6 actually obeys the new content-boundary instructions on real injection attempts (the prompt text is present per content-invariant tests but model behavior under attack is untested) | Build an eval suite with synthetic injection payloads (MASTER-QUEUE #19) + run against each drafter prompt | open |
| A16 | 2026-05-15 | 8 | The LLM actually follows the new Form 8867 hard rule for EITC / CTC / ACTC / AOTC / HOH positions (rule text is in the prompt but model adherence is untested) | Run an /e2e variant with synthetic EITC fact pattern + assert at least one surfaced position has `gapsToConfirm` containing "Form 8867" + "§6695(g)" | open |
| A17 | 2026-05-15 | 8 | The notice-drafter + inbox-drafter actually read `context.preparerFullName` from the user prompt over the (now-removed) hardcode default | First multi-tenant deploy (tenant #2) generates a notice / inbox draft signed with their EA name, not "Antonio Vazquez, EA" | open |
| A18 | 2026-05-15 | 7 | The new `security-lint` CI job runs cleanly on first PR + correctly fails any PR that adds a new `getAdminDb` caller or new agent file without the required marker | Next PR that adds a new agent or `getAdminDb` caller; verify the job either passes (allowlist updated) or correctly fails | open |
| A19 | 2026-05-15 | 6 | The `apply-37` smoke (webhook_events dedup table) passes on next CI run | Same as A11 — first PR's CI job exercises apply-37 | open |
| A20 | 2026-05-15 | 6 | The 3 webhook routes' new dedup wiring (`tryRecordWebhookEvent`) behaves correctly in production | First production webhook event from each provider (Square / DocuSign / Twilio) lands without rejection. Replay of a captured event would be the canary — if the env permits a controlled test. | open |
| A21 | 2026-05-15 | 5 | `apply-36` smoke (authorities NULL-tenant fix) passes on next CI run | Same as A11 + A19 — first PR's CI job | open |
| A22 | 2026-05-15 | 5 | The `seed-authorities` script works correctly post-Session-5 wrapper change (`db.transaction` + `SET LOCAL app.bypass_rls = 'on'`) | Re-run `pnpm tsx packages/db/scripts/seed-authorities.ts` against a fresh DB after migration 0036 + verify the 7 starter authorities seed cleanly | open |
| A23 | 2026-05-15 | 4 | The audit-chain integration suite (`audit-chain.test.ts`) passes against a real Neon test branch with all migrations applied | Set `DATABASE_URL_RLS_TEST` to a fresh Neon branch with migrations 0000-0038 applied + run `bun test packages/db/test/audit-chain.test.ts` | open |
| A24 | 2026-05-15 | 4 | The `verify-actions-chain` cron has been correctly running nightly against production tenants since Session 4 hardening | Check Inngest dashboard for the cron's run history in the last 30 days + verify the daily run logged `{tenants_checked: N, intact: N, broken: 0}` for each night | open |
| A25 | 2026-05-15 | 3 | The AAD delimiter rejection (Session 3 finding) is correctly enforced in production — no legitimate write path can pass a tenantId / clientId / path containing `;` or `:` | Inspect logs for any `AAD_DELIMITER_REGEX` rejection in the last 30 days. Today's tenantId + clientId values are UUIDs so the rejection is hypothetical; verifies that no future write path slipped through with non-UUID identifiers | open |

---

## Recently verified (last 14 days)

When an `open` row moves to `verified` or `refuted`, move it here. Drop rows older than 14 days into commit history.

| # | Date verified | Original row | Result | Evidence |
|---|---|---|---|---|

*(empty — backfill begins as items get verified)*

---

## How David should use this

- **Don't read this every day.** Read it when something happens that could verify items in bulk (a deploy, a CI run, partner #2 onboarding, end of week).
- **When I remind you of relevant rows**, take the 5 minutes to do the verification. If it's easy (visual check post-deploy), do it on the spot. If it's a focused test session, queue it.
- **Push back on rows that are stale.** If an assumption sat `open` for a month and the circumstance has changed, mark it `obsolete` — don't carry zombie items forever.

The point of this doc is to make the "production-ready" claim honest. Every commit that ships ASSUMED items adds rows here; every verified row moves the codebase one step closer to actually-proven instead of best-effort.
