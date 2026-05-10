# Incident Response Plan

**Version:** 1.0
**Effective:** 2026-05-09
**Owner:** Founder (incident commander until first security hire)
**Review cadence:** semi-annual + tabletop exercise annually

---

## 1. Purpose

Define how Docket detects, escalates, contains, eradicates, recovers from, and learns from security and availability incidents. The lifecycle: **Detect → Escalate → Contain → Eradicate → Recover → Post-Mortem**.

---

## 2. Definitions

| Term | Meaning |
|---|---|
| **Incident** | Any event that may impact confidentiality, integrity, or availability of Docket production systems or customer data. Includes confirmed breaches AND credible suspicion. |
| **Security incident** | Unauthorized access, data exfiltration, account compromise, malware, ransomware, prompt-injection causing harmful action, audit-chain tampering attempt. |
| **Availability incident** | Production outage, degraded performance affecting >5% of customers, vendor-side outage propagating to Docket, database failure, queue backup beyond SLA. |
| **Severity** | P1 (critical, customer-data-impact, all-hands), P2 (high, partial outage or contained breach), P3 (medium, single-tenant impact, recovered <1h), P4 (low, internal only). |
| **Incident commander** | Single person accountable for the incident from detection to post-mortem. Founder by default. |

---

## 3. Detection sources

| Source | What it watches | Alert path |
|---|---|---|
| **Sentry** | Application errors in both apps + workers, with `app:` tag | Founder email + push notification |
| **Inngest dashboard** | Job failures, queue depth, dead letters | Founder email + dashboard check during ops review |
| **Audit-chain verifier** | Nightly cron checks chain_seq + prev_hash + row_hash integrity. Failure = tamper signal | Founder email + Slack |
| **Cost outlier alert** | Inngest cron every 30 min flags per-tenant cost >3x rolling p95 | Founder Slack |
| **Cost spike alert** | Inngest daily 09:00 UTC flags day-over-day cost increase >50% | Founder Slack |
| **Health endpoints** | `/api/health` on both apps; status banner triggers ReadOnlyProvider when DB unhealthy | Customer-facing banner + founder push |
| **Customer report** | Email to founder, in-app message, support thread | Founder email + Slack |
| **Vendor advisory** | Twilio / DocuSign / Square / Anthropic / AWS / Cloudflare status pages | Subscribed via email |
| **Bug bounty / responsible disclosure** | (To set up post-launch) | TBD email alias |

---

## 4. Severity matrix

| Severity | Trigger | Response time | Escalation |
|---|---|---|---|
| **P1** | Confirmed breach. Confirmed customer-data exposure. Audit chain shows tamper. Production hard-down >15 min. | Immediate. < 5 min ack. | Founder + (when hired) on-call + (when hired) general counsel. Customer notification triggered if data exposure confirmed. |
| **P2** | Single-tenant compromise contained. Production degraded but functioning. Vendor-side outage with Bedrock fallback engaged. | < 30 min ack. | Founder + on-call. Customer status page update. |
| **P3** | Single-tenant operational issue. Cost outlier flagged. Single user-reported bug with security implications. | < 2 hours ack during business hours. | Founder. |
| **P4** | Internal-only signal. Tooling glitch. Non-customer-impacting cron failure. | < 24 hours ack. | Founder. |

---

## 5. Lifecycle

### Detect

The first signal — automated alert or human report — starts the incident clock. Within 5 min: founder acks, opens an incident channel (`#inc-YYYY-MM-DD-<slug>` in Slack or local doc if Slack unavailable), and starts the tracking doc at `docs/incidents/INC-YYYY-MM-DD-<slug>.md`.

### Escalate

For P1/P2: founder pages additional responders (when team grows) + general counsel (when retained) + customer-success contact at the affected tenant (when applicable).

For confirmed customer-data exposure: founder reads the relevant state-law breach-notification timeline (CCPA: 72-hour outer window for residents; varies state-by-state) and starts the notification clock immediately.

### Contain

Stop the bleed. Specific containment patterns:

- **Account compromise:** revoke session via Clerk + rotate the principal's secret + invalidate refresh tokens. Within 15 min for P1.
- **API key leak:** rotate the key + grep audit chain for actions taken with the leaked key + identify blast radius. Within 30 min for P1.
- **Prompt-injection causing harmful action:** disable the affected agent via feature flag + capture the prompt + write a regression test. Trust-gate enforcement is the structural defense; one-off failure means a gap in the gate.
- **Vendor-side breach (e.g., Twilio compromise):** rotate Docket's credential at the vendor + audit Docket's actions during the vendor's stated incident window + check audit chain.
- **Audit-chain tamper signal:** freeze writes to the affected tenant via ReadOnlyProvider + capture the chain state + investigate. Tamper signals are extremely serious.
- **Production outage:** roll back the most recent deploy if causation is plausible + engage Bedrock fallback + serve degraded-mode UI via status banners. Within 5 min decision.

### Eradicate

Remove the root cause, not just the symptom. Patch the vulnerability + verify no other instances exist + write the regression test or detection rule + close the gap in the policy doc that allowed the incident.

### Recover

Restore normal operations. Verify systems healthy. Disengage degraded modes. Notify customers of recovery. Validate audit chain integrity post-recovery.

### Post-mortem

Within 48 hours of P1/P2 resolution. Within 1 week of P3. P4 may roll up monthly.

Post-mortem template at `docs/incidents/POSTMORTEM-TEMPLATE.md` (created on first incident; structure: timeline / root cause / contributing factors / blast radius / what worked / what didn't / action items with owners and dates / customer-communication summary).

Post-mortems are blame-free at the personnel level and ruthlessly clear at the system level. The goal is to make the same incident impossible to repeat.

---

## 6. Customer notification

For confirmed customer-data exposure:

1. Founder confirms scope with engineering evidence (audit chain query, vendor logs, etc.).
2. Founder consults general counsel on jurisdiction-specific notification timelines.
3. Founder drafts notification: what happened, what data was exposed, when, what we did, what the customer should do.
4. Notification sent within statutory window (varies by jurisdiction; CCPA 72h for CA residents).
5. Public disclosure if jurisdiction or scope requires.

---

## 7. Evidence preservation

Before any remediation that destroys forensic state:
- Snapshot the relevant database tables to a write-once R2 bucket.
- Capture relevant log streams (Sentry, Inngest dashboard exports, vendor-console exports).
- Preserve the audit chain rows in their tamper-evident form.

If law-enforcement involvement is plausible (e.g., insider threat, ransomware), preserve everything before any remediation; consult counsel on chain-of-custody.

---

## 8. Tabletop exercises

Annually: founder runs a tabletop scenario through the full lifecycle. Target scenarios:
- Year 1: prompt-injection causing an unauthorized DocuSign envelope send.
- Year 2: Neon credential leak via a leaked .env in a public repo.
- Year 3: vendor-side breach (e.g., Twilio compromise in a region) propagating to Docket.

Tabletops produce a list of process gaps. Logged as action items.

---

## 9. Vendor incident response coordination

- **Anthropic / AWS Bedrock:** vendor-side incidents trigger fallback engagement at orchestrator layer (already implemented, commit `303f886`).
- **Neon:** read-only mode triggers via health gate. R2 cross-region replication (V1.5) enables full read failover.
- **Vercel:** Vercel-side outages affect both apps; status banners + customer comms.
- **Clerk / Twilio:** auth-side outages disable new logins; existing sessions remain. Customer comms.
- **DocuSign / Square:** payment + signing rails disabled; staff notified to expect retry-at-recovery.

Each vendor's status page is bookmarked + email-subscribed. Any incident at a vendor triggers a Docket-side check of "what would change for our customers if this vendor stays down for X hours?" and proactive comms accordingly.

---

## 10. Lessons-learned loop

Every post-mortem produces:
- One or more **action items** with owner + deadline.
- Possible **policy update** in `docs/security/`.
- Possible **detection-rule addition** (new Sentry alert, new Inngest cron, new audit-chain check).
- Possible **runbook update** in `docs/incidents/`.

Action items are tracked in `docs/incidents/action-items.md`. Quarterly review surfaces overdue items.

---

**Last reviewed:** 2026-05-09 (initial draft, founder)
**Next review:** 2026-11-09 (semi-annual cadence)
**Next tabletop:** 2027-Q1 (year-1 scenario: prompt-injection)
