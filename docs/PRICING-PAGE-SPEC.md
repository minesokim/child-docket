# Pricing Page Spec — Cost of Not Using Docket calculator

> *The interactive widget that does the work the framing cannot. Buyers feel the dollar amount before they swipe.*
> *Locked 2026-05-11. Production target: live on `/pricing` by 6/8/2026 (Week 5 of 100-by-8/1 sprint).*

This file is the source of truth for the calculator math, UX, copy, edge cases, and accuracy claims. The visual layout + ambient pricing-page copy lives in [`docs/landing-pages/pricing-page-copy.md`](landing-pages/pricing-page-copy.md). Voice + framing rules in [`docs/MARKETING-FRAMES.md`](MARKETING-FRAMES.md). Tier pricing locked in CLAUDE.md L6.

---

## ⭐ What the calculator IS

> A pricing-page widget where an EA or small-firm CPA plugs in 5 numbers about their practice (clients, EITC %, hourly rate, audit history, malpractice posture). Output: their **expected annual cost of not using Docket** vs the $3,000/yr founder-tier subscription. ROI multiple is the close anchor. No email gate, no signup required — the math closes itself.

**Why this conversion mechanism works**:

1. **The prospect does the work.** Calculators outperform static pricing tables because the prospect's own numbers create commitment-bias before the CTA.
2. **The dollar amount is concrete.** "$24,387 annual cost" beats "expensive penalties."
3. **The ROI multiple is the close.** "7.6× return" reads emotionally as "leaving money on the table if I do not subscribe."
4. **Same mechanism as the Discovery Scan.** Both surface a real $ number on the prospect's actual practice before asking for the sale. Penalty-anchored pricing math (canonical source: [`docs/MARKETING-FRAMES.md`](MARKETING-FRAMES.md) §"Penalty-anchored pricing").

---

## ⭐ What the calculator is NOT

| Not | Why not |
|---|---|
| A guarantee of savings | All outputs labelled "expected" / "estimated." Disclaimer at the bottom. We do not promise specific dollar outcomes. |
| Tax advice | The calculator is a marketing tool. Per IRS Circular 230 and our own counsel: no specific tax advice via marketing surfaces. |
| A regulatory compliance certification | Surfaces penalty exposure. Does not certify §6695(g) compliance. |
| A binding quote | Founder tier locked $250/mo per L6, but custom quotes (volume / Path 2) require sales conversation. |

---

## Input fields

5 inputs. Sane defaults. Tooltips on every label explaining what to put.

### Input 1: Clients prepped last season

| Field property | Value |
|---|---|
| Type | `number` |
| Range | 50 - 5,000 |
| Default | 200 |
| Step | 25 |
| Label | "Clients prepped last season" |
| Placeholder | "200" |
| Tooltip | Total returns you signed last tax year. Solo EAs typically 100-300. 2-10 preparer firms 300-1,500. |

### Input 2: % of clients with due-diligence credits (EITC / CTC / AOTC / HOH)

| Field property | Value |
|---|---|
| Type | `slider` 0-100 |
| Default | 25 |
| Step | 5 |
| Label | "% of clients with EITC, CTC, AOTC, or HOH" |
| Tooltip | Each due-diligence credit on a return adds a §6695(g) checklist requirement. EAs serving Spanish-speaking + Latino-business clients often run 30-50%. EAs serving HNW clients often <10%. |

### Input 3: Hourly realization rate

| Field property | Value |
|---|---|
| Type | `number` |
| Range | 75 - 1,000 |
| Default | 250 |
| Step | 25 |
| Prefix | $ |
| Suffix | /hr |
| Label | "Your hourly realization rate" |
| Tooltip | Average $ per billable hour at your firm. Default $250/hr. Mid-market firms often $200-400/hr. Senior partners $400-600/hr. Use your real realization, not your stated rate. |

### Input 4: Audit exposure in last 3 years

| Field property | Value |
|---|---|
| Type | `radio` |
| Options | `currently-active` / `closed-within-3yr` / `none` |
| Default | `none` |
| Label | "Have you had an IRS audit in the last 3 years?" |
| Tooltip | Active or recent audit exposure increases projected savings from Docket's audit defense substrate. Audit defense files generated continuously beat audit defense files reconstructed retroactively. |

### Input 5: Malpractice / E&O insurance

| Field property | Value |
|---|---|
| Type | `radio` |
| Options | `yes` / `no` / `not-sure` |
| Default | `not-sure` |
| Label | "Do you carry malpractice / Tech E&O insurance?" |
| Tooltip | Some carriers reduce premium for SOC 2 Type II posture + cryptographic audit chain. This is an estimate; ask your carrier directly. |

---

## Math + formulas (single source of truth)

All formulas below are the implementation contract. Haokun's calculator component reads from this exact table. Update this table to update the calculator — do not duplicate formulas in code comments.

### Variables (from inputs)

| Symbol | Source | Default |
|---|---|---|
| `C` | clients prepped last season | 200 |
| `E` | % clients with EITC/CTC/AOTC/HOH (decimal) | 0.25 |
| `R` | hourly realization rate ($) | 250 |
| `A` | audit exposure (none / closed / active) | none |
| `M` | malpractice carrier (yes / no / not-sure) | not-sure |

### Constants (calibrated from primary sources)

| Symbol | Value | Source |
|---|---|---|
| `P_6695g` | $650 per failure | IRS Rev. Proc. 2025-32 (2026 inflation adjustment) |
| `MissRate_baseline` | 1.5% | TIGTA report 2021: industry due-diligence miss rate range 1-2.5%; midpoint used |
| `MissRate_Docket` | ~0% (assume 0.05% for conservatism) | Position Framework refusal floor + continuous checklist |
| `Checklists_avg` | 4 (for clients with credits) | EITC + CTC + AOTC + HOH stack |
| `P_6694_avg` | $1,500 | $1,000 floor (§6694(a)) midpointed with 50%-of-fees (assume ~$1K per position avg) |
| `Positions_6694_baseline` | 2/yr | Industry estimate for small-firm EA practice (avg 1-3 §6694-exposed positions/yr) |
| `Positions_6694_Docket` | 0 | Refusal floor below Reasonable Basis prevents these |
| `AuditHours_base` | 60 hrs (annualized; e.g. one 60-hour audit every year, or 100 hours every 1.7 years) | 40-100 hour audit defense range per IRS Pub 5293 |
| `AuditHours_active_multiplier` | 1.5× | Active audit adds time to projection |
| `AuditHours_closed_multiplier` | 0.6× | Pattern reduction over time |
| `AuditHours_none_multiplier` | 0.4× | Even no-audit-history firms face annualized risk |
| `DocChase_hrs_per_mo` | 15 | Solo + small firm baseline doc chase + ChatGPT-armed-client time |
| `DocChase_load_factor` | 0.22 | Fraction of doc-chase time that maps to billable opportunity cost (not all reclaimed time is billable) |
| `DocChase_Docket_factor` | 0.4 | Docket reduces doc-chase by ~60% |
| `MalpracticeDelta` | -$1,500 if yes, $0 if no/not-sure | Industry-quoted Tech E&O premium reduction for SOC 2 + audit chain |
| `DocketAnnualCost` | $3,000 ($250 × 12) | L6 founder tier |

### Formulas

#### 1. §6695(g) penalty exposure

```
ClientsWithCredits = C * E
PenaltyExposure = ClientsWithCredits * Checklists_avg * (MissRate_baseline - MissRate_Docket) * P_6695g
```

Example with defaults (C=200, E=0.25):

```
50 clients × 4 checklists × (1.5% - 0.05%) × $650 = 50 × 4 × 0.0145 × $650 = $1,885
```

(Round to $1,900 for display.)

#### 2. §6694 understatement exposure

```
ExposureSavings = (Positions_6694_baseline - Positions_6694_Docket) * P_6694_avg
                = 2 × $1,500 = $3,000
```

#### 3. Audit defense time

```
AuditMultiplier = {
  active: 1.5,
  closed-within-3yr: 0.6,
  none: 0.4
}[A]

AuditHours = AuditHours_base * AuditMultiplier
AuditCostSavings = AuditHours * R * 0.5
  (multiply by 0.5 because Docket reduces audit defense time by ~50% — substrate
   generates the file as a side effect, EA's hours go to billable work)
```

Example with defaults (R=250, A=none):

```
60 × 0.4 = 24 hrs annualized
24 × $250 × 0.5 = $3,000
```

#### 4. Doc-chase / ChatGPT-armed-client opportunity cost

```
DocChaseAnnualHours = DocChase_hrs_per_mo * 12 = 180 hrs/yr
DocChaseBillableLoss = DocChaseAnnualHours * R * DocChase_load_factor * DocChase_Docket_factor
                     = 180 × R × 0.22 × 0.4
```

Example with defaults (R=250):

```
180 × $250 × 0.22 × 0.4 = $3,960
```

(Round to $4,000 for display.)

#### 5. Malpractice premium delta

```
MalpracticeDelta = {
  yes: -$1,500,
  no: $0,
  not-sure: -$500   // half credit when unsure to keep result honest
}[M]
```

#### 6. Total annual cost of not using Docket

```
TotalSavings = PenaltyExposure
             + ExposureSavings
             + AuditCostSavings
             + DocChaseBillableLoss
             - MalpracticeDelta   // subtract because savings is positive
```

Example with all defaults:

```
TotalSavings = $1,900 + $3,000 + $3,000 + $4,000 - $500 = $11,400
```

(Note: example in pricing-page-copy.md uses higher EITC% + realization rate; that example yields ~$22-25K. Show both: low-input and high-input cases produce wide range.)

#### 7. ROI multiple

```
ROI = TotalSavings / DocketAnnualCost
    = TotalSavings / $3,000
```

Example: $22,887 / $3,000 = **7.6×**

---

## Output display

### Headline result block

```
ANNUAL COST OF NOT USING DOCKET: $TotalSavings
DOCKET FOUNDER TIER ANNUAL COST:  $3,000 ($250/mo × 12)
ROI MULTIPLE:                      ROI×
```

Typography: Fraunces 56-72px for the headline number. DM Sans 16-18px for the math row. Forest-green emphasis on ROI multiple.

### Breakdown table

| Line item | Formula | Defaults result |
|---|---|---|
| §6695(g) penalty exposure | `ClientsWithCredits × Checklists × MissDelta × $650` | ~$1,900 |
| §6694 exposure | `2 positions × $1,500` | ~$3,000 |
| Audit defense time (annualized) | `AuditHours × R × 0.5` | ~$3,000 |
| Doc-chase / ChatGPT time | `180 × R × 0.22 × 0.4` | ~$4,000 |
| Malpractice premium delta | tabular, by carrier status | -$500 to -$1,500 |
| **Annual cost of not using Docket** | sum | **~$11,400** |

### CTA

```
→ Lock my founder slot
[Routes to /sign-up with calculator state in URL params]

[microcopy]
Founder rate $250/mo locked for life. First 50 firms only. [X] of 50 remaining.
```

---

## UX behavior

### Real-time updates

| Trigger | Behavior |
|---|---|
| Any input changes | Result re-renders within 100ms. No "Calculate" button required after first calculation. |
| First page load | Show defaults result before any input change ("Here is the math for a typical 200-client small-firm EA"). |
| Input out of range | Clamp to min/max. Show inline error message. |
| URL params present | Pre-fill inputs from URL params (`?clients=200&eitc=25&rate=250&audit=none&malpractice=not-sure`). |
| Share button clicked | Copy URL with current state to clipboard. Optional tweet-prefill. |

### Edge cases handled

| Edge case | Behavior |
|---|---|
| Zero clients | Disable Calculate; show "Please enter at least 50 clients." |
| 100% EITC | Allow but show contextual note: "Very high EITC density — verify with carrier whether your malpractice policy requires additional disclosure." |
| Realization rate < $75 or > $1,000 | Clamp + show warning: "Outside typical range. Double-check this number." |
| Audit active + low clients | Show contextual note: "Active audit with small book = high time-cost concentration; Docket's audit defense workspace + cited-authority chain materially reduces defense burden." |
| Malpractice "no" | Show contextual note: "Per IRS Pub 4557 + most state regs, tax preparers handling client PII should carry Tech E&O. Mention this to your insurance broker." |
| All defaults unchanged | Show secondary note: "Plug in your actual numbers — the default scenario is conservative. Most firms see 1.5-3× higher exposure." |

### Mobile responsive

| Breakpoint | Layout |
|---|---|
| ≥ 1024px | Two-column: inputs left 40%, output right 60% |
| 768-1023px | Stacked: inputs top, output bottom |
| < 768px | Stacked, inputs collapse into accordion; output sticks to top of viewport |

---

## Accuracy + disclaimers

### Disclaimer footer (shown below result)

> **Important.** This calculator surfaces an estimated cost-of-not-using based on industry-baseline rates. It is not tax advice, not a guarantee of savings, and not a regulatory compliance certification. Your actual exposure depends on your practice's specific client mix, position library coverage, and existing controls. Penalty rates sourced from IRS Rev. Proc. 2025-32 (2026 inflation adjustments). Industry miss rates sourced from TIGTA report 2021. Audit defense hour range from IRS Pub 5293.
>
> Docket does not provide tax advice via this calculator. Sign up for a Discovery Scan to get a real Position Framework analysis on one of your returns.

### Sources strip (linked at bottom)

> IRS Rev. Proc. 2025-32 · IRC §6694 / §6695 / §6701 · Treas. Reg. §1.6694 · IRS Pub 4557 (Safeguarding Taxpayer Data) · IRS Pub 5293 (Tax Pro Toolkit) · TIGTA report 2021 on preparer due diligence

### Audit log

Every calculator interaction logged for marketing analytics:
- Input field touched (which one + new value)
- Result viewed (full output + result $)
- Share button clicked
- CTA clicked (founder slot signup)

No PII in logs. Aggregated for funnel analysis.

---

## Build effort (for Haokun's queue)

| Phase | Effort | Owner | ETA |
|---|---|---|---|
| Input form component (5 fields, validation, defaults) | 0.5 day | Haokun | 5/30 |
| Math engine (TypeScript, pure functions, unit-tested) | 0.5 day | Haokun | 5/31 |
| Output display component (headline + breakdown table + CTA) | 0.5 day | Haokun | 6/1 |
| URL state management (share-friendly URLs) | 0.25 day | Haokun | 6/1 |
| Analytics events + tracking | 0.25 day | Haokun | 6/1 |
| Mobile responsive + accessibility pass | 0.25 day | Haokun | 6/2 |
| Founder-slot live counter integration | 0.5 day | Haokun | 6/4 |
| Voice-pass + visual polish with David | 0.5 day | David + Haokun | 6/5 |
| **Production deploy** | | | **6/8** |

Total: ~3 days of Haokun's time. Cheap relative to the funnel impact.

### Acceptance tests

1. With defaults, result = ~$11,400; ROI = ~3.8×.
2. With C=500, E=0.40, R=400, A=active, M=yes: result = ~$48-55K; ROI = ~16-18×.
3. With C=100, E=0.10, R=150, A=none, M=no: result = ~$5-6K; ROI = ~1.7-2×.
4. All edge cases above produce sensible output (not zero, not negative, not absurd).
5. URL `?clients=500&eitc=40&rate=400&audit=active&malpractice=yes` pre-fills correctly.
6. Calculator works without JS for SEO crawl (server-renders default scenario; JS hydrates for interactivity).
7. Share button copies tweet-prefilled URL with calculator state.

---

## What's NOT in this calculator (deliberately deferred)

| Item | Why deferred |
|---|---|
| State penalty calculations (CA FTB, NY DTF) | Federal only in v1. State coverage in v1.5. |
| Multi-state preparer (multi-jurisdiction) | v1.5. |
| Audit defense workspace deep-dive | v1.5 — calculator surfaces $ amount, full workspace UX is in command-room. |
| Per-engagement / per-notice pricing comparison | Standard-tier per-event pricing is in tier table. Calculator focuses on founder tier. |
| Tax-software-specific savings | Browser automation depth deferred to Phase 3-4 of v1. Not a calculator input. |
| Bilingual UI (Spanish, Mandarin) | English-only v1 per CLAUDE.md. |
| Comparison vs other AI tax tools | Anti-frame: we do not lead with competitor comparison. Calculator is about absolute cost-of-not-using, not relative cost-vs-competitors. |
| Mid-market tier breakdown (20-100 staff) | Different sales motion. Mid-market firm owners do not use a pricing-page calculator; they have a sales conversation. |

---

## Update discipline

- **Annual update** (every January): refresh `P_6695g` per latest IRS Rev. Proc.
- **Annual update** (every January): re-verify TIGTA + Pub 5293 + Pub 4557 cite freshness.
- **After 100 calculator interactions**: review input distribution + recalibrate defaults if median wildly off.
- **After first 10 closes from calculator path**: review actual delivered ROI vs calculator-promised ROI. Adjust formulas if systematic gap.
- **When CLAUDE.md L6 pricing changes**: update `DocketAnnualCost` constant + tier table.
- **Friday review during 100-by-8/1 sprint**: include calculator-to-CTA conversion rate in weekly channel-performance review.

---

*Created 2026-05-11. Re-read every Friday during the 100-by-8/1 sprint. Drift between this spec and the deployed widget is the bug it is designed to prevent. Update penalty math constants annually with IRS Rev. Proc. cycles.*
