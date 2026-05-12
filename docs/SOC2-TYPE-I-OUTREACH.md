# SOC 2 Type I Bridge — vendor outreach kit

> *Schedule SOC 2 Type I engagement for Q4 2026 to bridge from "controls in codebase" (today) to SOC 2 Type II report (mid-2027).*
> *Created 2026-05-11.*

---

## Why this exists

CLAUDE.md **L8** locks the posture: build SOC 2 Type II controls into the codebase NOW, document policies in `docs/security/`, defer Drata/Vanta attestation until capital lands. **The controls are real** (per-tenant DEK, audit chain, RLS, MFA, encryption-at-rest + in-transit, webhook verification, PII scrubber, change management, access reviews, incident response, BCP, risk register, controls matrix — all in `docs/security/`).

But there's a **2027 sales-cycle gap** the L8 lock doesn't address:

- Mid-market firm CIOs (the buyers of partner #2 and beyond) **require a SOC 2 Type II report** as a procurement gate.
- The Type II audit period is **6-12 months of operating with controls**, followed by the audit itself.
- If we start Drata/Vanta in Q1 2027, the **earliest possible Type II report lands late 2027**.
- That means Q1-Q3 2027 mid-market sales is **gated on a report we don't have yet**.

The **bridge is SOC 2 Type I**: a point-in-time attestation that controls are designed and implemented at a specific date. ~3 month engagement, ~$15-25K, ships Q1 2027. The bridge buys us mid-market trust through Q3 2027 while Type II is in flight.

Without the Type I bridge: mid-market sales constrained to firms that accept "Type II in progress" with no formal report. With it: every mid-market CIO sees a valid attestation.

---

## Recommended vendors

### 1. Drata — primary

[drata.com](https://drata.com)

**Why first**: market-leading SOC 2 platform. Integrates with our infra (Vercel, Neon, GitHub, AWS, Anthropic). Auto-evidence collection. Type I + Type II under one contract.

**Pricing expectation**: ~$15-20K/yr for Type I + first-year Type II audit prep. Type II audit itself is a separate audit-firm engagement (~$20-40K). Drata's tooling cost is the recurring piece.

### 2. Vanta — alternative

[vanta.com](https://vanta.com)

**Why second**: similar product, similar pricing, slightly different integration footprint. Useful as a price-comparison + alternative if Drata's quote runs high.

**Pricing expectation**: similar to Drata; $15-25K/yr range for compliance platform; separate audit-firm engagement on top.

### 3. Audit-firm-direct alternative

Some founders skip the compliance platform entirely and engage an audit firm (Schellman, Coalfire, Prescient Assurance) directly. Cheaper short-term (~$10-15K just for the Type I report, no recurring tooling cost) but more manual evidence-collection work. **Not recommended for a 2-person team**; the platform saves engineering time that's worth more than the tooling fee.

---

## Sample vendor outreach message

```
Hi [vendor sales contact],

I'm David Kim, CEO of Docket. We're a Y Combinator Fall 2026 applicant building
an AI compliance + audit platform for tax practices (operating system framing).

We're at the stage where we have:
  • SOC 2 Type II controls built into the codebase (per-tenant DEK encryption,
    cryptographic audit chain, RLS at ENABLE+FORCE, MFA via Clerk, full
    encryption at rest + in transit, webhook signature verification,
    PII regex scrubber, change management via protocol-gate hooks)
  • 12-doc policy + procedure set in docs/security/ covering all SOC 2
    Trust Services Criteria (Security, Availability, Confidentiality)
  • Quarterly access reviews + incident response plan + business continuity
    plan + vendor management policy already in place
  • First customer onboarding to production substrate by 5/30/2026
  • Targeting mid-market regional CPA firm acquisition Q1-Q2 2027 — which
    triggers the SOC 2 Type II procurement gate

Looking to engage for:
  • SOC 2 Type I attestation by Q1 2027 (the bridge report)
  • Concurrent Type II audit prep with Type II report targeting mid-2027
  • Recurring compliance platform during the Type II audit period

Questions for you:
  1. Pricing for SOC 2 Type I attestation at our stage (pre-Series-A,
     2-person team, controls already in place)?
  2. What's the realistic 90-day timeline from contract sign to Type I report?
  3. Which audit firms do you typically pair with for the actual attestation?
     (We want auditor independence; tool + audit-firm should be separate.)
  4. Integration coverage for our stack: Vercel, Neon Launch, Cloudflare R2,
     Inngest, GitHub, Anthropic API (with Bedrock fallback), Clerk, Sentry?
  5. Type II audit period: 6 months minimum, 12 months preferred? Locked
     start date implications if we sign now vs. Q4 2026?

Background on our compliance posture is publicly viewable in our public docs.
References available.

David Kim
CEO, Docket
[email]
[calendar link]
```

---

## What to evaluate in the call

| Question | What you're listening for |
|---|---|
| **Pricing structure** | Annual platform fee + per-employee fee? Cap at 10 employees? Quarterly vs annual billing? |
| **Audit-firm referral pool** | Independence preserved? Multiple options? Audit-firm rates separate from platform fees? |
| **Type I timeline** | Real 90 days, or "90 days after we finish onboarding"? Get a Gantt chart of weeks 1-12. |
| **Type II audit period overlap** | Can Type II audit period start *before* Type I report ships? (Yes — Type I is a snapshot; Type II is a window.) |
| **Integration depth** | Auto-evidence for our stack? Manual evidence-collection overhead? What integrations are paid extras? |
| **Cancellation terms** | Annual vs month-to-month? Termination for material breach clauses? |
| **References** | At least 2 SaaS startups our size who completed Type I → Type II with the same vendor + audit-firm pair. |
| **Hidden costs** | Penetration test (Type II often required); risk-management consulting; policy-review consulting. |

---

## Recommended timeline

| Date | Action |
|---|---|
| **2026-05 (this week)** | Send outreach to Drata + Vanta in parallel; request initial sales calls |
| **2026-05-30 (Antonio production sub-milestone)** | Have both proposals in hand; choose vendor |
| **2026-Q3 (Jul-Sep)** | Onboard onto vendor platform; map controls to evidence; vendor walkthroughs |
| **2026-Q4 (Oct-Dec)** | Audit-firm engaged; Type I fieldwork begins; report ships by end of Q4 |
| **2027-Q1 (Jan-Mar)** | Type I report in hand. Mid-market sales unblocked. Type II audit period begins (6-12 month window). |
| **2027-Q3 (Jul-Sep)** | Type II audit fieldwork |
| **2027-Q4 (Oct-Dec)** | Type II report ships. |

**Critical timing note**: Mid-market firms ask for Type II *or* a Type I bridge. We need the Type I in hand by Q1 2027. Working backward, vendor sign must close by mid-2026. **Sending the outreach this week is on the critical path.**

---

## Budget envelope

| Item | One-time | Recurring |
|---|---|---|
| Drata/Vanta platform (Year 1) | — | $15-20K/yr |
| Audit firm Type I attestation | $10-15K | — |
| Audit firm Type II attestation | $20-40K (annual) | — |
| Penetration test (if Type II requires) | $8-15K | — |
| Risk-management consulting (vendor often bundles or sells separately) | — | $5-10K/yr |
| **Total Year 1** | ~$40-70K total | — |

This is real money. Trigger spending only after the next priced round closes OR when accelerator capital lands. If neither has closed by Q3 2026, the Type I engagement timing slips and mid-market 2027 sales suffer. **The cyber insurance recommendation (`docs/CYBER-INSURANCE-RECOMMENDATION.md`) and this SOC 2 plan together total $42-73K Year-1; both are needed before mid-market sales can commit at scale.**

---

## Documentation underwriters will want (we have)

The vendor + audit firm will both want evidence the controls are real. Our `docs/security/` set is purpose-built for this — `docs/security/controls-matrix.md` maps every Trust Services Criterion (CC1–CC9, A1, C1) to the implementing file/commit/runbook. Sample evidence:

| Control | Evidence path |
|---|---|
| Per-tenant DEK encryption | `packages/db/src/encryption.ts` + 34/34 tests + commit `2c5db11` |
| Audit chain integrity | `packages/db/migrations/0007_*.sql` + nightly verifier in `services/workers/` |
| MFA | Clerk admin dashboard + onboarding doc |
| Access reviews | `docs/security/access-control-policy.md` §6 + quarterly review records |
| Incident response | `docs/security/incident-response-plan.md` + drill records |
| Change management | git log on `main` + protocol-gate trailers on every feat/fix commit |
| Vendor management | `docs/security/vendor-management-policy.md` + DPAs in `docs/security/dpas/` |

This is a stronger evidence package than most pre-Series-A startups bring to a SOC 2 engagement. Expect favorable timeline + pricing.

---

*Created 2026-05-11. Send outreach within 5 business days. Vendor decision by 5/30. Type I engagement signed by 7/30 (v1 launch week). Status updates back to STATE.md as the engagement progresses.*
