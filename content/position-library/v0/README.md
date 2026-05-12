# Position Library v0

> *The Antonio-validated authority-citing position library that powers the Discovery agent + Position Framework. 20 positions for v1 launch (7/30/2026). 5 drafted 2026-05-11.*

This is the substrate. Every position the Discovery agent surfaces is retrieved from this library. Every cited-authority decision the AI makes traces back to a position entry here. Every audit-defense file generated leans on this library's confidence-tier classifications + cite chains. Without it, the Discovery agent has nothing to scan against. This is the load-bearing substrate, not a feature.

---

## Provenance + ownership

Per CLAUDE.md §1 + §21 #4 + `docs/CONTRACTED-EXPERT-OUTREACH.md`:

- **Antonio Vazquez, EA** (Vazant Consulting, CA, 25-year practice) is the on-platform tax advisor + signs off on every position before it ships.
- **Contracted backup advisors** ($200-400/hr, sourced from AICPA + NAEA networks) provide scale-validation when Antonio's bandwidth is constrained.
- **David Kim** drafts position research from primary authority + co-edits with Antonio.
- **Haokun Yang** wires the Position Library into the Discovery agent retrieval pipeline + serializes position entries into the knowledge graph (`packages/tax-graph`).

**Review status enum** (every entry tracks):
- `DRAFT-DAVID` — David has drafted; Antonio has not reviewed
- `PENDING-ANTONIO` — Sent to Antonio for review; awaiting his sign-off
- `ANTONIO-VALIDATED` — Antonio has signed off; entry is production-ready
- `BACKUP-VALIDATED` — Contracted backup advisor has signed off (when Antonio is bandwidth-constrained)
- `NEEDS-AMENDMENT` — Antonio (or backup) flagged corrections; David is iterating

No entry ships to production with status below `ANTONIO-VALIDATED` (or `BACKUP-VALIDATED`).

---

## v0 scope (target 20 positions by 5/30/2026)

The v0 library prioritizes positions Antonio actually encounters in his ~250-client book. These are the highest-leverage retrievals the Discovery agent will need.

### Pricing penalty framing alignment

Every position entry maps to one or more preparer penalty risks. The Discovery agent uses this mapping to surface "this is what we're protecting you from" in the scan output. Penalty schedule (from `docs/MARKETING-FRAMES.md`):

| Penalty | Amount | Trigger |
|---|---|---|
| §6695(g) due diligence | $650/failure for 2026 (Rev. Proc. 2025-32) | Missing/incomplete EITC/CTC/AOTC/HOH checklist |
| §6694(a) unreasonable position | $1,000 OR 50% of fees | Position without Substantial Authority + no disclosure |
| §6694(b) willful/reckless | $5,000 OR 75% of fees | Reckless or intentional disregard |
| §6695(a)-(e) procedural | $60-$650 each | Sign return, furnish copy, retain copies, EIN, etc. |
| §6701 aiding understatement | $1,000 / $10,000 corp | Knew or should have known |

### v0 entry list (13 drafted; 7 queued — as of 2026-05-11 evening)

| # | Position | File | Status | Tier (typical) | Penalty exposure |
|---|---|---|---|---|---|
| 1 | §199A Qualified Business Income deduction | [p001-section-199a-qbi.md](positions/p001-section-199a-qbi.md) | DRAFT-DAVID | Tier 1 (Settled) | §6694(a) if mis-classified SSTB |
| 2 | §179 expensing for tangible §1245 property | [p002-section-179-expensing.md](positions/p002-section-179-expensing.md) | DRAFT-DAVID | Tier 1 (Settled) | §6694(a) if property non-qualifying |
| 3 | SE health insurance for S-Corp 2% shareholder | [p003-se-health-insurance-s-corp.md](positions/p003-se-health-insurance-s-corp.md) | DRAFT-DAVID | Tier 1 (Settled) | §6695(a)-(e) procedural |
| 4 | Augusta Rule §280A(g) 14-day rental | [p004-augusta-rule-280a-g.md](positions/p004-augusta-rule-280a-g.md) | DRAFT-DAVID | Tier 2 (Substantial Authority) | §6694(a) if rate not FMV |
| 5 | Home office accountable plan reimbursement for S-Corp shareholder | [p005-home-office-accountable-plan.md](positions/p005-home-office-accountable-plan.md) | DRAFT-DAVID | Tier 3 (Reasonable Basis + 8275) | §6694(a) if 8275 not filed |
| 6 | S-Corp reasonable compensation (Watson v. Comm'r framework) | [p006-s-corp-reasonable-compensation.md](positions/p006-s-corp-reasonable-compensation.md) | DRAFT-DAVID | Tier 2 | §6694(a) + §3121 reclassification |
| 7 | Accountable plan vehicle mileage reimbursement (standard rate) | [p007-accountable-plan-vehicle-mileage.md](positions/p007-accountable-plan-vehicle-mileage.md) | DRAFT-DAVID | Tier 1 / Tier 3 (substantiation) | §6694(a) if substantiation gap |
| 8 | EITC due-diligence checklist (Form 8867) | [p008-eitc-due-diligence-form-8867.md](positions/p008-eitc-due-diligence-form-8867.md) | DRAFT-DAVID | Tier 1 (procedural) | **§6695(g) primary — load-bearing** |
| 9 | CTC + ODC due-diligence checklist | [p009-ctc-odc-due-diligence.md](positions/p009-ctc-odc-due-diligence.md) | DRAFT-DAVID | Tier 1 (procedural) | §6695(g) primary |
| 10 | AOTC due-diligence checklist | [p010-aotc-due-diligence.md](positions/p010-aotc-due-diligence.md) | DRAFT-DAVID | Tier 1 (procedural) | §6695(g) primary |
| 11 | HOH filing status due-diligence checklist | (queued) | — | Tier 1 (procedural) | §6695(g) primary |
| 12 | CA AB-150 Pass-Through Entity Tax (PTET) election | (queued) | — | Tier 1 (CA-specific) | CA preparer penalty |
| 13 | Real estate professional status under §469(c)(7) | (queued) | — | Tier 2-3 | §6694(a) if hours not documented |
| 14 | Roth IRA backdoor conversion (Notice 2014-54) | (queued) | — | Tier 1 (Settled) | §6694(a) if pro-rata mis-applied |
| 15 | Mega backdoor Roth (after-tax 401(k) → Roth) | (queued) | — | Tier 2 | §6694(a) edge cases |
| 16 | Self-rental rules under §469(c)(2) + §1.469-2(f)(6) | (queued) | — | Tier 2-3 | §6694(a) + §469 grouping |
| 17 | Augusta Rule abusive variant (REFUSED template) | [p017-augusta-rule-abusive-refused.md](positions/p017-augusta-rule-abusive-refused.md) | DRAFT-DAVID | **REFUSED below RB** | §6694(b) trigger if claimed |
| 18 | Conservation easement charitable deduction (REFUSED; Notice 2017-10) | [p018-conservation-easement-refused.md](positions/p018-conservation-easement-refused.md) | DRAFT-DAVID | **REFUSED below RB** | §6662(h) 40% penalty if claimed |
| 19 | Hobby loss §183 reclassification (REFUSED template) | [p019-hobby-loss-183-refused.md](positions/p019-hobby-loss-183-refused.md) | DRAFT-DAVID | **REFUSED below RB** | §6662 + §183 reclass |
| 20 | Cost segregation study acceleration on rental property | (queued) | — | Tier 1-2 | §6694(a) edge cases |

**Cadence (updated 2026-05-11 evening)**: 13 drafted 5/11. Antonio reviews entries 1-5 (substantive Tier 1-3) starting 5/12. Entries 6-10 (substantive + due-diligence procedural) reviewed 5/15-5/22. REFUSED entries 17-19 reviewed 5/19-5/26. Next 7 queued (#11, #12, #13, #14, #15, #16, #20) drafted 5/19-5/26. All 20 Antonio-validated by 5/30 to support the Antonio production sub-milestone + 6/15 reference Discovery Scan delivery.

---

## File format spec (each position entry)

Every entry uses this structure. Drift between this spec and any individual entry is the bug.

```markdown
# Position p###: [Title]

## Status
- **Tier classification**: [Tier 1 Settled / Tier 2 Substantial Authority / Tier 3 Reasonable Basis + 8275 / Tier 4 MLTN / REFUSED-below-RB]
- **Review status**: [DRAFT-DAVID / PENDING-ANTONIO / ANTONIO-VALIDATED / BACKUP-VALIDATED / NEEDS-AMENDMENT]
- **Last reviewed**: [YYYY-MM-DD by reviewer]
- **Effective date range**: [tax years for which this applies]
- **Next mandatory refresh**: [trigger — typically annual Rev. Proc. or specific case law]
- **Penalty exposure if mis-applied**: [§6694(a) / §6694(b) / §6695(g) / §6701 / etc]

## Position statement
[One sentence: what the deduction, credit, or position IS]

## Plain-English description
[2-4 paragraphs explaining what this position is, who it applies to, and why an EA cares. This is the language the Discovery agent surfaces to a non-tax-trained audience.]

## Fact pattern triggers
[Bulleted list: every fact pattern in a client's return that should trigger the Discovery agent to consider this position. This is what the pgvector + BM25 retrieval matches against.]

## Cited authority chain
[Numbered list, in order of authority weight: IRC sections → Treas. Regs → Rev. Ruls. → Tax Court / Federal Circuit / SCOTUS → IRBs → Notices → IRS Pubs → CCAs / PLRs. Each citation includes section number + brief description.]

## 4-tier confidence rationale
[2-3 paragraphs: why this position falls in its tier. What authority supports it at that tier. Where the line is between this tier and the tier below.]

## Required substantiation
[Bulleted list of documentation a preparer must maintain for this position to defend on audit.]

## Draft 8275 disclosure (if Tier 3)
[Pre-drafted Form 8275 disclosure language, copy-paste-ready. For Tier 1-2 entries: "Not required at this confidence level." For Refused entries: N/A.]

## Common audit-defense framing
[2-3 paragraphs: how an EA defends this position on examination. What examiners typically ask for. What the chain-of-authority looks like.]

## Common mis-uses / failure modes
[Bulleted list: ways this position gets mis-applied. Why those mis-uses trigger penalty exposure. The Refusal Floor: when does this position cross from Tier 3 to BELOW REASONABLE BASIS.]

## Cross-references to related positions
[Linked list to other entries in this library.]

## Version history
- v0.1 [date] [reviewer] — Initial draft
- v0.2 [date] [reviewer] — [reason for revision]
```

---

## How the Discovery agent uses this

Per `docs/DISCOVERY-SCAN-OPERATIONAL.md` §"Discovery agent technical spec":

1. **Indexing**: Haokun's pipeline ingests every position entry into the pgvector authority library + BM25 keyword index in Phase 2-expansion of the substrate ramp.
2. **Retrieval**: when the Discovery agent processes a client's return, it runs each line item + schedule combo against the library. Top-k retrieval (k=5) surfaces candidate positions.
3. **Classification**: for each candidate, the agent uses the entry's tier classification + cited authority chain to assemble the 4-tier confidence rating for THIS client's fact pattern (may downgrade if substantiation gap).
4. **Refusal floor**: positions whose tier downgrades below Reasonable Basis get refused with a documented reason (entry's "Common mis-uses / failure modes" section provides the refusal rationale).
5. **8275 generation**: for Tier 3 positions, the agent uses the entry's "Draft 8275 disclosure" template + the client's specific facts to generate the disclosure.
6. **Output**: the Discovery Scan PDF surfaces each surfaced + refused position with cite chain pulled from this library.

The library is the source of truth. The agent is the retrieval + reasoning layer on top.

---

## What's NOT in v0 (defer to v1.5+)

| Item | Why deferred |
|---|---|
| State-specific position libraries beyond CA | Federal + CA in v0; expand to NY, TX, FL post-launch |
| Multi-entity flow-through (K-1, K-3) positions | Multi-entity workspace v1.5 per L12 |
| Trust + estate positions | Edge segment; defer until trust + estate preparer cohort signals |
| International (FBAR, FATCA, GILTI, FDII) positions | Edge segment; defer |
| Bilingual position summaries | English-only v1 |
| Position library for Path 2 partners (read-only API access to entries) | Lives behind the Path 2 API tier per L1; ship v1.5 |
| Versioned position library (effective-date for past tax years 2020-2024) | v1 covers TY2024 + TY2025 + TY2026; backfill 2020-2023 v1.5 |
| Position library audit-trail (which agent used which entry when) | Built INTO the audit chain; surface via UI v1.5 |

---

## Review workflow

1. **David drafts** an entry. Sets status to `DRAFT-DAVID`. Commits to repo.
2. **David sends** the entry file path to Antonio via email (subject: "Position library review: [Position title]"). Asks Antonio to review within 5 business days.
3. **Antonio reviews**. Two outcomes:
   - **Sign-off**: Antonio replies "approved as written" or "approved with these edits [list]." David applies edits, sets status to `ANTONIO-VALIDATED`, commits.
   - **Amendment needed**: Antonio flags substantive issues. David sets status to `NEEDS-AMENDMENT`, iterates, re-submits.
4. **Backup advisor fallback**: if Antonio's bandwidth is constrained (e.g., during his audits), David escalates to contracted backup advisor per `docs/CONTRACTED-EXPERT-OUTREACH.md`. Backup-validated entries are flagged `BACKUP-VALIDATED` (not `ANTONIO-VALIDATED`) — they ship to prod but get re-validated by Antonio when bandwidth returns.

Sign-off captured in writing (email, Slack, or signed PDF). Reference saved in the position file's "Version history" section.

---

## Penalty risk allocation

| Penalty type | Library entries that protect against it | Library entries that risk triggering if mis-applied |
|---|---|---|
| §6695(g) due diligence | #8 EITC / #9 CTC / #10 AOTC / #11 HOH (procedural checklists) | None — these entries ARE the checklists |
| §6694(a) unreasonable position | All Tier 1-2 entries with substantial authority | Tier 3 entries if 8275 not filed; Tier 4 entries always |
| §6694(b) willful/reckless | All entries — the Refusal Floor IS the §6694(b) protection | REFUSED entries (#17, #18, #19) if claimed anyway |
| §6695(a)-(e) procedural | #3 SE health insurance (W-2 reporting), #7 mileage (substantiation) | Any entry with weak substantiation requirements |
| §6701 aiding understatement | All Tier 1-2 entries | Any REFUSED entry claimed despite the refusal |

---

## Update discipline

- **Per-entry annual refresh**: every January, refresh inflation amounts in cites per IRS Rev. Proc. update.
- **Per-entry case-law refresh**: every 6 months, scan recent Tax Court / Federal Circuit decisions on each position for new case law that changes tier classification.
- **New entry pipeline**: David + Antonio identify 1-2 new positions per month from Antonio's actual client work. Antonio is the gatekeeper for which positions enter the library.
- **Per-entry usage telemetry**: once the Discovery agent is in production, log how often each entry is retrieved + how often it's surfaced vs refused. Top 5 most-used entries get prioritized for tier-classification refinement.
- **Antonio audit feedback**: every position used in Antonio's active audits gets reviewed quarterly for whether the audit experience surfaced any gaps in the entry (e.g., examiner asked for documentation we didn't anticipate).

---

*Created 2026-05-11. The Position Library is the load-bearing substrate. Drift between this README + individual entries + the deployed Discovery agent is the bug it is designed to prevent.*
