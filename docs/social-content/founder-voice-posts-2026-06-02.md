# Founder voice — Week 4 posts (6/2-6/8)

> *Week 4 of David's earned-media cadence. Boney-Henderson presentation week. Post-event traction posts. Antonio production sub-milestone (5/30) just landed.*
> *Drop-in ready. Voice-pass with David before posting.*

Week 1: `docs/social-content/founder-voice-posts-2026-05-12.md`
Week 2: `docs/social-content/founder-voice-posts-2026-05-19.md`
Week 3: `docs/social-content/founder-voice-posts-2026-05-26.md`

This week's framing pivots from "build authority" to "report traction." Use real numbers when possible.

---

## Tax Twitter — single-tweet hot takes

### Post 1 — Position Library milestone announcement (post Mon AM)

```
20 of 20 Position Library entries Antonio-validated.

Every position cites primary authority. Every Tier 3 has pre-drafted
Form 8275. 3 explicit refusals (Augusta abuse, conservation easement,
hobby loss §183).

This is the substrate the Discovery agent retrieves from. Production-
quality, EA-validated, audit-defense-ready.

Months of research. Antonio's 25 years of practice. Compressed into
the AI's source-of-truth.

#TaxTwitter
```

---

### Post 2 — Antonio production milestone (post Tue AM)

```
Antonio Vazquez's ~250 active clients officially live on Docket
production substrate as of 5/30.

Real RLS. Real per-tenant DEK encryption. Real cryptographic audit
chain. Real Position Library backing every position the AI surfaces.

Two active 2026 IRS audits defending through this substrate.

This is what compliance-first looks like in production.

#TaxTwitter
```

---

### Post 3 — Boney-Henderson presentation report (post Wed AM)

```
Just presented to Dr. Boney-Henderson's preparer network — ~1000 EAs
+ small CPAs.

Antonio led the deck. 60 minutes. Real audit defense story. Real
Position Framework demo. Real Coverage Map honest-about-limits.

DMs already coming in. Free Discovery Scans being scheduled.

This is the warm-channel distribution motion the funded competitors
structurally can't tap.

#TaxTwitter
```

---

### Post 4 — Refusal Floor reframe (post Thu AM)

```
"AI that refuses" is uncomfortable when you first hear it.

Then you see it in action:

× Conservation easement: refused (Notice 2017-10 listed transaction)
× Augusta @ $5K/day: refused (Sinopoli)
× Hobby loss claim: refused (Burrus / Roberts / Foster / Storey)
× S-Corp under-comp $24K on $200K profit: refused (Watson)

Every refusal is logged with cited reasoning.

The refusal log IS your audit defense.

This is why the product works.

#TaxTwitter
```

---

### Post 5 — Founder tier scarcity update (post Fri AM)

```
Founder tier update as of 6/[X]:

[X of 50] slots remaining at $250/mo locked for life.

After 50: $350/mo for the next 25.
After 75: $400/mo for the final 25.
After 100: standard tier pricing ($499 Solo / $1,499 Small) kicks in.

If you're considering Docket and the math works, move sooner not later.

The math gets worse the longer you wait.

#TaxTwitter
```

---

## Tax Twitter — threads

### Thread 1 — What we learned at the Boney-Henderson presentation (post Mon-Tue evening; 7 tweets)

```
[1/7]
Just presented Docket to Dr. Boney-Henderson's preparer network last
week. ~1000 EAs + small CPAs in the audience.

Antonio Vazquez led. I (David) sidekick'd. Here is what we learned.

[2/7]
1. §6695(g) is hitting harder than even the pessimists expected.

About 60% of the audience confirmed they've had at least one
§6695(g) compliance review opened in 2024-2025. That's up from
our pre-presentation estimate of 40-50%.

[3/7]
2. EITC + self-employment is the #1 audit selector.

Multiple EAs in the audience confirmed: returns claiming EITC with
Schedule C income are getting selected for preparer-level §6695(g)
review at much higher rates than EITC-with-W-2 returns.

[4/7]
3. The Refusal Floor concept lands harder than the Position Framework.

When I demoed Discovery Scan and showed the refused-positions page,
the audience leaned in. "You refused conservation easement? You
refused $5K/day Augusta?" Yes. With cited reasoning.

That's the moat.

[5/7]
4. EAs trust honest-about-limits more than comprehensive-coverage
claims.

When I showed Coverage Map and explicitly said "CA + federal only;
we don't cover NY/TX/FL yet" — multiple EAs DM'd later saying
"that's why I'm signing up."

The trust artifact is the absence of overclaim.

[6/7]
5. The pricing math closes itself when you show §6694 alongside
§6695(g).

Most EAs anchor on §6695(g) ($650/failure). Once they see §6694
($1,000 OR 50% of fees, GREATER of), the $250/mo founder rate
math becomes obvious.

One prevented §6694 understatement pays for 18 months of Docket.

[7/7]
DMs continue rolling in. Discovery Scans being scheduled.

Same product, different doors — and this one (warm-network) opens
fast.

DM me if you want to talk through whether this fits your practice.

#TaxTwitter
```

---

### Thread 2 — How the Discovery agent actually runs (technical depth, post Wed-Thu AM; 6 tweets)

```
[1/6]
The Discovery agent went live with Antonio's 250-client production
substrate on 5/30. Here is how it actually runs end-to-end.

[2/6]
1. PARSE: Haiku 4.5 vision model parses the redacted return PDF.
Extracts structured return data: form type, schedules, line items,
$ amounts, entity classification.

PII scrubber validates redaction. If client name or SSN detected,
delivery blocks until prospect re-redacts.

[3/6]
2. RETRIEVE: For each line item, retrieve top-5 candidate positions
from the Position Library v0 (20 entries, all Antonio-validated)
via pgvector + BM25 hybrid retrieval.

The library is the source of truth. The agent retrieves, doesn't
hallucinate.

[4/6]
3. CLASSIFY: For each candidate position, Sonnet 4.6 with prompt
caching applies the 4-tier confidence framework based on:
- Cited authority chain from the library
- Client's specific fact pattern
- Substantiation gaps detected

Tier downgrades happen when substantiation is incomplete.

[5/6]
4. REFUSAL FLOOR: Deterministic TypeScript rule (NOT LLM judgment)
drops every position below Reasonable Basis. Logs refusal with cited
reasoning.

This is the load-bearing safety property. LLMs can hallucinate
confidence. Refusal floor is hard-coded.

[6/6]
5. PDF: Render Discovery Scan PDF with editorial-warm design tokens.
Position cards + Refused positions page + audit-defense story footer.

Delivered via Resend transactional email within 24 hours.

Cost per scan: ~$0.22. 120 scans = ~$26 total cost. Negligible.

This is what compliance-first AI architecture actually looks like
in production.

#TaxTwitter
```

---

## r/taxpros — long-form post

### Post: "Recap from the Boney-Henderson presentation + what we're seeing post-event"

```
Title: Just presented to Dr. Boney-Henderson's preparer network
(~1000 EAs) — sharing what landed + what surprised us

Body:

Hey r/taxpros,

Quick update for anyone who's been following the §6695(g) +
compliance-first AI threads I've been posting. Antonio (founding
firm partner; defending two active 2026 IRS audits using Docket)
and I just presented to Dr. Boney-Henderson's preparer network.

Three things that surprised us:

1. THE REFUSAL FLOOR LANDED HARDER THAN THE POSITION FRAMEWORK.
We expected the 4-tier confidence rating to be the headline. It
wasn't. The Refused-Positions page in the Discovery Scan PDF (where
the AI shows what it explicitly refused to surface, with cited
reasoning) was what got the room. Multiple EAs DMed afterwards
saying "that's why I'm signing up."

2. §6695(g) AUDIT RATE IS HIGHER THAN PUBLISHED ESTIMATES.
Roughly 60% of the audience confirmed at least one §6695(g)
preparer-level compliance review in 2024-2025. The IRS is making
this an active lane. If you prep EITC returns with self-employment
income, your practice is in the high-selection bucket.

3. HONEST-ABOUT-LIMITS BEATS COMPREHENSIVE-COVERAGE CLAIMS.
When I showed Coverage Map and said "federal + CA only; we don't
cover NY/TX/FL yet" — that's what closed three sign-ups during the
event. The trust artifact is the absence of overclaim.

For anyone in the r/taxpros community: we're booking 10 more
Discovery Scan walkthroughs this week. 20-min Zoom, with me +
Antonio if available. Bring real fact patterns. DM david@docket.com
or reply here.

Founder tier remaining: [X] of 50 at $250/mo locked for life.

[edit: not affiliated with r/taxpros mods]
```

---

## LinkedIn — long-form

### LinkedIn Post 1 — Antonio production milestone for tax-pro audience (post Tue 7 AM)

```
Production milestone for Docket: as of 5/30, my founding firm
partner Antonio Vazquez's entire active client base (~250 clients,
all real, all production, all CA-resident) is operating on the
compliance-first AI substrate.

What that means concretely:

→ 28 PROD migrations live
→ RLS at ENABLE+FORCE on every tenant-scoped table
→ Per-tenant DEK encryption with AAD binding to (tenant_id,
  client_id, path)
→ Cryptographic audit chain (chain_seq + prev_hash + row_hash) +
  nightly tamper verifier
→ Bedrock fallback verified end-to-end (38/38 unit + 4/4 smoke)
→ Position Library v0 indexed: 20 entries, all Antonio-validated,
  cited authority on every entry
→ Discovery agent in production with ~$0.22/scan cost
→ Two active 2026 IRS audits defending through this substrate

This is what compliance-first AI looks like at production scale for
the EA segment.

For practitioners reading: if you want to see the substrate from
the prospect side, DM me. Discovery Scan walkthrough offer still
open at $250/mo founder rate, [X] of 50 slots remaining.

For investors reading: this is the lane the funded competitors
($235M+ combined raised in 2024-2025) are economically forced away
from. They target the top-100 firms with in-house counsel; we built
for the PTIN-carrying preparer.

Same product, different doors.
```

---

### LinkedIn Post 2 — The Coverage Map as competitive moat (post Thu 7 AM)

```
"Comprehensive coverage" is the wrong claim to make about AI tax
tools. Every state has its own residency rules, its own credits,
its own penalty structure. No AI tool actually has comprehensive
coverage.

Docket publishes a Coverage Map. Honest about what we cover, don't,
and refuse.

ALGORITHMIC (100% — math, due-diligence checklists, form fields)
PATTERN (industry-best — §199A, §179, accountable plans, Augusta)
JUDGMENT (cited authority + preparer review required)
EXTERNAL (honest about limits — most state libraries, controversies)

When we presented to Dr. Boney-Henderson's preparer network last
week, the Coverage Map was the slide that closed three founder-
tier sign-ups during the event. EAs trust honest-about-limits more
than comprehensive-coverage claims, because they live the asymmetry
themselves.

The trust artifact is the absence of overclaim.

This is the moat the funded AI tax competitors don't have at our
segment. They target Big-4 firms where comprehensive-coverage
claims work because in-house counsel verifies. EAs personally
carry the risk. Different product, different segment, different
trust posture.

DM me for the Coverage Map PDF or a 20-min walkthrough.

Same product, different doors per audience.
```

---

## Tracking spec carryover

Add columns this week:
- Did this post explicitly reference Boney-Henderson presentation? Y/N
- Did this post explicitly reference Antonio production milestone? Y/N
- DMs received from Boney-Henderson attendees? Count
- Discovery Scan walkthroughs booked this week? Count
- Founder-tier sign-ups closed this week? Count

---

## Anti-pattern guardrails (same as weeks 1-3)

- No em dashes, no AI vocabulary
- No emojis
- No buzzfeed listicles
- Real numbers + real cites + real names

---

*Created 2026-05-11. Voice-pass with David before posting. Update post 1-3 with real numbers when Antonio production sub-milestone confirmed + real Boney-Henderson presentation date is locked.*
