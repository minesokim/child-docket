# SOC 2 Controls Matrix

**Version:** 1.0
**Effective:** 2026-05-09
**Owner:** Founder
**Review cadence:** quarterly + before any external audit

---

## 1. Purpose

Map every SOC 2 Trust Services Criterion in scope (Security, Availability, Confidentiality) to the specific control implementation in the Docket codebase, the operational policy that governs it, and the evidence available for an external auditor.

The auditor reads this file + samples evidence from the cited file/commit/runbook. We do not pay for re-architecture; we pay for attestation.

---

## 2. Scope reminder

Trust Services Criteria in scope per `README.md`:
- **Security (CC1–CC9)** — full coverage
- **Availability (A1)** — covered via `business-continuity-plan.md`
- **Confidentiality (C1)** — covered via `data-classification-and-handling.md`

Out of scope for v1: Processing Integrity (PI1), Privacy (P1–P8). Justifications in `README.md`.

---

## 3. Common Criteria (CC1–CC9)

### CC1 — Control Environment

| Sub-criterion | Control | Implementation | Evidence |
|---|---|---|---|
| CC1.1 Demonstrates commitment to integrity + ethical values | Founder serves as the security lead until first hire; quarterly self-attestation + annual external review | `information-security-policy.md` §3 | Training log; quarterly review records |
| CC1.2 Board oversight | Founder is the board today; advisory board recruited as company grows; security risks reported at board meetings | n/a (pre-board); CEO plan summarizes top-5 risks at every checkpoint | CEO plan + decisions log |
| CC1.3 Org structure + reporting lines | Single founder; future hires onboard with documented role + access policy | `access-control-policy.md` §5 | Org chart in CEO plan |
| CC1.4 Demonstrates commitment to attract, develop, retain competent personnel | Hiring pipeline targets specialist roles (tax co-founder, partner-engineer); training policy | `employee-training-and-awareness.md` | Training log |
| CC1.5 Holds individuals accountable | Codex review on every commit; quarterly access review; training log signoff | `change-management-policy.md` §4 | Git log + audit chain |

### CC2 — Communication + Information

| Sub-criterion | Control | Implementation | Evidence |
|---|---|---|---|
| CC2.1 Internal communications | Slack + handoff docs + decisions log + autonomous decisions log | CLAUDE.md §23 + `docs/AUTONOMOUS-DECISIONS.md` | docs/ + git log |
| CC2.2 External communications | Customer-facing status page + sub-processor list + DPAs + SOC 2 report (when available) | `vendor-management-policy.md` §9 | Public-facing pages + signed DPAs |
| CC2.3 Communicates with parties about internal control | Quarterly review + tabletop exercises + customer security questionnaires | `incident-response-plan.md` §8 | Tabletop records |

### CC3 — Risk Assessment

| Sub-criterion | Control | Implementation | Evidence |
|---|---|---|---|
| CC3.1 Specifies suitable objectives | Information security objectives in `information-security-policy.md` §4 | Policy doc | docs/security/ |
| CC3.2 Identifies + analyzes risks | Risk register | `risk-management-policy.md` §4 | docs/security/risk-register.md |
| CC3.3 Considers fraud risk | Fraud risk surfaces in risk register (R11 phishing, R9 founder unavailability used adversarially) | `risk-management-policy.md` | Risk register |
| CC3.4 Identifies + analyzes change | Change management policy + protocol-gate enforcement | `change-management-policy.md` + `scripts/protocol-gate.ts` | Git log with trailers |

### CC4 — Monitoring Activities

| Sub-criterion | Control | Implementation | Evidence |
|---|---|---|---|
| CC4.1 Selects, develops, performs monitoring | Sentry + audit chain + cost outliers + nightly chain verifier + Inngest dashboard | `logging-and-monitoring.md` §3 | Live monitors |
| CC4.2 Communicates deficiencies | Incident response plan; post-mortems within 48h of P1/P2 | `incident-response-plan.md` §5 | docs/incidents/ |

### CC5 — Control Activities

| Sub-criterion | Control | Implementation | Evidence |
|---|---|---|---|
| CC5.1 Selects + develops control activities | Per-tenant DEK encryption; cryptographic audit chain; RLS; webhook signature verification; PII regex scrubber; protocol-gate hooks | `README.md` §"Architecturally implemented controls" | Codebase + test suites |
| CC5.2 Selects + develops technology controls | Same | Same | Same |
| CC5.3 Deploys policies + procedures | All policies in `docs/security/` | Codebase + docs | Git log |

### CC6 — Logical + Physical Access Controls

| Sub-criterion | Control | Implementation | Evidence |
|---|---|---|---|
| CC6.1 Implements logical access controls | MFA mandatory; Postgres RLS at `ENABLE + FORCE`; role hierarchy; PII unlock | `access-control-policy.md` §3-4 | App code + Clerk admin logs |
| CC6.2 Provisions identity | Onboarding workflow; quarterly access review | `access-control-policy.md` §5-6 | docs/security/access-changes.jsonl |
| CC6.3 Authorizes access changes | Founder-approved + logged | `access-control-policy.md` §5 | docs/security/access-changes.jsonl |
| CC6.4 Restricts physical access | Hosted infrastructure; founder workstations encrypted; no on-prem | n/a (cloud-native) | Vendor SOC 2 reports |
| CC6.5 Discontinues physical/logical access | Deprovisioning within 1 hour | `access-control-policy.md` §5 | docs/security/access-changes.jsonl |
| CC6.6 Encryption | AES-256-GCM per-tenant DEK; AAD-bound; KEK rotation; TLS 1.3 in transit | `data-classification-and-handling.md` §3 + `packages/db/src/encryption.ts` | Test suites + KEK rotation logs |
| CC6.7 Restricts unauthorized data movement | RLS; `getAdminDb()` documented bypass; PII scrubber | `access-control-policy.md` §4 + `packages/shared/src/scrub-pii.ts` | App code + audit chain |
| CC6.8 Prevents unauthorized + malicious software | Branch protection; codex review; protocol-gate; package-lock integrity | `change-management-policy.md` §4 | Git log + lockfile |

### CC7 — System Operations

| Sub-criterion | Control | Implementation | Evidence |
|---|---|---|---|
| CC7.1 Detects + monitors anomalies | Sentry alerts; cost outlier; cost spike; chain integrity verifier | `logging-and-monitoring.md` §5 | Live monitors |
| CC7.2 Monitors components | Health endpoints; vendor status pages | `business-continuity-plan.md` §3 | /api/health + status subscriptions |
| CC7.3 Evaluates security events | Incident response plan | `incident-response-plan.md` | docs/incidents/ |
| CC7.4 Responds to identified events | Same + escalation matrix | `incident-response-plan.md` §4 | docs/incidents/ |
| CC7.5 Recovers from events | BCP + DR drills | `business-continuity-plan.md` §5 | DR drill records |

### CC8 — Change Management

| Sub-criterion | Control | Implementation | Evidence |
|---|---|---|---|
| CC8.1 Authorizes + designs + tests + approves + implements changes | protocol-gate hooks + codex review + branch protection + smoke-test substrate | `change-management-policy.md` §4 | Git log + CI runs |

### CC9 — Risk Mitigation

| Sub-criterion | Control | Implementation | Evidence |
|---|---|---|---|
| CC9.1 Identifies + selects + develops risk mitigation activities | Risk management policy + risk register | `risk-management-policy.md` | Risk register |
| CC9.2 Vendor + business partner risk | Vendor management policy + DPAs + sub-processor list + exit plans | `vendor-management-policy.md` | docs/security/dpas/ |

---

## 4. Availability (A1)

| Sub-criterion | Control | Implementation | Evidence |
|---|---|---|---|
| A1.1 Capacity + performance objectives | RTO/RPO defined per tier in BCP §3 | `business-continuity-plan.md` | BCP doc |
| A1.2 Recovery activities | DR drills + Bedrock fallback + Neon PITR | BCP §5; commit `303f886` | DR drill records + smoke tests |
| A1.3 Backups | Neon PITR + weekly pg_dump to R2 + key-material backup | BCP §4; `docs/BACKUPS.md` | Backup logs |

---

## 5. Confidentiality (C1)

| Sub-criterion | Control | Implementation | Evidence |
|---|---|---|---|
| C1.1 Identifies + maintains confidential information | Data classification policy | `data-classification-and-handling.md` | Policy doc |
| C1.2 Disposes of confidential information | Customer-deletion within 30 days; cryptographic erasure via DEK destruction | `data-classification-and-handling.md` §7 | Deletion log |

---

## 6. Evidence sampling guide for the auditor

When the auditor lands, here is the fast path to evidence:

| Evidence type | Where to look |
|---|---|
| Encryption-at-rest implementation | `packages/db/src/encryption.ts` + tests in `packages/db/test/encryption.test.ts` |
| RLS enforcement | `packages/db/migrations/0001_*.sql` + every server action's `withTenant` wrapper |
| Audit chain integrity | `packages/db/migrations/0007_*.sql` + `services/workers/src/functions/verify-actions-chain.ts` |
| MFA enforcement | Clerk dashboard + onboarding doc |
| Access reviews | `docs/security/access-reviews/` + `docs/security/access-changes.jsonl` |
| Change management | Git log on `main`; protocol-gate trailers on every feat/fix commit |
| Incident response | `docs/incidents/` + `docs/incidents/POSTMORTEM-*.md` |
| Vendor due diligence | `docs/security/dpas/` + `vendor-management-policy.md` §4 |
| Backup testing | DR drill records in `business-continuity-plan.md` §7 |
| Training | `docs/security/training-log.md` |
| Risk management | `docs/security/risk-register.md` + `risk-management-policy.md` §4 |
| Logging + monitoring | Sentry org config + Inngest dashboard + audit chain |

---

**Last reviewed:** 2026-05-09 (initial draft, founder)
**Next review:** 2026-08-09
