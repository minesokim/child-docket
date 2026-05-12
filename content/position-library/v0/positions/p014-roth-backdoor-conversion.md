# Position p014: Roth IRA backdoor conversion (Notice 2014-54 mechanic)

## Status

- **Tier classification**: Tier 1 (Settled law)
- **Review status**: `DRAFT-DAVID`
- **Last reviewed**: 2026-05-11 by David Kim
- **Effective date range**: Tax years 2010-present (TCJA eliminated Roth recharacterization but explicitly preserved conversions; Notice 2014-54 confirms backdoor mechanic)
- **Next mandatory refresh**: January 2027 — refresh contribution limits + phaseout thresholds per latest Rev. Proc.
- **Penalty exposure if mis-applied**: §6694(a) preparer if §408(d)(2) pro-rata rule mis-applied; §72(t) early withdrawal penalty if conversion mis-coded as distribution; §4973 excess contribution penalty

## Position statement

A high-income taxpayer ineligible to contribute directly to a Roth IRA (due to §408A(c)(3) phaseout) may execute a "backdoor Roth": (1) contribute non-deductible amount to Traditional IRA; (2) convert Traditional IRA to Roth IRA. The conversion is not taxable to the extent of basis. Notice 2014-54 confirms the mechanic for after-tax 401(k) → Roth conversions; the same logic governs IRA backdoor.

## Plain-English description

For 2024, direct Roth IRA contributions are phased out at MAGI $146K-$161K single / $230K-$240K MFJ. Above the upper threshold, no direct Roth contribution is allowed.

The "backdoor Roth" workaround:

1. Taxpayer contributes the annual limit ($7,000 for 2024, $8,000 if 50+) to a Traditional IRA. **This contribution is non-deductible** (high-income taxpayer is above the deduction phaseout if covered by employer plan).
2. Taxpayer files Form 8606 to track the non-deductible basis.
3. Taxpayer converts the Traditional IRA balance to Roth IRA. **Tax on conversion is limited to the gain** (since basis is already after-tax).
4. Going forward, the Roth IRA grows tax-free.

**The §408(d)(2) pro-rata rule is the load-bearing trap**:

If the taxpayer has OTHER pre-tax Traditional IRA balances (from prior deductible contributions or 401(k) rollovers), the pro-rata rule applies. The conversion is treated as a proportional withdrawal from ALL Traditional IRA balances, not just the new non-deductible contribution.

Example:
- Taxpayer has $93,000 in a pre-tax Traditional IRA (from prior 401(k) rollover)
- Contributes $7,000 non-deductible to a Traditional IRA → total Traditional IRA balance = $100,000
- Converts $7,000 to Roth
- §408(d)(2) pro-rata: only $7,000/$100,000 = 7% of the conversion is "basis" → only $490 is non-taxable; **$6,510 IS taxable income**

Most taxpayers don't realize this. The "free" backdoor Roth becomes a major taxable event.

**Workaround**: Roll the existing pre-tax Traditional IRA into a 401(k) BEFORE the conversion (if 401(k) plan accepts incoming rollovers). This zeroes out the pre-tax balance for §408(d)(2) pro-rata purposes. Common for high-income clients with 401(k) plans that accept rollovers.

**Why an EA cares**: nearly every high-income client wants backdoor Roth. The pro-rata rule mis-application is a classic §6694(a) trap. Done right, it's a $7,000/year tax-advantaged-savings vehicle that compounds for decades. Done wrong, it triggers a 5-figure taxable event the client wasn't expecting.

## Fact pattern triggers

The Discovery agent should consider this position when:
- Form 5498 with Traditional IRA contribution
- Form 5498 with Roth conversion
- Form 1099-R with code 2 or 7 (conversion)
- AGI above Roth direct-contribution phaseout
- Form 8606 attached
- Prior-year Traditional IRA balances (suggests potential §408(d)(2) issue)
- 401(k) rollover history (prior pre-tax money rolled to IRA)

## Cited authority chain

1. **IRC §408A** — Roth IRA rules
2. **IRC §408A(c)(3)** — Roth contribution phaseout
3. **IRC §408A(d)(3)** — conversion provisions
4. **IRC §408A(d)(6)** — post-TCJA recharacterization rules (recharacterizations of CONTRIBUTIONS still allowed; recharacterizations of CONVERSIONS eliminated by TCJA effective 2018)
5. **IRC §408(d)(2)** — pro-rata rule for IRA distributions
6. **IRC §72(t)** — 10% early withdrawal penalty (if conversion mis-coded as distribution)
7. **IRC §4973** — excess contribution penalty
8. **Treas. Reg. §1.408A-4** — conversion rules
9. **Treas. Reg. §1.408A-5** — recharacterization rules
10. **Notice 2014-54** — IRS confirmation that allocation between basis + earnings is allowed for after-tax 401(k) → Roth conversions; same principle governs IRA backdoor
11. **Rev. Proc. 2024-XX** — 2024 contribution limits + phaseout thresholds
12. **Rev. Proc. 2025-32** — 2026 limits + thresholds
13. **Form 8606 (latest year)** — Nondeductible IRA Basis tracking
14. **Form 1099-R (latest year)** — Distributions from Pensions/Annuities/IRAs
15. **IRS Publication 590-A** — Contributions to IRAs
16. **IRS Publication 590-B** — Distributions from IRAs
17. **CCA 200913004** — Chief Counsel Advice on IRA aggregation for pro-rata purposes

## 4-tier confidence rationale

**Tier 1 (Settled)** for the standard backdoor Roth with no pre-existing pre-tax Traditional IRA balances. The mechanic is statutory.

**Tier 1 (Settled)** for the backdoor Roth WITH pre-existing pre-tax balance properly rolled to 401(k) BEFORE conversion, zeroing out pro-rata exposure.

**REFUSED below RB**:
- Backdoor Roth executed when client has substantial pre-tax IRA balance + no 401(k) rollover done first → triggers §408(d)(2) pro-rata + unexpected taxable income
- "Reverse engineer" backdoor Roth after-the-fact (the Form 8606 and conversion sequence must be done correctly in real time)
- Claiming non-deductible Traditional IRA basis without filing Form 8606 (loses basis tracking)

## Required substantiation

1. **Form 8606** filed for the year of non-deductible contribution
2. **Form 1099-R** for the conversion (issued by custodian)
3. **Form 5498** for both contribution + conversion
4. **Records of all Traditional IRA balances** at year-end (for §408(d)(2) computation)
5. **401(k) rollover paperwork** if pre-tax balance rolled out before conversion
6. **MAGI computation** showing taxpayer is above Roth direct-contribution phaseout (otherwise direct Roth was the right path; backdoor was unnecessary)

## Draft 8275 disclosure

Not required at Tier 1 confidence. The position is statutory.

## Common audit-defense framing

When IRS challenges (typically a 1099-R coding issue or §408(d)(2) pro-rata mis-application):

1. **Produce Form 8606** for each year non-deductible contributions were made
2. **Show Form 1099-R** with correct conversion coding (Code 2 for under-59.5, Code 7 for 59.5+)
3. **Show year-end Traditional IRA balances** for pro-rata computation
4. **Show 401(k) rollover paperwork** if applicable
5. **Demonstrate MAGI exceeds direct-contribution phaseout**

Typical IRS questions:
- "Was Form 8606 filed?"
- "What were the year-end Traditional IRA balances?"
- "Was the pro-rata rule applied correctly?"
- "Was the conversion properly coded on Form 1099-R?"

Docket pre-logs each.

## Common mis-uses / failure modes

| Mis-use | Why it fails | Penalty |
|---|---|---|
| Backdoor Roth without addressing existing pre-tax IRA balance | §408(d)(2) pro-rata triggers unexpected taxable income | §6694(a) preparer + tax + interest |
| Form 8606 not filed | Non-deductible basis is lost; future distributions taxed fully | §6694(a) |
| Backdoor Roth attempted for taxpayer NOT above Roth phaseout | Backdoor was unnecessary; should have been direct contribution | §6694(a) (negligence) |
| Pro-rata computation done at conversion date vs year-end | §408(d)(2) requires year-end balance | §6694(a) |
| Conversion coded incorrectly on 1099-R | Custodian must use Code 2 or 7 | Need to amend; §6694(a) |
| Direct Roth contribution despite phaseout (no backdoor) | §4973 6% excess contribution penalty | Tax + §6694(a) |
| Conversion attempted in a year when also taking RMD | RMD must be satisfied first | §6694(a) edge case |

## Cross-references to related positions

- p015: Mega backdoor Roth (after-tax 401(k) → Roth) — same Notice 2014-54 principle
- p001: §199A QBI — Roth conversion is portfolio income, doesn't affect QBI directly but affects MAGI threshold

## Version history

- v0.1 2026-05-11 David Kim — Initial draft from IRC §408A + §408(d)(2) + Notice 2014-54 + Treas. Reg. §1.408A-4 + Form 8606 + Pub 590-A + Pub 590-B + CCA 200913004; pending Antonio review

---

*Pending Antonio review. Status `DRAFT-DAVID` until Antonio signs off.*
