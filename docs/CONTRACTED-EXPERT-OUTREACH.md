# Contracted Tax Advisor Pipeline — outreach kit

> *Backup-capacity advisor sourcing for Position Library validation, in support of Antonio (primary on-platform tax advisor).*
> *Created 2026-05-11.*

---

## Why this exists

Antonio Vazquez (EA, Vazant Consulting) is the on-platform tax advisor and primary reviewer of every Position Library entry — that's the structural answer to "where does Docket's tax-domain depth come from" (CLAUDE.md §1 + §21 #4). But Antonio is one person, currently defending two active 2026 IRS audits for his own clients, and the Position Library v1 needs 20 positions reviewed + signed-off in the next 6 months while v1.5 expands to 50+ positions across federal + multi-state surfaces.

This kit sets up a **contracted backup-advisor pipeline** so Antonio is never the bottleneck on:

1. Position Library entries during Antonio's audit-defense weeks
2. State-specific positions outside CA (where Antonio isn't the right reviewer anyway)
3. Surge scale-validation work when partner #2 onboards in Phase 6 of v1
4. Second-opinion review on Tier 3 (judgment-required) positions where Antonio wants peer validation

**This is not a tax co-founder hire.** It's contracted advisory work, billed hourly, no equity, time-bound to specific position-review deliverables.

---

## What to look for in a contracted advisor

### Hard requirements

- **Active EA or CPA license** in good standing (PTIN-eligible)
- **10+ years of return-preparation experience** at the segment we serve (solo practice or small firm — NOT Big-4, NOT in-house tax counsel)
- **Multi-state experience** — at minimum CA + one other state with a state income tax (NY, TX, FL, IL)
- **Comfortable working from primary authority** — has to be able to cite IRC + Treas Reg + controlling cases without research handholding; ability to articulate confidence-tier classification (Settled / Substantial Authority / Reasonable Basis / More Likely Than Not)
- **References from at least 2 prior contracted-review engagements** (academic tax journal peer review, AICPA technical committee work, or contracted research for a tax-software vendor — all qualifying)

### Strong-plus

- **NAEA committee or AICPA technical committee experience** (signals comfort with formal position-paper work)
- **Prior experience reviewing AI-generated tax content** for accuracy (rare but increasingly valuable)
- **State PTET or §199A specialty** (these are the highest-leverage Position Library entries)
- **Audit-defense practice** (means they think in terms of "what gets challenged" not just "what's allowed")
- **Spanish or Mandarin fluency** (helpful for the cohort Antonio's mentor's network surfaces)

### Disqualifiers

- "Find every deduction" practice posture — wrong philosophy for compliance-first work
- Loophole-finder / asset-protection-aggressive practice — same
- Big-4 background only with no small-firm experience — they think differently about PTIN risk
- No active client work in last 24 months — knowledge atrophies fast
- Tax software vendor employee — conflicted on the Path 2 partner-tier question

---

## Sourcing channels (in priority order)

| Channel | Why | Lead time |
|---|---|---|
| **Antonio's professional network** | Already filtered for compliance-first orientation + Antonio's vouching is the strongest signal. Highest-quality lead. | 1-2 weeks |
| **Antonio's mentor (Dr. Jasmine Boney-Henderson) network** | 1000+ preparer reseller network; some have committee or contracted-review experience | 2-3 weeks |
| **NAEA listserv / forums** | Self-selected EAs with formal involvement; post a "contracted Position Library review work, $200-400/hr, 5-10 hrs/wk, remote" listing | 1-2 weeks |
| **AICPA Tax Section committees** | CPAs with formal technical-committee experience; LinkedIn search + direct outreach to committee members | 3-4 weeks |
| **r/taxpros (16K members)** | Lower signal-to-noise but volume-rich; a thoughtful post may surface 1-2 qualified candidates | 2-3 weeks |
| **Tax-research vendor alumni** (Bloomberg Tax, CCH, Checkpoint authors) | High-quality but harder to find + may be on competing-vendor non-competes | 4-6 weeks |
| **Latino Tax Pro instructor pool** | Bilingual-capable + segment-aligned with Antonio's actual client demographic | 2-3 weeks |

---

## Sample outreach message (LinkedIn DM or NAEA listserv post)

```
Hi [name] —

Quick context: I'm building Docket, an AI compliance + audit platform for tax practices. My on-platform tax advisor is Antonio Vazquez (EA, Vazant Consulting, CA) — he reviews every position our system surfaces. We're at the stage where the Position Library is expanding faster than Antonio alone can review during his current audit-defense load.

Looking for a contracted tax advisor to handle:
  • Per-position review of Position Library entries (IRC cite + Treas Reg + controlling case + confidence-tier classification + 8275 trigger)
  • 5-10 hrs/week, remote
  • $200-400/hr depending on specialty depth
  • Time-bound to specific deliverables (we count positions reviewed, not hours billed)

What I'm looking for:
  • Active EA or CPA in good standing
  • 10+ years return-prep experience at the solo / small-firm segment
  • Comfortable working from primary authority
  • Multi-state experience (at minimum CA + one state with income tax)
  • Compliance-first orientation (NOT loophole-finder)

If you (or someone you know) might be interested, I'd love to do a 30-min call. Background on the company at [URL]. References available.

David Kim
CEO, Docket
[email]
```

**Customization rules**:
- For Antonio's referrals: lead with "Antonio said you might be interested" — that's the strongest opener.
- For NAEA listserv: lead with the qualifier list (EA in good standing, 10+ years, etc.); makes it easy for unqualified candidates to self-screen out.
- For AICPA committee members: lead with the formal-review nature of the work; that's why they're on a committee.
- For r/taxpros: lead with the per-position fee structure; that audience responds better to concrete deliverables than to retainer language.

---

## Contractor agreement skeleton (key clauses)

When a candidate accepts, the contractor agreement should include:

1. **Scope of work**: per-position review with deliverable = signed sign-off on each position with IRC cite + tier classification + reviewer attestation.
2. **Compensation**: hourly rate ($200-400 depending on specialty), invoiced monthly, paid net-15.
3. **Conflict of interest**: contractor discloses any active relationship with a competing AI tax tool or tax-software vendor; we mutually decide if it's a conflict.
4. **Confidentiality**: standard NDA covering Position Library content + Docket internal docs; survives termination by 5 years.
5. **IP assignment**: anything the contractor produces under the engagement is work-for-hire owned by Docket (positions, citations, attestations).
6. **No-employment clause**: explicitly contractor relationship, contractor handles their own taxes (1099 — see docs/security/access-control-policy.md for principal handling).
7. **Indemnity carve-out**: contractor warrants their own work meets professional standards under their license; Docket indemnifies for use of their reviewed positions in marketing or other downstream surfaces beyond the original review.
8. **Termination**: either party with 30 days notice; pro-rated final invoice; IP assignment survives.

Have a tax-law-aware attorney draft the actual agreement before signing the first contractor. Budget: $500-1,000 one-time for the template, then reusable.

---

## Quality control (because the lawsuit risk is real)

Every Position Library entry surfaced in production carries a `reviewedBy` field that resolves to a real EA or CPA name + license number + sign-off timestamp. **No position ships without sign-off.** AI-classified positions live in a separate "draft" namespace that's never surfaced to a customer-facing surface.

The contractor agreement includes:
- Required disclosure if a reviewed position is later overturned (Tax Court, appellate, or IRS guidance change) — contractor flags Docket so we can re-classify.
- Required annual re-review of any position the contractor has signed off on (catches stale citations).

This is how we credibly say "every position cited to primary authority" without it becoming an unverifiable claim.

---

## Budget planning

| Phase | Effort | Cost |
|---|---|---|
| **v1 (now → 7/30)**: 20 positions × 2-4 hrs review each + 1 second-opinion on each | ~60-80 hrs total | $12K-30K one-time |
| **v1.5 (8/1 → 12/31)**: + 30 more positions + state-specific expansions (NY, TX, FL) | ~100 hrs/quarter ongoing | $20K-40K/quarter |
| **v2 (2027+)**: continuous review + annual re-validation + state expansion (25+ states) | ~50-100 hrs/quarter | $10K-40K/quarter |

**v1 budget envelope**: ~$25K against ~$12K ARR from Antonio + Discovery Scan revenue. Loss-leading on this is correct — Position Library credibility is the moat. Accelerator capital funds the gap.

---

## Action plan this week

| Day | Action | Owner |
|---|---|---|
| Mon | Talk to Antonio: who in his network could do this work? Ask him for 3 names | David |
| Tue | LinkedIn search + draft outreach for AICPA Tax Section committee members in CA / NY (start with 10) | David |
| Wed | Post on NAEA-internal listserv (Antonio can post on our behalf if non-members can't) + draft a Latino Tax Pro outreach | David / Antonio |
| Thu | Begin 30-min calls with respondents (target: 5-10 candidates spoke to by end of week 2) | David |
| Fri | Shortlist to 2-3 finalist contractors. Run reference checks. | David |
| End-of-week 2 | First contracted advisor signed; first Position Library entry under review | — |

If no qualified candidate surfaces in 2 weeks: re-open with Antonio + ask for warm intros, OR pay a recruiter ($500-2000 fee) at a tax-specialist recruiter (Robert Half Finance + Accounting, Ledgent Finance, Brilliant Financial Search).

---

*Created 2026-05-11. Re-read at any expansion of Position Library scope. Update with contractor names + rates as the pipeline fills.*
