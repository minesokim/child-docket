# Landing page copy — `docket.com/pricing`

> *The penalty-anchored pricing page. Calculator is the load-bearing widget.*
> *Route: `apps/client-portal/src/app/pricing/page.tsx` (or marketing site). Calculator spec at [`docs/PRICING-PAGE-SPEC.md`](../PRICING-PAGE-SPEC.md).*

Drop-in copy below. Penalty-anchored math + canonical copy in [`docs/MARKETING-FRAMES.md`](../MARKETING-FRAMES.md) §"Penalty-anchored pricing." Tier pricing locked in CLAUDE.md L6.

---

## Page metadata

| Field | Value |
|---|---|
| `<title>` | Pricing — Docket |
| `meta description` | $250/mo founder rate, locked for life, first 50 firms. Less than half of one $650 §6695(g) penalty. See the cost-of-not-using math. |
| `og:image` | Pricing tier table + calculator screenshot |
| `canonical` | `https://docket.com/pricing` |

---

## Above the fold

```
[eyebrow]
THE PRICING

[H1, Fraunces 56-72px]
The pricing is the positioning.

[subhead, DM Sans 18-22px, max 3 lines]
We priced the founder tier at $250/mo. Less than half of one $650 IRS
due-diligence penalty under §6695(g). One prevented penalty pays for
half a year. The math is the offer.

[two CTAs, side-by-side]
[primary] → Run a Discovery Scan first
[secondary] → Jump to the calculator ↓
```

---

## Section 1 — The penalty math (locked from MARKETING-FRAMES.md)

```
[eyebrow]
THE PENALTY MATH

[H2, Fraunces 40-48px]
The numbers IRS examiners actually assess.

[stacked penalty cards, ordered by ascending dollar amount]

[card 1] §6695(g) DUE-DILIGENCE PENALTY
Per failure, not per return.
$650 per failure for 2026 returns ($635 for 2025).
A return with EITC + CTC + AOTC + HOH is four checklists. Miss all four
on one client: $2,600 from one return.
Source: IRS Rev. Proc. 2025-32

[card 2] §6694(a) UNREASONABLE POSITION
$1,000 OR 50% of fees (whichever is greater).
Triggered by a position without Substantial Authority + no disclosure.

[card 3] §6694(b) WILLFUL / RECKLESS
$5,000 OR 75% of fees (whichever is greater).
Triggered by reckless or intentional disregard of rules.

[card 4] §6695(a)-(e) PROCEDURAL
$60-$650 each.
Failure to sign return, furnish copy to taxpayer, retain copies, EIN, etc.

[card 5] §6701 AIDING UNDERSTATEMENT
$1,000 individual / $10,000 corporate.
"Knew or should have known."

[card 6] AUDIT DEFENSE ENGAGEMENT (real cost)
40-100 hours at $300-500/hr = $12K-$50K.
When the IRS opens an exam, every billable hour you spend on defense
is one you are not billing client work.

[card 7] PTIN SUSPENSION
Career-ending.
Pattern of preparer misconduct triggers IRS suspension.

[footnote citation]
Sources: IRS Rev. Proc. 2025-32 (2026 inflation adjustments) ·
IRC §6694 + §6695 + §6701 · Treas. Reg. §1.6694-1 et seq.
```

---

## Section 2 — The calculator (interactive widget)

```
[eyebrow]
INTERACTIVE

[H2, Fraunces 40-48px]
What is it costing you NOT to use Docket?

[subhead, DM Sans 16px]
Plug in your numbers. The calculator does the rest. No email gate, no signup.

[layout: input column 40% / output column 60%, side-by-side on desktop, stacked on mobile]

[input panel — title]
YOUR FIRM, IN NUMBERS

[inputs — labels + tooltips]

CLIENTS PREPPED LAST SEASON
[number input, default 200]
ⓘ Total returns you signed last tax year. Solo EAs typically 100-300;
2-10 preparer firms 300-1,500.

% OF CLIENTS WITH EITC / CTC / AOTC
[slider 0-100, default 25%]
ⓘ Each due-diligence credit on a return adds a §6695(g) checklist.
EAs serving Spanish-speaking + Latino-business clients often run 30-50%.

YOUR HOURLY REALIZATION RATE
[number input, default 250, prefix $]
ⓘ Average $ per billable hour at your firm. Default $250/hr. Mid-market
firms often $200-400/hr. Senior partners $400-600/hr.

CURRENT TAX PREP SOFTWARE
[select] OLT / Drake / ProConnect / UltraTax / Lacerte / CCH / TaxAct / Other
ⓘ Used to estimate browser-automation integration vs API path.
Affects implementation friction, not annual cost.

HAVE YOU HAD AN AUDIT IN THE LAST 3 YEARS?
[radio] Yes — currently active / Yes — closed / No
ⓘ Active or recent audit exposure increases the projected savings from
Docket's audit defense substrate.

DO YOU CARRY MALPRACTICE / E&O INSURANCE?
[radio] Yes / No / Not sure
ⓘ Premium-discount conversation if yes. Some carriers reduce premium
for SOC 2 Type II posture + audit chain in production.

[CTA inline]
→ Calculate my number

[output panel — title]
YOUR ANNUAL COST OF NOT USING DOCKET

[result, large type, oversized, Fraunces 56-72px]
$24,387

[result breakdown, DM Sans 16px stacked]

EXPECTED §6695(g) PENALTY EXPOSURE (this year)
50 clients × 4 checklists × 1.5% miss rate × $650 = $1,950
ⓘ Industry baseline miss rate: 1-2% per checklist without continuous
Position Framework. Docket drives this to ~0.

EXPECTED §6694 EXPOSURE
2 positions × $1,500 avg = $3,000
ⓘ Practices serving small-business clients average 1-3 §6694-exposed
positions per year without a refusal floor.

EXPECTED AUDIT DEFENSE TIME (annualized)
60 hours × $250/hr = $15,000
ⓘ Audit defense engagements run 40-100 hours. Even if you only have
one audit every 3 years, the annualized cost is real.

DOC-CHASE + CLIENT-CHATGPT TIME LOSS
15 hrs/mo × 12 × $250 × 22% load = $9,900
ⓘ Time spent on document chasing + arguing with ChatGPT-armed clients,
calibrated against your realization rate.

ESTIMATED MALPRACTICE PREMIUM DELTA
-$1,500
ⓘ Some carriers reduce premium for SOC 2 + audit chain. Estimate only;
ask your carrier.

[net result block, forest-green border + cream fill]
ANNUAL COST OF NOT USING DOCKET: $24,387 - $1,500 = $22,887

DOCKET FOUNDER TIER ANNUAL COST: $3,000 ($250/mo × 12)

ROI MULTIPLE: 7.6×

[CTA, oversized, forest green]
→ Lock my founder slot
[Routes to /sign-up with prefill from calculator state]

[microcopy below CTA]
Founder rate $250/mo locked for life. First 50 firms only. [X] of 50 remaining.
```

---

## Section 3 — Founder tier scarcity

```
[eyebrow]
FOUNDER TIER

[H2, Fraunces 40-48px]
Three pricing windows. The math gets worse the longer you wait.

[3-column tier card layout]

[col 1, forest-green border, "RECOMMENDED" label]
FOUNDER TIER — $250/mo
First 50 firms only. Locked for life.
✓ All agents included (no add-on fees)
✓ Unlimited active clients (no metering)
✓ Position Library access (Antonio-validated)
✓ Audit defense workspace
✓ All Path 2 API access (Partner tier privileges)
✓ Priority support direct from David
[X] of 50 slots remaining
→ Lock my slot

[col 2]
FOUNDER v2 — $350/mo
Firms 51-75. Locked for life.
✓ Same as Founder tier
30% off Solo standard ($499)

[col 3]
FOUNDER v3 — $400/mo
Firms 76-100. Locked for life.
✓ Same as Founder tier
20% off Solo standard ($499)

[footnote]
After firm 100: standard tier pricing (Solo $499, Small $1,499, Growing
$4,499, Mid-market $14,999) with active-client metering kicks in.
```

---

## Section 4 — Standard tier table (post-founder)

```
[eyebrow]
STANDARD TIERS (POST-FOUNDER COHORT)

[H2, Fraunces 36-44px]
For firms joining after the founder window closes.

[table, DM Sans 14-16px]

TIER         BASE      INCLUDED CLIENTS  PER ACTIVE CLIENT  CAP
Solo         $499/mo   50                +$5                $749/mo
Small        $1,499/mo 150               +$5                $1,999/mo
Growing      $4,499/mo 500               +$4                $5,499/mo
Mid-market   $14,999/mo 2,000            +$3                $23,999/mo

[add-on agents — Solo + Small only, optional]
Discovery $199/mo · Strategy/Planning $299/mo · Audit Defense $99/mo · Multi-Entity Optimization $199/mo

[per-event pricing]
Notice response $50 · Representation engagement $99 · Incorporation $25 + state · BOI $15 · SOI $10

[footnote]
Active client = client with at least one activity in the rolling 90-day window
(message sent, document uploaded, return prepped, notice handled). No
per-seat fees ever. No per-return fees ever. Per-active-client metering
aligns cost with value; per-seat punishes growth.
```

---

## Section 5 — Path 2 API tier (the orchestration play)

```
[eyebrow]
PATH 2 — API + MCP SERVER

[H2, Fraunces 36-44px]
For AI tax tools building on top of Docket's compliance substrate.

[3-column tier card]

DEVELOPER — FREE
1K API calls/mo
MCP server access (read)
Documentation + support forum

PARTNER — $999/mo
1M API calls/mo
+$0.001 overage per call
MCP server access (read + write)
Position Framework as a service
Audit chain as a service
Direct partner-tier support

PLATFORM — CUSTOM
Volume discounts
SLA contracts
White-label option
Custom Position Library partitions

[CTA, secondary]
→ Email david@docket.com for partner intro
```

---

## Section 6 — FAQ

```
[eyebrow]
PRICING FAQ

[H2]
The questions buyers ask before they swipe.

[accordion list]

Q. Is the $250/mo founder rate locked forever?
A. Yes. Locked for life. As long as you remain a Docket customer in good
standing, the rate does not increase. Even when standard tiers go up,
your rate is anchored.

Q. What if I cancel and come back later?
A. The founder rate is non-transferable and non-resumable. If you cancel,
you re-enter at standard tier pricing.

Q. Does the founder tier include all add-on agents?
A. Yes. All Discovery, Strategy/Planning, Audit Defense, and Multi-Entity
Optimization agents are included at no additional cost. Standard-tier
buyers pay $99-$299/mo per agent.

Q. What about per-event pricing (notices, rep engagements, etc)?
A. Founder-tier customers get unlimited notice responses, representation
engagements, incorporations, BOI, SOI — no per-event fees. Standard-tier
buyers pay $10-$99 per event.

Q. How does active-client metering work?
A. Active = at least one activity in the rolling 90-day window. Inactive
clients do not count toward your metered usage. Founder tier has no
metering — unlimited active clients.

Q. Can I downgrade to a lower tier later?
A. Yes, but founder rate does not transfer. If you start at founder $250
and downgrade after 50 customer slots are full, you go to Solo standard
$499 (not $250 or $350).

Q. What if I am at the active-client cap on Solo tier?
A. You either pay the per-active-client overage ($5/active beyond 50,
capped at $749/mo) or upgrade to Small tier ($1,499/mo, 150 included).

Q. Is the price tax-deductible?
A. Yes. Docket is software-as-a-service for tax preparation. Ordinary +
necessary business expense per IRC §162.

Q. What happens if you raise prices later?
A. Founder rate is locked. Standard tier price changes apply to new
customers + existing standard-tier customers on the next renewal.

Q. Do you offer annual prepay discount?
A. Yes — 10% off annual prepay on all standard tiers. Founder tier
already underpriced; no additional annual discount.
```

---

## Section 7 — Final CTA

```
[H2, Fraunces 44-56px, max 2 lines]
You read the math. The math is the offer.

[body, DM Sans 18-20px]
$250/mo. Locked for life. First 50 firms. [X] of 50 remaining.

[primary CTA, oversized, forest green]
→ Lock my founder slot

[secondary CTA]
→ Run a Discovery Scan first (free, 24h turnaround)
```

---

## Implementation notes for Haokun

| Element | Production note |
|---|---|
| Calculator widget | Client-side React component. Inputs persist to URL query params (`?clients=200&eitc=25&rate=250`) so prospects can share their result. |
| Calculator math | Pull formulas from [`docs/PRICING-PAGE-SPEC.md`](../PRICING-PAGE-SPEC.md) §"Math + formulas" — single source of truth. |
| Result share | "Share my result" button generates a tweet-prefilled CTA with the dollar number. Optional. |
| Founder slot counter | Live count, pulled from `prospects` table (`stage = closed-won AND tier_offered = founder-250 AND closed_won_date IS NOT NULL`). Refresh every 5 min. Cache 60s. |
| Sign-up route | `/sign-up` is a new route — needs Clerk integration + tenant creation flow. v0: redirect to `mailto:david@docket.com?subject=Founder%20tier%20signup&body=...` and David does manual onboarding for first 30 closes. |
| Calculator analytics | Track every calculator field change as an analytics event. Plot conversion from calculator-engagement to sign-up CTA click. |
| Mobile responsive | Calculator inputs stack to single column under 768px. Result panel slides up from below inputs. |
| Performance budget | Calculator is JS-heavy; lazy-load below the fold. LCP target still < 1.5s. |
| Accessibility | All inputs labelled + aria-describedby for tooltips. Result panel updates announced via aria-live="polite". |

---

*Created 2026-05-11. Voice-pass with David before production deploy. Update tier pricing if L6 lock changes. Update calculator formulas if penalty-math source documents update.*
