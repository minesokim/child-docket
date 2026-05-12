# Discovery Scan — Sample Output

> *The reference template for what every Discovery Scan PDF looks like in production. A full worked example on a hypothetical client return.*
> *Locked 2026-05-11. This is the gold-standard reference for Haokun's Discovery agent + the artifact Antonio uses to show prospects.*

This sample is structured exactly as the production PDF will render. Every section, every position, every refusal, every footer block. The agent technical spec is at [`docs/DISCOVERY-SCAN-OPERATIONAL.md`](DISCOVERY-SCAN-OPERATIONAL.md). The visual design language uses editorial-warm tokens from `packages/ui/src/tokens.ts` (Fraunces serif + DM Sans + cream canvas + forest green primary).

**About the sample**: hypothetical 5-preparer firm in Riverside, CA. Client is an S-Corp owner of a small construction company (anonymized as "Hernandez Construction Inc."). Tax year 2025. Single return scanned. All positions, citations, and refusals below are realistic for this fact pattern. **Numbers are illustrative**: $43,400 in surfaced deductions, 8 positions across 4 tiers, 3 refusals below Reasonable Basis.

---

## Page 1 — Cover

```
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║                                                                  ║
║                              DOCKET                              ║
║                       [wordmark, forest green]                   ║
║                                                                  ║
║                                                                  ║
║                                                                  ║
║                                                                  ║
║                    DISCOVERY SCAN                                ║
║                                                                  ║
║                    Mendoza & Associates EAs                      ║
║                                                                  ║
║                                                                  ║
║                    Position Framework analysis                   ║
║                    Tax Year 2025                                 ║
║                                                                  ║
║                                                                  ║
║                                                                  ║
║                                                                  ║
║                    Generated 2026-05-11                          ║
║                    Prepared for Maria Mendoza, EA                ║
║                                                                  ║
║                                                                  ║
║                                                                  ║
║                                                                  ║
║                                                                  ║
║                                                                  ║
║    "The AI defense layer for tax practices.                      ║
║     Every position cited. Every action audit-trailed."           ║
║                                                                  ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
```

Typography: Fraunces 32-40px for "DISCOVERY SCAN" + firm name. DM Sans 14-16px for subtitle + date + tagline. Cream canvas. Forest green wordmark only. No decorative imagery.

---

## Page 2 — Executive Summary

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  EXECUTIVE SUMMARY                                               │
│  ────────────────────────────────────────────────────────────    │
│                                                                  │
│  WHAT WE SCANNED                                                 │
│                                                                  │
│  1 return — Tax Year 2025                                        │
│  Entity: Hernandez Construction Inc. (S-Corp)                    │
│  AGI bucket: $200K-$300K                                         │
│  Schedules: K-1 (1120-S), Schedule E, Schedule A (itemized)      │
│  State: California                                               │
│                                                                  │
│                                                                  │
│  WHAT WE SURFACED                                                │
│                                                                  │
│  $43,400 in additional defensible deductions across 8 positions  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ TIER 1 — Settled law                3 positions   $18,600 │  │
│  │ TIER 2 — Substantial Authority      2 positions   $12,800 │  │
│  │ TIER 3 — Reasonable Basis + 8275    2 positions    $9,400 │  │
│  │ TIER 4 — MLTN (preparer judgment)   1 position     $2,600 │  │
│  │ ─────────────────────────────────────────────────────────  │  │
│  │ TOTAL DEFENSIBLE                    8 positions   $43,400 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│                                                                  │
│  WHAT WE REFUSED                                                 │
│                                                                  │
│  3 positions below Reasonable Basis. The system refused — that   │
│  is the design. Detailed reasoning on page 11.                   │
│                                                                  │
│                                                                  │
│  THE AUDIT-DEFENSE STORY                                         │
│                                                                  │
│  Every position above is logged with prep date, cited authority, │
│  and confidence rating. If this return is audited, the defense   │
│  file is one click away from the command-room.                   │
│                                                                  │
│  Detailed positions: pages 3-10.                                 │
│  Refusals: page 11.                                              │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Page 3 — Position #1 (Tier 1 — Settled law)

```
┌──────────────────────────────────────────────────────────────────┐
│  POSITION #1 — Tier 1 (Settled law)                              │
│  ─────────────────────────────────────────────────────────────   │
│                                                                  │
│  DEDUCTION / POSITION                                            │
│  Section 199A Qualified Business Income deduction —              │
│  S-Corp pass-through, construction (QPP), under SSTB threshold   │
│                                                                  │
│  LINE ITEM                                                       │
│  Form 1040 Line 13 (via Form 8995-A)                             │
│                                                                  │
│  $ IMPACT                                                        │
│  $9,800 additional deduction surfaced                            │
│                                                                  │
│  CONFIDENCE                                                      │
│  TIER 1 — Settled law. Direct statutory authority + Treas. Reg.  │
│                                                                  │
│  CITED AUTHORITY                                                 │
│    • IRC §199A(a) — 20% deduction on Qualified Business Income   │
│    • Treas. Reg. §1.199A-1(b)(14) — definition of trade or       │
│      business                                                    │
│    • Treas. Reg. §1.199A-5(b)(2)(xiv) — construction is NOT      │
│      a Specified Service Trade or Business (SSTB)                │
│    • Rev. Proc. 2025-32 — 2026 threshold ($241,950 single /      │
│      $483,900 MFJ)                                               │
│                                                                  │
│  REASONING                                                       │
│  The taxpayer's S-Corp distributes ordinary business income      │
│  from a non-SSTB construction operation. K-1 line 1 income is    │
│  $187,400. Below the 2025 phaseout threshold. Taxpayer is        │
│  eligible for the full 20% QBI deduction on the lesser of QBI    │
│  or 20% of (taxable income minus net capital gain). The return   │
│  as filed used a manually-calculated $39,200 (20% × $196,000)    │
│  but missed the $9,800 additional QBI from W-2 wages adjustment  │
│  per §199A(b)(2)(B).                                             │
│                                                                  │
│  W-2 WAGES + UBIA CALCULATION                                    │
│    W-2 wages paid by S-Corp (per K-1 line 17a): $112,400         │
│    UBIA of qualified property (per K-1 line 17b): $284,000       │
│    50% of W-2 wages: $56,200                                     │
│    25% of W-2 + 2.5% of UBIA: $35,200                            │
│    Greater of: $56,200                                           │
│    QBI: $196,000                                                 │
│    20% of QBI: $39,200                                           │
│    Limit (greater of W-2 or W-2+UBIA): $56,200                   │
│    Lesser of 20% QBI or W-2 limit: $39,200                       │
│                                                                  │
│    Note: existing return understated by $9,800; corrected        │
│    figure is $39,200, return filed $29,400.                      │
│                                                                  │
│  AUDIT EXPOSURE                                                  │
│  Low. §199A is widely litigated but the construction-as-non-SSTB │
│  position is settled. IRS examiner would request K-1, payroll    │
│  records, and UBIA documentation — all available.                │
│                                                                  │
│  DRAFT 8275 / DISCLOSURE                                         │
│  Not required at Tier 1 confidence.                              │
│                                                                  │
│  DOCKET LOG ENTRY                                                │
│  scan_id: a7c4e9-2026-05-11 · position_id: pos-001               │
│  prep_date: 2026-05-11 14:23:17 UTC                              │
│  citation_chain: [§199A(a), 1.199A-1(b)(14), 1.199A-5(b)(2)(xiv) │
│                   Rev. Proc. 2025-32]                            │
│  authority_versions_at_scan: as of 2026-05-11                    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Page 4 — Position #2 (Tier 1 — Settled law)

```
┌──────────────────────────────────────────────────────────────────┐
│  POSITION #2 — Tier 1 (Settled law)                              │
│  ─────────────────────────────────────────────────────────────   │
│                                                                  │
│  DEDUCTION / POSITION                                            │
│  Section 179 expensing on construction equipment placed in       │
│  service 2025 — full deduction instead of MACRS over 5 years     │
│                                                                  │
│  LINE ITEM                                                       │
│  Form 1120-S, Form 4562 Part I                                   │
│                                                                  │
│  $ IMPACT                                                        │
│  $5,400 acceleration (Section 179 vs MACRS 5-year)               │
│                                                                  │
│  CONFIDENCE                                                      │
│  TIER 1 — Settled law. IRC §179 + Treas. Reg.                    │
│                                                                  │
│  CITED AUTHORITY                                                 │
│    • IRC §179(b)(1) — $1,160,000 expense limit for 2025          │
│    • IRC §179(b)(2) — phaseout threshold $2,890,000 for 2025     │
│    • Rev. Proc. 2025-32 — 2026 inflation amounts                 │
│    • Treas. Reg. §1.179-2 — qualifying property                  │
│                                                                  │
│  REASONING                                                       │
│  Taxpayer purchased $27,000 in construction equipment (concrete  │
│  mixer + power tools, qualifying §179 property). Placed in       │
│  service November 2025. Return as filed elected MACRS 5-year     │
│  depreciation ($5,400/yr). §179 immediate expensing of full      │
│  $27,000 is available because:                                   │
│    1. Property is qualifying tangible §1245 property             │
│    2. Used > 50% in trade or business                            │
│    3. Total §179 purchases ($27,000) well below the $1.16M cap   │
│    4. S-Corp had sufficient taxable income to absorb deduction   │
│       (per K-1 line 1, $187,400 ordinary income)                 │
│                                                                  │
│  RECOMMENDATION                                                  │
│  Amend with Form 1040X + Form 4562 amended (Part I) to elect     │
│  §179 on full $27,000. Acceleration: $21,600 deduction shifted   │
│  from Years 2-6 to Year 2025. Net Year 2025 benefit at 24%       │
│  marginal: $5,184 in tax savings.                                │
│                                                                  │
│  AUDIT EXPOSURE                                                  │
│  Negligible. §179 election is a routine, statutory choice.       │
│                                                                  │
│  DRAFT 8275 / DISCLOSURE                                         │
│  Not required at Tier 1 confidence.                              │
│                                                                  │
│  DOCKET LOG ENTRY                                                │
│  scan_id: a7c4e9-2026-05-11 · position_id: pos-002               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Page 5 — Position #3 (Tier 1 — Settled law)

```
┌──────────────────────────────────────────────────────────────────┐
│  POSITION #3 — Tier 1 (Settled law)                              │
│  ─────────────────────────────────────────────────────────────   │
│                                                                  │
│  DEDUCTION / POSITION                                            │
│  Self-employed health insurance deduction for S-Corp 2%          │
│  shareholder — wages-and-deduction approach                      │
│                                                                  │
│  LINE ITEM                                                       │
│  Form 1040 Schedule 1, Line 17                                   │
│                                                                  │
│  $ IMPACT                                                        │
│  $3,400 above-the-line deduction surfaced                        │
│                                                                  │
│  CONFIDENCE                                                      │
│  TIER 1 — Settled law. IRC §162(l) + Notice 2008-1               │
│                                                                  │
│  CITED AUTHORITY                                                 │
│    • IRC §162(l) — self-employed health insurance deduction      │
│    • IRC §1372 — S-Corp shareholders treated as partners         │
│      (for §162(l) purposes); >2% shareholder includes premium    │
│      in Box 1 W-2 wages                                          │
│    • Notice 2008-1 — formal IRS guidance on S-Corp >2%           │
│      shareholders                                                │
│                                                                  │
│  REASONING                                                       │
│  Taxpayer is 100% S-Corp shareholder. Health insurance premium   │
│  of $14,400 was paid by the S-Corp. Per Notice 2008-1, the       │
│  premium must be added to Box 1 wages of the W-2 (which the      │
│  S-Corp did, per W-2 line 1 — $112,400 includes the $14,400      │
│  premium). The above-the-line deduction is available on Form     │
│  1040 Schedule 1 Line 17 up to the lesser of premium paid or     │
│  S-Corp earned income.                                           │
│                                                                  │
│  Return as filed claimed only $11,000 (presumably an error in    │
│  the deduction calculation worksheet). Correct deduction is      │
│  the full $14,400 — incremental benefit $3,400.                  │
│                                                                  │
│  AUDIT EXPOSURE                                                  │
│  None. Routine S-Corp tax preparation issue.                     │
│                                                                  │
│  DRAFT 8275 / DISCLOSURE                                         │
│  Not required at Tier 1 confidence.                              │
│                                                                  │
│  DOCKET LOG ENTRY                                                │
│  scan_id: a7c4e9-2026-05-11 · position_id: pos-003               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Page 6 — Position #4 (Tier 2 — Substantial Authority)

```
┌──────────────────────────────────────────────────────────────────┐
│  POSITION #4 — Tier 2 (Substantial Authority)                    │
│  ─────────────────────────────────────────────────────────────   │
│                                                                  │
│  DEDUCTION / POSITION                                            │
│  Augusta Rule rental — taxpayer rents personal residence to      │
│  S-Corp for 14 days/year for business meetings (board planning   │
│  retreats), excludes rental income under §280A(g)                │
│                                                                  │
│  LINE ITEM                                                       │
│  Schedule E zeroed (rental income excluded); S-Corp deducts      │
│  rent paid as ordinary business expense on Form 1120-S           │
│                                                                  │
│  $ IMPACT                                                        │
│  $8,500 deduction surfaced ($1,500/day × 14 days reasonable      │
│  rent for area; documented at trial)                             │
│                                                                  │
│  CONFIDENCE                                                      │
│  TIER 2 — Substantial Authority. Statutory plus consistent       │
│  case law support.                                               │
│                                                                  │
│  CITED AUTHORITY                                                 │
│    • IRC §280A(g) — 14-day rental income exclusion               │
│    • IRC §162 — ordinary and necessary business expense          │
│    • Rev. Rul. 2004-32 — reasonable rent must be "fair market    │
│      rental value"                                               │
│    • J. Yancey v. Comm'r, T.C. Summary Op. 2004-101 — Augusta    │
│      Rule application to S-Corp pays-shareholder transactions    │
│    • Sinopoli v. Comm'r, T.C. Memo 2023-105 — recent case        │
│      supporting Augusta Rule with proper documentation           │
│                                                                  │
│  REASONING                                                       │
│  This is the "Augusta Rule" strategy. Section 280A(g) allows a   │
│  taxpayer to exclude income from renting their personal          │
│  residence for fewer than 15 days/year. The S-Corp pays the      │
│  shareholder rent; the rent is deducted on Form 1120-S as        │
│  ordinary business expense (§162); the shareholder excludes      │
│  the rental income on Schedule E.                                │
│                                                                  │
│  Net effect: $8,500 deduction at S-Corp level, $0 income at      │
│  taxpayer level. Pass-through savings: $8,500 × marginal rate.   │
│  At 24% federal + 9.3% CA, savings ≈ $2,830.                     │
│                                                                  │
│  KEY REQUIREMENTS (all must be met to defend on audit):          │
│    1. Real business purpose (board meeting, strategic planning   │
│       retreat, training day) — NOT a sham                        │
│    2. Documented agenda + minutes from each meeting day          │
│    3. Reasonable rent based on local comp data ($1,500/day for   │
│       Riverside CA based on comparable conference/event venue    │
│       pricing — documented at $200/hr × 8 hrs/day)               │
│    4. Total ≤ 14 days for the year                               │
│    5. Form 1099-MISC issued by S-Corp to shareholder (NOT 1099)  │
│       and shareholder excludes via §280A(g)                      │
│                                                                  │
│  AUDIT EXPOSURE                                                  │
│  Moderate. The Augusta Rule is well-litigated and the cases      │
│  consistently uphold it WHEN the documentation is in place.      │
│  The IRS challenges Augusta Rule deductions ~30% of the time.    │
│  Reasonable Basis support is strong; Substantial Authority is    │
│  supported because of clear statutory + Tax Court support.       │
│                                                                  │
│  DRAFT 8275 / DISCLOSURE                                         │
│  Not required at Tier 2 confidence — Substantial Authority is    │
│  the §6662 standard. We recommend documentation pack be          │
│  maintained: rental agreement, daily agendas, minutes, comp data │
│  for fair market rental.                                         │
│                                                                  │
│  DOCKET LOG ENTRY                                                │
│  scan_id: a7c4e9-2026-05-11 · position_id: pos-004               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Page 7 — Position #5 (Tier 2 — Substantial Authority)

```
┌──────────────────────────────────────────────────────────────────┐
│  POSITION #5 — Tier 2 (Substantial Authority)                    │
│  ─────────────────────────────────────────────────────────────   │
│                                                                  │
│  DEDUCTION / POSITION                                            │
│  S-Corp reasonable compensation — IRS guidance positions the     │
│  taxpayer's W-2 wages ($112,400) below the "reasonable comp"     │
│  threshold for a 100% owner of a $400K-revenue construction      │
│  business; under-compensation could trigger §3121 reclass        │
│                                                                  │
│  LINE ITEM                                                       │
│  Defensive position — no immediate $ surfaced; protect against   │
│  reclassification penalty                                        │
│                                                                  │
│  $ IMPACT                                                        │
│  $4,300 (protection against reclass penalty — analysis below)    │
│                                                                  │
│  CONFIDENCE                                                      │
│  TIER 2 — Substantial Authority for the defensive position;      │
│  Reasonable Basis for the aggressive "below market" claim        │
│                                                                  │
│  CITED AUTHORITY                                                 │
│    • IRC §1366(a) — pass-through taxation of S-Corp              │
│    • Rev. Rul. 73-361 — reasonable compensation standard         │
│    • Watson v. Comm'r, T.C. Memo 2010-243 (also 668 F.3d 1008,   │
│      8th Cir. 2012) — leading case on S-Corp reasonable comp     │
│    • IRS Fact Sheet 2008-25 — IRS reasonable comp guidance       │
│    • Glass Blocks Unlimited v. Comm'r, T.C. Memo 2013-180 —      │
│      use of independent appraisal data                           │
│                                                                  │
│  REASONING                                                       │
│  Industry data (Bureau of Labor Statistics OEW 2025 + Construction│
│  Owners Association of America comp survey):                     │
│  Small construction business owner-operator (CA region, ~$400K   │
│  revenue, hands-on operator):                                    │
│    - 25th percentile: $98,000                                    │
│    - 50th percentile: $128,000                                   │
│    - 75th percentile: $172,000                                   │
│    - 90th percentile: $241,000                                   │
│                                                                  │
│  Taxpayer's W-2 wages ($112,400) fall in the 30th-40th           │
│  percentile range. This is defensible as "reasonable" but is on  │
│  the LOW side for a 100% owner who works full-time. Audit risk: │
│  the IRS could reclassify a portion of distributions as wages,   │
│  triggering FICA/Medicare on the reclassified amount + §6651     │
│  penalty.                                                        │
│                                                                  │
│  RECOMMENDATION                                                  │
│  Option A — STATUS QUO: file as is. The $112,400 is defensible   │
│  but IRS reclass risk is moderate (10-15% audit probability      │
│  given the comp data + S-Corp distribution profile).             │
│                                                                  │
│  Option B — PROACTIVE: file with internal documentation          │
│  pack (industry comp data + ownership-effort analysis +          │
│  comparable-firm survey) that establishes $112,400 at the        │
│  reasonable end of the spectrum. Documented ~2 hours of EA       │
│  time. Reduces audit risk and provides cite-ready defense if     │
│  triggered.                                                      │
│                                                                  │
│  Option C — INCREASE COMP: amend W-2 + Form 941 to raise         │
│  comp to $128,000 (50th percentile). Cost: $1,560 additional     │
│  FICA/Medicare paid. Net audit-protection benefit: ~$4,300       │
│  expected value of avoided reclass penalty.                      │
│                                                                  │
│  ANTONIO'S NOTE                                                  │
│  Antonio Vazquez (on-platform tax advisor) flags that S-Corp     │
│  reasonable-comp positions need documentation pre-prep, not      │
│  post-audit. We strongly recommend Option B or C with the next   │
│  filing.                                                         │
│                                                                  │
│  AUDIT EXPOSURE                                                  │
│  Moderate. IRS heavily audits S-Corp comp levels in $200-400K    │
│  revenue range. Watson v. Comm'r is the controlling case;        │
│  taxpayer position is defensible but not bulletproof.            │
│                                                                  │
│  DRAFT 8275 / DISCLOSURE                                         │
│  Not required at Tier 2 confidence (Substantial Authority is the │
│  §6662 standard). Recommend Form 8275-R if amending later for    │
│  aggressive position.                                            │
│                                                                  │
│  DOCKET LOG ENTRY                                                │
│  scan_id: a7c4e9-2026-05-11 · position_id: pos-005               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Page 8 — Position #6 (Tier 3 — Reasonable Basis + 8275)

```
┌──────────────────────────────────────────────────────────────────┐
│  POSITION #6 — Tier 3 (Reasonable Basis + 8275 disclosure)       │
│  ─────────────────────────────────────────────────────────────   │
│                                                                  │
│  DEDUCTION / POSITION                                            │
│  Home office deduction for S-Corp shareholder — accountable      │
│  plan reimbursement of $200/mo × 12 = $2,400 to shareholder for  │
│  exclusive-business-use of home office (60 sq ft of 1800 sq ft   │
│  primary residence)                                              │
│                                                                  │
│  LINE ITEM                                                       │
│  Form 1120-S — $2,400 ordinary business expense                  │
│  Form 1040 — no income to shareholder (accountable plan,         │
│  §1.62-2)                                                        │
│                                                                  │
│  $ IMPACT                                                        │
│  $4,800 net benefit ($2,400 corporate deduction + $2,400         │
│  excluded from W-2 wages × 1.0 marginal absorbed at corp level)  │
│                                                                  │
│  CONFIDENCE                                                      │
│  TIER 3 — Reasonable Basis WITH Form 8275 disclosure             │
│                                                                  │
│  CITED AUTHORITY                                                 │
│    • IRC §62(c) — accountable plan rules                         │
│    • Treas. Reg. §1.62-2 — accountable plan substantiation       │
│    • IRC §280A(c)(1) — home office exclusive-use requirement     │
│    • IRS Pub 587 — Business Use of Your Home                     │
│    • IRC §1372 — S-Corp shareholders treated as partners for     │
│      §280A purposes                                              │
│                                                                  │
│  REASONING                                                       │
│  The taxpayer is the sole shareholder + sole employee of the     │
│  S-Corp. Has a dedicated 60 sq ft home office (3.3% of home).    │
│  Office is used "regularly + exclusively" for business — meets   │
│  §280A(c)(1) standard. S-Corp pays $200/mo accountable-plan      │
│  reimbursement to the shareholder; shareholder excludes the      │
│  reimbursement under §1.62-2 (accountable plan).                 │
│                                                                  │
│  THE NUANCE (why Reasonable Basis, not Substantial Authority):   │
│  The Tax Court has consistently held that an S-Corp can          │
│  reimburse a shareholder for home office under §62(c). However,  │
│  there is some inconsistency in how strictly the "regularly +    │
│  exclusively" test is applied to remote work arrangements        │
│  post-COVID. IRS audit guidance suggests examiners may push      │
│  back on the rental-equivalent approach. We recommend including  │
│  Form 8275 disclosure to preempt the §6662 understatement        │
│  penalty if the position is rejected.                            │
│                                                                  │
│  ALTERNATIVE STRUCTURE (not used in return as filed):            │
│  The "no reimbursement, just deduct on Schedule A" alternative   │
│  is no longer available post-TCJA for employees (suspended       │
│  miscellaneous deductions). The accountable-plan reimbursement   │
│  is the only viable path for S-Corp shareholders.                │
│                                                                  │
│  RECOMMENDATION                                                  │
│  Amend Form 1120-S to include the $2,400 reimbursement as        │
│  ordinary expense. Attach Form 8275 disclosure (pre-drafted      │
│  below). Document:                                               │
│    1. Square footage measurement + photographs                   │
│    2. Accountable plan written policy (S-Corp board minutes)     │
│    3. Monthly reimbursement requests with substantiation         │
│    4. Receipt of payment from S-Corp                             │
│    5. Use log if practical                                       │
│                                                                  │
│  DRAFT 8275 / DISCLOSURE — PRE-DRAFTED                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Form 8275 (Rev. Aug 2013)                                  │ │
│  │ Disclosure Statement                                        │ │
│  │                                                            │ │
│  │ Part I — Information About the Position                    │ │
│  │ Item 1: Form 1120-S, Line 17 (Other deductions)            │ │
│  │ Item 2: Home office accountable-plan reimbursement under   │ │
│  │   IRC §62(c), Treas. Reg. §1.62-2, and IRS Pub 587         │ │
│  │ Item 3: $2,400                                             │ │
│  │                                                            │ │
│  │ Part II — Detailed Explanation                             │ │
│  │ Hernandez Construction Inc. (S-Corp) reimbursed its 100%   │ │
│  │ shareholder $200/month for the regular and exclusive use   │ │
│  │ of 60 square feet of his primary residence for business    │ │
│  │ purposes pursuant to §62(c) accountable plan rules. The    │ │
│  │ reimbursement is excluded from the shareholder's wages     │ │
│  │ under Treas. Reg. §1.62-2 and the position is supported    │ │
│  │ by IRS Publication 587. Documentation supporting the       │ │
│  │ accountable plan, square footage measurement, and          │ │
│  │ exclusive-use requirements is maintained by the taxpayer.  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  AUDIT EXPOSURE                                                  │
│  Moderate-high. Home office deductions are well-audited.         │
│  Form 8275 disclosure provides §6662 penalty defense even if     │
│  the position is challenged.                                     │
│                                                                  │
│  DOCKET LOG ENTRY                                                │
│  scan_id: a7c4e9-2026-05-11 · position_id: pos-006               │
│  8275_pre_drafted: yes                                           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Page 9 — Position #7 (Tier 3 — Reasonable Basis + 8275)

```
┌──────────────────────────────────────────────────────────────────┐
│  POSITION #7 — Tier 3 (Reasonable Basis + 8275 disclosure)       │
│  ─────────────────────────────────────────────────────────────   │
│                                                                  │
│  DEDUCTION / POSITION                                            │
│  Vehicle expense deduction — corporate-owned truck used >50% in  │
│  business, fully depreciated (5-year MACRS class life expired);  │
│  unreimbursed business mileage deduction for shareholder         │
│  personal vehicle used for site visits ($0.67/mi × 8,420 mi)     │
│                                                                  │
│  LINE ITEM                                                       │
│  S-Corp accountable plan reimbursement to shareholder for        │
│  business mileage on personal vehicle (Form 1120-S Line 17)      │
│                                                                  │
│  $ IMPACT                                                        │
│  $4,600 deduction surfaced ($0.67/mi × 8,420 business miles =    │
│  $5,641; net of $1,041 from existing partial reimbursement)      │
│                                                                  │
│  CONFIDENCE                                                      │
│  TIER 3 — Reasonable Basis WITH Form 8275 disclosure             │
│                                                                  │
│  CITED AUTHORITY                                                 │
│    • IRC §62(c) — accountable plan rules                         │
│    • Notice 2025-XX — 2026 standard mileage rate                 │
│    • Treas. Reg. §1.274-5 — substantiation requirements          │
│    • IRS Pub 463 — Travel, Gift, and Car Expenses                │
│                                                                  │
│  REASONING                                                       │
│  Shareholder used personal vehicle for 8,420 business miles in   │
│  2025 (documented via Triplog app). S-Corp had a partial         │
│  reimbursement program at $0.55/mi (legacy rate). Should use     │
│  IRS standard mileage rate of $0.67/mi for 2025. Difference:     │
│  $1,011 underclaimed.                                            │
│                                                                  │
│  Additionally, recommend formalize accountable plan policy +     │
│  document substantiation requirements per Treas. Reg.            │
│  §1.274-5 (mileage log, business purpose, destination, time +    │
│  place of travel, business relationship).                        │
│                                                                  │
│  WHY TIER 3 (not Tier 1):                                        │
│  The position itself (accountable-plan mileage reimbursement)    │
│  is Tier 1 Settled. But the substantiation gap from the          │
│  Triplog data — missing some business-purpose annotations on a   │
│  subset of trips — creates a documentation issue that could be   │
│  challenged. Tier 3 with 8275 disclosure protects against        │
│  §6662 if the position is partially disallowed.                  │
│                                                                  │
│  RECOMMENDATION                                                  │
│  1. Update accountable plan policy to current rate ($0.67/mi)    │
│  2. Reconstruct missing trip annotations from calendar +         │
│     project schedule (defensible audit-trail of which client     │
│     sites were visited when)                                     │
│  3. Reimburse the additional $1,011 difference                   │
│  4. Attach Form 8275 disclosure for the position                 │
│                                                                  │
│  DRAFT 8275 / DISCLOSURE — PRE-DRAFTED                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Form 8275 (Rev. Aug 2013)                                  │ │
│  │ Disclosure Statement                                        │ │
│  │                                                            │ │
│  │ Part I — Information About the Position                    │ │
│  │ Item 1: Form 1120-S, Line 17 (Other deductions)            │ │
│  │ Item 2: Business mileage reimbursement under §62(c)        │ │
│  │   accountable plan at IRS standard rate ($0.67/mi for      │ │
│  │   2025)                                                    │ │
│  │ Item 3: $5,641 (8,420 miles × $0.67/mi)                    │ │
│  │                                                            │ │
│  │ Part II — Detailed Explanation                             │ │
│  │ Hernandez Construction Inc. (S-Corp) reimbursed its        │ │
│  │ shareholder $5,641 for 8,420 business miles driven in his  │ │
│  │ personal vehicle during 2025. Substantiation was           │ │
│  │ maintained via Triplog mileage tracking application for    │ │
│  │ approximately 75% of trips; the remaining 25% has been     │ │
│  │ reconstructed from project schedules + client site visit   │ │
│  │ records + calendar entries. The accountable plan policy    │ │
│  │ is documented in S-Corp board minutes. The IRS standard    │ │
│  │ mileage rate ($0.67/mi) is used per Notice 2025-XX.        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  AUDIT EXPOSURE                                                  │
│  Moderate. Vehicle expense deductions are routine audit          │
│  triggers. Substantiation gap reconstruction is the load-bearing │
│  documentation issue.                                            │
│                                                                  │
│  DOCKET LOG ENTRY                                                │
│  scan_id: a7c4e9-2026-05-11 · position_id: pos-007               │
│  8275_pre_drafted: yes                                           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Page 10 — Position #8 (Tier 4 — MLTN, preparer judgment required)

```
┌──────────────────────────────────────────────────────────────────┐
│  POSITION #8 — Tier 4 (MLTN — preparer judgment required)        │
│  ─────────────────────────────────────────────────────────────   │
│                                                                  │
│  DEDUCTION / POSITION                                            │
│  Domestic production activities — California construction        │
│  qualifies for state-level §17052.10 New Employment Credit       │
│  ($2,600 estimated based on payroll thresholds and county        │
│  designation)                                                    │
│                                                                  │
│  LINE ITEM                                                       │
│  CA Form 540 Schedule P + Form 3554                              │
│                                                                  │
│  $ IMPACT                                                        │
│  $2,600 CA tax credit (potential)                                │
│                                                                  │
│  CONFIDENCE                                                      │
│  TIER 4 — More Likely Than Not (PREPARER JUDGMENT REQUIRED)      │
│                                                                  │
│  CITED AUTHORITY                                                 │
│    • Cal. Rev. & Tax Code §17052.10 — New Employment Credit      │
│    • CA Franchise Tax Board Form 3554 + Instructions             │
│    • FTB Notice 2024-XX (most recent guidance)                   │
│                                                                  │
│  REASONING                                                       │
│  California offers a New Employment Credit ($1,000-$4,000 per    │
│  qualifying employee) for net new hires in Designated            │
│  Geographic Areas (DGA). Hernandez Construction Inc. hired one   │
│  new employee in 2025 in Riverside County (which contains DGA    │
│  tracts in San Bernardino-Riverside region).                     │
│                                                                  │
│  WHY TIER 4 (not lower):                                         │
│  The qualifying conditions are nuanced:                          │
│    1. Hiring must be in a designated census tract (DGA) — the    │
│       new hire's residence + work location both factor           │
│    2. Hourly wage threshold ($16/hr minimum in 2025)             │
│    3. Hours worked threshold (35+ hrs/wk for 12+ months)         │
│    4. Hire must be a Designated Group member (long-term          │
│       unemployed, veteran, etc.)                                 │
│    5. CA tentative reservation required BEFORE the credit is     │
│       claimed                                                    │
│                                                                  │
│  Based on the available payroll data, conditions 2-4 appear      │
│  likely to be met but cannot be verified without additional      │
│  client interview. Condition 5 (tentative reservation) is        │
│  uncertain — the taxpayer may or may not have filed Form 3554-A  │
│  with FTB BEFORE making the hire.                                │
│                                                                  │
│  PREPARER ACTION REQUIRED                                        │
│  Before claiming this credit, the EA must:                       │
│    1. Verify hire location + employee residence are in a DGA     │
│       (check FTB DGA lookup)                                     │
│    2. Verify the wage and hours conditions                       │
│    3. Verify the employee was a Designated Group member          │
│    4. Confirm tentative reservation was filed (Form 3554-A)      │
│    5. File Form 3554 with the return                             │
│                                                                  │
│  If any of the above cannot be verified, DO NOT CLAIM. The       │
│  consequences of a wrongly-claimed CA credit are significant     │
│  (FTB clawback + interest + potential preparer penalty).         │
│                                                                  │
│  AUDIT EXPOSURE                                                  │
│  Moderate-high if claimed without proper documentation. Low      │
│  audit risk if all 5 conditions documented.                      │
│                                                                  │
│  DRAFT 8275 / DISCLOSURE                                         │
│  N/A — this is a state-level credit, not a federal position.     │
│  Federal Form 8275 does not apply. If claimed and challenged on  │
│  CA exam, defense relies on documentation pack.                  │
│                                                                  │
│  DOCKET LOG ENTRY                                                │
│  scan_id: a7c4e9-2026-05-11 · position_id: pos-008               │
│  tier_4_preparer_judgment_required: yes                          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Page 11 — Refused Positions (the trust artifact)

```
┌──────────────────────────────────────────────────────────────────┐
│  REFUSED POSITIONS                                               │
│  ─────────────────────────────────────────────────────────────   │
│                                                                  │
│  These are positions we considered and REFUSED to surface as     │
│  defensible because they fall below the Reasonable Basis floor.  │
│  Listed here for transparency — every refusal is part of your    │
│  audit defense.                                                  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ REFUSED POSITION #1                                         ││
│  │                                                             ││
│  │ POSITION CONSIDERED                                         ││
│  │ Conservation easement charitable deduction on shareholder's ││
│  │ personal residence backyard (claimed as "habitat            ││
│  │ preservation")                                              ││
│  │                                                             ││
│  │ WHY REFUSED                                                 ││
│  │ - No qualifying conservation purpose under §170(h)          ││
│  │ - No qualified organization to receive the easement         ││
│  │ - No qualified appraisal for the alleged value              ││
│  │ - Pattern matches listed transaction Notice 2017-10         ││
│  │   (syndicated conservation easements)                       ││
│  │ - Audit risk: extreme. Penalty risk: §6662(h) 40% gross     ││
│  │   valuation misstatement penalty                            ││
│  │                                                             ││
│  │ WHAT WE WOULD NEED                                          ││
│  │ A qualifying conservation purpose under §170(h)(4), a       ││
│  │ qualified organization recipient under §170(h)(3), and a    ││
│  │ qualified appraisal under §170(f)(11). None of these are    ││
│  │ present in the fact pattern.                                ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ REFUSED POSITION #2                                         ││
│  │                                                             ││
│  │ POSITION CONSIDERED                                         ││
│  │ S-Corp ordinary loss claim on shareholder's "research"      ││
│  │ expenses for a side gig (writing fiction in evenings)       ││
│  │                                                             ││
│  │ WHY REFUSED                                                 ││
│  │ - No active trade or business; hobby loss rules under       ││
│  │   §183 apply                                                ││
│  │ - No profit motive evidence                                 ││
│  │ - No business books and records                             ││
│  │ - Pattern: classic §183 hobby vs business question; would   ││
│  │   be reclassified to nondeductible hobby losses on audit    ││
│  │                                                             ││
│  │ WHAT WE WOULD NEED                                          ││
│  │ Evidence of profit motive (business plan, marketing         ││
│  │ activity, separate bank account, books and records,         ││
│  │ history of profit/loss showing intent to profit) under      ││
│  │ §183(d) and the 9-factor test of Treas. Reg. §1.183-2(b).   ││
│  │ None present.                                               ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ REFUSED POSITION #3                                         ││
│  │                                                             ││
│  │ POSITION CONSIDERED                                         ││
│  │ Augusta Rule rental at $5,000/day × 14 days = $70,000       ││
│  │ (aggressive variant of Position #4)                         ││
│  │                                                             ││
│  │ WHY REFUSED                                                 ││
│  │ - Rate ($5,000/day) is not "fair market rental value" for   ││
│  │   the Riverside CA area; comparable conference/event venue  ││
│  │   pricing supports $1,000-$2,000/day max                    ││
│  │ - At Substantial Authority threshold, the $1,500/day        ││
│  │   defensible variant is surfaced as Position #4             ││
│  │ - At Reasonable Basis threshold, $2,500-3,000/day might     ││
│  │   stretch with documentation. $5,000/day is below the floor ││
│  │ - Pattern: Augusta Rule abuse cases (e.g., Sinopoli) where  ││
│  │   the rate is inflated to maximize the deduction trigger    ││
│  │   §6662 understatement penalty                              ││
│  │                                                             ││
│  │ WHAT WE WOULD NEED                                          ││
│  │ Comparable rental data supporting $5,000/day for the        ││
│  │ Riverside CA area. None found.                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  WHY WE SURFACE REFUSALS                                         │
│  Refusing aggressive positions IS the product. Every refusal     │
│  protects the EA's PTIN. The audit-defense file generated by     │
│  Docket includes both surfaced positions AND refusals, so if     │
│  the IRS asks "why didn't you claim X?" the answer is logged.    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Page 12 — Footer + Next Step

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  YOUR AUDIT-DEFENSE STORY                                        │
│  ────────────────────────────────────────────────                │
│                                                                  │
│  Every position in this scan was generated with the              │
│  chain-of-authority logged. If this return is audited, the       │
│  defense file is one click away. That is the Docket substrate,   │
│  not a feature.                                                  │
│                                                                  │
│  Position #1: §199A QBI — full authority chain logged            │
│  Position #2: §179 expensing — election + UBIA logged            │
│  Position #3: SE health insurance — Notice 2008-1 logged         │
│  Position #4: Augusta Rule — case law + comp data logged         │
│  Position #5: Reasonable comp — BLS comp survey data logged      │
│  Position #6: Home office — 8275 disclosure logged               │
│  Position #7: Mileage — accountable plan policy logged           │
│  Position #8: CA NEC — preparer-judgment-required note logged    │
│                                                                  │
│  Refusal #1: Conservation easement — Notice 2017-10 cited        │
│  Refusal #2: Hobby loss — §183 9-factor analysis logged          │
│  Refusal #3: Augusta abuse — comp data refutation logged         │
│                                                                  │
│                                                                  │
│  COVERAGE MAP                                                    │
│  ────────────────────────────────────────────────                │
│                                                                  │
│  Detailed coverage scope: docket.com/coverage                    │
│  Federal coverage: comprehensive (IRC + Treas. Reg. + Pub +      │
│    Tax Court + recent IRBs)                                      │
│  California coverage: comprehensive (FTB + state-specific        │
│    credits + AB-150 PTET + Residency manual)                     │
│  Other states: flagged out-of-scope in scan output (we will      │
│    note "we do not cover NY/TX/FL position library yet" in       │
│    scan output)                                                  │
│                                                                  │
│                                                                  │
│  THE OFFER                                                       │
│  ────────────────────────────────────────────────                │
│                                                                  │
│  Founder rate is $250/mo, locked for life, first 50 firms.       │
│  [X] of 50 remaining. To lock yours:                             │
│                                                                  │
│       david@docket.com                                           │
│       20-min walkthrough: calendly.com/davidkim-docket           │
│                                                                  │
│  After 50 firms: $350/mo for the next 25 (still locked for       │
│  life). After 75: $400/mo for the final 25. After 100:           │
│  standard tier pricing ($499 Solo / $1,499 Small).               │
│                                                                  │
│                                                                  │
│  DISCLAIMER                                                      │
│  ────────────────────────────────────────────────                │
│                                                                  │
│  This Discovery Scan is a Position Framework artifact, not a     │
│  complete audit defense file or return preparation service.      │
│  Positions surfaced require preparer judgment plus client facts  │
│  validation. Docket does not sign returns; the preparer remains  │
│  responsible for filing. Cited authorities are current as of     │
│  2026-05-11.                                                     │
│                                                                  │
│  This scan was generated on a redacted return uploaded by the    │
│  recipient. After 7 days, the uploaded return is deleted from    │
│  Docket systems. Per-tenant DEK encryption with AAD binding +    │
│  cryptographic audit chain at SOC 2 Type II posture.             │
│                                                                  │
│                                                                  │
│  ────────────────────────────────────────────────────────────    │
│                                                                  │
│  Docket — The AI defense layer for tax practices                 │
│  david@docket.com · docket.com                                   │
│                                                                  │
│  © 2026 Docket · Scan ID a7c4e9-2026-05-11                       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Rendering notes (for Haokun's PDF generator)

| Element | Spec |
|---|---|
| Page size | US Letter (8.5" × 11"), portrait |
| Margins | 0.75" all sides |
| Body font | DM Sans 11pt, 1.5 line-height |
| Display font | Fraunces 18-24pt for section headers, 32-40pt for cover |
| Body color | `oklch(20% 0.01 60)` (warm dark gray, near-black) |
| Canvas | `oklch(98% 0.01 85)` (cream) |
| Accent | `oklch(42% 0.09 150)` (forest green) — for section borders, position numbers, callouts, CTA links |
| Border | 1px solid `oklch(85% 0.02 85)` (warm light gray) for content boxes |
| Code/log entries | `JetBrains Mono` 9pt, `oklch(35% 0.01 85)` (medium warm gray) |
| Footer pagination | "Docket Discovery Scan — [Firm Name] — Page X of N" centered at bottom |
| Watermark | Light gray Docket wordmark in center of every page at 5% opacity (legal-document feel) |
| Headers/footers | Each position page has a thin top border with "Position #N — Tier [N]" lining up with title |
| Inter-section spacing | 24px between major sections, 16px between positions |
| Empty space discipline | Every page should have at least 20% whitespace. If a position runs long, break to next page rather than cramming. |

### Length expectations

| Section | Pages |
|---|---|
| Cover | 1 |
| Executive summary | 1 |
| Position details (each position is ~1 page; 8 positions = 8 pages) | 8 |
| Refused positions | 1-2 |
| Footer + next step | 1 |
| **Total** | **~12 pages** |

For returns with fewer positions surfaced (e.g., already-tight returns with 3-4 positions), the PDF can be 7-8 pages. For returns with many positions (15+), it can be 18-25 pages.

---

## Acceptance checks (run on every PDF before delivery)

David personally reviews these on the first 30 PDFs, then the agent self-checks after:

| Check | Pass criteria |
|---|---|
| Every position has all 6 required fields | DEDUCTION + LINE ITEM + $ IMPACT + CONFIDENCE + CITED AUTHORITY + REASONING |
| Every Tier 3 position has draft 8275 attached | YES, pre-drafted in the position block |
| Every Tier 4 position has "PREPARER JUDGMENT REQUIRED" callout | YES |
| Refusal page exists with at least 1 refusal | YES (unless no aggressive positions were considered — note that in the scan) |
| Cited authorities are real IRC sections + real cases (no hallucinations) | Cross-check with knowledge graph before render |
| Dollar amounts add up to executive summary headline | Sum of position $-impact = executive summary total |
| No PII in scan output (no client name, no SSN, no EIN) | Run PII scrubber on rendered PDF text |
| Antonio's note appears on at least one position | YES (especially for nuanced or wedge positions) |
| Footer has correct slot count + Calendly link + David's email | Pull from CRM live counter |
| Disclaimer is verbatim from this template | Match exact text |

---

## What's NOT in this sample (deliberately deferred)

| Item | Why deferred |
|---|---|
| Multi-return scans (e.g., scan 5 returns at once) | Single-return is the cold-prospect flow. Founder-tier customers get batch scans. |
| K-1 / partnership-level position library | Pass-through positions can be flagged for preparer judgment. Full multi-entity scan v1.5. |
| Year-over-year delta scans | Strategy Agent territory; static return analysis in v1. |
| Multi-state side-by-side coverage | Federal + CA in v1; expansion v1.5. |
| Spanish + bilingual PDF rendering | English-only v1 per CLAUDE.md. |
| Interactive PDF (clickable position numbers, expand/collapse) | Static PDF for v1; interactive HTML version v1.5. |
| Strategy Agent recommendations (future-year planning) | Different artifact. Discovery surfaces what is missed; Strategy plans future. |

---

## Update discipline

- **After first 30 PDFs delivered**: review acceptance-check pass rate. Iterate on any check failing >5%.
- **After first 100 PDFs delivered**: review position-tier distribution + refusal-rate distribution. If <10% of scans have refusals, the refusal floor is too lenient. If >40% have refusals, prospects may bounce on the perceived "negative" framing — iterate on language.
- **After Antonio's reference scan**: capture his actual numbers + use them as the headline marketing artifact for the rest of the acquisition push. Update this sample with anonymized references.
- **Annual update** (January): refresh inflation amounts in citations (§179 limits, Augusta Rule rates, etc.) per IRS Rev. Proc.
- **When CLAUDE.md L6 pricing changes**: update footer slot count + CTA text.

---

*Created 2026-05-11. This is the gold-standard reference for what every Discovery Scan PDF looks like. Re-read before every Discovery agent prompt iteration. Drift between this sample and the production output is the bug it is designed to prevent.*
