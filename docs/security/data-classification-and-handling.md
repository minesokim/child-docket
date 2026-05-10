# Data Classification & Handling Policy

**Version:** 1.0
**Effective:** 2026-05-09
**Owner:** Founder
**Review cadence:** quarterly + on every new data type onboarded

---

## 1. Purpose

Define how Docket classifies data, the handling rules for each class, and the encryption + retention requirements that follow from classification.

---

## 2. Classification levels

| Level | Definition | Examples |
|---|---|---|
| **Public** | Data intentionally published to the world. | Marketing pages, documentation, open-source content, the controls matrix entries that are non-secret. |
| **Internal** | Data shared inside Docket but not externally. | Roadmap files in `docs/`, decisions log, internal Slack messages, non-sensitive code. |
| **Confidential** | Data shared with one or more tenants but not the public. | Tenant-scoped operational data (clients table, intake responses without PII fields, action audit rows that don't carry encrypted body), tenant configuration, app analytics. |
| **Restricted** | Data subject to regulatory protection, handles tax-payer PII or firm credentials. | SSN, EIN, bank account numbers, Twilio/DocuSign/Square/Gmail credentials, audit-chain rows containing encrypted body, Form 8879 envelopes, IRS transcripts (when integrated), agent prompt + completion logs that may contain PII. |

---

## 3. Handling rules per class

### Public

- May be transmitted in cleartext.
- May be stored in any system.
- May be cached by CDNs.
- No retention limit.

### Internal

- Transmitted over HTTPS only.
- Stored on systems with at-least Internal-level access control (GitHub, Vercel team).
- Not exposed in customer-facing surfaces.
- Retention as needed for operations; archive when no longer relevant.

### Confidential

- Transmitted over HTTPS only.
- Stored in production systems behind tenant RLS.
- Never logged in plaintext to Sentry, Inngest dashboards, or third-party observability tools (the PII regex scrubber `packages/shared/src/scrub-pii.ts` enforces this on best-effort basis; Internal-class structured data must NOT contain PII).
- Backup encryption per `business-continuity-plan.md`.
- Retention: 7 years (tax document standard) for tenant-data; configurable per tenant in v1.5+.

### Restricted

- **Encryption at rest:** AES-256-GCM with per-tenant DEK + master KEK two-tier key management. AAD bound to (tenant_id, client_id, path) per commit `2c5db11`. No exceptions.
- **Encryption in transit:** HTTPS for app traffic; TLS 1.3 for direct database connections.
- **Field-level encryption** for SSN/EIN/bank account fields in `clients` and `intake_responses` tables. Reveal flow on command-room is per-session, 15-min TTL, role-gated, rate-limited, audit-logged per access.
- **Tenant credentials** (`tenant_credentials.data`) encrypted with the tenant's DEK; the DEK is encrypted with the master KEK. KEK rotation runbook + script exist (`2d63206` + `3bd42b1`).
- **No plaintext in logs.** Sentry breadcrumbs are scrubbed via `scrubPII` before transmission. Plaintext PII in logs = security incident.
- **No plaintext in error messages** returned to clients.
- **No plaintext in URLs** or query strings (per privacy rules in system prompt).
- **No plaintext in caching layers** (Vercel edge cache, CDN). Restricted data is never cacheable.
- **Backup encryption:** logical backups (pg_dump) of Restricted data are encrypted with a separate backup KEK before R2 upload.
- **Retention:** 7 years post-engagement-close (tax document retention standard) unless legally required longer (active audit, litigation hold). Tenant-configurable with founder approval.
- **Deletion:** customer-requested deletion completes within 30 days of request; per-tenant DEK rotation walker (`reencrypt-legacy.ts`) handles cryptographic erasure for full-tenant deletions.

---

## 4. Specific Restricted data items + protections

| Item | Storage | Protection | Audit |
|---|---|---|---|
| SSN / ITIN | `clients.ssn` (encrypted), `intake_responses` (encrypted) | DEK per-tenant, AAD-bound, field-level | Audit row on every reveal |
| EIN | Same | Same | Same |
| Bank account / routing | `clients.bank_account` (encrypted) | Same | Same |
| Twilio credentials | `tenant_credentials.data` | Tenant DEK | Audit row on every credential access |
| DocuSign credentials | Same | Same | Same |
| Square credentials | Same | Same | Same |
| Gmail OAuth tokens | Same | Same | Same |
| Form 8879 envelopes | DocuSign vendor-side + R2 (signed PDF) | Vendor SOC 2 + R2 SSE | Audit row + DocuSign event log |
| IRS transcripts (v1.5+) | R2 encrypted | Per-tenant DEK | Audit row |
| Agent prompts + completions | `actions` table (compressed payload) | Encrypted body for sensitive prompts | Audit chain row |

---

## 5. Data flow rules

- **PII into Sentry:** **never**. PII regex scrubber (`packages/shared/src/scrub-pii.ts`, 32 tests) intercepts breadcrumbs + error contexts. New error paths must be reviewed for PII leakage.
- **PII into Inngest event payloads:** **never**. Inngest events carry IDs that the worker dereferences against the database; the database fetch is the only place plaintext appears in worker memory.
- **PII into LLM prompts:** **conditional**. Prompts that need PII (tax position drafting, return preparation) carry it through encrypted-body fields. ZDR per-Anthropic and per-AWS Bedrock (BAA-eligible) prevents persistent storage at vendor.
- **PII into URL parameters:** **never**. Query strings are visible in server logs, browser history, referrer headers.
- **PII into Slack / email / handoff docs:** **never** in plaintext. Use redacted forms (last-4-of-SSN) when needed for support context.
- **PII via screenshots:** customers may upload PII-bearing documents; the upload is encrypted at rest. Antonio + future preparers must follow the screen-share + screenshot policy in `employee-training-and-awareness.md`.

---

## 6. Special handling: tax-domain data

- **Authority corpus** (Public): IRS Pubs, FTB rulings, Tax Court opinions. Public data; no special handling.
- **Effective-date-versioned authority** (Internal): once integrated into the knowledge graph, becomes tenant-shareable but the curation work is internal. Stored in `content/authority/` (currently empty; ingestion deferred per CLAUDE.md §15).
- **Position drafts** (Confidential, may include PII): generated in agent runs, stored in tenant-scoped tables, audit-logged.
- **Filed forms** (Restricted): contain PII + are sent to IRS; storage as Restricted, retention 7 years minimum.

---

## 7. Customer-facing data ownership

Tenants own their data. Specifically:
- Tenant-scoped data is segregated by Postgres RLS at `ENABLE + FORCE`. Two `getAdminDb()` callers bypass RLS with documented justification (CLAUDE.md §18). Adding a third caller requires founder approval + SECURITY.md justification.
- On tenant churn, customer may request data export (machine-readable + human-readable) within 30 days.
- On customer-requested deletion: complete cryptographic erasure within 30 days; the tenant's DEK is destroyed, rendering any leftover encrypted ciphertext unrecoverable.

---

## 8. Anti-patterns blocked

- Logging request bodies with PII to Sentry.
- Storing PII in env vars.
- Including PII in commit messages, PR descriptions, or commit comments.
- Sending PII via email or Slack in plaintext.
- Caching PII at edge or CDN.
- Storing PII in URL query strings.

---

**Last reviewed:** 2026-05-09 (initial draft, founder)
**Next review:** 2026-08-09
