# Coverage Map — what Docket covers, what's coming, what we don't

> *Published transparent compliance scope. The honest-by-design positioning move.*
> *Lives at `docket.com/coverage` post-launch (URL TBD). Until then, this file is the canonical reference for marketing claims, sales-call commitments, and the ToS coverage-scope clause.*
>
> *Locked 2026-05-11.*

---

## Why this page exists

Every other AI tax tool markets "find every deduction" or "covers all compliance" without ever telling buyers what their AI catches and what it doesn't. That works for them because their buyers are Big-4 firms with in-house tax counsel handling the compliance line. **At Antonio's segment — solo EAs and small-firm CPAs whose PTIN is on every return — that's an unbuyable claim. The first time the tool misses something, the marketing line becomes a lawsuit exhibit.**

Docket flips it. We publish what we cover with surgical specificity, with status indicators, with cited authority. The buyer sees:

1. What's **live** today (concrete, citable, contractually bound).
2. What's **pending** (with dates).
3. What's **out of scope** (and that we know it).

This page IS the liability boundary. Marketing copy that exceeds what's here doesn't get to ship. Sales calls that promise beyond what's here don't get to close. ToS references this page as the bounded scope of the product.

**This is the category-defining move.** No tax software has ever published its coverage this transparently. It's harder to ship and easier to trust.

---

## The 4-tier classification

Every compliance surface in this document is classified into one of four tiers. The tier determines the *kind* of promise we can make.

| Tier | What it is | Coverage promise | % of rule surface |
|---|---|---|---|
| **1 — Algorithmic** | Deterministic check; system definitively can / cannot pass | **100% within scope.** Every algorithmic check, every time. | ~30-40% |
| **2 — Pattern recognition** | Cross-document, cross-client, year-over-year detection | **Industry-best, transparent.** Patterns your team would catch with unlimited time. | ~30-40% |
| **3 — Judgment-required** | Cannot be algorithmically resolved; professional discretion | **Cited support, you decide.** Position Framework gives the IRC + Treas Reg + controlling case; preparer decides. | ~15-20% |
| **4 — External knowledge** | Data Docket doesn't have visibility into | **Structured surfacing, honest about limits.** Intake structure surfaces what we can ask. The rest is undisclosed-by-client territory. | ~10-15% |

A given compliance area frequently has work distributed across all four tiers. For example, "§170 charitable substantiation" has Tier 1 algorithmic checks ($500 threshold triggers Form 8283; $5,000 threshold requires qualified appraisal), Tier 2 pattern checks (non-cash gift mentioned in intake but no 8283 detected), Tier 3 judgment (is this a qualified appraiser?), and Tier 4 external (did the client receive a contemporaneous written acknowledgment we don't have a copy of?).

---

## The 5-layer Minimum-Viable Shield

These five layers cover **~95% of preparer penalty exposure** and **~85% of common audit triggers** that Antonio's segment actually faces. Building all five and shipping them in production is the goal. Phasing in order of leverage.

| Layer | Promise | Tier | Status | Build effort |
|---|---|---|---|---|
| **L1 — Due-diligence machinery** (§6695(g)) | 100% coverage of EITC/CTC/AOTC/HOH due-diligence checklists | Tier 1 | 🚧 v1 (target 5/30) | 2-3 weeks, no advisor dependency |
| **L2 — Position Framework (top 20)** | The 20 most-contested positions with cited authority + tier classification + 8275 trigger | Tier 1 + Tier 3 | 🚧 v1 ramp (Antonio sign-off per position) | 4-6 months with Antonio's review pipeline |
| **L3 — Procedural compliance** (§6695(a)-(e)) | Signature, PTIN, copy retention, identifying numbers, §7216 consent | Tier 1 | 🚧 v1 | 2-3 weeks |
| **L4 — Anomaly detection** (top 12 patterns) | Cross-document + cross-client + YoY anomaly surfacing | Tier 2 | ⏳ v1.5 | 4-6 weeks (depends on L2 live) |
| **L5 — Audit defense workspace** | Contemporaneous workpaper + retention archive + notice triage | Tier 1 + Tier 3 | 🟡 partial (already substrate-shipped per CLAUDE.md §15 Phase 5) | 4 weeks completion |

Total v1: L1 + L3 + L5 = covers ~60-70% of preparer penalty exposure.
Total v1.5: + L2 + L4 = covers ~95% of preparer penalty exposure.

---

## The 20-position Position Library (L2 — Tier 1 + Tier 3)

These are the 20 positions that account for the **majority of §6694 exposure** for Antonio's segment. Each one ships with: confidence-tier classification (Settled / Substantial Authority / Reasonable Basis with 8275 / More Likely Than Not), cited primary authority (IRC + Treas Reg + Rev Proc + controlling case where applicable), 8275 trigger detection, and auto-draft disclosure language. **Every position reviewed + signed off by Antonio before going live; contracted backup advisors handle scale-validation when Antonio's bandwidth is constrained.**

| # | Position | IRC § | Why it's on the list |
|---|---|---|---|
| 1 | §199A QBI computation + SSTB classification | 199A | New (post-TCJA), complex, frequently disputed |
| 2 | Reasonable compensation (S-corp owners) | 1366, 162 | Common §6694 trigger |
| 3 | Hobby vs business activity | 183, 162 | Common Schedule C audit trigger |
| 4 | §469 passive activity | 469 | Real estate professional disputes |
| 5 | Real estate professional hours qualification | 469(c)(7) | Hours-documentation disputes |
| 6 | §170 charitable substantiation | 170(f) | Appraisal requirements, contemporaneous acknowledgment |
| 7 | §1031 like-kind exchange | 1031 | Real property only post-TCJA |
| 8 | §121 home sale exclusion | 121 | Ownership/use test edge cases |
| 9 | §274 meals and entertainment | 274 | Substantiation requirements |
| 10 | §280A home office deduction | 280A | Exclusive use test |
| 11 | §168(k) bonus depreciation | 168(k) | Phase-down schedule, qualified property |
| 12 | §179 expensing | 179 | Income limits, recapture |
| 13 | §1245 / §1250 depreciation recapture | 1245, 1250 | Sale-of-business-asset edge cases |
| 14 | §163(j) interest limitation | 163(j) | Small business exception |
| 15 | §61 constructive receipt | 61 | Timing disputes |
| 16 | §164(b) SALT cap / PTET election | 164(b) | State PTET election mechanics |
| 17 | §219 / §408 IRA deductibility | 219, 408 | Income phase-outs |
| 18 | §72(t) early distribution exceptions | 72(t) | Exception qualifications |
| 19 | §223 HSA contributions | 223 | Contribution limits |
| 20 | §6662 substantial understatement threshold | 6662 | Accuracy-related penalty threshold |

---

## Coverage by surface (the published matrix)

This is the matrix that ships at `docket.com/coverage` as a live page. Status indicators: ✅ Live · 🚧 In build · ⏳ Pending · ❌ Out of scope.

### Federal preparer penalties

| Penalty surface | Coverage | Status | Notes |
|---|---|---|---|
| §6695(g) due diligence (EITC/CTC/AOTC/HOH 8867) | Tier 1 | 🚧 v1 (5/30) | $650/failure × up to 4 = $2,600/return; the #1 IRS preparer-enforcement lever |
| §6694(a) unreasonable position | Tier 1 + Tier 3 | 🚧 v1 ramp (with Position Library L2) | Position classification + 8275 trigger |
| §6694(b) willful / reckless | Tier 3 (judgment-only) | ⏳ v1.5 | Pattern detection; advisor review required |
| §6695(a) failure to sign return | Tier 1 | 🚧 v1 | Mechanical check |
| §6695(b) failure to furnish identifying number | Tier 1 | 🚧 v1 | Mechanical check |
| §6695(c) failure to retain copy | Tier 1 | 🚧 v1 | Audit-chain retention; already substrate-shipped |
| §6695(d) failure to file correct information returns | Tier 1 | ⏳ v1.5 | Information-return integration |
| §6695(e) failure to disclose info return correctly | Tier 1 | ⏳ v1.5 | Same as above |
| §6701 aiding understatement | Tier 3 | ⏳ v1.5 | Pattern-based; advisor review |
| §6713 disclosure of taxpayer information | Tier 1 | 🚧 v1 | §7216 consent management |

### Federal forms

| Form | Coverage | Status |
|---|---|---|
| Form 1040 + Schedules A, B, C, D, E | Tier 1 completeness + Tier 2 anomaly | 🚧 v1 |
| Form 1040 Schedule SE | Tier 1 + Tier 2 | 🚧 v1 |
| 1099 series (NEC, MISC, INT, DIV, B, R, K) | Tier 1 completeness + Tier 4 missing-doc surfacing | 🚧 v1 |
| Form 1120-S (S-corp) | Tier 1 completeness | 🚧 v1 |
| Form 1065 (Partnership) | Tier 1 completeness | 🚧 v1 |
| Form 1120 (C-corp) | Tier 1 completeness | ⏳ v1.5 |
| Form 1041 (Trust / Estate) | Tier 1 completeness | ⏳ v1.5 |
| Form 990 / 990-EZ / 990-N (Exempt) | Tier 1 completeness | ⏳ v2 |
| Form 706 / 709 (Estate / Gift) | Tier 3 (judgment-led) | ⏳ v2 |
| FBAR / FinCEN 114 | Tier 4 (intake-disclosed) | 🚧 v1 |
| Form 8938 FATCA | Tier 4 (intake-disclosed) | 🚧 v1 |

### California state (the v1 state)

| Surface | Coverage | Status |
|---|---|---|
| FTB residency determination | Tier 3 (judgment-led; cited authority from 300+ page FTB Residency Manual) | 🚧 v1 ramp |
| FTB PTET election | Tier 1 mechanical + Tier 3 judgment | 🚧 v1 |
| CA LLC franchise tax | Tier 1 | 🚧 v1 |
| CA SOI (Statement of Information) | Tier 1 deadline-driven | 🚧 v1 |
| CDTFA sales tax | Tier 1 + Tier 2 (online-seller Wayfair rules) | ⏳ v1.5 |
| EDD AB5 worker classification | Tier 3 | ⏳ v1.5 |
| FTB suspended entity status | Tier 4 (external lookup) | ⏳ v1.5 |

### Other states (v1.5 sequence per Dr. Boney-Henderson network footprint)

| State | Coverage | Status |
|---|---|---|
| Texas | Tier 1 federal pass-through; no state income tax | ⏳ v1.5 |
| New York | Tier 1 + state PTET | ⏳ v1.5 |
| Florida | Tier 1 federal pass-through; no state income tax | ⏳ v1.5 |
| Illinois | Tier 1 + state PTET | ⏳ v2 |
| Pennsylvania | Tier 1 + local taxes | ⏳ v2 |
| 25+ additional states | Tier 1 deadline + filing-status calendar | ⏳ v2 |

### Audit defense surface

| Surface | Coverage | Status |
|---|---|---|
| Contemporaneous workpaper per position | Tier 1 (auto-generated as side effect) | 🚧 v1 |
| Completion timestamp + checklist retention | Tier 1 | 🚧 v1 (substrate already shipped) |
| Archived client communications (Universal Client Memory) | Tier 1 | ✅ Live |
| Notice triage (CP2000, CP504, LT11) | Tier 3 (judgment-led; cited authority on response) | 🚧 v1 ramp |
| Audit response draft | Tier 3 | ⏳ v1.5 |
| Form 2848 / 8821 filing via Tax Pro Account browser automation | Tier 1 + Tier 3 | ⏳ v1.5 (per CLAUDE.md §15 Phase 5 descope) |

### Pattern recognition (L4 — Tier 2)

Top 12 anomaly checks that ship in v1.5:

1. 1099-K reported but no Schedule C started
2. W-2 + Schedule C from same employer (§3509 misclassification risk)
3. YoY income delta >50% (verification trigger)
4. ERC claim pattern flags
5. Missing 1099-NEC for known contractors (cross-doc)
6. Foreign accounts aggregate >$10K (FBAR trigger)
7. Cryptocurrency transactions without Form 8949
8. §170 non-cash >$500 without Form 8283
9. §170 non-cash >$5,000 without qualified appraisal
10. S-corp $0 W-2 wages (reasonable comp flag)
11. Schedule C losses >3 of 5 years (hobby loss flag)
12. Real estate Schedule E with full passive losses claimed (§469 flag)

### Outside scope (the honest disclosure)

| Surface | Why out of scope |
|---|---|
| International tax (CFCs, GILTI, Subpart F, foreign trust reporting) | Specialist depth; mid-market not in v1; v2 if buyer demand surfaces |
| Estate tax planning + Form 706 | Complex judgment-led; specialist work; v2 |
| Partnership §704(b) capital account maintenance | Specialist work; v2 |
| Cannabis-specific (§280E) | Industry specialization; v2 |
| Non-profit Form 990-PF (private foundation) | Specialist work; v2 |
| Bankruptcy tax (§1398) | Edge case |
| Generation-skipping transfer (GST) tax | Specialist work; v2 |
| Specific state income tax for: AK, NV, NH, SD, TN, WA, WY | No state income tax in these states |
| Foreign client representation (non-resident alien returns Form 1040-NR) | Out of scope for v1 |
| Cryptocurrency mining + staking tax treatment beyond standard reporting | Specialist work; v1.5 if buyer demand surfaces |
| Crypto NFT-specific tax treatment | Same |
| Web3 / DAO governance taxation | Same |
| Quarterly estimated tax safe harbor optimization (advanced multi-state) | Tier 3 judgment; advisor required; v1.5 |
| State sales-tax nexus determination for multi-state online sellers | Tier 3; v1.5 |
| State PTET elections beyond CA + NY | v2 sequence |

**What we explicitly will not promise**:
- "Catches every compliance failure" — false on its face; no system does this.
- "Replaces your professional judgment" — false; that's L9 character lock.
- "Eliminates audit risk" — reduces, doesn't eliminate.
- "Files your returns autonomously" — refused by trust gate per L1 + CLAUDE.md §8.

---

## Marketing language bounded by this page

Per the ToS coverage clause (to be drafted), every external claim about Docket's compliance coverage references this page as the bounded scope. The default footer for marketing surfaces:

> *Docket supports professional tax preparation. It does not replace your professional responsibility. Coverage updated continuously at [docket.com/coverage](#).*

And the default sales-call closer disclaimer:

> *"I want to be clear: Docket covers the 50 things the IRS actually penalizes preparers for. There are 50,000 tax rules in this country. Anyone who tells you their AI catches all of them is selling you a lawsuit exhibit. We tell you exactly what we cover."*

That last line is the strongest single piece of sales positioning in the toolkit. It positions every other AI tax tool as making the irresponsible promise and Docket as the only one mature enough to be honest about scope.

---

## Update discipline

- Every new compliance surface shipped → row added here with status updated to ✅ Live.
- Every Position Library entry signed off by Antonio → corresponding row in §"20-position" gets advisor-name + sign-off date.
- Quarterly review: founder + Antonio walk this page, confirm every Live row is still passing, push v1.5 surfaces forward.
- ToS coverage clause references this URL; ToS update lags this file by no more than 30 days.

---

*Created 2026-05-11. Re-read before any external coverage claim. Drift between this page and external copy is the bug it's designed to prevent. Locks the liability boundary AND the trust-building artifact in a single document.*
