# Discovery Scan — operational spec

> *The high-volume top-of-funnel offer for the 100-by-8/1 push. Free audit-defense scan, 24-hour turnaround, primary CTA on every cold-outreach send.*
> *Locked 2026-05-11. Production target: landing page live 5/25; first Antonio reference scan delivered 6/15.*

This file is the operational + technical spec for shipping the Discovery Scan as both a marketing surface and a real product. The acquisition strategy this feeds lives in [`docs/DESIGN-PARTNER-ACQUISITION-PLAN.md`](DESIGN-PARTNER-ACQUISITION-PLAN.md). The cold-outreach playbook that points prospects here lives in [`docs/pitch-decks/cold-outreach-templates.md`](pitch-decks/cold-outreach-templates.md).

---

## ⭐ What the Discovery Scan IS

> A free, 24-hour-turnaround Position Framework analysis of one redacted return. We surface every defensible deduction the return missed, classified into 4 confidence tiers (Settled / Substantial Authority / Reasonable Basis / MLTN) with the IRC cite + draft 8275 attached on each position. Refuses below Reasonable Basis. Delivered as a branded PDF.

**The mechanism in plain terms**: prospect uploads a redacted return → Discovery agent runs the Position Framework across the return → outputs a Petal-branded PDF with positions surfaced + classified + cited. Prospect gets the PDF. We get a real dollar number for the close.

**Why this is the right top-of-funnel offer**:

1. **Concrete dollar anchor.** "We surfaced $X in additional defensible deductions" is the close anchor. Hormozi-style number that converts even AI-skeptical EAs.
2. **Risk-free to the prospect.** No commitment. No demo required. They keep the PDF whether they sign or not.
3. **The product IS the demo.** A real Discovery Scan PDF is more compelling than a 30-min Zoom walkthrough. The PDF sits in their inbox; they re-read it; they show partners; it pulls itself through the funnel.
4. **Produces compounding artifacts.** Every scan produces an anonymized case study for marketing surfaces (with prospect permission), seeds the Position Library, and validates the Position Framework against real-world returns.

---

## ⭐ What the Discovery Scan is NOT

| Not | Why not |
|---|---|
| A return preparer | We don't prep the return. We don't sign. We classify positions on a return the EA already prepped. |
| A second-opinion service we charge for | Charging here breaks the funnel mechanic. Free + 24h is the whole point. |
| An "AI deduction maximizer" | Per L9 + MARKETING-FRAMES voice rules: never "AI maximizes deductions." Always "catches every defensible deduction your team would have caught with unlimited time + audit trail built in." |
| A full audit defense engagement | The PDF is a Position Framework artifact, not a complete audit-defense file. Audit-defense engagements are paid + scoped. |
| An aggressive-position recommendation | The Refusal Floor below Reasonable Basis is hardcoded. Aggressive positions get refused with a documented reason — that itself is part of the trust-building. |

---

## Landing page — `petal.com/scan`

Single-page conversion surface. Production target: live by 5/25/2026.

### Information architecture (above the fold)

| Slot | Content |
|---|---|
| **Eyebrow** | "FREE DISCOVERY SCAN — first 30 EAs and small firm CPAs" |
| **H1** | Find every defensible deduction your last return missed. Cited authority on each one. |
| **Subhead** | 24-hour turnaround. Real Position Framework run on a redacted return. PDF delivered with IRC cites, 4-tier confidence ratings, and draft 8275s on every Tier 3 position. |
| **Primary CTA** | "Run my scan" → form below |
| **Trust anchor (small, below CTA)** | Antonio Vazquez, EA at Vazant Consulting, runs his ~250 active clients on the same Position Framework. Currently defending two active 2026 IRS audits using Petal as the substrate. |

### Information architecture (below the fold)

**Section 1 — "What you get in the PDF"** (3-column or 3-bullet layout):

1. **Every defensible deduction.** Every position the AI surfaces carries a 4-tier confidence rating (Settled law / Substantial Authority / Reasonable Basis + 8275 / MLTN) with the IRC cite attached at decision time.
2. **The refusal floor.** Positions below Reasonable Basis get refused with a documented reason. We don't surface aggressive territory unsupported. That refusal is part of your audit defense.
3. **Draft 8275 on Tier 3 positions.** Every Reasonable Basis position arrives with the disclosure pre-drafted. That's not a feature — that's the only way the Position Framework can run.

**Section 2 — "How it works"** (numbered, 4 steps):

1. Upload a redacted return (PDF or PDF + workpapers). Strip client name, address, SSN — keep entity type, AGI bucket, schedules, and line items.
2. Petal runs the Position Framework across every line.
3. 24-hour turnaround. You get a Petal-branded PDF.
4. Optional: 20-minute follow-up call to walk through positions, talk through whether the founder rate makes sense for your firm.

**Section 3 — "The math behind the offer"** (per MARKETING-FRAMES.md penalty-anchored pricing):

> The §6695(g) due-diligence penalty is **$650 per failure**, per Rev. Proc. 2025-32. Per failure, not per return.
> The §6694 understatement penalty is **$1,000 to $5,000**.
> An audit defense engagement is **40 to 100 hours** at your realization rate — call it $20K of billable work you're not doing.
>
> Founder rate is $250/mo, locked for life, first 50 firms. One prevented §6695(g) penalty pays for half a year of Petal. One prevented §6694 understatement pays for 18 months. One prevented audit defense pays for 5+ years.

**Section 4 — "Who's behind this"** (founder credibility):

> Petal is built by **David Kim** (CEO) and **Haokun Yang** (CTO, 5+ year partnership pre-Petal). Tax-domain coverage runs through **Antonio Vazquez, EA at Vazant Consulting**, on-platform tax advisor (1% equity, 25 years EA practice, ~250 active clients, two active 2026 IRS audits in progress). Backed by 28 PROD migrations, RLS at ENABLE+FORCE, per-tenant DEK encryption, and a cryptographic audit chain. Compliance-first AI built for the preparer's side of the desk.

**Section 5 — "FAQ"** (collapsed accordions):

> **What if my return has no defensible deductions to surface?**
> Then we tell you that. The PDF is the artifact of running the Position Framework; if the return is already tight, that's the answer. You keep the PDF. We part ways.
>
> **Is my redacted return data secure?**
> Yes. The Discovery Scan runs in our SOC 2 Type II-controlled substrate (RLS + per-tenant DEK + AAD-bound encryption + cryptographic audit chain). After 7 days, the return is deleted. Detailed posture at `docs/security/`.
>
> **What if I don't want to commit to the $250/mo founder rate?**
> You don't have to. The scan is free, the PDF is yours, and there's no obligation. We expect 30-50% of prospects to walk away with just the PDF — that's the deal.
>
> **Can I send multiple returns at once?**
> One per prospect, first time. After signing for the founder tier, you can run scans on every return you prep.
>
> **What states do you cover?**
> Federal first (IRS authority library is the priority). California state coverage is in the seed library. Other states are flagged as out-of-scope in the PDF with a "we don't cover this state's position library yet" note. Honest-about-limits per the Coverage Map.

**Section 6 — CTA repeat** (sticky on scroll):

| Field | Type | Required |
|---|---|---|
| First name | Text | Yes |
| Last name | Text | Yes |
| Firm name | Text | Yes |
| EA / CPA / PTIN designation | Single-select | Yes |
| Firm size | `solo` / `2-5` / `6-10` / `11-20` / `21+` | Yes |
| Tax prep software | Single-select (OLT / Drake / ProConnect / UltraTax / Lacerte / CCH / TaxAct / Other) | Yes |
| Email | Email | Yes |
| Phone | Phone | Optional |
| LinkedIn URL | URL | Optional |
| Return upload | File (PDF, max 25MB, optional this step — we send upload link separately) | Optional |
| "I confirm the upload will be redacted of client PII" | Checkbox | Yes |
| Heard about Petal via | Single-select (Boney-Henderson / cold email / LinkedIn / NAEA event / r/taxpros / Tax Twitter / referral / search / other) | Yes |
| CTA | "Run my scan" | |

After submission: form data writes to `Prospects` table in CRM (per `docs/pitch-decks/cold-outreach-templates.md`); auto-send the onboarding email (below); flag in CRM as `stage = scan-offered`.

### Production stack for the landing page

- **Routing**: new route `apps/client-portal/src/app/scan/page.tsx` (or new marketing site if we extract). Initial deploy: under existing `petal-portal.vercel.app/scan` until brand domain locked.
- **Form submission**: Next.js server action → writes to `prospects` table (new migration) + sends transactional email (Resend or Postmark; free tier sufficient for v0).
- **Upload handling**: presigned R2 URL pattern (already used in client portal); 25MB cap; PDF + image MIME only; AAD bound to `(prospect_id, scan_id, path)` per encryption convention.
- **Styling**: editorial-warm language (Fraunces + DM Sans, cream canvas, forest green primary) per `packages/ui/src/tokens.ts`.
- **Analytics**: Vercel Analytics (free tier) + simple conversion event tracking (`scan_form_submit`, `scan_pdf_delivered`, `scan_demo_booked`, `scan_signed`).
- **Domain**: live at `petal.com/scan` (or whatever brand-domain is locked); 301 from any subdomain variants.

---

## Discovery Scan PDF template structure

The artifact delivered to the prospect. Single PDF, 5-12 pages depending on return complexity. Branded with Petal wordmark, cream + forest green design language. NEVER reads as AI-generated slop.

### Page 1 — Cover

| Slot | Content |
|---|---|
| Wordmark | Petal logo top-left (forest green oklch) |
| Title | "Discovery Scan — [Firm Name]" |
| Subtitle | "Position Framework analysis · [Tax Year]" |
| Date | Generated [date] · Prepared for [First Last, EA/CPA] |
| Tagline (bottom) | "The AI defense layer for tax practices. Every position cited. Every action audit-trailed." |

### Page 2 — Executive summary

Single page. Three callouts:

1. **What we scanned**: [N] returns from [Year]. [Entity type(s)]. AGI bucket [X]-[Y]. Schedules: [list].
2. **What we surfaced**: **$[X] in additional defensible deductions** across **[N] positions**. Breakdown:
   - Tier 1 (Settled law): [N] positions, $[X] surfaced
   - Tier 2 (Substantial Authority): [N] positions, $[X] surfaced
   - Tier 3 (Reasonable Basis + 8275): [N] positions, $[X] surfaced, [N] draft 8275s attached
   - Tier 4 (MLTN): [N] positions, $[X] surfaced (preparer judgment required on each)
3. **What we refused**: [N] positions below Reasonable Basis. The system refused — that's the design.

Bottom of page: "Detailed positions on pages 3-N. Cited authority on every position."

### Page 3 to N — Position details (one position per ~half page)

For each surfaced position, structured block:

```
═══════════════════════════════════════════════════
POSITION #[N] — Tier [1|2|3|4]
═══════════════════════════════════════════════════

DEDUCTION / POSITION:
[Plain-English description]

LINE ITEM:
Form [X] Line [Y], or Schedule [X] Line [Y]

$ IMPACT:
$[X] additional deduction surfaced

CONFIDENCE:
Tier [1|2|3|4] — [Settled law | Substantial Authority | Reasonable Basis | MLTN]

CITED AUTHORITY:
- [IRC §X(y)(z)]
- [Treas. Reg. §X.X-Y]
- [Rev. Rul. YYYY-NN] or [Tax Court case citation]

REASONING:
[2-4 sentences. What pattern triggered this position. What authority supports it.
What conditions must be met for it to apply.]

DRAFT 8275 (if Tier 3):
[Pre-drafted Form 8275 disclosure language, copy-paste-ready]

AUDIT EXPOSURE:
[Notes on what an IRS examiner would likely ask for in defense]

DOCKET REFUSED?
[N/A for surfaced positions; if Tier 4 we may note "Preparer judgment required"]
```

### Page N+1 — Refused positions (transparency artifact)

For each refused position:

```
═══════════════════════════════════════════════════
REFUSED POSITION #[N] — Below Reasonable Basis floor
═══════════════════════════════════════════════════

POSITION CONSIDERED:
[Plain-English description]

WHY REFUSED:
- No Substantial Authority in our knowledge layer
- No Reasonable Basis with 8275 disclosure
- [Specific authority gap identified]

WHAT WE'D NEED TO TAKE THIS POSITION:
[Honest description: "If [authority Z] were applicable, the position
would meet Reasonable Basis. We did not find Z in this fact pattern."]
```

This page is the trust-builder. Showing what the system refuses is more credible than showing what it surfaces. EAs trust a system that refuses where appropriate.

### Last page — Footer + next step

| Slot | Content |
|---|---|
| Audit defense story | "Every position in this scan was generated with the chain-of-authority logged. If any of these returns gets audited, the defense file is one click away. That's the Petal substrate, not a feature." |
| Coverage Map link | "Detailed coverage scope: petal.com/coverage" |
| Founder rate CTA | "Founder rate is $250/mo, locked for life, first 50 firms. [X] of 50 remaining. To lock yours: david@petal.com or 20-min call link." |
| Disclaimer | "This Discovery Scan is a Position Framework artifact, not a complete audit defense file or return preparation service. Positions surfaced require preparer judgment + client facts validation. Petal does not sign returns; the preparer remains responsible for filing. Cited authorities are current as of [date]." |
| Footer | "Petal · david@petal.com · petal.com" |

---

## Onboarding email (auto-sent when form submitted)

> **Subject:** Your Petal Discovery Scan request — upload link inside
>
> Hi [First name],
>
> Thanks for requesting a Discovery Scan for [Firm name]. Quick note on what happens next.
>
> **Step 1 — Upload your redacted return.**
> Secure upload link: [unique link, expires 72h]. PDF or PDF + workpapers, max 25MB.
>
> Before uploading, strip:
> - Client name + address
> - SSNs (you can replace with XXX-XX-XXXX)
> - EINs (replace with XX-XXXXXXX)
> - Bank account numbers
>
> Keep:
> - Entity type
> - AGI / income bucket
> - All schedules, line items, dollar amounts
> - State of residence
> - Any unusual transactions, K-1s, foreign income, depreciation, NOLs
>
> **Step 2 — We run the Position Framework.**
> Once your return is in, we run a full 4-tier analysis. 24-hour turnaround. The result is a Petal-branded PDF with every defensible deduction surfaced + classified + cited.
>
> **Step 3 — You get the PDF.**
> Delivered to this email address. Optional: 20-minute walkthrough call where we go through positions together and talk about whether the $250/mo founder rate makes sense for [Firm name].
>
> No commitment either way. If the scan surfaces real money, we talk. If not, you keep the PDF.
>
> Questions? Just reply to this email.
>
> David Kim
> CEO, Petal
>
> *P.S. The §6695(g) due-diligence penalty is $650 per failure. Petal founder rate is $250/mo. One prevented penalty pays for half a year. The math is the offer.*

---

## Discovery agent — technical spec (for Haokun's queue)

This is the build spec for the Discovery agent itself. Lives in `services/workers/src/agents/discovery-agent.ts` when shipped. Target ship: **6/8/2026** (Week 5 of acquisition plan; Antonio's reference scan needs to land 6/15).

### Inputs

| Input | Type | Source |
|---|---|---|
| `prospect_id` | UUID | `prospects` table (new migration) |
| `scan_id` | UUID | `discovery_scans` table (new migration) |
| `return_pdf` | R2 object key | uploaded via presigned URL |
| `prospect_metadata` | JSON | from landing page form: firm size, tax software, EA/CPA designation |

### Pipeline

```
[1] PDF parse + redaction validation
    ├─ Haiku 4.5 vision: extract structured return data (form, schedule, line items, $ amounts)
    ├─ Validate: SSN/EIN redaction confirmed; client name absent or pattern-stripped
    └─ Output: ReturnGraph { entity_type, schedules[], line_items[], $ buckets[] }

[2] Position discovery loop (Sonnet 4.6 with prompt caching on knowledge bundle)
    ├─ For each line item + schedule combo:
    │   ├─ Search authority library (pgvector + BM25 hybrid) for relevant IRC sections, Treas. Regs, Rev. Ruls., Tax Court cases
    │   ├─ Surface candidate positions (deductions, credits, elections, depreciation, basis)
    │   ├─ Run 4-tier confidence classifier per position
    │   └─ Generate citation + draft 8275 (Tier 3) or refusal reasoning (below RB)
    └─ Output: PositionList[] with tier classifications

[3] Refusal floor enforcement (deterministic rule, NOT LLM-judgment)
    ├─ Drop every position below Reasonable Basis
    ├─ Log refusals to "Refused positions" section of PDF
    └─ Validate no Tier 4 (MLTN) position made it past floor without explicit preparer-judgment-required flag

[4] PDF rendering (use existing PDF tooling: react-pdf or @react-pdf/renderer; align to Petal design tokens)
    ├─ Cover + executive summary + position blocks + refused-positions + footer
    ├─ Apply forest green oklch + Fraunces + DM Sans + cream canvas tokens
    ├─ Generate via background job on Inngest
    └─ Store in R2 with AAD-bound encryption (prospect_id, scan_id, "scan-output.pdf")

[5] Delivery
    ├─ Email PDF to prospect via Resend (subject: "Your Petal Discovery Scan — [Firm Name]")
    ├─ Update CRM: stage = scan-delivered, scan_pdf_url = R2 link
    ├─ Trigger David alert: new scan delivered to [prospect]; total $ surfaced [$X]
    └─ Log audit chain row: action=scan_delivered, agent=discovery-agent, cost=...

[6] Telemetry
    ├─ Cost telemetry tagged with prospect_id + scan_id
    ├─ Model tier breakdown (Haiku tokens, Sonnet tokens, cached vs uncached)
    └─ Latency: PDF parse + position loop + PDF render + email delivery
```

### Per-scan cost budget

Target: **<$0.50 per scan** to keep the unit economics of free-scan-as-funnel viable.

| Phase | Model | Tokens (est.) | Cost (est.) |
|---|---|---|---|
| PDF parse + vision | Haiku 4.5 | 5K in / 1K out, cached system prompt | $0.008 |
| Position discovery loop (10-30 positions per scan) | Sonnet 4.6, 80% cache hit on knowledge bundle | 50K in / 10K out cached + 5K out fresh | $0.21 |
| Refusal floor enforcement | TypeScript rules, no LLM | 0 | $0 |
| PDF rendering | @react-pdf/renderer | 0 | $0 |
| Email delivery (Resend) | API | 0 | $0.0001 |
| **Total per scan** | | | **~$0.22** |

At 10 scans/week × 12 weeks = 120 scans × $0.22 = **$26.40 total budget for the entire acquisition push**. Negligible. The $250-400/mo founder revenue from a single scan-to-signup pays the whole funnel back in week 1.

### Failure modes + guards

| Failure | Guard |
|---|---|
| PDF can't be parsed (corrupt, image-only, encrypted) | Vision retry with Sonnet; if still fail, email prospect "we couldn't parse — please resend as text-PDF or workpapers" |
| PII not redacted (SSN, EIN, name pattern detected) | PII scrubber (32 tests, existing) blocks delivery; auto-email prospect to redact + resend; flag in CRM |
| Position discovery returns 0 positions | This is a real outcome. Tell the prospect: "Your return was already tight. PDF documents what we considered + refused." Compliments retention. |
| Position discovery returns >50 positions | Likely vision misparse or fact pattern explosion. David reviews before delivery. Manual gate at first 30 scans. |
| Scan output >$50K surfaced | David reviews before delivery. Don't auto-deliver outsized claims — verify the position library hit the right authority. |
| Discovery agent timeout / error | Inngest retry (3x); after 3 failures, alert David + auto-email "scan delayed, manual review in progress" to prospect |
| Knowledge layer cache miss (authority not in library) | Position tier downgrades to "preparer judgment required" with explicit note; doesn't refuse, doesn't surface as Tier 1-3 |

### Dependency chain (what has to ship before Discovery agent works)

| Dependency | Status | Owner | ETA |
|---|---|---|---|
| Authority library v0 (50 IRC sections + 30 Treas. Regs + 20 Rev. Ruls. for top-deduction patterns) | Empty (`content/authority/` exists, no content) | Antonio + David | 6/1 |
| Position Library v0 seed (20 positions Antonio-validated) | Empty (Phase 3 work per CLAUDE.md §15) | Antonio + David | 6/1 |
| pgvector authority search + BM25 hybrid retrieval | Schema migrations in flight (`packages/tax-graph` exists; ingestion not started) | Haokun | 5/28 |
| 4-tier classifier prompt + 8275 generation prompt | Paper spec in POSITION-FRAMEWORK.md; needs LLM iteration | Haokun + Antonio | 6/4 |
| PDF rendering (@react-pdf/renderer + design tokens) | Not started | Haokun | 6/8 |
| Discovery agent orchestration (Inngest function + telemetry + audit chain) | Pattern exists (triage-classifier, inbox-drafter); needs new agent file | Haokun | 6/8 |
| Landing page (`/scan` route + form + R2 upload + onboarding email) | Not started | Haokun + David | 5/25 |
| Refusal floor enforcement (deterministic rule) | TypeScript-only; ship in 1 day | Haokun | 6/4 |
| First Antonio reference scan (the headline marketing artifact) | Requires all above to ship | Haokun + David + Antonio | 6/15 |

### Manual gate during first 30 scans

Until we hit 30 successful scans, **David personally reviews every output before delivery**. The gate:

1. Discovery agent generates PDF + queues for delivery
2. Slack/email alert: "Scan [N] ready for review, $[X] surfaced"
3. David reviews positions for: cited-authority accuracy, refusal-floor enforcement working, no obvious mis-classifications
4. David clicks "approve" → email sends
5. After 30 successful reviews with zero corrections needed, auto-delivery kicks in

The manual gate is the trust-building phase for the agent itself. Same way Antonio runs his returns manually before trusting any system.

---

## What's NOT in this spec

| Item | Why deferred |
|---|---|
| Multi-return batch scans (>1 return at a time) | Founder tier signup unlocks unlimited scans; multi-batch is a paid-tier feature. |
| Multi-state position library (beyond CA) | Honest-about-limits per Coverage Map. Out-of-state positions get flagged "we don't cover this state yet" in the PDF. |
| K-1 / partnership tier scans | Multi-entity work is product depth, but pass-through positions can be flagged "preparer judgment required." Full multi-entity scan in v1.5. |
| Year-round monitoring + delta scans | Strategy Agent territory; v1 ships static return analysis only. |
| Spanish + bilingual PDF rendering | Defer; first 100 customers are English-language. |
| Strategy Agent recommendations (multi-year planning) | Different agent. Discovery surfaces what's already missed; Strategy plans future. |
| Self-serve scan re-runs | Founder-tier customers get a different surface (`/scans` route inside command-room). Cold-prospect flow is single-scan only. |

---

## Update discipline

- **After first scan delivered**: review cost vs budget, latency vs target, position-accuracy vs Antonio's eyeball check. Recalibrate.
- **After first 10 scans**: review conversion rate (scan-delivered → demo-booked → close). If <25% scan-to-demo conversion, iterate on PDF design + delivery email.
- **After first 30 scans**: graduate from manual review gate to auto-delivery.
- **After Antonio's reference scan (6/15)**: capture his book's surfaced $ as the headline marketing number for the rest of the acquisition push. This is the proof point that converts the next 70 customers.
- **Weekly Friday review**: cost/scan, latency, $ surfaced distribution, refusal-rate distribution, scan-to-demo conversion. Update in STATE.md.

---

*Created 2026-05-11. Re-read every Friday during the 100-customer sprint. Drift between this spec and reality is the bug it's designed to prevent. Update with actual unit economics after first 10 scans — recalibrate from real data.*
