# Written Information Security Plan (WISP)

> *Required by IRS Publication 4557, FTC Safeguards Rule (16 CFR Part 314), Massachusetts 201 CMR 17.00, and a growing list of state-level tax preparer regulations. Failure to maintain a WISP can result in PTIN suspension + civil penalties.*

**Version:** 1.0
**Effective:** 2026-05-11
**Owner:** David Kim (Security Coordinator — Docket Inc.)
**Review cadence:** annually + after any material change to systems, vendors, or staff
**Next review:** 2027-05-11

---

## 1. Purpose

This Written Information Security Plan (WISP) describes the administrative, technical, and physical safeguards Docket Inc. uses to protect the confidentiality, integrity, and availability of:

- Federally protected taxpayer information (FTI) under IRC §6103 and IRS Publication 4557
- Personally Identifiable Information (PII) of Docket customers, their clients, and their employees
- Tenant credentials (Twilio, DocuSign, Square, Gmail OAuth, IRS Solutions, OLT, Xero)
- Agent prompt + completion logs containing tax-domain information
- Audit-chain records under SOC 2 Type II posture (CLAUDE.md L8)

This WISP is the parent document for all other security policies in `docs/security/`. It governs every Docket employee, contractor, sub-processor, and any third party with access to Docket production systems.

---

## 2. Regulatory framework

Docket is bound by the following overlapping requirements. This WISP satisfies the minimum standard of the most stringent applicable rule.

| Regulation | Coverage | Compliance posture |
|---|---|---|
| **IRS Publication 4557** (Safeguarding Taxpayer Data) | Required for any paid tax preparer or third-party service provider handling FTI | Required document; this WISP IS the document |
| **IRS Publication 5708** (Creating a WISP) | Practical guidance on WISP content | Used as primary template reference |
| **FTC Safeguards Rule** (16 CFR Part 314, amended 2023) | Required for financial institutions including tax preparers under GLBA | Compliant via this WISP + technical safeguards |
| **Massachusetts 201 CMR 17.00** | Required for any entity storing PII of MA residents | Compliant via this WISP + per-tenant DEK encryption |
| **California Consumer Privacy Act (CCPA / CPRA)** | Required for entities processing CA residents' personal info | Compliant; privacy policy at docket.com/privacy |
| **NY SHIELD Act** | Required for entities holding NY residents' PII | Compliant via FTC Safeguards Rule baseline |
| **SOC 2 Type II Trust Services Criteria** | Buyer-required for mid-market firm sales | Controls in codebase per L8; attestation Q4 2026 per docs/SOC2-TYPE-I-OUTREACH.md |

This WISP does NOT address:
- HIPAA (Docket does not process Protected Health Information)
- PCI DSS Level 1 (Docket does not store cardholder data; Square handles payment tokens)
- FedRAMP / FISMA (Docket does not currently serve federal government customers)

---

## 3. Security Coordinator + governance

### Designated Security Coordinator

| Role | Name | Contact | Responsibilities |
|---|---|---|---|
| **Security Coordinator** | David Kim | david@docket.com · [phone TBD] | Final accountability for security posture. Signs off on every quarterly review. Approves policy changes. Reports to founder/board on incidents. |

**Until Docket hires a dedicated Information Security Officer (estimated v1.5+ revenue threshold), David Kim serves as Security Coordinator.** This concentration is documented as a known risk (see §10 Risk Assessment).

### Backup contact

| Role | Name | Contact |
|---|---|---|
| **Backup Coordinator** | Haokun Yang (CTO) | [email TBD] |

### External counsel

| Role | Name | Use case |
|---|---|---|
| **Legal counsel** | TBD | Privacy / security incident response, breach notification, vendor contracts |
| **Cyber insurance broker** | Vouch (primary) + Embroker (backup) per `docs/CYBER-INSURANCE-RECOMMENDATION.md` | Tech E&O + Cyber bundle with AI-affirmative rider. Target binding: 5/16/2026. |

### Governance cadence

| Cadence | Activity |
|---|---|
| **Daily** | Sentry alerts reviewed; suspicious activity escalated within 1 hour of discovery |
| **Weekly** | Security log review (auth failures, RLS violations, encryption errors, audit-chain tamper alerts) |
| **Monthly** | Vendor access review; identity removal for departed contractors |
| **Quarterly** | Full WISP review with Security Coordinator + Backup; risk register update; control effectiveness validation |
| **Annually** | Comprehensive WISP refresh; risk assessment; tabletop incident response drill; vendor security re-assessment |

---

## 4. Information classification (per `data-classification-and-handling.md`)

Docket processes four data classifications. Handling rules differ by classification.

| Classification | Examples | Encryption | Access |
|---|---|---|---|
| **Public** | Marketing site, Coverage Map, public pricing | None required | Anyone |
| **Internal** | Employee handbooks, non-customer-facing operational documentation, anonymized aggregate analytics | TLS in transit | Employees + contractors with NDA |
| **Confidential** | Tenant credentials (Twilio, DocuSign, Square OAuth tokens), customer-facing analytics with tenant-scoped data, agent prompt/completion logs | AES-256 at rest + TLS in transit; per-tenant DEK | Authorized employees on need-to-know basis |
| **Restricted** | Taxpayer PII (SSN, EIN, bank account, name+address+DOB combos), tax-position memos with client-identifying details, audit-chain records | AES-256-GCM with AAD binding to (tenant_id, client_id, path) + TLS 1.3 in transit | Authorized employees on documented need-to-know basis with audit-trail logging |

**FTI (Federally protected Taxpayer Information under IRC §6103)** is treated as Restricted by default.

---

## 5. Administrative safeguards

### 5.1 Personnel security

- **Background check** required for any Docket employee with access to Confidential or Restricted data prior to hiring. Cost: ~$50/check via Checkr or similar.
- **NDA + Confidentiality Agreement** signed by every employee, contractor, and sub-processor before access is granted.
- **Security awareness training** required at onboarding + annually. Tracked per `employee-training-and-awareness.md`. Includes:
  - IRS Pub 4557 + FTC Safeguards Rule overview
  - Phishing recognition + reporting
  - Password hygiene + MFA enforcement
  - Incident reporting procedure (per `incident-response-plan.md`)
  - Tax-preparer-specific risks (W-2 phishing, ID theft, ransomware)
- **Disciplinary action** for policy violations follows `information-security-policy.md` §6.

### 5.2 Access control (per `access-control-policy.md`)

- **Principle of least privilege**: every access grant must be justified by a documented business need.
- **Role-based access**: Docket uses RBAC primitives in Clerk + tenant_credentials.role_grants table. Roles: `firm_owner`, `preparer`, `reviewer`, `front_desk`, `read_only`.
- **MFA required** for all production system access (Clerk-enforced).
- **Access reviews** monthly (per §3 governance cadence). Each access grant must be re-justified or revoked.
- **Termination**: access revoked within 4 hours of role change or termination. SOC 2 control evidence: Clerk session list + tenant_credentials audit log.

### 5.3 Vendor risk management (per `vendor-management-policy.md`)

Sub-processors handling Confidential or Restricted data:

| Vendor | Service | Data classification | DPA on file | SOC 2 / equivalent |
|---|---|---|---|---|
| Anthropic | AI inference (Sonnet/Haiku/Opus) | Confidential (with PII scrubber) | Yes — ZDR + standard DPA | SOC 2 Type II |
| AWS (Bedrock) | AI inference fallback | Confidential | Yes — AWS standard DPA | SOC 2 Type II + FedRAMP |
| Neon | Database (Postgres) | Restricted | Yes | SOC 2 Type II |
| Cloudflare R2 | Object storage | Restricted | Yes | SOC 2 Type II |
| Clerk | Authentication | Confidential (no taxpayer PII) | Yes | SOC 2 Type II |
| Twilio | SMS / phone | Confidential (recipient phone) | Yes | SOC 2 Type II + HIPAA-eligible |
| Square | Payments | Confidential (no card storage; tokens only) | Yes | PCI DSS Level 1 |
| DocuSign | E-signature + KBA | Restricted (LexisNexis KBA on identity verification) | Yes — DocuSign DPA + LexisNexis sub-DPA | SOC 2 Type II + IRS Pub 1345 KBA-compliant |
| Resend | Transactional email | Confidential | Yes | SOC 2 Type II |
| Inngest | Background jobs | Confidential | Yes | SOC 2 Type II |
| Vercel | Hosting | Confidential | Yes | SOC 2 Type II |
| Sentry | Error monitoring | Confidential (PII scrubber in middleware) | Yes | SOC 2 Type II |

**Vendor onboarding** requires: security questionnaire review, DPA execution, attestation review (most recent SOC 2 / equivalent), risk register entry. Vendors lacking SOC 2 or equivalent attestation are not approved for Restricted data handling without compensating controls.

---

## 6. Technical safeguards

Most technical safeguards are already built into the Docket codebase per L8 (build SOC 2 controls INTO the codebase before attestation). What follows is the production posture as of 2026-05-11.

### 6.1 Encryption

- **At rest**:
  - Database: TLS 1.3 + Postgres encryption (Neon native; AES-256 default)
  - Application-level: per-tenant DEK (AES-256-GCM) with AAD binding to `(tenant_id, client_id, path)`. Master KEK rotation runbook live (`KEK-ROTATION.md`).
  - Object storage: Cloudflare R2 server-side encryption (AES-256)
  - Backups: encrypted at rest, encryption keys held separately from data
- **In transit**: TLS 1.3 for all production traffic (Vercel-enforced); Postgres connections forced TLS; no plaintext channels permitted
- **Encryption code path**: `packages/db/src/encryption.ts` (34/34 tests). AAD binding documented at commit `2c5db11`.

### 6.2 Access control

- **Multi-factor authentication**: required for all production access via Clerk (phone OTP + future MFA via Clerk).
- **Row-level security (RLS)**: all tenant-scoped tables have RLS at `ENABLE + FORCE` since migration 0001. App reads/writes wrap in `withTenant(tenantId, ...)` which `SET LOCAL app.current_tenant_id` for the transaction. RLS-bypass code paths (admin DB access) are restricted to 2 documented callers (`auth.ts` for phone-tenant chicken-and-egg, `current-user.ts` for Clerk-session-to-user resolution).
- **Least-privilege roles**: tenant role-based access (firm_owner / preparer / reviewer / front_desk / read_only).
- **Session security**: Clerk-managed sessions with rolling 7-day TTL.

### 6.3 Audit logging (per `logging-and-monitoring.md`)

- **Cryptographic audit chain**: `chain_seq` + `prev_hash` + `row_hash` on every action. Append-only via Postgres trigger. Nightly `verify_actions_chain` cron detects tampering. Commit `0680874` + `5b4ef92`.
- **Audit chain content**: every action that touches a tenant's data (create, update, delete, file, submit) leaves an immutable row in the `actions` table with tenant_id, user_id, action_type, target_resource, timestamp.
- **Sentry monitoring**: production errors + warnings captured with PII scrubber (commit `8f0c2d5`, 32 tests). Both apps wired with `app:` tag.
- **Cost telemetry**: every agent call logged with tenant + agent + action class via orchestrator hook.
- **Tamper detection**: nightly verifier detects audit-chain mutations. Cost spike + outlier alerts (`5b5bb4e`).

### 6.4 Network security

- **Production access**: VPN-required is N/A (we use SaaS, not on-prem); production console access via SSO-authenticated dashboards only.
- **Firewall**: Cloudflare WAF in front of Vercel. Rate limiting per route via Vercel edge functions + in-process limiter (Upstash Redis swap at v1.5).
- **DDoS**: Cloudflare DDoS protection on all public routes.
- **Webhooks**: HMAC signature verification on every inbound webhook (Square, DocuSign, Twilio, Inngest). Helper: `@docket/shared/webhooks` (32/32 tests). Timing-safe comparison.

### 6.5 Vulnerability management

- **Dependency scanning**: GitHub Dependabot on the repo for known CVEs. Critical/high advisories patched within 7 days; medium within 30.
- **Code review**: every commit reviewed via codex (`Codex-Reviewed: PASS` trailer required on `feat(/fix(` commits per protocol-gate). User mandate per CLAUDE.md §23.
- **CI gates**: typecheck + tests + protocol-gate run on every commit (`.githooks/pre-commit` + `.githooks/commit-msg` + CI `.github/workflows/ci.yml`).
- **Penetration testing**: deferred to post-attestation (Q1 2027). External pentest planned via Cobalt or Bishop Fox.

### 6.6 Backup + business continuity (per `business-continuity-plan.md`)

- **Database backups**: Neon point-in-time recovery to 7-day window; daily logical backups to encrypted R2.
- **R2 cross-region replication**: v1.5 priority (before Feb 2027 tax season) per CLAUDE.md §23 PRODUCTION-READINESS posture.
- **Multi-cloud DB hot standby**: v1.5 priority per PRODUCTION-READINESS §A.
- **Recovery time objective (RTO)**: 4 hours for full production restore. Recovery point objective (RPO): 1 hour.
- **Disaster recovery drill**: annually (next drill 2026-11-01). Documented in `business-continuity-plan.md`.

---

## 7. Physical safeguards

Docket is a fully remote company. Physical safeguards apply to remote employees' work environments.

- **Workstations**: encrypted disk required (FileVault on Mac, BitLocker on Windows). MDM enforcement deferred to first dedicated security hire.
- **Removable media**: prohibited. Production data must never be copied to USB drives, external HDDs, or unmanaged cloud storage (personal Dropbox, Google Drive personal account).
- **Printing**: prohibited for any Restricted or Confidential data. Customer-facing paper documents (e.g., signed engagement letters) handled exclusively via DocuSign + R2.
- **Screen locks**: required after 5 minutes idle on all employee workstations.
- **Physical access to remote work environments**: each employee maintains a private, secure workspace. Family members, roommates, and co-located individuals must not be able to view production data on the employee's screen.

---

## 8. Data retention + disposal

Per IRS Pub 4557 + 26 CFR §301.7216:

| Data type | Retention | Disposal |
|---|---|---|
| Tax returns (filed via Docket on behalf of customers) | 7 years (IRS standard) | Cryptographic erasure via DEK rotation + R2 lifecycle policy |
| Audit-chain records | 7 years (or longer if litigation hold) | Cryptographic erasure |
| Customer-facing agent prompt/completion logs | 2 years for product analytics; longer if individually requested | Cryptographic erasure |
| Discovery Scan upload data (prospect-uploaded redacted returns) | 7 days post-delivery | Hard delete from R2 + DEK rotation |
| Customer engagement records (engagement letters, signatures) | 7 years | Cryptographic erasure |
| Sentry error logs | 90 days rolling | Auto-deleted per Sentry retention policy |
| Vendor sub-processor data | Per each vendor's DPA | Sub-processor disposal under each DPA |
| Employee records | 4 years post-employment | Encrypted archive then erasure |

---

## 9. Incident response (per `incident-response-plan.md`)

### 9.1 Incident classification

| Severity | Examples | Response time |
|---|---|---|
| **P0 — Critical** | Active data breach, unauthorized access to Restricted data, ransomware, ongoing exfiltration | < 15 minutes |
| **P1 — High** | Vendor breach affecting Docket, audit-chain tamper detection, customer-reported security incident | < 1 hour |
| **P2 — Medium** | Sentry critical error, dependency vulnerability disclosure (high CVE), customer phishing report | < 4 hours |
| **P3 — Low** | False-positive security alerts, customer access-level issue, documentation inconsistencies | < 24 hours |

### 9.2 Response procedure

1. **Discover**: anyone (employee, customer, vendor, automated alert) reports incident
2. **Contain**: Security Coordinator notified; affected systems isolated; access revoked as needed
3. **Investigate**: root cause analysis; scope of impact determined
4. **Eradicate**: vulnerabilities patched; compromised credentials rotated
5. **Recover**: production restored from clean backups if necessary; verification of clean state
6. **Notify**: regulatory + customer notifications per breach notification laws (see §9.3)
7. **Post-mortem**: documented within 30 days; lessons learned applied to WISP + policies

### 9.3 Breach notification timeline

Per state-specific breach notification laws (CCPA, NY SHIELD, etc.) + FTC Safeguards Rule:

- **Customers**: notified without unreasonable delay; never more than 30 days from discovery
- **Regulators (state AGs, IRS, FTC)**: notified per each jurisdiction's statutory window (typically 30-60 days; some require shorter for >500-record breaches)
- **IRS Stakeholder Liaison**: notified within 1 week if FTI involved (per IRS Pub 4557)
- **Cyber insurance carrier**: notified within 24 hours per Vouch / Embroker policy terms
- **Public disclosure**: required if >500 individuals' PII affected (per most states); SEC 8-K disclosure if material

### 9.4 Incident reporting

| Channel | Contact |
|---|---|
| Internal staff | Slack #security-incidents (private) + email `security@docket.com` (David Kim's inbox until dedicated mailbox) |
| Customers | Public form at docket.com/security/incident-report + email `security@docket.com` |
| Sub-processors | Per each vendor's DPA; mandatory reporting clause |
| Bug bounty / external researchers | docket.com/security/responsible-disclosure (v1.5 — initially via email `security@docket.com`) |

### 9.5 Post-incident review

Every P0 or P1 incident triggers a post-mortem within 30 days. Post-mortem template in `incident-response-plan.md`. Lessons feed back into:
- WISP updates
- Risk register updates
- Employee training curriculum
- Vendor risk re-assessment

---

## 10. Risk assessment

### 10.1 Top risks (current as of 2026-05-11)

| # | Risk | Likelihood | Impact | Mitigations |
|---|---|---|---|---|
| 1 | **Security Coordinator concentration** — David Kim is sole Security Coordinator until first hire | Medium | High | Backup Coordinator (Haokun) named; quarterly external review with cyber insurance broker; SOC 2 Type I attestation Q4 2026 brings external auditor eyes |
| 2 | **Customer credential leakage via prompt injection** — agent operates against customer's Gmail/IRS Solutions/OLT credentials; malicious email could attempt to exfiltrate | Medium | High | PII scrubber on all agent inputs; trust gate before any external action; mandatory human approval for filing actions; refusal floor below Reasonable Basis |
| 3 | **Vendor sub-processor breach** | Medium | High | DPA + SOC 2 required from all Confidential/Restricted data sub-processors; monthly access review; vendor risk register |
| 4 | **Ransomware / encryption malware on Docket infrastructure** | Low | Critical | Cloudflare WAF + DDoS; encrypted backups in separate region; cyber insurance Tech E&O + Cyber bundle target binding 5/16/2026 |
| 5 | **Insider threat (employee/contractor exfiltration)** | Low | High | Background check; NDA; audit-chain logs all data access; principle of least privilege; monthly access review |
| 6 | **Phishing of Docket employee credentials** | Medium | High | MFA enforced via Clerk; security awareness training annually; phishing simulation quarterly (v1.5) |
| 7 | **Audit-chain tampering / forensic integrity** | Low | Critical | Cryptographic chain (chain_seq + prev_hash + row_hash); nightly tamper verifier; immutable trigger at DB layer |
| 8 | **DDoS on production surfaces** | Medium | Medium | Cloudflare DDoS protection; rate limiting; auto-scaling on Vercel + Neon Launch tier |
| 9 | **Data loss from vendor outage** | Low | High | Cross-region backup (v1.5); multi-cloud hot standby (v1.5); RTO 4 hr / RPO 1 hr |
| 10 | **Regulatory non-compliance** (state-by-state) | Medium | Medium | Annual WISP review; legal counsel engagement; tax-state-specific compliance tracking |

### 10.2 Risk acceptance

Docket leadership has accepted the following residual risks pending v1.5 maturity:

- Security Coordinator concentration (mitigated by Q4 2026 SOC 2 Type I + cyber insurance)
- R2 cross-region replication deferred (mitigated by 7-day point-in-time recovery on Neon + daily logical backups)
- External penetration test deferred (mitigated by codex review on every commit + protocol-gate enforcement)
- MDM on employee workstations deferred (mitigated by FileVault/BitLocker enforcement + screen lock policies)

---

## 11. Compliance attestations + certifications

### 11.1 Current state

- **SOC 2 Type II controls in codebase**: per L8, controls already built. Documentation at `docs/security/`.
- **SOC 2 Type I attestation**: scheduled Q4 2026 per `docs/SOC2-TYPE-I-OUTREACH.md`. Drata or Vanta engagement targeted by 6/15/2026.
- **SOC 2 Type II attestation**: target mid-2027 (12-month observation window after Type I).
- **Cyber insurance**: Tech E&O + Cyber bundle target binding 5/16/2026 via Vouch primary + Embroker backup per `docs/CYBER-INSURANCE-RECOMMENDATION.md`. $1M aggregate coverage with AI-affirmative rider.
- **GDPR**: not currently applicable (Docket does not serve EU residents); Privacy Shield equivalent not needed.

### 11.2 Customer attestation requests

Customers (especially mid-market firm partner #2) may request:
- Most recent SOC 2 attestation (delivered post-Q4 2026)
- WISP copy (this document; available via NDA-protected sharing)
- Cyber insurance certificate of insurance (COI) (delivered post-5/16/2026)
- Penetration test results (deferred Q1 2027)
- DPA + sub-processor list (delivered upon contract execution)

---

## 12. Training + awareness (per `employee-training-and-awareness.md`)

- **Onboarding training**: every new employee + contractor reads this WISP + all `docs/security/` policies before access is granted. Completion attested in writing.
- **Annual refresher**: every employee re-reads WISP + completes annual security awareness training within their employment anniversary month.
- **Topical training**: incident-specific re-training after any P1 or P0 incident affecting the employee's area.
- **Phishing simulation**: quarterly (v1.5+, when first hire lands).
- **Tax-preparer-specific training**: annual coverage of IRS Pub 4557 + FTC Safeguards Rule + state-level breach notification updates.

Training records maintained in `~/.gstack/projects/minesokim-child-docket/security-training-log/` (project-local, gitignored — contains employee names + completion dates).

---

## 13. WISP review + update cadence

This WISP is reviewed:
- **Annually**: comprehensive review by Security Coordinator (2026-05-11 → next review 2027-05-11)
- **After any material change**: new sub-processor, new product capability, new regulation, new employee, new incident, new threat intelligence
- **After every P0 or P1 incident**: validates that response procedures + safeguards prevented escalation
- **Before each SOC 2 attestation**: pre-attestation WISP refresh

Each review documented in `docs/security/wisp-revision-log.md` (future file; created on first revision).

---

## 14. References + crosslinks

This WISP is implemented through and references the following companion policies (all in `docs/security/`):

- [`information-security-policy.md`](information-security-policy.md) — parent policy + scope
- [`access-control-policy.md`](access-control-policy.md) — RBAC + MFA + least privilege
- [`change-management-policy.md`](change-management-policy.md) — code change controls
- [`incident-response-plan.md`](incident-response-plan.md) — incident playbook
- [`vendor-management-policy.md`](vendor-management-policy.md) — sub-processor governance
- [`business-continuity-plan.md`](business-continuity-plan.md) — DR + backup
- [`employee-training-and-awareness.md`](employee-training-and-awareness.md) — training curriculum
- [`data-classification-and-handling.md`](data-classification-and-handling.md) — data classification rules
- [`risk-management-policy.md`](risk-management-policy.md) — risk register + assessment
- [`logging-and-monitoring.md`](logging-and-monitoring.md) — audit logging + Sentry
- [`controls-matrix.md`](controls-matrix.md) — SOC 2 criterion → control → file mapping

Companion business docs:
- [`docs/SOC2-TYPE-I-OUTREACH.md`](../SOC2-TYPE-I-OUTREACH.md) — Type I engagement plan
- [`docs/CYBER-INSURANCE-RECOMMENDATION.md`](../CYBER-INSURANCE-RECOMMENDATION.md) — Tech E&O + Cyber posture
- [`CLAUDE.md`](../../CLAUDE.md) — project context + L8 lock

### External references

- IRS Publication 4557 (Safeguarding Taxpayer Data): https://www.irs.gov/pub/irs-pdf/p4557.pdf
- IRS Publication 5708 (Creating a WISP): https://www.irs.gov/pub/irs-pdf/p5708.pdf
- FTC Safeguards Rule (16 CFR Part 314): https://www.ftc.gov/legal-library/browse/rules/safeguards-rule
- Massachusetts 201 CMR 17.00: https://www.mass.gov/regulations/201-CMR-17
- IRC §6103 (taxpayer return confidentiality)
- 26 CFR §301.7216 (preparer disclosure restrictions)
- NIST Cybersecurity Framework (referenced for control mapping)

---

## 15. Acknowledgment

This WISP is the official Written Information Security Plan for Docket Inc., effective 2026-05-11. It has been approved by:

**Security Coordinator**: David Kim
**Date**: 2026-05-11
**Signature**: [signed digitally upon publishing; physical signature on file]

**Backup Coordinator**: Haokun Yang
**Date**: 2026-05-11
**Signature**: [signed digitally upon publishing]

Next mandatory review: **2027-05-11**.

---

*This document is required by IRS Publication 4557. Failure to maintain a WISP can result in PTIN suspension under IRC §6694 et seq. and civil penalties under the FTC Safeguards Rule. Re-read at every quarterly governance review. Update whenever systems, vendors, staff, or regulations change materially.*

*Created 2026-05-11. Companion to all `docs/security/` policies. Drift between this document and reality is the bug it is designed to prevent.*
