# Tax Position Framework

> *AI surfaces every defensible position with risk-adjusted documentation. EA decides.*

This document is the canonical answer to: how does Docket handle deductions, gray-area positions, and aggressive planning without putting an EA's PTIN at risk?

The framework lives at the intersection of three constraints:

1. **Circular 230** governs preparer conduct. Below-reasonable-basis positions are misconduct.
2. **§6694** imposes preparer penalties for understatements without substantial authority (or reasonable basis with disclosure).
3. **AICPA SSTS** (Statements on Standards for Tax Services) — the professional ethics floor. Members must comply or lose certification.

Every architectural choice in Docket's deduction surface flows from these three. Re-read them before changing anything in this doc.

---

## 1. The framing — never "AI maximizes deductions"

The wrong framing is "AI maximizes deductions." It's the Turbotax framing — and it works for Turbotax because the *taxpayer* signs the return. Their PTIN doesn't exist. Their license doesn't get suspended.

The right framing for Docket is:

> AI surfaces every defensible position with risk-adjusted documentation, and the EA decides.

Three reasons this matters more than any other product framing decision:

- **The PTIN is on every return.** Antonio's livelihood is at stake on every position the AI suggests. He will not adopt a tool that asks him to ship a position he can't defend.
- **Marketing the wrong frame attracts the wrong clients.** "Loophole finder" copy attracts taxpayers looking to evade. "Catches every defensible deduction your team would have caught with unlimited time" attracts professionals.
- **It IS the differentiator.** Consumer tools can be aggressive. Funded competitors at the return-prep layer (Accrual, Black Ore, Basis) target Big 4 / top-100 firms where in-house tax counsel handles the legal risk. Nobody in our segment is building a tool that holds the compliance line correctly. That's the lane.

---

## 2. The four confidence tiers + the refusal floor

Every deduction or position the AI surfaces is classified into exactly one of four tiers, plus a fifth "refusal" outcome below the floor.

### Tier 1 — Settled law

- **Standard**: clear authority, no reasonable challenge.
- **Examples**: standard deduction; clearly ordinary and necessary trade-or-business expenses; depreciation tables; W-2 box 1 reporting.
- **AI behavior**: recommends directly, no friction. Single click to accept.
- **EA behavior**: rubber-stamp. Audit log records "AI-tier-1, EA accepted, T+0s."

### Tier 2 — Substantial authority (~40% sustainability)

- **Standard**: weight of authority supporting the position is substantial in relation to authority against. Most legitimate planning lives here.
- **Examples**: home office (regular and exclusive use); accountable plans; S-corp reasonable comp within established ranges; standard mileage vs. actual; SEP-IRA / solo 401(k) contributions; QBI optimization at the §199A safe-harbor.
- **AI behavior**: recommends with cited authority inline. Surfaces the IRC / Treas. Reg. / Rev. Rul. / case law that supports the position. Confidence label visible.
- **EA behavior**: reviews authority, accepts. Audit log records the cited authority *at the moment of decision* (so a future change to the underlying authority doesn't retroactively undermine the decision).

### Tier 3 — Reasonable basis (~20% sustainability, requires Form 8275 disclosure)

- **Standard**: position is reasonable but does not meet substantial authority. Reasonable-basis-with-disclosure avoids the §6694 substantial-understatement penalty by attaching Form 8275 to the return.
- **Examples**: Augusta rule (§280A(g)) when the home rental is to the taxpayer's own business; hiring minor children with documented services; cost segregation on edge property classifications; real estate professional status when material participation is borderline; aggressive entity classification elections.
- **AI behavior**: recommends with cited authority AND mandatory disclosure-suggestion attached. Generates draft 8275 disclosure. Surfaces the documentation checklist required to defend.
- **EA behavior**: explicit toggle: "Accept with 8275" vs "Reject" vs "Modify to Tier 2 alternative." No silent acceptance. Audit log records: position, authority, EA's choice, generated 8275 (if accepted).

### Tier 4 — More likely than not (>50% required for tax shelters / listed transactions)

- **Standard**: legally required for Reportable Transactions (§6011), Listed Transactions, and certain tax shelters. Higher bar than substantial authority.
- **Examples**: complex partnership allocations under §704(b); some captive insurance structures; conservation easements; §1031 exchanges with related-party concerns; some cost-seg studies on single-asset partnerships.
- **AI behavior**: flags the higher standard explicitly. Refuses to draft until EA explicitly overrides with a "I've reviewed the higher-bar requirement" attestation.
- **EA behavior**: hard stop. Cannot proceed via a single click. Must affirmatively attest. Audit log records the attestation text + timestamp + EA's user ID.

### Below reasonable basis — REFUSAL

- **Standard**: no substantial authority, no reasonable basis. Suggesting this position would constitute Circular 230 §10.34 misconduct (preparer realistically should know the position would not be sustained).
- **AI behavior**: refuses. Surfaces *why* it refused (which standard fails) and what additional facts/authority *might* move it to Tier 3.
- **EA behavior**: cannot override via the AI surface. Must take the position outside Docket if at all (and Docket logs that the EA was warned).

> **The refusal is a feature, not a limitation.** It's what makes the rest of the AI trustworthy. Antonio knows that if Docket suggests a position, it cleared the floor.

---

## 3. The structured position object

Every recommendation the AI emits — Tier 1 through Tier 4 — is a structured object, not free-text:

```typescript
type TaxPosition = {
  id: string;                          // ULID
  clientId: string;
  engagementId: string;                // links to specific tax-year engagement
  taxYear: number;

  // Identity
  positionType: string;                // "home_office" | "augusta_rule" | ...
  irc_section: string;                 // "§280A(c)(1)"
  treas_reg: string | null;            // "Treas. Reg. §1.280A-2"
  controlling_case: string | null;     // "Soliman v. Commissioner, 506 U.S. 168"
  rev_ruling: string | null;           // "Rev. Rul. 2024-XX"
  authority_as_of_date: string;        // ISO date — captures the day this authority was current

  // Confidence
  tier: 'settled' | 'substantial' | 'reasonable_basis' | 'more_likely_than_not';
  sustainability_estimate_pct: number; // ai's numeric estimate, 0-100
  disclosure_required: boolean;        // true → 8275 needed
  reportable_transaction: boolean;     // true → triggers §6011 reporting

  // Impact
  estimated_savings_low: number;       // dollar range
  estimated_savings_high: number;
  multi_year_impact: { year: number; estimated_savings: number }[] | null;

  // Risk
  audit_dif_score_delta: number | null;       // estimated DIF score impact
  similar_position_audit_rate: number | null; // historical audit rate for this position type
  documentation_checklist: string[];           // ["mileage log", "exclusive-use photos", ...]

  // EA decision (filled when EA acts)
  ea_decision: 'accepted' | 'modified' | 'rejected' | 'pending' | null;
  ea_decision_at: string | null;
  ea_decision_user_id: string | null;
  ea_modified_to_tier: TaxPosition['tier'] | null;
  ea_rejection_reason: string | null;
  generated_8275_id: string | null;            // links to disclosure_filings row

  // Provenance
  triggered_by: 'discovery' | 'strategy' | 'position_request';
  source_artifact_ids: string[];               // emails, docs, bank-feed rows that triggered this
};
```

Three things this shape enforces:

1. **The cited authority is captured at decision time, not at retrieval time.** If a Rev. Proc. is superseded next year, last year's return decision still reads "EA accepted on date X with authority Y" — that's the audit defense.
2. **The EA's choice is explicit and logged.** Acceptance, modification, rejection — all timestamped. The `actions` table audit trail captures the click. The `tax_positions` row captures the *reasoning context* of the click.
3. **No free-text "AI suggested home office."** Free text is unsearchable, unaggregatable, undefendable. Structured fields support: "show me every Tier-3 position Antonio took in 2026 and the authority he cited."

---

## 4. The three modes

The framework operationalizes through three distinct operating modes. The same AI core, three different triggers and surfaces.

### Discovery mode (continuous, background)

The wedge feature. Runs on a cron + event triggers. Reads the full client context (every email, doc, bank feed row, prior-year return, Xero entry, message thread) and surfaces missed deductions.

This is the closed loop in action. Most deductions get missed not because the EA doesn't know the rule — they get missed because no human can hold three years of context across 200 clients in their head while doing real work.

**Triggers**:
- New email lands in shared inbox → scan for deduction triggers.
- Bank feed transaction syncs → match against deductible-pattern library.
- Document gets classified → cross-reference with prior-year positions.
- Year-end / quarter-end → batch-scan all clients for retirement, QBI, depreciation timing.

**Surface**: rows in `/inbox` Discovered column. Each row shows the structured TaxPosition object. EA acts: accept (queues for next prep) / dismiss (logged with reason) / modify.

**The EA-facing pitch**: "Docket found you $47K in missed deductions across 80 clients last quarter."

That number — quantifiable, demonstrable — closes deals. It's the wedge.

### Strategy mode (EA-initiated)

EA queries: "tell me everything I should consider for client X given their full situation." AI returns a ranked list of strategies with multi-year modeling.

**Triggers**: explicit EA prompt. Either via command palette ("strategy for John") or per-client right-rail action.

**Coverage**:
- Entity restructuring (Schedule C → S-corp, S-corp → C-corp, single-member LLC → partnership)
- Retirement plan choices (SEP vs solo 401(k) vs cash-balance plan)
- Depreciation elections (§179 vs bonus vs MACRS, §168(k) phase-out timing)
- Accounting method changes (cash vs accrual, §263A capitalization)
- QBI optimization (aggregation election, W-2 + UBIA strategies)
- State residency planning
- Roth conversion ladders
- Multi-year income smoothing

Each strategy returns: cost (legal/admin to implement), savings (multi-year), risk (tier classification), complexity (EA hours required to defend).

**Surface**: ranked table in command room. EA picks one to model in detail. Detail view shows year-by-year projection, breakeven, and the 8275 disclosure (if any) required.

### Position mode (aggressive territory)

EA says: "client wants to do X." AI builds the strongest possible defense.

This is where the framework's *refusal* teeth matter most.

**Flow**:

1. EA describes the position (e.g., "client wants to claim Augusta rule for 14 days at $4,500/day rate").
2. AI evaluates against the four-tier framework.
3. If Tier 1-3: AI builds the defense package — IRC cites, controlling cases, draft memo, documentation checklist, 8275 if Tier 3.
4. If Tier 4: AI builds the defense + flags the higher standard + requires explicit attestation.
5. If below Reasonable Basis: **AI refuses to draft**. Surfaces the failing standard. Optionally surfaces "what facts/authority would move this to Tier 3?"

The refusal is a logged event in the `actions` table — Docket can show the audit trail "client requested aggressive position X on date Y, AI refused, EA proceeded outside Docket / EA dropped the position." Either is defensible to the IRS or to a malpractice insurer.

---

## 5. Knowledge architecture (no parametric memory for tax law)

Tax law is the worst possible domain for parametric LLM memory:

- It changes constantly (OBBBA reset dozens of TCJA provisions in 2025; annual inflation adjustments; state law per-jurisdiction).
- It's high-stakes and dated — a Rev. Proc. superseded last month gives wrong answers if the model trained 18 months ago.
- It has 50+ jurisdictions (federal + states + cities like NYC + sometimes localities).

Docket's knowledge layer is **retrieval over a curated, dated authority library**. The AI never relies on parametric recall for a citation it could be wrong about.

### Authority library structure

```
content/authority/
  federal/
    irc/                        # full IRC, version-stamped per amendment date
    treas-regs/                 # by section
    irs-pubs/                   # current + 3 prior years
    notices/
    rev-rulings/
    rev-procs/
    chief-counsel-advice/
    actions-on-decisions/
    irm/                        # Internal Revenue Manual
  case-law/
    tax-court/                  # with shepherding for current validity
    circuit/
    supreme-court/
  professional/
    aicpa-ssts/
    circular-230/
  states/
    ca/
      ftb-pubs/
      ftb-legal-rulings/
      cdtfa/                    # sales/use
      edd/                      # payroll/worker classification
      residency-manual/
    [other states added as design partners come online]
```

Each chunk in the library is stamped with:

- `effective_from` (date the authority took effect)
- `superseded_at` (null if still current; date if rolled back)
- `superseded_by` (cite to the replacement authority)
- `vector_embedding` (for retrieval)
- `tier_classification` (which tier this authority would support — populated by the curator, not the AI)

When a `TaxPosition` is generated, the AI retrieves authority from this library, cites it inline, and the cite includes the `effective_from` date. If a Rev. Proc. gets superseded next month, the next return touching that issue surfaces a "STALE CITE" warning automatically.

### What we build vs. what we license

**Build (the moat)**:
- Federal: IRC, Treas. Regs, IRS Pubs, Rev. Rulings, Rev. Procs, current + 3 prior years. Public domain or government-published. Free to ingest.
- State: California first (Antonio's jurisdiction). FTB pubs + Legal Rulings + residency manual. Public, free.
- Internal playbooks. The real moat. Built from Antonio's actual cases, written up as structured memos.

**License (defer)**:
- Bloomberg Tax, Thomson Reuters Checkpoint, CCH AnswerConnect — editorial commentary. Expensive ($15-40k/seat/yr). Not needed for v1; primary sources + internal playbooks cover the majority of practical positions. Add when usage data shows specific gaps.

**Partner (v1.5)**:
- Blue J for outcome prediction (judicial precedent ML). Their ML over our case-law-cited TaxPosition objects becomes "what would the Tax Court do."

---

## 6. What this framework requires in the build

### Schema additions (Phase 1, Wks 1-2)

- `tax_positions` table (the structured object above)
- `disclosure_filings` table (8275 generation tracking, links to TaxPosition rows)
- `authority_chunks` table (the dated authority library; pgvector for retrieval)
- `position_library` seed data (~50 common Tier 1-3 positions to anchor retrieval)
- New audit-trail action class: `propose-position` and `decide-position`

### Agent additions (Phase 3, Wks 5-6)

Three agents added to the fleet (CLAUDE.md §9):

| Agent | Mode | Trigger | Output |
|---|---|---|---|
| **Discovery agent** | continuous | cron + signal/received events | TaxPosition rows in Discovered queue |
| **Strategy agent** | EA-initiated | command palette / per-client action | ranked-list table + multi-year model |
| **Position agent** | EA-initiated | "client wants X" prompt | defense package OR refusal |

All three call `runDocketAgent` (services/orchestrator), so cost telemetry + audit + caching apply automatically.

### UI surfaces (Phase 4, Wks 7-8 — Manager mission control)

- **Tier indicator**: every TaxPosition row in the UI shows its tier as a color-coded pill (green = Tier 1, amber = Tier 2, orange = Tier 3, red = Tier 4, gray = below floor / refused). Same color language across `/inbox`, client detail, return prep.
- **Authority inline**: hover on any cite expands to the full authority text + `effective_from` date.
- **Audit defense export**: one-click PDF per return: every position taken, EA's decision, the cited authority at decision time, the 8275 disclosures filed. This becomes the file the EA hands to Tax Court / IRS exam / malpractice carrier if needed.

### Trust escalation reframed (CLAUDE.md §8)

The four levels in §8 (Suggest+explain → Suggest+shorthand → Auto-execute-low-risk → Full-autopilot) map onto position tiers, not generic action classes:

- **Level 1 firm**: AI proposes, EA decides every Tier 1-4 position. (Antonio's starting state.)
- **Level 2 firm**: AI auto-accepts Tier 1 (settled-law) positions; EA decides Tier 2-4. Logged for review.
- **Level 3 firm**: AI auto-accepts Tier 1-2 with substantial authority; EA decides Tier 3-4. EA reviews Level-2 log weekly.
- **Level 4 firm**: AI auto-accepts Tier 1-2; auto-flags Tier 3 with default disclosure; EA decides Tier 4.

Tier 4 always requires human attestation. Tier 5 (below floor) always refuses. These never escalate.

---

## 7. Marketing copy lock

**For firm-side marketing (the EA-facing pitch)**:

- ✅ "Catches every defensible deduction your team would have caught with unlimited time."
- ✅ "Audit trail built in for every position taken."
- ✅ "Compliance-first AI that won't put your PTIN at risk."
- ✅ "Discover, defend, document — every position, every cite, every decision logged."
- ❌ "Maximize your client's refund." (Wrong audience signal.)
- ❌ "Find loopholes." (Attracts the worst clients; repels sophisticated EAs.)
- ❌ "AI handles your taxes." (Black-box framing — the opposite of what we sell.)

**For client-side marketing**: not Docket's job. Antonio's firm sets its own posture (conservative, balanced, aggressive within compliance). Docket gives every firm the *range*, not the *posture*.

---

## 8. Success metrics

What we measure to know the framework is working:

- **EA acceptance rate by tier** — Tier 1 should be ~95%+ acceptance (rubber stamp). Tier 2 should be 70%+ (EA reviews authority). Tier 3 should be 30-50% (EA decides whether to accept the disclosure burden). If Tier 1 acceptance drops, the AI is surfacing junk. If Tier 3 acceptance is too high, the AI is being too aggressive.
- **Refusal rate** — should be small but non-zero. Zero refusals means the AI isn't actually applying the floor (concerning). High refusal rate (>10% of position requests) means client targeting is wrong.
- **Audit defense exports per return** — every return should have one. If they don't, EAs aren't using the audit trail and we have a UX gap.
- **Stale-cite warnings hit** — when authority gets superseded, returns referencing it should surface warnings. Zero warnings ever means our staleness tracking isn't working.
- **Discovered $ surfaced per quarter** — the wedge metric. The number we put in marketing copy.

---

## 9. What this framework does NOT do

To prevent feature creep into compliance violations:

- **Does not generate fake source documents.** Ever. No "draft a receipt for the home office expense the client claims they had."
- **Does not retroactively edit prior-year positions.** A Tier-3 position taken in 2024 stays at Tier 3 in the audit log even if the underlying authority changes in 2026. The audit defense file is the historical record.
- **Does not optimize for refund alone.** A Roth conversion suggestion considers the full multi-year tax picture, not just this year's bracket.
- **Does not advise on illegal positions.** The Tier-5 refusal is hard-coded. No prompt engineering can unlock it. (Adversarial prompt-injection defense lives at the orchestrator layer.)

---

## 10. Read also

- [`CLAUDE.md` §8](../CLAUDE.md) — the six AI intelligence layers + trust escalation
- [`CLAUDE.md` §9](../CLAUDE.md) — agent fleet (discovery / strategy / position agents land here)
- [`CLAUDE.md` §12](../CLAUDE.md) — knowledge layer (the authority library)
- [`CLAUDE.md` §13](../CLAUDE.md) — competitive whitespace bets (this framework IS bet #1's actual mechanism)
- [`docs/STRATEGIC-BRIEF.md`](STRATEGIC-BRIEF.md) — strategic context

---

*Last updated: 2026-05-08. Authored alongside the post-finalize-debugging session, after the YC AI-native company framing locked in and after David's strategic question forced the position-tier scaffolding to be made explicit. Framework is the product. Re-read before changing anything in §1, §2, or §9.*
