# Information Security Policy

> *Per L8 (CLAUDE.md): the auditor reads existing posture; we pay for attestation, not re-architecture.*

**Version:** 1.0
**Effective:** 2026-05-09
**Owner:** David Kim (founder, security lead until first security hire)
**Review cadence:** quarterly + after any material change

---

## 1. Purpose

This policy establishes how Docket protects the confidentiality, integrity, and availability of customer data, firm-owner credentials, and tax-domain information processed by the Docket platform. It is the parent document for all other security policies in this directory.

---

## 2. Scope

This policy applies to:
- All Docket production systems (`apps/client-portal`, `apps/command-room`, `services/orchestrator`, `services/workers`, `mcp-servers/*`)
- All data classified as Internal, Confidential, or Restricted under [`data-classification-and-handling.md`](data-classification-and-handling.md) — including taxpayer PII (SSN/EIN/bank), tenant credentials (Twilio, DocuSign, Square, Gmail OAuth tokens), agent prompt + completion logs, and audit-chain rows
- All Docket personnel — founder, contractors, future hires
- All third-party sub-processors enumerated in [`vendor-management-policy.md`](vendor-management-policy.md)

---

## 3. Roles & responsibilities

| Role | Responsible for |
|---|---|
| Founder (David Kim) | Final accountability for security posture. Signs off on every quarterly review. Approves policy changes. |
| Security lead | Day-to-day enforcement, incident response coordinator, vendor risk reviewer, access-review owner. **Currently the founder; transfer when first security hire lands.** |
| All personnel | Read every policy in this directory at onboarding + after every material update. Complete annual security refresher. Report incidents within 1 hour of discovery. |
| Sub-processors | Bound by their own attestations + Docket's vendor management policy. See vendor-management-policy.md for the current list. |

---

## 4. Information security objectives

1. **Confidentiality.** No unauthorized disclosure of taxpayer PII, firm credentials, or audit-chain data.
2. **Integrity.** No unauthorized modification of returns, positions, audit rows, or filed forms. Cryptographic audit chain detects tampering.
3. **Availability.** Production systems available with 99.9% uptime target during tax season (Jan–Apr); 99.5% off-season.
4. **Auditability.** Every action that touches a tenant's data leaves a row in the audit trail. Every cited tax position links back to its authority. Every commit links back to its codex review.

---

## 5. Control framework

Docket aligns to **SOC 2 Type II** Trust Services Criteria (Security, Availability, Confidentiality) for v1. Processing Integrity and Privacy criteria are deferred per `README.md`. The full criterion → control → file mapping lives in [`controls-matrix.md`](controls-matrix.md).

We do not chase ISO 27001 certification independently; SOC 2 is the buyer-required floor for our segment (mid-market firms, EAs handling regulated data). When we land enterprise customers (top-100 firms), we layer ISO 27001 + HIPAA-BAA-readiness on top.

---

## 6. Policy adherence

Violations of this policy are taken seriously. Specific consequences depend on context (accidental disclosure vs. willful exfiltration), but every incident is investigated, documented, and ratified at the next quarterly review.

The founder retains the right to immediately revoke access for any personnel reasonably suspected of policy violation pending investigation.

---

## 7. Exception handling

Exceptions to any policy in this directory require:
1. Documented justification.
2. Compensating control identified.
3. Founder approval (in writing — Slack with reaction or commit trailer).
4. Logged to `docs/security/policy-exceptions.jsonl` with timestamp, sha (if commit-related), reason, expiration date.
5. Quarterly review surfaces all open exceptions. Expired exceptions reopen as findings.

The `Protocol-Skip` trailer mechanism (CLAUDE.md §23) is the same pattern applied to commit-time policy bypass; the broader exception path is for non-commit operational decisions (e.g., "we'll skip vendor reassessment for Twilio this quarter because the contract auto-renews next month").

---

## 8. Related policies

- [`access-control-policy.md`](access-control-policy.md)
- [`change-management-policy.md`](change-management-policy.md)
- [`incident-response-plan.md`](incident-response-plan.md)
- [`vendor-management-policy.md`](vendor-management-policy.md)
- [`business-continuity-plan.md`](business-continuity-plan.md)
- [`data-classification-and-handling.md`](data-classification-and-handling.md)
- [`logging-and-monitoring.md`](logging-and-monitoring.md)
- [`employee-training-and-awareness.md`](employee-training-and-awareness.md)
- [`risk-management-policy.md`](risk-management-policy.md)

---

## 9. Acceptance

By committing to a Docket-related branch or accessing any Docket production system, all personnel acknowledge they have read, understood, and will comply with this policy and every policy referenced in §8.

---

**Last reviewed:** 2026-05-09 (initial draft, founder)
**Next review:** 2026-08-09 (quarterly cadence)
