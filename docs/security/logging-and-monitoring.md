# Logging & Monitoring Policy

**Version:** 1.0
**Effective:** 2026-05-09
**Owner:** Founder
**Review cadence:** quarterly + after every detection-rule change

---

## 1. Purpose

Define what Docket logs, where log data goes, who can see it, how alerts fire, and how long logs are retained. The objective is auditable observability with PII protection.

---

## 2. Logging architecture

### Application logs (apps + services + workers)

- **Sentry** is the centralized error + performance tracker. Both apps (`apps/client-portal`, `apps/command-room`) + workers (`services/workers`) wired with the `app:` tag distinguishing source. Commits `a122ae5` → `95e2629` → `40c5caa`.
- **Vercel built-in logs** capture request-level data for both apps. 7-day retention on Pro; archived to R2 monthly for compliance retention.
- **Inngest dashboard** captures every job invocation, retry, dead-letter. 30-day retention; older events archived per backup strategy.
- **Console logs in production** are forbidden by `/code-quality` gate; ESLint rule prohibits `console.log` outside test files. Real telemetry uses structured logging through Sentry.

### Audit chain (the security log)

- **Cryptographic audit chain** (`packages/db/migrations/0007_*.sql`) records every state-changing server action with chain_seq + prev_hash + row_hash. Append-only via trigger. Tamper-evident.
- **Nightly verification cron** (`verify_actions_chain` per `services/workers/src/functions/verify-actions-chain.ts`) walks the chain and alerts on any inconsistency.
- **Retention:** indefinite. Audit chain is the system of record for "what happened in the platform and when." 7 years minimum; longer for litigation hold.

### Access logs

- **Clerk** logs every login + MFA challenge.
- **Vercel** logs every deployment + environment-variable change.
- **Neon** logs every connection + role-level event (audit log enabled).
- **GitHub** logs every commit, PR, branch protection change, role change.
- **Cloudflare** logs every R2 access + dashboard event.

---

## 3. What is logged

| Event | Where | Tag |
|---|---|---|
| Application errors (exceptions, API failures) | Sentry | `app:client-portal` or `app:command-room` or `app:workers` |
| State-changing actions (every server action that mutates) | Audit chain (`actions` table) | tenant_id, user_id, action_class, prompt_hash |
| AI inference calls | `actions` (cost telemetry hook on `runDocketAgent`) | model, tokens, cost, cached |
| Agent runs (triage, drafter, etc.) | `actions` + Sentry breadcrumbs | agent_name, model_tier, latency |
| Webhook receipts (Twilio, DocuSign, Square, Gmail, Inngest) | Audit chain + Sentry | source, signature_verified |
| Tenant credential access (encryption boundary cross) | Audit chain | reason, principal |
| PII unlock (SSN/EIN reveal on command-room) | Audit chain | principal, target_client_id, ttl_remaining |
| Migration runs | Stdout + commit history | migration_id, env, applied_at |
| Health-check failures | Sentry + status endpoint | service, region |
| Cost outliers | Inngest cron + audit row | tenant_id, ratio, p95 |

---

## 4. PII scrubbing

The PII regex scrubber (`packages/shared/src/scrub-pii.ts`, 32 tests, commit `8f0c2d5`) is the structural defense:
- Wraps Sentry's `beforeSend` hook.
- Strips SSN-shaped strings, EIN-shaped strings, bank-account-shaped strings, email-when-untrusted, phone-when-untrusted from breadcrumbs and error contexts.
- Tests cover happy-path + edge cases (formatted-vs-unformatted, partial matches, false-positive resistance).

If a new error path could carry PII (e.g., a new agent that processes return data), the founder verifies the path is wrapped in `scrubPII` before deploy. New PII-shaped data types added to the regex coverage in the same commit that adds the feature.

---

## 5. Alert routing

| Alert | Trigger | Destination | Severity |
|---|---|---|---|
| Sentry P1 errors | New exception in production with > 5 occurrences in 1 hour | Founder email + push | P1/P2 |
| Sentry P2 errors | New exception in production | Founder email | P3 |
| Audit chain integrity failure | Nightly verifier reports inconsistency | Founder email + Slack | P1 |
| Cost outlier | Per-tenant cost > 3x rolling p95 (every 30 min) | Founder Slack | P3 |
| Cost spike | Day-over-day cost > +50% (daily 09:00 UTC) | Founder Slack | P3 |
| Inngest dead letter | Job fails after all retries | Founder email | P2/P3 depending on job |
| Health-endpoint failure | `/api/health` reports unhealthy DB or vendor | Customer-facing banner + founder push | P1 |
| Vendor status-page incident | Subscribed status pages (Anthropic, AWS, Vercel, Neon, Cloudflare, Clerk, Twilio, DocuSign, Square, Inngest) | Founder email | P2/P3 depending on vendor |

Alert noise tuning is part of every quarterly review.

---

## 6. Log access

| Source | Who can read |
|---|---|
| Sentry | Founder; future security lead. Customer-data scrubbing means logs are Internal-class. |
| Vercel logs | Founder; future on-call eng. Tenant identifiers visible; PII is scrubbed. |
| Inngest dashboard | Founder; future on-call eng. Event payloads carry IDs only, not PII (per `data-classification-and-handling.md` §5). |
| Audit chain | Founder; auditor (when SOC 2 attestation begins). Read-only via the verifier cron + ad-hoc Drizzle queries. |
| Clerk admin logs | Founder; future security lead. |
| Neon admin logs | Founder. |
| GitHub admin logs | Founder; future engineering lead. |
| Cloudflare admin logs | Founder. |

Access is logged in turn (the access-control event log is itself a Confidential-class data asset).

---

## 7. Retention

| Log source | Retention | Reason |
|---|---|---|
| Sentry | 90 days (default) | Standard error-tracking horizon |
| Vercel logs | 7 days hot, archived monthly to R2 (90 days) | Standard request-log horizon |
| Inngest | 30 days hot, archived monthly | Standard job-log horizon |
| Audit chain | Indefinite (7 years minimum) | System of record for security + compliance |
| Clerk admin | Per Clerk default; exported quarterly to internal storage | SOC 2 access-review evidence |
| Neon admin | Per Neon default; exported quarterly | Same |
| GitHub admin | Per GitHub default | Same |
| Cloudflare admin | Per Cloudflare default | Same |

After retention expiration: cryptographic destruction (delete or rotate keys, depending on substrate).

---

## 8. Monitoring dashboards

- **Cost dashboard** at `/dashboard/cost` (commit `f170c03` + `86e7e0a`) — per-tenant rolling cost, model-tier mix, agent-run distribution.
- **Home dashboard** at `/` (commit `8cc55eb`) — high-level practice intelligence per Antonio's actual ledger.
- **Health endpoints** at `/api/health` on both apps — substrate health for status-banner consumption.
- **Future:** OpenTelemetry → Honeycomb (or Datadog) per CLAUDE.md tech foundation; not yet wired.

---

## 9. Anti-patterns blocked

- Logging request bodies wholesale (PII risk).
- Logging stack traces with locals containing PII (Sentry's "include locals" feature is disabled).
- Custom log shippers that bypass Sentry or audit chain (only audited paths get to write to logging substrates).
- Console.log in production code (blocked by ESLint + `/code-quality`).

---

**Last reviewed:** 2026-05-09 (initial draft, founder)
**Next review:** 2026-08-09
