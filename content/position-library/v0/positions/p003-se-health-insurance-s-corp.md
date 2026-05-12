# Position p003: Self-employed health insurance deduction for S-Corp 2% shareholder

## Status

- **Tier classification**: Tier 1 (Settled law)
- **Review status**: `DRAFT-DAVID`
- **Last reviewed**: 2026-05-11 by David Kim
- **Effective date range**: Tax years 2008-present (formalized by Notice 2008-1)
- **Next mandatory refresh**: January 2027 — refresh annually for any IRS guidance updates
- **Penalty exposure if mis-applied**: §6695(a)-(e) procedural if W-2 doesn't include premium in Box 1 wages; §6694(a) if claiming the deduction without the W-2 inclusion mechanic

## Position statement

A more-than-2% shareholder of an S-Corp may deduct the cost of health insurance premiums (including spouse + dependents) as an above-the-line deduction on Schedule 1 Line 17, provided the S-Corp paid or reimbursed the premiums and the amount is included in the shareholder's W-2 Box 1 wages.

## Plain-English description

This is the "wages-and-deduction" mechanic for S-Corp >2% shareholders. The S-Corp pays (or reimburses) health insurance premiums for the shareholder. To preserve the deduction:

1. The S-Corp deducts the premiums as a corporate expense (ordinary business deduction).
2. The premium amount is added to the shareholder's W-2 Box 1 (wages subject to income tax) — but NOT to Box 3 (FICA wages) or Box 5 (Medicare wages).
3. The shareholder claims the above-the-line deduction on Form 1040 Schedule 1 Line 17, up to the lesser of (a) the premiums paid, or (b) the shareholder's earned income from the S-Corp.

**Net effect**: deduction at corporate level + deduction at individual level + zero FICA/Medicare on the premium portion of wages. Functionally identical to an unincorporated self-employed individual's §162(l) deduction.

**Critical procedural requirement**: the premium MUST be reported in the shareholder's W-2 Box 1 wages. Without W-2 inclusion, the shareholder cannot claim the §162(l) deduction (per Notice 2008-1 + IRC §1372). This is the single most-common preparation error in this area.

**Why an EA cares**: every S-Corp shareholder client of preparation age has this issue. Mis-handling (e.g., S-Corp paying premium without W-2 inclusion) creates a §6694(a) preparer exposure on the shareholder's return — the deduction claimed is incorrect.

## Fact pattern triggers

The Discovery agent should consider this position when:
- S-Corp K-1 (1120-S) with shareholder identified as >2% owner
- W-2 issued by the S-Corp to the shareholder
- Health insurance premiums paid by the S-Corp (corporate expense)
- Shareholder's W-2 Box 1 wages compared against Box 3/5 — if Box 1 > Box 3/5 by an amount roughly matching annual health insurance premiums, this position likely applies
- Schedule 1 Line 17 (self-employed health insurance deduction) currently zero or under-stated
- Box 14 W-2 with code "S Corp Health" or similar

## Cited authority chain

1. **IRC §162(l)(1)** — self-employed health insurance deduction
2. **IRC §162(l)(2)** — deduction limited to earned income from the trade or business
3. **IRC §162(l)(5)** — exclusions (group health plans of employer of spouse, etc.)
4. **IRC §1372** — S-Corp >2% shareholders treated as partners for §162(l) purposes (the foundational sub-rule)
5. **Notice 2008-1** — IRS guidance establishing the wages-and-deduction mechanic for S-Corp >2% shareholders (the most-cited authority for this position)
6. **Notice 2008-1 Q&A 1-15** — operational details on W-2 reporting + qualifying plans + Medicare-only coverage
7. **Treas. Reg. §1.162-10** — general rules for §162 deductions
8. **Rev. Rul. 91-26** — earlier IRS guidance on partner-equivalent §162(l) treatment
9. **IRS Publication 535** — Business Expenses (consumer-facing summary)
10. **Form 1040 Schedule 1 Instructions** — Line 17 instructions for above-the-line deduction
11. **Form W-2 Instructions (Code 2.A.S Corporation)** — Box 14 reporting code "S Corp Health" guidance
12. **CCA 200905004** — clarifying who must own the health insurance policy (S-Corp can purchase OR reimburse premiums paid by shareholder)

## 4-tier confidence rationale

**Tier 1 (Settled law)** for the standard fact pattern: S-Corp >2% shareholder, S-Corp pays premium, W-2 Box 1 includes premium, deduction claimed up to earned income limit.

The position is one of the most-settled in tax preparation. Notice 2008-1 has been on the books for 18 years; the mechanic is well-understood by practitioners and examiners.

**Downgrades exist for edge cases**:

- **Tier 2 (Substantial Authority)** if the S-Corp's plan covers only the shareholder (sole-employee plan); examiners may scrutinize whether the plan is "established" by the S-Corp per Notice 2008-1 Q&A 3.
- **Tier 3 (Reasonable Basis + 8275)** if the spouse-employer alternative coverage exception under §162(l)(5)(A) is at issue — was the shareholder's spouse eligible for spouse-employer coverage, and how is that documented?
- **REFUSED below RB**: claiming the deduction WITHOUT the W-2 inclusion mechanic. The mechanic is mandatory per Notice 2008-1; absent the W-2 inclusion, no deduction available.

## Required substantiation

1. **W-2 Form** with the premium amount included in Box 1, NOT in Box 3 or Box 5
2. **Health insurance policy documentation** (carrier, policyholder, coverage period, premium amount)
3. **Payment records** showing S-Corp paid or reimbursed the premium
4. **S-Corp K-1** confirming the shareholder owns >2% (Schedule K-1 line "Shareholder's percentage of stock ownership for tax year")
5. **Board minutes or employment agreement** establishing the health insurance benefit as part of the shareholder's compensation
6. **Earned income computation**: K-1 line 1 (ordinary income) + W-2 Box 1 wages from the S-Corp = earned income limit
7. **Schedule 1 Line 17 computation** showing the deduction amount and limit

## Draft 8275 disclosure

Not required at Tier 1 confidence. Defer to entry if downgraded.

## Common audit-defense framing

When IRS challenges:

1. **Show W-2 inclusion**: confirm Box 1 includes the premium amount via cross-check against Box 3/5.
2. **Cite Notice 2008-1 + IRC §1372**: the foundational authorities.
3. **Show >2% ownership**: K-1 confirms the shareholder qualifies for the §1372 treatment.
4. **Show earned income limit not exceeded**: §162(l)(2) limit calculation.
5. **Show no alternative coverage exclusion**: confirm shareholder wasn't eligible for spouse-employer subsidized coverage under §162(l)(5)(A).

Typical IRS questions:
- "Is the premium in W-2 Box 1?"
- "Is the shareholder >2% owner?"
- "Was the plan 'established' by the S-Corp per Notice 2008-1?"
- "Was the deduction limited to earned income?"

Docket pre-logs each.

## Common mis-uses / failure modes

| Mis-use | Why it fails | Penalty |
|---|---|---|
| S-Corp pays premium without W-2 Box 1 inclusion | §1372 + Notice 2008-1 require W-2 inclusion as the gating mechanic | §6694(a); deduction must be denied |
| Including premium in Box 3 + Box 5 (FICA + Medicare wages) | Notice 2008-1 explicitly excludes from FICA/Medicare; over-payment | §6695(a) procedural; refund due |
| Claiming deduction > earned income from S-Corp | §162(l)(2) limit; excess must be carried over | §6694(a) if claim is knowing |
| Claiming for a <2% shareholder | §1372 only applies to >2%; <2% gets group health treatment per regular §106 | §6694(a) |
| Claiming when spouse-employer subsidized coverage was available | §162(l)(5)(A) exclusion applies | §6694(a) if knowingly omitted from analysis |
| Claiming on Long-Term Care insurance without age-based limit | LTC has separate annual age-based deduction limits | §6694(a) edge case |

## Cross-references to related positions

- p001: §199A QBI deduction — health insurance premium adds to W-2 wages, affects W-2 limit for §199A
- p005: Home office accountable plan — similar S-Corp shareholder reimbursement pattern
- p007: Accountable plan vehicle mileage — similar accountable plan mechanic

## Version history

- v0.1 2026-05-11 David Kim — Initial draft from Notice 2008-1 + IRC §162(l) + §1372 + Pub 535; pending Antonio review

---

*Pending Antonio review. Status `DRAFT-DAVID` until Antonio signs off.*
