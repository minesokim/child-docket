# Position p001: Section 199A Qualified Business Income (QBI) deduction

## Status

- **Tier classification**: Tier 1 (Settled law)
- **Review status**: `DRAFT-DAVID`
- **Last reviewed**: 2026-05-11 by David Kim
- **Effective date range**: Tax years 2018-2025 (Settled). The §199A deduction is currently scheduled to sunset 12/31/2025 under TCJA. **Critical refresh trigger**: any post-2025 extension or modification by Congress changes the post-2025 applicability — re-validate this entry every January.
- **Next mandatory refresh**: January 2027 (post-2026 tax year), unless legislative action triggers earlier
- **Penalty exposure if mis-applied**: §6694(a) if the taxpayer's business is misclassified as non-SSTB when it's actually SSTB; §6695(a)-(e) procedural if Form 8995 / 8995-A not properly attached

## Position statement

The §199A QBI deduction allows non-corporate taxpayers (individuals, trusts, estates) to deduct up to 20% of qualified business income from pass-through businesses (sole proprietorships, partnerships, S-corporations, certain trusts) for tax years 2018-2025.

## Plain-English description

Section 199A was added by the Tax Cuts and Jobs Act (TCJA) of 2017 and gives pass-through business owners a 20% deduction on their share of business profit. The deduction is taken on Form 1040 (Line 13 for 2024+), computed on Form 8995 (simple) or Form 8995-A (when income exceeds thresholds).

There are three regimes:

1. **Below threshold** ($241,950 single / $483,900 MFJ for 2025; indexed annually per Rev. Proc.) — full 20% deduction; no SSTB or W-2/UBIA limits apply.
2. **Within phase-in range** ($241,950-$291,950 single / $483,900-$583,900 MFJ for 2025) — partial limitations apply; SSTB phase-out begins; W-2/UBIA limit begins to bind.
3. **Above phase-in** (>$291,950 single / >$583,900 MFJ for 2025) — full SSTB phase-out (SSTB get zero deduction); full W-2/UBIA limit applies.

The deduction is the lesser of:
- 20% of QBI per qualified trade or business, OR
- Greater of (50% of W-2 wages paid by the business) OR (25% of W-2 wages + 2.5% of UBIA of qualified property)

Capped overall at 20% of (taxable income minus net capital gain).

**Why an EA cares**: this is the single largest deduction available to most pass-through small-business owners. Mis-classifying a business as non-SSTB when it is SSTB (at income above the threshold) results in disallowance + §6694(a) preparer exposure.

## Fact pattern triggers

The Discovery agent should consider this position when ANY of the following appear in the return:
- Schedule K-1 from a 1065 (partnership) or 1120-S (S-corp) with line 1, 2, or 3 income
- Schedule C income from sole proprietorship
- Schedule E rental income (if rental rises to "trade or business" level per Rev. Proc. 2019-38 safe harbor)
- Schedule F farm income
- Box 14 W-2 with §199A wages reported (REIT dividends + PTP income flow-through)
- 1099-DIV with §199A REIT dividends (Box 5)
- 1099-MISC / 1099-NEC trade or business income
- Filing status threshold check: AGI within or above the phase-in range

## Cited authority chain

In order of authority weight:

1. **IRC §199A(a)** — 20% deduction on Qualified Business Income (statutory)
2. **IRC §199A(b)(2)** — limitations based on W-2 wages and UBIA of qualified property
3. **IRC §199A(c)** — definition of "qualified business income"
4. **IRC §199A(d)** — definition of "qualified trade or business" (SSTB exclusion above threshold)
5. **IRC §199A(e)(2)** — threshold amount indexed to inflation
6. **Treas. Reg. §1.199A-1** — general rules and definitions
7. **Treas. Reg. §1.199A-1(b)(14)** — definition of "trade or business" (§162 standard)
8. **Treas. Reg. §1.199A-2** — W-2 wage and UBIA calculations
9. **Treas. Reg. §1.199A-3** — computation of QBI
10. **Treas. Reg. §1.199A-4** — aggregation rules for multiple businesses
11. **Treas. Reg. §1.199A-5(b)(2)** — SSTB definitions (the load-bearing reg for classification)
12. **Treas. Reg. §1.199A-5(b)(2)(xiv)** — Construction explicitly NOT an SSTB
13. **Treas. Reg. §1.199A-5(b)(2)(xi)** — health, law, accounting, actuarial science, performing arts, consulting, athletics, financial services, brokerage services, investing/investment management — explicitly SSTB
14. **Rev. Proc. 2019-38** — safe harbor for rental real estate to qualify as "trade or business"
15. **Rev. Proc. 2025-32** — 2026 inflation amounts ($241,950 single / $483,900 MFJ for 2025; 2026 amounts publish ~November 2025)
16. **Form 8995-A Instructions (2024)** — operational guidance
17. **IRS Publication 535** — definitions and examples (consumer-facing)
18. **Berry v. Comm'r, T.C. Memo 2024-XX** — recent case on SSTB classification edge cases (verify cite with Antonio)
19. **CCA 202101013** — IRS Chief Counsel Advice on aggregation rules

## 4-tier confidence rationale

This position is **Tier 1 (Settled law)** for the vast majority of fact patterns: a pass-through business owner taking the 20% deduction on QBI from a clearly-non-SSTB trade or business below the phase-in threshold.

**The classification can downgrade for these reasons**:

- **Tier 2 (Substantial Authority)** if the business is in a phase-in zone for SSTB classification (e.g., a hybrid services + product business where the SSTB designation is contested per Treas. Reg. §1.199A-5(b)(3)).
- **Tier 3 (Reasonable Basis + 8275)** if the business is a non-traditional rental property classified as a "trade or business" without meeting the Rev. Proc. 2019-38 safe harbor. Form 8275 disclosure recommended.
- **Tier 4 (MLTN) or REFUSED** if the taxpayer is above-threshold + claiming non-SSTB status for a business that any reasonable reading of §1.199A-5(b)(2) classifies as SSTB. Example: a "consulting" business reframed as "education" to escape SSTB. Refuse without 8275 disclosure.

**Where Tier 1 holds**:
- Construction (explicitly non-SSTB per §1.199A-5(b)(2)(xiv))
- Manufacturing
- Retail
- Wholesale
- Most real-estate rental that meets the Rev. Proc. 2019-38 safe harbor
- Restaurants
- Trades (plumbing, electrical, HVAC)

**Where Tier 2+ scrutiny needed**:
- Consulting (always SSTB above threshold)
- Healthcare professional practice (SSTB)
- Law firm (SSTB)
- Financial services (SSTB)
- Performing arts (SSTB)
- Investment management (SSTB)
- Hybrid businesses with services + product mix

## Required substantiation

For the Discovery agent's position-defense file + the Antonio's audit-defense use case:

1. **K-1 (or Schedule C/E/F)** with QBI components clearly labeled (lines 1, 2, 3 for K-1; net profit on Schedule C)
2. **W-2 wages paid by the business** (K-1 line 17a; W-3 totals)
3. **UBIA of qualified property** (K-1 line 17b; depreciation schedules)
4. **Business classification documentation** (NAICS code; description of business activities)
5. **SSTB analysis worksheet** (only required if income within or above phase-in range)
6. **Aggregation election statement** (if multiple businesses are aggregated under §1.199A-4)
7. **Safe harbor election statement for rental property** (if rental treated as trade or business per Rev. Proc. 2019-38)
8. **Form 8995 or Form 8995-A** properly attached to Form 1040

## Draft 8275 disclosure

Not required at Tier 1 confidence. Defer to entry if downgraded to Tier 3.

## Common audit-defense framing

When the IRS challenges a §199A deduction (which it does, especially in the SSTB classification arena), the defense flow:

1. **Pull the chain-of-authority for the SSTB classification**: cite Treas. Reg. §1.199A-5(b)(2)(xiv) for non-SSTB classification (e.g., construction); cite §1.199A-5(b)(3) phase-in mechanics if income is in-range.
2. **Provide the SSTB analysis worksheet**: show the trade-or-business activity, the §1.199A-5(b)(2) classification assessment, and the conclusion.
3. **Provide W-2 + UBIA documentation**: if the deduction relies on the W-2/UBIA limit (above-threshold), show the computation.
4. **Cite Rev. Proc. 2019-38 safe harbor** if rental property is at issue.
5. **Cite Berry v. Comm'r or similar recent cases** if examiner is challenging a borderline SSTB classification.

Typical IRS questions:
- "Why is this business classified non-SSTB?"
- "What are the W-2 wages paid by the business?"
- "What is the UBIA of qualified property?"
- "Was an aggregation election made?"
- "Was the rental real estate safe harbor elected?"

Docket's Position Framework pre-logs the answer to each of these at decision time. Audit defense becomes pulling the pre-logged answer.

## Common mis-uses / failure modes

| Mis-use | Why it fails | Penalty |
|---|---|---|
| Claiming non-SSTB on a consulting practice above threshold | Treas. Reg. §1.199A-5(b)(2)(xi) explicitly lists consulting as SSTB | §6694(a) |
| Reframing services business as "non-services" to escape SSTB | Substance-over-form doctrine; reasonable basis fails | §6694(a)-(b) |
| Treating personal residence rental income as QBI | Fails §162 trade-or-business test; no safe harbor | §6694(a) |
| Using 50% of W-2 wages limit when 25%+2.5% UBIA would be more generous | Just a missed computation; not a penalty issue but bad practice | None directly |
| Aggregating businesses that don't meet §1.199A-4(b)(1) common-ownership rule | Misapplication of regulation | §6694(a) if claim is unreasonable |
| Claiming on a non-domestic business | §199A only applies to U.S. trades or businesses | §6694(a)-(b) |

## Cross-references to related positions

- p002: §179 expensing — affects UBIA and W-2/UBIA limit calculation
- p005: Home office accountable plan — increases W-2 wages reported, affects §199A limit
- p007: Accountable plan mileage reimbursement — same
- p012: CA AB-150 PTET — interacts with §199A for CA-resident pass-through owners
- p013: Real estate professional status — affects whether rental income qualifies as QBI

## Version history

- v0.1 2026-05-11 David Kim — Initial draft from primary IRC + Treas. Reg. + recent guidance; pending Antonio review

---

*Pending Antonio review. Status `DRAFT-DAVID` until Antonio signs off.*
