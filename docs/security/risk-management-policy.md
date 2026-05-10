# Risk Management Policy

**Version:** 1.0
**Effective:** 2026-05-09
**Owner:** Founder
**Review cadence:** quarterly + after every incident or material change

---

## 1. Purpose

Define how Docket identifies, scores, treats, monitors, and reports risk to confidentiality, integrity, availability, and compliance posture. Maintain a living risk register that reflects the actual risk surface, not a static document.

---

## 2. Risk identification sources

- **Quarterly internal review** — founder walks through `docs/security/` + `docs/PRODUCTION-READINESS.md` + active vendor incidents.
- **Incident post-mortems** — every P1/P2 incident produces at least one new risk-register entry or revises an existing one.
- **Customer-reported issues** — bugs, security disclosures, support escalations.
- **Vendor advisories** — vendor SOC 2 changes, breach disclosures, status-page incidents.
- **External audit findings** — Drata / Vanta when engaged; codex review findings in commits.
- **Threat-intelligence reading** — quarterly review of common attack patterns against tax-pro adjacents (IRS-impersonation, wire fraud, OLT/Drake credential phishing).

---

## 3. Risk scoring

Each risk gets:
- **Likelihood** (1–5): how plausible the realization, given current controls.
- **Impact** (1–5): what happens if it materializes — customer-data exposure, downtime, reputational damage, financial loss.
- **Score** = Likelihood × Impact (1–25).

Treatment band:
- **Score 1–6**: Accept. Document and move on.
- **Score 7–12**: Mitigate. Specific control + owner + deadline.
- **Score 13–19**: Mitigate or Avoid. Control must significantly reduce one of the inputs; if no viable control, change the architecture or feature scope.
- **Score 20–25**: Block. Cannot ship until reduced. Re-architect, defer feature, or transfer (insurance + contractual).

---

## 4. Risk register (initial seed; lives in `docs/security/risk-register.md` going forward)

| ID | Risk | L | I | Score | Treatment | Owner | Deadline | Status |
|---|---|---|---|---|---|---|---|---|
| R1 | **Compliance liability on filed forms** — agent error sends incorrect 2848 to IRS | 3 | 5 | 15 | Mitigate: trust gate locked at level 1 for `file` action class; mandatory human approval before submit; structured prompt construction with client_id binding at every layer; pre-flight verification | Founder | v1 launch (7/30) | In-flight |
| R2 | **Agent prompt error sends wrong filing for wrong client** — bug in prompt construction binds wrong client_id | 2 | 5 | 10 | Mitigate: typed branded IDs; integration test with adversarial scenarios; trust-gate enforcement | Founder | Phase 3 of v1 | In-flight |
| R3 | **Knowledge layer ingestion brittleness** — agent cites stale or hallucinated authority | 3 | 4 | 12 | Mitigate: hand-curated subset for v1 (Pub 17 + FTB residency); citation verifier; spot-check before agent output reaches users | Founder | Phase 3 of v1 | In-flight |
| R4 | **Tenant isolation leak** — RLS bypass exposes one tenant's data to another | 1 | 5 | 5 | Accept (with monitoring): RLS at `ENABLE + FORCE`; only 2 documented `getAdminDb()` callers; SECURITY.md justification required for third caller. Quarterly review + adversarial test | Founder | Ongoing | Accepted |
| R5 | **Master-KEK fallback path still active** — `encryption.ts:194-215` retains legacy unbinding code | 3 | 4 | 12 | Mitigate: run `pnpm --filter @docket/db reencrypt-legacy --dry-run` before any real client onboards; remove fallback after migration | Founder | Phase 2 of v1 (Antonio sub-milestone) | Open |
| R6 | **Audit-chain tamper attempt** — adversary tries to modify historical audit rows | 1 | 5 | 5 | Accept (with detection): cryptographic chain (chain_seq + prev_hash + row_hash); nightly verifier cron; tamper triggers P1 incident | Founder | Ongoing | Accepted |
| R7 | **AI vendor outage** — Anthropic-side outage blocks agent runs | 3 | 3 | 9 | Mitigated: Bedrock fallback at orchestrator (commit `303f886`, 38/38 unit + 4/4 smoke); fallback engages automatically | Founder | Done | Mitigated |
| R8 | **Single-region database failure (Neon)** — production data unavailable | 2 | 5 | 10 | Mitigate (V1.5): Neon read replica us-east-2 (substrate exists; routing pending). R2 cross-region replication. Multi-cloud DB hot standby. Read-only mode via `HealthStatusGate` already deployed | Founder | V1.5 (before Feb 2027 tax season) | In-flight |
| R9 | **Founder unavailability** — single-point-of-failure on operations | 4 | 4 | 16 | Mitigate: BOG (break-of-glass) handoff doc maintained quarterly; partner-engineer #2 hired Phase 4 of v1; rotate on-call by hire-3 | Founder | Phase 4 of v1 | Open |
| R10 | **Cyber-insurance gap** — uncovered loss event | 4 | 4 | 16 | Mitigate: cyber-insurance policy by v1 launch; tabletop scenario tested before purchase to validate coverage | Founder | v1 launch (7/30) | Open |
| R11 | **Phishing against founder** — credential compromise leading to broad access | 3 | 5 | 15 | Mitigate: hardware MFA on root accounts; phishing-resistance training annually; vendor-impersonation simulation; password manager only | Founder | Ongoing | In-flight |
| R12 | **Customer-data exfiltration via prompt injection** — adversarial document tricks agent into leaking another client's data | 2 | 5 | 10 | Mitigate: trust gate; structured prompt construction with client_id binding at every layer; injection-defense layer in system prompt; per-client RLS at every retrieval | Founder | Ongoing | In-flight |
| R13 | **Antonio non-conversion** — design partner #1 doesn't become paying customer | 3 | 4 | 12 | Mitigate (per L14): partner #2 within 90 days from a different segment AND different network. Reference-customer diversification | Founder | Phase 4 of v1 | Open |
| R14 | **Mid-market partner #2 acquisition timing** — onboarding misses 7/30 launch | 3 | 4 | 12 | Mitigate: warm intros via Antonio's mentor; pre-built partner-onboarding playbook; <2-week engagement-to-production cycle | Founder | Phase 6 of v1 | Open |
| R15 | **Cathedral-mode scope creep** — v1 expands past 7/30 deadline | 4 | 3 | 12 | Mitigate: explicit no-more-expansions rule once 5/30 sub-milestone hits; new ideas → TODOs.md; expansion appetite check at 6/13 + 7/11 | Founder | Ongoing | In-flight |

---

## 5. Risk treatment

For each Mitigate or Avoid risk:
1. Specific control identified.
2. Owner assigned.
3. Deadline set (relative to v1 phase plan).
4. Effectiveness measured at quarterly review.

For Accept risks:
1. Justification documented.
2. Compensating monitoring identified.
3. Re-evaluated quarterly to confirm "accept" remains the right call.

For Block risks:
1. Feature or architecture revised until risk score drops below 20.
2. If no path to <20: ship-block until resolved.

---

## 6. Risk reporting

- **Quarterly:** founder reviews the full register; updates scores based on changes; closes mitigated items; opens new items from incidents or threat-intel.
- **At every CEO-review checkpoint:** top-5 risks summarized in the CEO plan; mitigation status reported.
- **On every customer-facing security questionnaire:** the relevant subset of the register surfaces in the response (sanitized for sales appropriateness).
- **At SOC 2 attestation time:** the full register is presented to the auditor as evidence of risk management practice.

---

## 7. Insurance + transfer

- **Cyber-insurance** before v1 launch. Coverage targets: data-breach response, business interruption, regulatory fines (where insurable), customer notification cost, third-party liability.
- **E&O insurance** for tax-position risk (if Docket is named on a position). Discuss with general counsel.
- **D&O insurance** when raising priced equity round.

Cyber-insurance underwriter typically requires evidence of: SOC 2 in progress (the documents in this directory), MFA mandatory, encryption at rest + in transit, backup tested, IR plan documented. We have all of these.

---

## 8. Anti-patterns blocked

- "Risk is too low to bother documenting" — every identified risk goes in the register, including Score 1–6 Accept items. The discipline is "we made a deliberate choice."
- Optimistic scoring under deadline pressure — quarterly review revisits any risk where the score doesn't match observed reality.
- "We'll fix it when it happens" without an owner or deadline — every Mitigate item has both.

---

**Last reviewed:** 2026-05-09 (initial draft, founder)
**Next review:** 2026-08-09
