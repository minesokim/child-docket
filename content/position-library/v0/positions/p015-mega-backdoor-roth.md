# Position p015: Mega backdoor Roth (after-tax 401(k) → Roth conversion)

## Status

- **Tier classification**: Tier 2 (Substantial Authority) — depends on 401(k) plan design + Notice 2014-54 mechanics
- **Review status**: `DRAFT-DAVID`
- **Last reviewed**: 2026-05-11 by David Kim
- **Effective date range**: Tax years 2014-present (Notice 2014-54 clarified the mechanic in 2014)
- **Next mandatory refresh**: January 2027 — refresh annual 401(k) limits per latest Rev. Proc.; refresh Notice 2014-54 status
- **Penalty exposure if mis-applied**: §6694(a) preparer if Notice 2014-54 allocation mis-applied; §72(t) early withdrawal penalty; §408(d)(2) pro-rata trap

## Position statement

A taxpayer whose employer 401(k) plan permits after-tax (non-Roth) contributions AND in-service distributions may execute a "mega backdoor Roth": (1) make after-tax 401(k) contributions up to the §415(c)(1)(A) total limit ($69,000 for 2024); (2) immediately convert the after-tax balance to Roth (either via in-service distribution to Roth IRA, or in-plan Roth conversion). Notice 2014-54 confirms the basis-only-allocation mechanic.

## Plain-English description

This is the "mega" version of backdoor Roth. Standard backdoor Roth is capped at the annual IRA contribution limit ($7,000 for 2024). Mega backdoor Roth uses the much higher 401(k) total annual additions limit.

**The 401(k) §415(c)(1)(A) total annual additions limit** for 2024 is **$69,000** ($76,500 with catch-up if 50+). This includes:
- Employee elective deferrals (pre-tax + Roth combined): $23,000 ($30,500 catch-up)
- Employer match
- Employer profit-sharing
- **After-tax employee contributions** ← the lever

So for a high-income employee with $69,000 limit:
- $23,000 Roth deferral
- $5,000 employer match
- $0 employer profit-sharing
- **$41,000 after-tax contribution available** (= $69,000 - $23,000 - $5,000)

The $41,000 goes in after-tax. Then convert it to Roth (either in-plan or via IRA). After conversion, that $41,000 grows tax-free forever in Roth.

**Critical plan-design requirements**:
1. **Plan must allow after-tax contributions**. Many 401(k) plans don't.
2. **Plan must allow in-service distributions OR in-plan Roth conversions**. Without either, after-tax money sits in pre-tax wrapper until separation.
3. **Plan must report the after-tax basis separately**. Notice 2014-54 allocation requires tracking.

**Notice 2014-54 mechanic**: when an after-tax 401(k) distribution is split between Roth IRA + Traditional IRA (or two destinations), the basis can be allocated entirely to the Roth (avoiding tax on conversion). Without Notice 2014-54 allocation, conversion would be pro-rata.

**Why Tier 2 (not Tier 1)**:
- The position requires plan-design dependencies (plan must permit). Confirmed via plan document review.
- The Notice 2014-54 allocation mechanic is well-established but requires the custodian/plan administrator to execute correctly.
- Pre-tax/Roth/after-tax basis tracking on the 401(k) side requires careful documentation.

**Why an EA cares**: high-income clients with mega backdoor Roth-capable plans (Google, Microsoft, Meta, Apple, many tech companies + some larger firms) can dramatically accelerate tax-advantaged savings. Done right: $41K/year extra in Roth space. Done wrong: unexpected taxable income.

## Fact pattern triggers

The Discovery agent should consider this position when:
- W-2 from an employer known to permit mega backdoor (tech companies + larger employers)
- Form 5498 with after-tax 401(k) → Roth conversion
- Form 1099-R for in-service distribution with after-tax basis component
- Schedule 1 with retirement-plan items suggesting high contribution
- AGI in high bracket (mega backdoor Roth is for top-tier savers, $250K+ income typical)

## Cited authority chain

1. **IRC §415(c)(1)(A)** — total annual additions limit ($69,000 for 2024)
2. **IRC §402A** — Roth 401(k) treatment
3. **IRC §402(c)** — eligible rollover distributions
4. **IRC §408A** — Roth IRA rules (destination for mega backdoor IRA route)
5. **IRC §72(d)** — basis allocation rules
6. **IRC §401(a)(31)** — direct rollover rules
7. **Treas. Reg. §1.402A-1** — Roth 401(k) rules
8. **Notice 2014-54** — basis allocation between Roth + Traditional for split rollovers (THE foundational authority for this position)
9. **Notice 2014-74** — operational guidance following 2014-54
10. **Rev. Proc. 2024-XX** — 2024 §415(c)(1)(A) limit + 401(k) catch-up amounts
11. **Rev. Proc. 2025-32** — 2026 limits
12. **Form 1099-R (latest year)** — Distributions
13. **Form 5498 (latest year)** — IRA Contribution Information
14. **IRS Publication 575** — Pension and Annuity Income
15. **IRS Publication 590-A** — Contributions to IRAs

## 4-tier confidence rationale

**Tier 2 (Substantial Authority)** for the well-executed mega backdoor with:
- Plan document permitting after-tax contributions + in-service distributions
- Notice 2014-54 allocation correctly applied at conversion
- 1099-R correctly coded by custodian
- Annual additions within §415(c)(1)(A) limit

**Tier 3 (Reasonable Basis + 8275)** if there's substantiation ambiguity:
- Plan document doesn't explicitly permit; client + plan administrator confirmed verbally
- Notice 2014-54 allocation done via paperwork the IRS could challenge
- Basis tracking required reconstruction

**REFUSED below RB**:
- Executing the conversion without confirming plan-design support
- Notice 2014-54 allocation not done; conversion taxed pro-rata unexpectedly
- Annual additions exceed §415(c)(1)(A) (excess contribution penalty)

## Required substantiation

1. **401(k) plan document** confirming after-tax contributions + in-service distributions (or in-plan Roth conversion) are permitted
2. **Payroll records** showing after-tax contribution amount
3. **Form 1099-R** from the plan with correct coding + basis information
4. **Form 5498** showing the Roth deposit
5. **Notice 2014-54 allocation paperwork** filed with the plan administrator (typically a written election or election within the plan's distribution form)
6. **Year-end basis statement** from the plan administrator
7. **§415(c)(1)(A) annual addition limit verification** (sum of all contributions ≤ limit)

## Draft 8275 disclosure

Not typically required at Tier 2. If Notice 2014-54 allocation is reconstructed retroactively, consider Form 8275:

```
Form 8275 (Rev. Aug 2013) — Disclosure Statement

Part I — Information About the Position
Item 1: Form 1040 — Roth conversion of after-tax 401(k) balance
Item 2: Allocation of basis to Roth destination per Notice 2014-54
Item 3: $[X] converted; $[Y] taxable (gain portion only)

Part II — Detailed Explanation
[Taxpayer] received an in-service distribution from [Employer] 401(k)
plan totaling $[X], consisting of $[Y] after-tax basis + $[Z] taxable
gain. Per Notice 2014-54, the after-tax basis was allocated entirely
to the Roth IRA destination, and the taxable gain was allocated to
[Traditional IRA / Roth (taxable conversion)]. The plan permits
after-tax contributions and in-service distributions per the plan
document dated [date]. Annual additions for the year totaled $[total],
within the §415(c)(1)(A) limit.
```

## Common audit-defense framing

When IRS challenges:

1. **Produce 401(k) plan document** supporting after-tax + in-service
2. **Show Notice 2014-54 allocation** paperwork
3. **Show 1099-R coding** matches conversion
4. **Show §415(c)(1)(A) compliance**
5. **Cite Notice 2014-54 + 2014-74**

Typical IRS questions:
- "Did the plan permit after-tax contributions?"
- "Did the plan permit in-service distributions?"
- "Was Notice 2014-54 allocation properly elected?"
- "Did annual additions exceed the §415(c)(1)(A) limit?"

## Common mis-uses / failure modes

| Mis-use | Why it fails | Penalty |
|---|---|---|
| Plan doesn't permit after-tax contributions; client made them anyway | Excess contribution; corrective distribution required | §4973 + §6694(a) |
| Notice 2014-54 allocation not properly elected | Conversion taxed pro-rata; unexpected income | §6694(a) preparer + tax |
| In-service distribution attempted but plan doesn't permit | Plan reverses transaction; potential plan-qualification issue | §6694(a) |
| Total annual additions exceed §415(c)(1)(A) | Excess contribution penalty | §4973 |
| Confusing mega backdoor with regular backdoor Roth | Different mechanics + different limits | §6694(a) |
| 1099-R coded incorrectly by custodian | Conversion treated as ordinary distribution | Amend; §6694(a) |
| Mega backdoor on plan WITHOUT separate after-tax basis tracking | Plan can't allocate; basis lost | §6694(a) |

## Cross-references to related positions

- p014: Roth IRA backdoor conversion — same Notice 2014-54 principle, different vehicle
- p001: §199A QBI — affects MAGI calculation (Roth conversion is income for MAGI purposes)

## Version history

- v0.1 2026-05-11 David Kim — Initial draft from IRC §415(c)(1)(A) + §402A + Notice 2014-54 + Notice 2014-74 + Treas. Reg. §1.402A-1 + Pub 575 + Pub 590-A; pending Antonio review

---

*Pending Antonio review. Status `DRAFT-DAVID` until Antonio signs off.*
