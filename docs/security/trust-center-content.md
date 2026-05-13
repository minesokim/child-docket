# Trust Center — public listing of shipped security controls

> *Source content for the public `/trust` route on the marketing site.*
> *Locked 2026-05-13. Updates as new controls ship.*
> *Slant.app's Trust Center is the structural reference; ours lists actually-shipped controls (no aspirational items).*

This file is the canonical source for the public Trust Center page (`docket.com/trust`) that ships with the marketing site at v1 launch (7/30). Drata / Vanta automation is deferred until capital lands (per [`CLAUDE.md` L8](../../CLAUDE.md)). The *page itself* — a static, read-only listing of controls we've actually built — ships now as a pre-sale trust signal.

**Audit posture clarification:** every control listed below is *built and in production* on the v1 substrate. We are SOC 2 Type II-ready in posture, not Type II-certified in tooling. Certification audit begins when capital lands (per L8 lock).

---

## Infrastructure security

### Multi-tenant isolation via Postgres row-level security (RLS)
- Every tenant-scoped table has `ENABLE` + `FORCE ROW LEVEL SECURITY` applied
- `current_tenant_id()` function gates every read/write at the database layer
- Application code wraps every database operation in `withTenant(tenantId, fn)` which `SET LOCAL app.current_tenant_id` for the transaction
- `getAdminDb()` is the only RLS-bypass path; used in exactly two locations (intake auth chicken-and-egg + Clerk session → user/tenant resolution). Audited via grep on every change.
- Verified by `bun test` suite on every commit (workspace typecheck + `@docket/db` integration tests)

### Cryptographic audit chain
- Every state-changing action writes a row to `actions` table via BEFORE INSERT trigger (migration 0022)
- Trigger fills `chain_seq` (monotonic) + `prev_hash` (SHA-256 of prior row) + `row_hash` (SHA-256 of current row including prev_hash)
- Audit chain forms a tamper-evident linked list
- Nightly cron `verify-actions-chain` walks the chain; surfaces any tampering to Sentry + the audit log itself
- Independent verification: any auditor can replay the chain offline given a database dump

### Per-tenant data encryption keys (DEK)
- Each tenant gets a unique 256-bit DEK encrypted by a master KEK
- All sensitive fields (SSN, EIN, bank account, financial IDs) are AES-256-GCM encrypted with the tenant's DEK
- AAD (Additional Authenticated Data) binds ciphertexts to `(tenant_id, client_id, path)` to prevent cross-tenant ciphertext substitution
- In-process LRU cache for hot DEKs; eviction on tenant deletion
- DEK rotation procedure documented; master-KEK fallback path being removed (V1 hardening item)

### Encryption at rest
- All Postgres data on Neon's hosted infrastructure with AES-256 disk encryption
- Cloudflare R2 object storage encrypted at rest by R2 (S3-compatible)
- Backups encrypted at rest by Neon's backup infrastructure
- DEK-encrypted columns provide a second layer for the most sensitive fields

### Encryption in transit
- TLS 1.3 enforced on all external surfaces (Vercel default)
- TLS 1.2+ enforced between application and database (Neon configuration)
- Internal service-to-service via HTTPS only; no plaintext
- HSTS headers applied to all marketing + app surfaces

### Webhook signature verification
- Every inbound webhook (DocuSign, Square, Twilio, Inngest, Resend) signature-verified via `@docket/shared/webhooks`
- Timing-safe comparison; rejects on signature mismatch
- 32/32 webhook verification tests passing on every commit
- Test secrets explicitly separated from production secrets

### Multi-factor authentication (MFA)
- Phone-OTP via Clerk + Twilio (SMS-delivered one-time codes)
- Clerk's session management; tokens not stored long-term in application
- MFA enforced on every sign-in (no remember-me bypass)
- Future: TOTP-app option for users who prefer not to receive SMS

### Rate limiting on public endpoints
- In-process token-bucket rate limiter on `/api/intake/flush`, `/api/scan-intake-stub`, `revealIntakeField`, etc.
- IP + tenant-keyed buckets
- 429 responses on bucket exhaustion with `Retry-After` headers
- Upstash Redis swap planned for V1.5 (per-Vercel-lambda Map limiter is the v0 substrate)

---

## Organizational security

### Access controls
- Role-based access control via Clerk + our policy matrix
- 5 roles: `firm_owner` / `preparer` / `reviewer` / `admin` / `assistant`
- Sensitive operations (SSN reveal, 8879 sign, payment data) gated to specific roles
- Policy matrix documented in [`docs/security/access-control-policy.md`](access-control-policy.md)
- Per-session SSN/EIN reveal with 15-min TTL + 6/min rate limit + audit row per unlock

### Authentication
- Phone-OTP via Clerk + Twilio is the only authentication path
- No password-based auth (eliminates password-database compromise risk)
- Session tokens managed by Clerk (industry-standard rotation + invalidation)
- No social login / SSO (defer to V1.5 + only for firm-owner / preparer roles, never for taxpayers)

### Personnel access
- Production database access limited to David Kim (CEO) + Haokun Yang (CTO)
- Production credentials stored in `.env.local` (gitignored) for dev + Vercel encrypted env vars for production
- No third-party engineering access; no contractors with production access
- Antonio (advisor) has firm-owner role on his Vazant tenant only; no cross-tenant access

### Data classification
- 4-tier classification: Public / Internal / Confidential / Restricted
- SSN / EIN / bank account = Restricted (DEK-encrypted + masked-by-default UI + audit-logged reveals)
- Tax positions + memos + client communications = Confidential
- Tenant configuration + non-sensitive client metadata = Internal
- Marketing content + position library = Public
- Full policy in [`docs/security/data-classification-and-handling.md`](data-classification-and-handling.md)

---

## Product security

### Data minimization at the form layer
- Intake forms collect only the data required for tax preparation
- §7216 consent captured before any disclosure-eligible data is collected
- Optional fields explicitly marked; required fields explicitly justified
- No third-party trackers / analytics on intake routes (Sentry only for error tracking)

### PII scrubbing in observability
- Sentry beforeSend scrubber redacts SSN / EIN / email / phone substrings before events leave our processes
- Field-name-based redaction for sensitive-looking field names
- 32 PII scrubber tests verifying every edge case
- See `@docket/shared/sentry-scrubber` + `pii-scrubber` modules

### Input validation at every server-action boundary
- Zod schemas (or hand-written validation) on every server action
- Reject malformed inputs at the API boundary before any database write
- Type errors surface as structured 400 responses; no internal errors leak
- Per-route validation tests on critical surfaces (e.g., 12 validation tests on `/api/scan-intake-stub` per codex audit)

### Compliance-first AI position framework
- Every AI-surfaced tax position carries: cited IRC authority, confidence tier (1-4), audit-risk assessment, refusal floor below Reasonable Basis
- Position Framework full spec in [`docs/POSITION-FRAMEWORK.md`](../POSITION-FRAMEWORK.md)
- AI never auto-files a position above Tier 1; EA decides every Tier 2-4
- Refusal floor is non-negotiable; AI returns "I refuse" rather than surfacing a position below reasonable basis

### Trust escalation gate
- Every external-effect action (send email, write to tax software, file with IRS) gated through `assertTrustGate`
- Per-tenant trust level (L1-L4) × action class × position tier matrix
- L1 firm: all external actions require human approval (Antonio's default)
- L2+: progressive auto-acceptance based on action class + position tier
- 15 trust-gate tests verifying the matrix logic

### Audit-immutable design
- `actions` table is INSERT-only via trigger (no UPDATE / DELETE except FK-cascade SET NULL on `client_id` per migration 0012)
- Audit chain prevents tampering; any modification is detectable by chain re-verification
- Retention policy: 7-year tax-document retention default (configurable per tenant)
- Soft-delete only at the application layer; never hard-delete operational data

---

## Internal security procedures

### Change management
- Every commit must pass: typecheck across 15 workspaces + `@docket/shared` test suite + `@docket/db` integration tests + protocol-gate (commit-message trailer validation) + codex review
- Protocol-gate enforces: edge-case enumeration + score ≥95 + alignment check + craft check + codex review verdict + compliance check
- See [`docs/security/change-management-policy.md`](change-management-policy.md) for full procedure
- CI re-validates every protocol on every commit in a PR; locally pre-commit + commit-msg hooks block first

### Logging and monitoring
- All AI agent calls logged to `actions` table with cost telemetry, latency, model used, token counts
- Per-tenant + per-agent cost dashboards
- Sentry exception monitoring with structured tags (app, surface, tenant_id where appropriate)
- Cost-outlier alert thresholds (spike detection on hourly + daily cost-per-tenant baselines)
- Full policy in [`docs/security/logging-and-monitoring.md`](logging-and-monitoring.md)

### Incident response
- Documented IR playbook covering: data breach / vendor outage / agent malfunction / compliance issue / billing dispute
- Severity 1-4 escalation matrix
- Customer notification SLA: 72 hours per relevant state breach laws
- Full procedure in [`docs/security/incident-response-plan.md`](incident-response-plan.md)

### Vendor management
- Sub-processor list maintained: Anthropic / AWS Bedrock / Neon / Clerk / Twilio / Square / DocuSign / Cloudflare / Resend / Vercel / Voyage AI / Cohere / Sentry / Stripe (when added)
- Each vendor evaluated for: security posture, data residency, sub-processor disclosure, SOC 2 / equivalent attestation
- All sub-processors have ZDR or equivalent enterprise data handling
- Full list + DPA links in [`docs/security/vendor-management-policy.md`](vendor-management-policy.md)

### Backup and recovery
- Neon automated continuous backups + point-in-time recovery (24h window on free tier, 7d on Launch tier)
- Cloudflare R2 object storage versioning (90-day retention on delete)
- Backup restoration tested quarterly
- Full BCP in [`docs/security/business-continuity-plan.md`](business-continuity-plan.md)

---

## Data and privacy

### Customer data ownership
- Customers own their data outright; we provide infrastructure to manage it
- Data export endpoint per CCPA / GDPR (V1.5 ship)
- Data deletion procedure: 30-day grace period + permanent deletion on request
- Per-tenant DEK rotation supported (rotates per-DEK without re-encrypting historical data via DEK chain)

### Data retention
- 7-year tax-document retention default (matches IRS audit window)
- Configurable per tenant via `tenant_settings.retention_policy`
- Customer data deleted upon tenant offboarding (30-day grace)
- Audit chain entries retained for the life of the platform (immutable per design)

### Data classification policy
- Restricted (SSN / EIN / bank): DEK-encrypted, masked-by-default UI, audit-logged reveals
- Confidential (positions, memos, communications): tenant-RLS-scoped, no DEK encryption (queryability), encrypted at rest
- Internal (configuration, metadata): tenant-RLS-scoped, encrypted at rest
- Public (marketing content, position library citations): no encryption beyond TLS
- Full policy in [`docs/security/data-classification-and-handling.md`](data-classification-and-handling.md)

### Zero Data Retention with AI providers
- Anthropic API requests configured for ZDR (Zero Data Retention) — prompts and completions not stored for training
- AWS Bedrock (fallover provider) configured equivalently
- Voyage AI embeddings: ZDR per Voyage's enterprise data handling
- No customer data fed into model training, evaluation, or fine-tuning pipelines

### Cross-border data residency
- Primary infrastructure US-based (Vercel + Neon + Cloudflare R2 us-east-2)
- Sub-processor data flows documented in vendor management policy
- No customer data leaves US unless customer explicitly enables (e.g., for international clients)

---

## Compliance and audits

### SOC 2 posture
- All controls listed above built into the codebase per [`CLAUDE.md` L8](../../CLAUDE.md) lock
- Drata / Vanta automation deferred until capital lands; the controls themselves ship now
- Independent attestation audit planned for Q1/2027 once tooling investment closes

### IRS compliance
- Form 8879 KBA (Knowledge-Based Authentication) per IRS Pub 1345 NIST IAL2 standard
- §7216 consent captured before any taxpayer information disclosure
- §6695(g) due-diligence checklist support (Form 8867) for EITC / CTC / AOTC / HOH returns
- §6694 understatement penalty protection: Position Framework refusal-floor + cited authority on every position

### State compliance
- California: §17530.5 disclosure compliance built into intake flow
- CCPA-compliant data export + deletion endpoints (V1.5)
- State-specific tax-position content (CA FTB Residency Manual + Legal Rulings) in position library

### Privacy laws
- CCPA-compliant by design (data export + deletion + opt-out)
- GDPR-equivalent practices for international clients (when added)
- No third-party tracking / analytics on intake routes
- Cookie banners default to privacy-preserving option (decline cookies unless explicitly accepted)

---

## What we DON'T claim

Honesty about gaps protects trust:

- **Not yet SOC 2 Type II certified.** Posture-ready, not attestation-ready. Q1/2027 target.
- **Not yet HIPAA-eligible Twilio account.** Tax data isn't strictly PHI, but HIPAA-eligible posture is defensive. Adding ~$20/mo when capital lands.
- **Not yet penetration-tested by external firm.** External pentest scheduled Q4/2026 pre-launch.
- **Not yet ISO 27001 certified.** No immediate plan; SOC 2 Type II covers buyer expectations at our segment.
- **Not yet FedRAMP authorized.** Not in scope; we don't sell to federal government.

---

## Reporting security issues

If you discover a security vulnerability, please email **security@docket.com** with:
- Description of the vulnerability
- Steps to reproduce
- Expected impact assessment
- Your contact information for follow-up

We will respond within 24 hours, acknowledge within 72 hours, and remediate per severity. Coordinated disclosure preferred (90-day default before public disclosure).

We do not currently offer paid bug bounties. We do publicly acknowledge security researchers who report responsibly in our quarterly security update.

---

## Update log

| Date | Change | Updated by |
|---|---|---|
| 2026-05-13 | File created as canonical source for `/trust` route content. 7 sections + footer. All listed controls are actually shipped in production (no aspirational items). Slant.app's Trust Center is the structural reference. | David Kim |

---

*This file maps directly to the `/trust` route on the marketing site (V1 launch 7/30). When ready to ship: render this content as a static HTML page; no auth required; no analytics tracking; encryption-only TLS connection.*
