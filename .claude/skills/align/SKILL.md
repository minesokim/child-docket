# /align — does this feature serve the grand product goal

> *Run BEFORE committing every feature. Look past the code-quality bar; ask whether this feature serves the MISSION, GOAL, and POSITIONING of the product as a whole. If it doesn't, fix the alignment before merging.*

---

## Why this skill exists

User-codified 5/8/2026:

> "dont just do the bare minimum to get over the score threshold. look at the grand plan of the product as a whole. the mission, the goal, and the alignment of the feature with our grand goal. if it doesn't align, fix."

The /score skill catches code-level production-readiness gaps (substrate without consumer, migrations not applied, etc.). It does NOT catch "this feature is well-built but doesn't serve the product." A perfectly-engineered feature that's misaligned with the mission is still slop at the product level.

This skill is the second gate. /score answers "is this load-bearing in the codebase?" — /align answers "is this load-bearing in the product?"

---

## When this fires

Between /score and /keep-going. After a feature passes /score (>=95), before the loop advances.

```
finish item N
  │
  ▼
/score (loop until >= 95)
  │
  ▼
/align — does this feature serve the mission/goal?
  │
  ├── YES → /keep-going advances to item N+1
  │
  └── NO  → identify the misalignment, propose the smallest
            change that closes it, implement, re-score,
            re-align ⟲
```

---

## The mission (from CLAUDE.md §1)

> "The agentic operator for a tax practice. Top-tier preparer-grade AI animates every surface; drives the existing tax stack via API-first integrations + browser automation as fallback."

> "Your practice. Every tool. One operator."

---

## The product anchors (CLAUDE.md §1-§14)

These are the load-bearing claims the product makes. Every feature should serve at least one:

1. **Memory scoped to the client.** Per CLAUDE.md §1 — the practice ledger enforces this. Every action lives on the client record.
2. **Compliance-first deduction surfacing.** Per CLAUDE.md §13 + POSITION-FRAMEWORK.md — every position carries an IRC cite + tier classification + audit risk. NOT a loophole-finder.
3. **Audit-defensible by default.** Per PRODUCTION-READINESS §I marketing handle — "Docket is the tax AI where every action is reversible and audit-defensible. The only one."
4. **Never destroys client data.** Per the IG-ad-scenario callout — "AI almost cost my client $2M because it stripped 7 years of data." The structural defenses are append-only audit, refusal floor, pre-signature checklist, rewind primitive, soft-delete, backups + cross-region replication.
5. **Mediated by AI, gated by Antonio.** Per CLAUDE.md §4 — taxpayer never interacts with autonomous AI. Every action preparer-approved.
6. **Practice + relationship + rep layer.** Per CLAUDE.md §17 — Docket's structural lane (vs return-prep agents fighting up-market).
7. **Multi-tenant from day 1.** Per CLAUDE.md §2 + §16 — every consulting engagement runs on the same substrate. No snowflakes.
8. **EA representation rights as the second pillar.** Per CLAUDE.md §13 bet #4 — 2848 + transcripts + notice triage.
9. **Forward-deployed for Antonio + partner #2.** Per CLAUDE.md §3 — the v1 wedge is real customers, not aspirational.
10. **Vendor-resilient.** Per CLAUDE.md §23 + PRODUCTION-READINESS §A — locked 5/8/2026 after Neon Cell 6 outage.
11. **$50/mo cost discipline.** Per CLAUDE.md §7 + COSTS.md.
12. **Editorial-warm UI.** Per CLAUDE.md §11 — anti-AI-slop, intentional design, no shadcn aesthetic.

---

## The seven explicit NOs (CLAUDE.md §14)

A feature that violates ANY of these is misaligned:

1. Don't fight Black Ore / Accrual / Basis on autonomous return prep for big firms.
2. Don't build a consumer tax filer.
3. Don't lead positioning with "deeper than any CPA."
4. No WhatsApp in v1.
5. Don't build a return calculation engine.
6. No per-customer snowflakes.
7. No Bloomberg/CCH/Checkpoint year 1.

Plus the operating NOs: no Python backend, no AWS Bedrock from day 1 (resolved 5/8 with failover), no Big-4/F500 pivot for 18-24 months.

---

## The alignment checklist

Per feature, answer all six:

### 1. Which product anchor does this serve?

Name at least one from the list of 12. If you can't, the feature is decoration.

### 2. Does this serve the MID+DOWN market segment posture?

Per CLAUDE.md §14 segment posture — v1 targets mid-market and down-market. Big-4-targeted features waste cycles. A feature that only matters at scale of a 100-staff firm is misaligned for v1.

### 3. Does this make the eventual platform unlock easier or harder?

Per CLAUDE.md §16 productization discipline — every consulting engagement should produce platform IP. A feature that's only useful for one design partner (Antonio) and unusable elsewhere is misaligned.

### 4. Does this serve the compliance moat?

The compliance-first deduction surfacing is the structural moat vs Big-4-targeted competitors. A feature that erodes the moat (e.g., a "deduction maximizer" tone) is misaligned. A feature that hardens it (audit chain, refusal floor, position framework) is aligned.

### 5. Does this make the user-visible experience clearer or muddier?

Anti-AI-slop discipline. "Editorial warmth, not AI dashboard." A feature that adds a generic shadcn modal, a left-border accent, decorative icons, or AI-vocab copy is misaligned with the design system.

### 6. Does the feature surface to the user, or is it pure substrate?

This is the deepest check. From the user's 5/8 codified frustration:

> "i shipped a lot of substrate but the substrate isn't yet load-bearing in production"

Substrate is fine when it enables a user-visible feature. Substrate that NEVER reaches the user is misaligned with the product. Every commit should have a follow-up trace to a user-visible outcome — ideally in the same commit, or explicitly tracked as a follow-up that won't be forgotten.

---

## Worked examples

### Aligned ✓

**Migration 0022 audit-trail chain** — serves anchor 3 (audit-defensible) + anchor 4 (never destroys data). The chain is invisible to Antonio TODAY, but it's the structural substrate for the rewind primitive (V1.5) which IS user-visible. Aligned.

**PII scrubber + scrubPII into gmail ingest** — serves anchor 2 (compliance moat) + anchor 4 (never destroys data). Defensive; user never sees it but it's the difference between "we leaked a SSN to Anthropic embeddings" and "we didn't." Aligned.

**eval-classify F1=1.000** — serves anchor 1 (memory: agent quality), anchor 2 (compliance: catches regressions), anchor 11 (cost: $0.024/run is cheap). Aligned.

### Misaligned ✗ (hypothetical)

**A "deduction maximizer" agent** — violates the position framework's compliance-first stance. Tells the user we'll find them money. Erodes the moat vs Big-4-targeted competitors who can also do this with their in-house tax counsel cover. **Misaligned**; either reshape into a compliance-first surface (the Discovery agent) or kill.

**A shadcn-default settings modal** — violates anchor 12 (editorial-warm UI). Generic affordances make Docket look like every other AI tool. **Misaligned**; reshape with custom Docket tokens.

**A "delve into your tax history" insights surface** — uses an AI vocab forbidden word + leans on "deeper than any CPA" positioning. **Misaligned**; reword.

### Borderline (requires deliberation)

**Status banners + ReadOnlyProvider** — serves anchor 10 (vendor-resilient). User sees the banner during outages. Strong alignment if the banner copy is accurate to what the system actually does (codex caught this on the helpers); weaker if the copy overpromises (the helpers "Your saves are queued" was a misalignment that was fixed). After the fix: aligned.

**A Sentry test endpoint** — substrate-only. Does NOT serve any anchor directly. Justified as "obscurity-not-auth verification" with explicit removal-before-launch tracking. Borderline aligned because it's documented as temporary AND the launch-prep removal is in the queue.

---

## What to do when misaligned

Three options, in priority order:

1. **Reshape the feature** so it serves an anchor. Often a small change — different copy, different placement, different default.
2. **Kill the feature.** Better to ship nothing than ship misaligned code that we'll have to rip out later.
3. **Document the misalignment as a known tradeoff** with explicit revisit-conditions (a rare path; only when the feature is genuinely necessary substrate but lacks a current consumer).

---

## Anti-patterns this skill blocks

### "It compiles, /score said 95, ship it"
The /score skill doesn't ask whether the feature should EXIST. /align asks the harder question.

### "Generic shadcn defaults"
Anti-AI-slop discipline. Editorial warmth is non-negotiable.

### "AI vocab leakage"
Per CLAUDE.md voice rules — no `delve / crucial / robust / pivotal / landscape / tapestry / underscore / foster / showcase`. Marketing copy especially.

### "Big-4-targeted feature work"
Per the segment posture — Big 4 / F500 is deferred 18-24 months. Features only relevant at that scale are misaligned for v1.

### "Snowflakes"
Per §16 productization discipline — every feature should run on the multi-tenant substrate. No "Antonio-special" code that won't work for partner #2.

### "Demo-path-only"
A feature that works in the demo but breaks in real volumes is misaligned. v1 ships features that hold up at Antonio's 240-client scale.

---

## Output format

```
/align on [feature name / commit SHA]

Anchors served: [list from the 12]
Anchors weakened: [list, if any]
NOs violated: [list, if any]

Q1 (anchor served):     [answer]
Q2 (segment posture):    [answer]
Q3 (platform unlock):    [answer]
Q4 (compliance moat):    [answer]
Q5 (UX clarity):         [answer]
Q6 (substrate vs UX):    [answer]

Verdict: ALIGNED / MISALIGNED / BORDERLINE
If misaligned: smallest reshape to fix is [X].
```

---

## What this skill does NOT do

- Replace /score (code-level production-readiness)
- Replace codex review (code-level correctness)
- Auto-fix misalignment — surfaces it for the loop to attack
- Trust "it serves the user eventually" — every feature must trace to a CURRENT or imminent user surface, not "v3 someday"

---

*Last updated: 2026-05-08. Built code that doesn't serve the product is still slop. /align is the gate that catches it.*
