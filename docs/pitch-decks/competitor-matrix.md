# Competitor matrix — Docket vs TaxDome vs Canopy vs Karbon

> *Sales artifact. Public-facing once `/pricing` ships on the marketing site.*
> *Locked 2026-05-13 after Slant.app benchmarking — Slant's pricing-page matrix vs Wealthbox + Redtail is the structural reference.*
> *Update cadence: every 6 weeks during v1 build, monthly post-launch. When a competitor adds a capability we listed, mark `Limited` with a footnote on the gap.*

This file is the source of truth for the competitor-matrix table that will render on `docket.com/pricing` at v1 launch (per [`PRODUCT-ROADMAP.md` §6 Marketing](../PRODUCT-ROADMAP.md)). Single source — every other surface that quotes the matrix (sales deck slide 5, NAEA chapter dinner handout, cold-outreach Variant C, ea-cpa-sales-deck.md) reads from here.

---

## The matrix

| Capability | Docket | TaxDome | Canopy | Karbon |
|---|---|---|---|---|
| **Position Framework with cited authority (Tier 1-4 + refusal floor)** | ✓ | — | — | — |
| **Discovery agent (continuous deduction surfacing across book)** | ✓ | — | — | — |
| **Audit chain with cryptographic verification** | ✓ | — | — | — |
| **Memories surface (AI-curated, plain-English, per-client)** | ✓ | — | — | — |
| **Nudges agent (life-event + drift + milestone outreach)** | ✓ | — | — | — |
| **Need You workflow primitive (4-lane: New Intakes / Ready to Prep / Ready to File / Sign & File)** | ✓ | Limited¹ | Limited² | — |
| **Reasoning trail on every agent output** | ✓ | — | — | — |
| **OLT browser automation (tax software where competitors won't go)** | ✓ | — | — | — |
| **Cited-authority position library (IRC + Treas Regs + FTB)** | ✓ | — | — | — |
| **Per-active-client pricing (no per-seat penalty for growth)** | ✓ | — | — | — |
| **Pre-filing IRS reconciliation (W&I transcripts vs uploaded docs)** | ✓ (V1.5) | — | — | — |
| **Refund policy display + KBA-compliant 8879 e-sign** | ✓ | Limited³ | Limited⁴ | — |
| **AI Tasks (natural-language workflow authoring)** | ✓ | Rules-based | Rules-based | Rules-based |
| **Audit Defense subscription module** | ✓ | — | — | — |
| **Bilingual portal (Spanish v1.5, Mandarin/Vietnamese/Tagalog v2)** | ✓ (V1.5) | — | — | — |
| **White-label / firm-custom subdomain** | ✓ (V1.5) | ✓ | Limited⁵ | — |
| **Client + meeting + book chat (three-scope Ask Docket)** | ✓ | — | — | — |
| **Project templates (Return Prep / Audit Defense / Notice Response / etc.)** | ✓ | Limited⁶ | Limited⁷ | Limited⁸ |
| **Magic Buttons (chat-bound custom AI workflows)** | ✓ (V1.5) | — | — | — |
| **Workflow Marketplace (community-shared AI workflow templates)** | ✓ (V1.5) | — | — | — |
| **Pre-Meeting Brief Agent (N-hour-ahead client meeting prep)** | ✓ (V1.5) | — | — | — |
| **Notetaker → Tasks chain (transcript → engagement tasks)** | ✓ (V1.5) | — | — | — |
| **Adaptive UI (season-driven layout: peak/extension/off-season/pre-season)** | ✓ (V1.5) | — | — | — |
| **Touchpoint freshness view (cross-channel staleness detection)** | ✓ (V1.5) | — | — | — |
| **Annual review / engagement renewal cycle** | ✓ (V1.5) | Limited⁹ | Limited¹⁰ | — |

### Footnotes (gap detail)

¹ TaxDome has generic pipeline/board views. They don't decompose into the Need You 4-lane workflow primitive (New Intakes / Ready to Prep / Ready to File / Sign & File). Generic pipeline = noun. Need You = verb. Updated 2026-05-13.

² Canopy has stage-based pipeline views. Same generic-pipeline limitation as TaxDome — no operational verb structure that decomposes engagements by what-action-comes-next. Updated 2026-05-13.

³ TaxDome ships 8879 e-sign but uses generic e-sign vendors (HelloSign / DocuSign basic). Does not bundle the LexisNexis KBA add-on that IRS Pub 1345 IAL2 compliance requires. Customer must integrate KBA separately. Updated 2026-05-13.

⁴ Canopy ships 8879 e-sign with their own e-sign integration but no native KBA. Same gap as TaxDome. Customer fills via DocuSign add-on. Updated 2026-05-13.

⁵ Canopy white-label is enterprise-tier ($$$$) and limited to logo + color overrides. No custom CNAME / subdomain for the client portal. Updated 2026-05-13.

⁶ TaxDome has automation templates but they're rules-based ("if X then Y"), not AI-driven project templates with AI steps + cited authority on output. Updated 2026-05-13.

⁷ Canopy automations are rules-based per-engagement. No project-template marketplace with tax-vertical pre-built workflows (Return Prep / Audit Defense / Notice Response / etc.). Updated 2026-05-13.

⁸ Karbon's project workflows are generic-PM-tool style. No tax-vertical project templates with pre-built AI steps. Updated 2026-05-13.

⁹ TaxDome has annual recurring engagement workflows but no AI-driven scope-change negotiation or pre-renewal outreach drafting. Updated 2026-05-13.

¹⁰ Canopy has annual recurring tasks but no Memories + Nudges-driven pre-renewal touchpoints. Updated 2026-05-13.

---

## Why we win (talking points for sales calls)

### vs TaxDome
TaxDome is a document drawer with a portal. It does what it was designed for in 2017. It's not a platform that adapts to the §6695(g) audit lane the IRS opened in 2024. Their AI features are bolted-on practice-management upgrades — they don't carry the Position Framework + cited-authority discipline that an EA's PTIN requires. **One-liner:** "TaxDome stores your work. Docket defends it."

### vs Canopy
Canopy is closer than TaxDome — they ship triage-classification AI and beat us to that surface in 2024. But the AI is shallow: no cited authority, no refusal floor, no audit chain, no Memories surface. They added AI to a practice-management product. We built an AI-native operating system. **One-liner:** "Canopy added AI. Docket is built around it."

### vs Karbon
Karbon is the strongest at email AI among PM incumbents — but Karbon is built for general accounting workflows, not tax-specific PTIN risk. They have no Position Framework, no Discovery agent, no IRS-knowledge-layer integration. They're the right tool for a general-accounting firm; they're the wrong tool for a tax firm. **One-liner:** "Karbon is for accountants. Docket is for tax pros."

### Why all three are structurally weaker
None of the three were architected AI-first. They added AI features to existing practice-management cores between 2023-2025. The retrofit shows: AI sits in a sidebar, not at the substrate. None implement the refusal-floor pattern (refuse below Reasonable Basis), which is the load-bearing compliance discipline for an EA's PTIN. Docket is structurally different.

---

## What we DON'T claim (defensive moves)

Honesty in the matrix protects us when a prospect asks "but TaxDome does X too, right?" — we want to say "yes, here's where they have it, and here's where ours is deeper." Never claim a capability we don't ship.

**Where competitors are stronger today:**

- **TaxDome customer base + brand maturity.** They have 10,000+ firms. We have 1 (Antonio) + waitlist. Their existing-customer comfort beats our newness on the "we're already on TaxDome, why switch" objection. We counter with the migration story + Antonio reference + founder-tier scarcity.
- **Canopy direct IRS integration.** Canopy is in the IRS Transcripts API partner program (we're not — V1.5 path). They have a pull-transcripts-natively capability we don't have until ~Q2/2027.
- **Karbon team-collaboration UX.** Their team views + per-staff load distribution UX is more mature than our Phase 4 plan. Their mid-market firm collaboration story is stronger than ours today.

We acknowledge these. The matrix doesn't lie. The strategic answer to each: substrate differences compound; the items above are temporary advantages they can't sustain because their base architecture isn't AI-first.

---

## Where Docket is `V1.5` rather than `✓`

The matrix marks features as `✓ (V1.5)` when they're paper-spec today but shipping by Dec 2026. Honesty about timeline: prospects appreciate it. The alternative — marking everything `✓` and surprising the prospect at week-3 of onboarding — costs trust + churns.

The `✓ (V1.5)` rows above:
- Pre-filing IRS reconciliation
- Bilingual portal
- White-label custom subdomain
- Magic Buttons
- Workflow Marketplace
- Pre-Meeting Brief Agent
- Notetaker → Tasks chain
- Adaptive UI
- Touchpoint freshness view
- Annual review / engagement renewal cycle

In sales calls: "These ship by December. Founder tier gets every one of them at the $250/mo lock — no upcharge as we add features. Your roadmap is locked in. Standard tier pricing doesn't kick in until year 2."

---

## Update log

| Date | Change | Updated by |
|---|---|---|
| 2026-05-13 | File created. 25 capability rows, footnotes for 10 competitor-Limited cells. Slant.app benchmark applied to structure. | David Kim (canonical pitch + Slant integration C16/C17) |

---

## Pairing with other artifacts

- **Cold outreach Variant C** ("Practice management gap") references this matrix as supporting detail — the "TaxDome and Canopy added AI but it's a feature, not a product" line traces back to the row-by-row gap analysis above.
- **EA / CPA sales deck slide 5** ("Moat") visualizes the top 6 rows.
- **Mid-market firm deck slide 7** ("Why us vs incumbents") visualizes all 25 rows.
- **NAEA / chapter dinner handout** (1-page) includes a condensed 10-row version printed on the back.
- **`/pricing` marketing-site page** (V1 launch 7/30) renders the full matrix interactively, with hover-to-footnote on competitor-Limited cells.

---

*Maintain this file with the same discipline as `docs/COVERAGE-MAP.md`. Re-read every demo, every cold-outreach reply with "what does it cover" questions, every Coverage Map update commit.*
