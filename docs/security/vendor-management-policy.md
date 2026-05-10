# Vendor Management Policy

**Version:** 1.0
**Effective:** 2026-05-09
**Owner:** Founder
**Review cadence:** quarterly + on every new vendor + on every incident at an existing vendor

---

## 1. Purpose

Define how Docket assesses, onboards, monitors, and offboards third-party vendors that process or could process customer data. The objective is auditable third-party risk management with clear sub-processor disclosure and tested exit plans.

---

## 2. Scope

Every vendor in the dependency chain — explicitly:
- **Cloud infrastructure:** Vercel (apps), Neon (database), Cloudflare (R2 + DNS), Inngest (background jobs)
- **AI inference:** Anthropic (primary), AWS Bedrock (fallback)
- **Communications:** Twilio (SMS + OTP), Gmail / Google Workspace (per-tenant OAuth, firm-owner email-in)
- **Payments:** Square (deposit + future invoicing)
- **E-signature + KBA:** DocuSign + LexisNexis (NIST IAL2)
- **Auth:** Clerk
- **Observability:** Sentry
- **Source code:** GitHub
- **Future:** Voyage AI (embeddings), Cohere (rerank), Deepgram (voice transcription v1) → Gladia v2, Drata or Vanta (SOC 2 attestation), CA Secretary of State API (Phase 2-expansion), FinCEN BOI E-Filing (Phase 2-expansion), IRS Tax Pro Account (Phase 5)

---

## 3. Vendor risk classification

| Tier | Definition | Examples | Assessment depth |
|---|---|---|---|
| **Critical** | Stores or processes regulated customer data; takes the firm down if it fails | Neon, Vercel, Cloudflare, Anthropic (+ Bedrock fallback), Clerk, Twilio, DocuSign, Square, Gmail | Full SOC 2 review + sub-processor list + exit plan + annual reassessment |
| **Important** | Operational dependency; recoverable with effort | Sentry, Inngest, GitHub, future Voyage / Cohere / Deepgram / Gladia | SOC 2 review + annual reassessment |
| **Routine** | Tools that don't touch customer data | npm registry, package CDNs, dev-only services | Lockfile integrity + minor-version policy + breach-monitoring |

---

## 4. Sub-processor list (current)

The complete current sub-processor map:

| Vendor | Tier | What they process | Where | DPA in place | SOC 2 / equivalent |
|---|---|---|---|---|---|
| **Vercel** | Critical | App hosting + edge compute + build | US (us-east-1 default) | Yes | SOC 2 Type II |
| **Neon** | Critical | Postgres production database (Launch tier, DEKs encrypted at rest) | us-east-2 | Yes | SOC 2 Type II |
| **Cloudflare R2** | Critical | Document object storage | Auto (no specific region binding for R2) | Yes | SOC 2 Type II |
| **Inngest** | Critical | Durable background jobs | US (Vercel integration) | Yes | SOC 2 Type II |
| **Anthropic** | Critical | LLM inference (primary) + ZDR | Per Anthropic policy | Yes (DPA + ZDR) | SOC 2 Type II |
| **AWS Bedrock** | Critical | LLM inference (fallback) | us-east-1 | Yes (BAA-eligible) | SOC 2 Type II |
| **Clerk** | Critical | Authentication, MFA, OTP coordination | US | Yes | SOC 2 Type II |
| **Twilio** | Critical | SMS OTP, customer notifications, optional voice | US | Yes | SOC 2 Type II |
| **DocuSign** | Critical | Form 8879 e-signature, envelope storage | US | Yes (HIPAA-eligible) | SOC 2 Type II |
| **LexisNexis** (via DocuSign KBA) | Critical | Knowledge-Based Authentication for IRS NIST IAL2 | US | Via DocuSign | Internal SOC equivalence |
| **Square** | Critical | Deposit + invoice payment | US | Yes | PCI DSS Level 1 |
| **Gmail (Google Workspace)** | Critical | Per-tenant firm-owner email OAuth | Per Google policy | Each firm has their own DPA with Google | SOC 2 Type II |
| **Sentry** | Important | Error tracking with `app:` tag scrubbing | US | Yes | SOC 2 Type II |
| **GitHub** | Important | Source code | US | Yes | SOC 2 Type II |

The PII regex scrubber (`packages/shared/src/scrub-pii.ts`, 32 tests) ensures we don't ship PII to Sentry breadcrumbs even on uncaught error paths.

---

## 5. Onboarding a new vendor

1. **Justify the vendor.** Why does Docket need this? What other options were considered? Documented in `docs/AUTONOMOUS-DECISIONS.md` for non-trivial choices.
2. **Risk-tier the vendor.** Critical / Important / Routine per §3.
3. **Review SOC 2 / equivalent.** Critical and Important vendors must have current SOC 2 Type II (or HIPAA / ISO 27001 equivalent for non-US). Read the latest report or bridge letter.
4. **Sign DPA + sub-processor terms.** Critical and Important vendors must have a DPA in place before customer data flows. Sign electronically; archive at `docs/security/dpas/<vendor>.pdf`.
5. **Catalog credentials.** New vendor adds to `docs/STATE.md` connected systems table + this policy's sub-processor list. Credential rotation cadence specified.
6. **Update the controls matrix.** [`controls-matrix.md`](controls-matrix.md) reflects which SOC 2 criteria the new vendor touches.

---

## 6. Ongoing monitoring

- **Monthly:** founder reviews each Critical vendor's status page for incidents in the prior 30 days.
- **Quarterly:** full vendor review (this policy is reviewed; sub-processor list audited; DPAs verified current).
- **Annually:** request the vendor's latest SOC 2 Type II report (or bridge letter); review findings; document any concerns.
- **On every vendor incident:** assess Docket's exposure within their stated incident window; check audit chain for actions during that window; consider customer notification per [`incident-response-plan.md`](incident-response-plan.md) §6.

---

## 7. Exit plans

For every Critical vendor, a tested exit plan answers: "if this vendor became unviable in 30 days, how would we move?"

| Vendor | Exit plan summary | Time to exit | Last tested |
|---|---|---|---|
| **Vercel** | Migrate Next.js apps to Cloudflare Pages or self-hosted Node + edge worker. Routes are standard Next.js; edge runtime usage minimal. | 2–4 weeks | Not yet tested. |
| **Neon** | Standard Postgres dump + restore to Supabase / RDS / Aiven. Pgvector is widely supported. | 1 week | Not yet tested. |
| **Cloudflare R2** | S3-compatible API; AWS S3 is the obvious migration target. | 3–5 days | Not yet tested. |
| **Inngest** | Migrate to Temporal (more complex, more capable) or Trigger.dev. Inngest functions are TS code; rewrite cost is moderate. | 2–3 weeks | Not yet tested. |
| **Anthropic** | Bedrock fallback already in production (`303f886`). For full exit: orchestrator is provider-agnostic (model tier abstraction); plumb OpenAI or self-hosted via the same interface. | 1–2 weeks | **Tested in CI:** Bedrock fallback runs in smoke tests (4/4 passing). |
| **AWS Bedrock** | Disengage; rely on Anthropic primary. Or pivot to OpenAI through orchestrator. | < 1 day | Tested via cutover smoke. |
| **Clerk** | Migrate to Auth0 or self-hosted Supertokens. Phone-OTP is a standard primitive; Twilio integration moves with us. | 3–4 weeks | Not yet tested. |
| **Twilio** | MessageBird / Vonage / Plivo. SMS providers are interchangeable. | 1 week | Not yet tested. |
| **DocuSign** | Documenso self-hosted is the v1+ target per CLAUDE.md tech foundation. Or HelloSign / Adobe Sign. KBA via direct LexisNexis InstantID Q&A. | 4–6 weeks | Not yet tested. |
| **Square** | Stripe (if we ever add it back) / payment-link providers. Square is the primary because Antonio uses it day-to-day; for partner #2+ we may multi-rail. | 2 weeks | Not yet tested. |
| **Gmail** | Each firm uses their own Gmail per L10 lock; firm-level switch is the firm's IT decision, not ours. | n/a | n/a |
| **Sentry** | Datadog / Honeycomb / GlitchTip self-hosted. | 1 week | Not yet tested. |

Annual goal: test one exit plan per year per Critical vendor. Year 1: Bedrock fallback (already tested in CI); Year 1 H2: Neon dump/restore drill.

---

## 8. Concentration risk

We accept some concentration today (Vercel + Neon + Cloudflare in particular). Mitigations:

- **Multi-region:** in v1.5 (PRODUCTION-READINESS §A), Neon read replica + R2 cross-region replication.
- **Hot-standby DB:** v1.5 multi-cloud DB hot standby per CLAUDE.md vendor resilience posture (locked 2026-05-08).
- **Inference resilience:** Bedrock fallback already in production.

---

## 9. Customer disclosure

The current sub-processor list is **published** at `https://docket.tax/security/sub-processors` (URL TBD; placeholder until launch). New sub-processor additions trigger a 30-day customer notification period (industry standard for B2B SaaS). Customers may object; objections trigger founder-level review of the change.

For our segment (mid-market firms + EAs), customers expect a sub-processor list at sales-cycle time. The list is the artifact.

---

## 10. Vendor-side incident handling

When a vendor reports an incident affecting Docket:
1. Within 1 hour: founder reads the vendor's incident notice and Docket's potential blast radius.
2. Within 4 hours: founder decides on customer notification (yes / no / monitor) per `incident-response-plan.md` §6.
3. Within 24 hours: rotate any credential the vendor states may have been exposed.
4. Within 48 hours of vendor incident closure: post-mortem of Docket's response if Docket-side action was needed.

---

**Last reviewed:** 2026-05-09 (initial draft, founder)
**Next review:** 2026-08-09
