# Position p016: Self-rental rules under §469(c)(2) + §1.469-2(f)(6)

## Status

- **Tier classification**: Tier 2-3 (Substantial Authority when income is properly recharacterized; Reasonable Basis + 8275 when grouping elections at issue)
- **Review status**: `DRAFT-DAVID`
- **Last reviewed**: 2026-05-11 by David Kim
- **Effective date range**: Tax years 1986-present (§469 enacted 1986; §1.469-2(f)(6) since regulations promulgated)
- **Next mandatory refresh**: January 2027 — refresh case law every 6 months; check IRS audit guides
- **Penalty exposure if mis-applied**: §6694(a) preparer if recharacterization not applied; §469 PAL on rental loss disallowance if not grouped; potential §6662 understatement

## Position statement

When a taxpayer rents real property to a trade or business in which the taxpayer materially participates, **§1.469-2(f)(6)** recharacterizes the rental NET INCOME (not loss) as non-passive. This prevents taxpayers from artificially creating passive income to absorb passive losses by self-renting. Self-rental LOSSES remain passive unless the taxpayer elects to group the rental with the operating business under §1.469-4.

## Plain-English description

§469 (passive activity loss rules) is the trap. Rental real estate is per-se passive (§469(c)(2)). A taxpayer's losses from rental are passive losses, only offsetting passive income.

Some taxpayers tried to game this: own rental property, rent it to their own S-Corp / partnership that they materially participate in, generate rental income. The rental income is "passive" — it can absorb other passive losses (like a passive K-1 loss from another investment).

**The IRS closed this loophole via §1.469-2(f)(6)**: self-rental NET INCOME is recharacterized as non-passive. Cannot be used to absorb other passive losses.

**But the asymmetry**: self-rental LOSSES remain passive by default. A taxpayer renting at below FMV to their own business creates passive losses that are limited.

**The fix**: §1.469-4(d) grouping election. Taxpayer may elect to group the rental with the operating business as a single activity. If grouped:
- Both treated as a single trade or business
- Material participation in the combined activity allows non-passive treatment of both income AND loss
- Both must satisfy "rental related to trade or business" test under §1.469-4(d)(1)

**Why an EA cares**: clients who own both rental property + operating business (very common pattern — owner of S-Corp owns the building the S-Corp operates in) routinely have self-rental issues. Misapplying §1.469-2(f)(6) costs the client tens of thousands in lost passive-loss offsets. Misapplying §1.469-4 grouping creates an irrevocable election that affects multiple years.

## Fact pattern triggers

The Discovery agent should consider this position when:
- Schedule E rental property
- Same taxpayer's S-Corp or partnership operates the rented property
- Rental income (not loss) on Schedule E
- Other passive losses on return (e.g., K-1 from unrelated passive investment) that COULD be absorbed by recharacterized rental income
- Material participation in the operating business documented

## Cited authority chain

1. **IRC §469** — Passive Activity Loss rules
2. **IRC §469(c)(2)** — rental real estate per-se passive
3. **IRC §469(h)** — material participation tests
4. **Treas. Reg. §1.469-2(f)(6)** — self-rental income recharacterization (THE controlling rule)
5. **Treas. Reg. §1.469-4(d)** — grouping rules
6. **Treas. Reg. §1.469-4(d)(1)** — rental + trade-or-business grouping requirements
7. **Treas. Reg. §1.469-4(c)(2)** — grouping must be reasonable
8. **Treas. Reg. §1.469-9** — Real Estate Professional rules (interaction)
9. **Krukowski v. Comm'r, T.C. Memo 2000-XX** — leading case applying §1.469-2(f)(6)
10. **Carlos v. Comm'r, T.C. Memo 2010-XX** — recharacterization upheld
11. **Senra v. Comm'r, T.C. Memo 2011-XX** — grouping election rejected
12. **Rev. Proc. 2010-13** — grouping election filing procedure
13. **IRS Publication 925** — Passive Activity and At-Risk Rules
14. **IRS Audit Technique Guide — Passive Activity Loss**

## 4-tier confidence rationale

**Tier 2 (Substantial Authority)** when:
- Self-rental properly recharacterized (income made non-passive per §1.469-2(f)(6))
- Grouping election (if made) is properly executed under §1.469-4(d) and timely filed
- Material participation in operating business well-documented

**Tier 3 (Reasonable Basis + 8275)** when:
- Grouping election reasonableness is borderline (multiple rentals, mixed-use)
- Material participation in operating business is documented but contested

**REFUSED below RB**:
- Trying to use self-rental income to absorb unrelated passive losses (§1.469-2(f)(6) explicitly forbids)
- "Reverse" grouping election to convert losses to non-passive without proper election
- Retroactive grouping election (must be timely; per Rev. Proc. 2010-13)

## Required substantiation

1. **Lease agreement** showing taxpayer rents to own controlled entity
2. **Material participation documentation** for operating business (per §469(h))
3. **Grouping election statement** if §1.469-4(d) election made — filed with first return after grouping decision; irrevocable absent FTB consent
4. **Schedule E income/loss treatment** matching recharacterization or grouping outcome
5. **Self-rental recharacterization analysis** documented in workpaper
6. **Rental at FMV documentation** (lease rate vs comparable market data)

## Draft 8275 disclosure (Tier 3 grouping-borderline variant)

```
Form 8275 (Rev. Aug 2013) — Disclosure Statement

Part I — Information About the Position
Item 1: Schedule E + Schedule K-1 — grouping of rental real estate
with operating S-Corp business under §1.469-4(d)
Item 2: Treatment of activities as a single non-passive activity
under Treas. Reg. §1.469-4(d) with material participation
Item 3: $[X] in losses claimed as non-passive

Part II — Detailed Explanation
[Taxpayer] owns [Rental Property] which is rented to [S-Corp name],
in which the taxpayer materially participates. The taxpayer elected
under §1.469-4(d) to group the rental activity with the operating
S-Corp business as a single activity for purposes of §469. The
grouping is reasonable because [the rental activity is integrally
related to the operating business — the operating business depends
on the rental space; or another fact-specific reasonable basis].
Material participation in the combined activity is supported by
[documented hours / records]. Grouping election was filed with the
[Year] return per Rev. Proc. 2010-13.
```

## Common audit-defense framing

When IRS challenges:

1. **Show lease agreement** + rental rate
2. **Document material participation** in operating business
3. **Apply §1.469-2(f)(6) recharacterization** correctly
4. **Show grouping election** if applicable
5. **Cite Krukowski / Carlos / Senra** for relevant fact pattern

Typical IRS questions:
- "Is the rental at FMV?"
- "Did the taxpayer materially participate in the operating business?"
- "Was a §1.469-4(d) grouping election filed?"
- "Was the rental income properly recharacterized as non-passive?"

## Common mis-uses / failure modes

| Mis-use | Why it fails | Penalty |
|---|---|---|
| Using self-rental income to absorb unrelated passive losses | §1.469-2(f)(6) explicitly recharacterizes income as non-passive | §6694(a) + tax + §469 disallowance |
| Retroactive grouping election | Must be timely; Rev. Proc. 2010-13 | §6694(a) |
| Treating self-rental loss as non-passive without grouping election | Default is passive loss | §6694(a) |
| Renting below FMV creating artificial passive loss | Reasonableness fails; substance-over-form | §6694(a)-(b) |
| Renting above FMV to inflate operating-business expense | Same | §6694(b) potentially |
| Multiple rentals not grouped consistently | §1.469-4 reasonableness fails | §6694(a) |
| Grouping election made then activity changes substantially | Grouping may no longer be reasonable; FTB consent to regroup | §6694(a) |

## Cross-references to related positions

- p013: Real Estate Professional Status §469(c)(7) — different §469 escape hatch
- p001: §199A QBI — affected by self-rental treatment (recharacterized income may be QBI per Rev. Proc. 2019-38)
- p004: Augusta Rule §280A(g) — different short-term-rental mechanic

## Version history

- v0.1 2026-05-11 David Kim — Initial draft from IRC §469(c)(2) + Treas. Reg. §1.469-2(f)(6) + §1.469-4(d) + Krukowski + Carlos + Senra + Rev. Proc. 2010-13 + Pub 925; pending Antonio review

---

*Pending Antonio review. Status `DRAFT-DAVID` until Antonio signs off.*
