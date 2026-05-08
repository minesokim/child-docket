---
name: edge-cases
version: 1.0.0
description: |
  Pre-implementation skill that forces explicit enumeration of edge cases
  and failure modes BEFORE writing the code. Pairs with /code-quality
  (which is post-code review) and /smoke-test (which is end-to-end
  verification). This one happens at the TOP of the build cycle, not
  the bottom.

  Triggered before implementing any non-trivial feature. The drift it
  prevents: shipping happy-path code, then discovering the failure
  modes when a user hits them in production.
voice-triggers:
  - what could go wrong
  - edge cases for this
  - failure modes
allowed-tools:
  - Read
  - Grep
  - Glob
---

# edge-cases

> Senior engineers think about edge cases BEFORE they write the code.
> Junior engineers (and AI on autopilot) think about happy path first
> and fix edge cases when production breaks.

## When to invoke

**Always**, before implementing:
- A new server action or API route
- A new agent in the fleet
- A new table or schema migration
- A new background worker / Inngest function
- A new integration with an external API (Anthropic, Bedrock, R2, Plaid,
  IRS, DocuSign, Square, Twilio, Clerk)
- A new UI surface that takes user input
- Any code path that touches money, signatures, filings, or PII

**Skip** for:
- Pure styling / typography changes
- Adding a missing import
- Renaming a variable
- Comment-only edits
- Doc-only edits

## The drift this skill prevents

Without this skill, the autopilot pattern is:

1. Read the spec
2. Write the happy path
3. Run typecheck → passes
4. Run smoke test → passes (because smoke tests cover the same happy path)
5. Commit
6. User hits an edge case in prod
7. Realize "I didn't think about that"
8. Fix-up commit
9. Repeat

The skill enforces a sequence reversal — think about edge cases FIRST,
then the implementation actively defends against them.

## Workflow

### Step 1 — write the spec one sentence

What is this code supposed to do, in one sentence? If you can't, you
don't understand the feature yet. Read more.

Example: "Discovery agent scans a client's bank-feed transactions and
surfaces ones that look deductible."

### Step 2 — list 8-15 edge cases

For the feature you just spec'd, brainstorm at least 8 edge cases.
The bar is "could this break in a way that costs the user money,
their PTIN, their license, or their relationship with their client?"

Categories to walk through:

**Input edge cases**
- Empty input (zero rows, empty string, null)
- Single-element input (degenerate cases)
- Maximum-size input (1MB body, 10K rows, 100MB upload)
- Malformed input (invalid base64, garbage JSON, wrong encoding)
- Adversarial input (SQL injection patterns, regex DoS, path traversal,
  prompt injection)
- Unicode + emoji + RTL text + null bytes
- Very long strings, very deeply nested objects

**State edge cases**
- Race conditions (two writes to same row simultaneously)
- Out-of-order events (status update arrives before creation)
- Idempotency (event delivered twice — does the second one corrupt state?)
- Stale state (record was deleted between read and write)
- Cross-tenant accidents (client_id from tenant A queried by tenant B)
- Partial state (half-completed multi-step transaction)

**Failure-mode edge cases**
- External API down (Anthropic 503, R2 timeout, Neon outage)
- External API rate limited (429 with retry-after)
- External API returns garbage (200 with empty body)
- Network partition mid-operation
- Lambda timeout (60s for Vercel Pro; what state is left if killed at 59s?)
- Out-of-memory (sharp on a 50MB image; tesseract worker crash)
- Disk full / R2 quota exceeded

**Time edge cases**
- Year boundary (December 31 / January 1)
- Leap year (Feb 29)
- Daylight savings transition
- Timezone confusion (UTC vs America/Los_Angeles)
- Future dates / past dates (DOB in the future, deadline in the past)
- Clock skew between client and server

**Permission edge cases**
- User has wrong role
- User's tenant doesn't match the resource
- User's session expired mid-operation
- User was deleted between auth check and action

**Domain-specific edge cases (TAX-PRACTICE-AWARE)**
- Client SSN looks like a fake-but-valid pattern (000-00-XXXX block)
- Client filed but didn't pay (return accepted, payment failed)
- Client's W-2 was reissued mid-prep (W-2c arrives after original W-2)
- Engagement spans tax year boundary (return for 2025 prepped Jan 2026)
- Multiple states (CA primary, TX rental, NV W-2)
- Joint filer + 1 spouse-only document
- Client switches firms (Antonio → another EA on Docket)
- Antonio retires (firm transfer)
- IRS notice arrives (CP2000 etc.) requiring response within 30 days
- Audit selection (return picked for examination)
- Power of attorney revoked

For each edge case, write down:
- What goes wrong
- What the user-visible consequence is (NOT "an error" — be specific:
  "user is shown the wrong refund amount" / "doc is silently lost" /
  "filing rejected by IRS")
- Severity: critical (money/PTIN/license at risk) / high (UX broken) /
  medium (graceful degradation acceptable) / low (cosmetic)

### Step 3 — decide handle / document / out-of-scope per case

For each edge case, pick one:

**Handle**: implementation actively defends against this case. Test
coverage is required.

**Document**: the case is real but out of v1 scope. Inline comment
references the case + future plan. Tracked in PRODUCTION-READINESS.md
or AUTONOMOUS-QUEUE.md as a followup.

**Out-of-scope**: the case is not real for this feature (e.g., "year
boundary edge case" doesn't apply to an SMS verifier).

If more than 3 cases are "Document" deferred to followup, the feature
scope is wrong — either the spec is too big or the deferred cases
should be in scope. Renegotiate.

### Step 4 — write the happy path with edge-case tests interleaved

Implementation discipline:

- For every "Handle" case from Step 3, the code has explicit branching
  or guard logic with a comment naming the edge case it defends against.
- For every "Handle" case, there is a test that exercises that branch
  and asserts the correct outcome.
- For every "Document" case, there's an inline comment of the form:
  `// EDGE_CASE(deferred): <one-sentence description>. Tracked at
  PRODUCTION-READINESS §X.`

Order of writing:
1. Tests first (one per Handle case + happy path)
2. Then implementation
3. Run tests until all green

This is TDD-shaped, but the value is in the EDGE-CASE DISCIPLINE, not
the test-first dogma. If you find writing tests pre-implementation
clunky, write impl first then add tests — but every Handle case still
needs a test, period.

### Step 5 — codex review the edge-case coverage

Before committing, codex review (per /code-quality Step 5) should be
prompted to specifically check edge-case coverage. Add to the codex
prompt:

> Review the edge-case coverage. The author claims to have considered
> the following edge cases: [paste your list from Step 2 with
> handle/document/out-of-scope status]. Are there cases you'd flag
> that I missed? Are any "Handle" cases under-tested? Are any
> "Document" cases actually critical and incorrectly deferred?

If codex surfaces missed cases that are critical or high severity,
fix before commit.

## Calibration: tonight's misses

Cases I've personally missed during this session that this skill would
have caught:

- **Webhook verification** (item #1, b31e91f): I shipped without
  considering "what if the same body is replayed twice?" — replay
  protection isn't built in. Codex didn't flag it because I didn't
  prompt for edge-case review. Documented as known followup, but
  should have been considered upfront.
- **Test fixtures lockfile** (item #2, 605ba26): never thought about
  "what if Vercel uses --frozen-lockfile?" — broke 3 prod deploys.
  Pure operational edge case I should have anticipated.
- **Sentry test endpoint**: shipped without considering "what if the
  endpoint is left in production after launch?" — added a removal
  reminder but should have been a stop-condition.

The bar this skill enforces: "list 8-15 edge cases up front, decide
handle/document/out-of-scope, never claim done until coverage is
explicit."

## Anti-pattern: "I'll fix that in followup"

If during Step 2 you find yourself thinking "I'll just handle that
later" for more than 1-2 cases, the feature scope is wrong. Either:
- Narrow the scope (do less now)
- Expand the implementation (handle it now)
- Genuinely commit to a followup item with a hard deadline

Never ship a feature with critical or high-severity edge cases
deferred unless there's an explicit, time-bounded followup plan.

## Reference: tax-domain edge case checklist

Reused across most Docket features. Run through this list any time
the feature touches a tax domain object:

- [ ] What if the client filed in a prior year with different EA?
  (Memory continuity)
- [ ] What if the spouse's data conflicts with the primary's? (Joint
  filer reconciliation)
- [ ] What if the doc is for the wrong tax year? (Year mismatch)
- [ ] What if the doc is for a different client (uploaded to wrong
  account)? (Slot/identity mismatch)
- [ ] What if the engagement was retroactively cancelled? (Engagement
  state changes after AI work)
- [ ] What if the EA fires the client mid-engagement? (Client-firm
  termination)
- [ ] What if the IRS rejects the e-file? (Reject reason routing)
- [ ] What if the client is selected for audit? (Workflow changes,
  doc retention extends, no soft-delete on audit-relevant artifacts)
- [ ] What if a Tier-3 position gets retroactively reclassified by
  authority changes? (Authority versioning, stale-cite warnings)
- [ ] What if the client's state of residency changes mid-year? (Multi-
  state attribution)
- [ ] What if the client requests data export under CCPA/GDPR while
  in active engagement? (Data export policy)
- [ ] What if the client's phone number changes? (Auth + comms re-bind)

These aren't all in scope for every feature, but glance through the
list and explicitly mark out-of-scope ones.

## How this pairs with other skills

- `/edge-cases` — runs BEFORE implementation (this skill)
- `/code-quality` — runs BEFORE commit (post-implementation gate)
- `/smoke-test` — runs AFTER implementation (E2E verification)
- `/decisions-log` — runs AT END of session (notify user of judgment calls)

The four together form the autonomous build cycle. Skipping any one
re-creates the drift the others were designed to prevent.
