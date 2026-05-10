# Business Continuity Plan

**Version:** 1.0
**Effective:** 2026-05-09
**Owner:** Founder
**Review cadence:** semi-annual + DR drill annually

---

## 1. Purpose

Define how Docket maintains availability of customer-facing services and recovers from disruptions: vendor outages, data loss, regional failure, founder unavailability, or catastrophic infra failure.

---

## 2. Scope

In scope:
- `apps/client-portal` (production at `https://docket-portal.vercel.app`)
- `apps/command-room` (production at the Vercel-assigned hostname)
- `services/orchestrator` (in-process; runs inside both apps)
- `services/workers` (Inngest production environment)
- Production database (Neon Launch, us-east-2)
- Object storage (Cloudflare R2)
- Auth (Clerk)
- Communications (Twilio, Gmail per-tenant)
- Payments (Square)
- E-signature + KBA (DocuSign + LexisNexis)
- AI inference (Anthropic primary, AWS Bedrock fallback)

Out of scope:
- The legacy demo at `docket-client-portal.vercel.app` (mock data; informational only).
- Local-development environments.

---

## 3. Recovery objectives

| Tier | Service | RTO | RPO | Justification |
|---|---|---|---|---|
| **Tier 1** | Production database (Neon prod branch) | 4 hours | 1 hour | Customer data integrity is non-negotiable; tax-deadline windows make extended unavailability unacceptable. |
| **Tier 1** | Both Next.js apps (Vercel) | 1 hour | n/a (stateless) | Vercel auto-failover within region; cross-region rebuild < 1 hour. |
| **Tier 1** | Inngest workers + queues | 4 hours | 1 hour | Durable execution preserves in-flight jobs across restarts. |
| **Tier 2** | Auth (Clerk) | 8 hours | n/a | Existing sessions persist during Clerk outage; new logins blocked. Status banner notifies users. |
| **Tier 2** | AI inference | 1 hour | n/a | Bedrock fallback engages automatically; tested in CI. |
| **Tier 2** | Document storage (R2) | 8 hours | 24 hours | Document upload is async and recoverable; existing docs cache locally during outage. |
| **Tier 3** | Communications (Twilio) | 24 hours | n/a | SMS notifications degrade gracefully; in-app messaging continues. |
| **Tier 3** | Payments (Square) | 24 hours | n/a | Deposit collection can be deferred during outage; manual invoicing as fallback. |
| **Tier 3** | E-signature (DocuSign) | 24 hours | n/a | Sign tasks queue; customer notified of signing-window pause. |

---

## 4. Backup strategy

### Database

- **Neon point-in-time recovery (PITR)** is the primary backup mechanism. Neon Launch tier provides 7 days of PITR by default, configurable.
- **Logical backups** (pg_dump) run weekly to a Cloudflare R2 backup bucket. Retention 90 days.
- **DEK + KEK material** is excluded from logical backups (they live in `tenant_credentials.data` encrypted form; the master KEK lives in Vercel env, NOT in the database).
- See [`docs/BACKUPS.md`](../BACKUPS.md) for the operational runbook.

### Object storage (R2)

- Documents are immutable once uploaded (overwrite blocked at the bucket policy level).
- Cross-region replication is V1.5 work per CLAUDE.md vendor resilience posture (locked 2026-05-08, before Feb 2027 tax season).
- Until cross-region: single-region R2 with the implicit Cloudflare durability guarantee + monthly integrity check (sample 100 files, verify checksum).

### Source code

- GitHub serves as the canonical source. Branch protection on `main`. All work in PRs.
- Founder maintains a local clone on the primary dev machine + a backup clone on a secondary machine.

### Secrets

- Production env vars on Vercel are the authority; Vercel handles backup of project settings.
- Founder maintains a 1Password vault snapshot exported quarterly to encrypted offsite storage.

---

## 5. Disaster scenarios + recovery plans

### Scenario A: Neon production database outage (single-region)

**Detection:** `/api/health` reports `db: unhealthy`; status banner triggers; ReadOnlyProvider engages on both apps.

**Response:**
1. Verify Neon status page; if confirmed Neon-side: monitor + status comms to customers.
2. If Neon-side > 4 hours: invoke recovery from logical backup to a fresh Neon project (or alternative provider per vendor exit plan).
3. Update `DATABASE_URL` env var; redeploy both apps; verify health.
4. Reconcile any in-flight Inngest jobs that retry against the new database.
5. Post-mortem within 48h.

**Tested:** Not yet.

### Scenario B: Vercel outage (single-region)

**Detection:** Vercel status page; both apps unreachable on production hostnames.

**Response:**
1. Verify Vercel status page.
2. If Vercel-side: status comms to customers; Vercel typically restores within 1–4 hours.
3. If Vercel persistent > 4 hours: deploy to backup target (Cloudflare Pages or self-hosted Node) per vendor exit plan in `vendor-management-policy.md`. Time to deploy: 2–4 hours.
4. Update DNS to point at backup target.
5. Post-mortem within 48h.

**Tested:** Not yet. Year-1 H2 goal: dry-run deploy to Cloudflare Pages with feature flags.

### Scenario C: AI inference outage (Anthropic-side)

**Detection:** Orchestrator logs vendor-side errors; `runDocketAgent` throws after retries.

**Response:**
1. Bedrock fallback engages automatically (commit `303f886`, 38/38 unit + 4/4 smoke).
2. If Bedrock also unavailable: agent fleet returns degraded responses per agent-class fallback policy; status banner notifies customers.
3. Post-mortem within 48h.

**Tested:** YES. Bedrock fallback is in CI smoke. Customer-facing degraded mode is partially tested.

### Scenario D: Auth outage (Clerk-side)

**Detection:** Clerk status page; new logins fail.

**Response:**
1. Existing sessions persist (Clerk session cookies are signed; verification works during partial outages).
2. Status banner: "New logins temporarily unavailable; existing sessions continue."
3. If Clerk persistent > 8 hours: invoke vendor exit plan (Auth0 / Supertokens self-hosted). 3–4 weeks per exit plan; not realistic for short outages.
4. Post-mortem within 48h.

**Tested:** Not yet.

### Scenario E: Catastrophic data loss (corruption, accidental destructive command, ransomware)

**Detection:** Audit chain integrity verifier fails OR database query returns unexpected zero rows OR file system shows mass deletion.

**Response:**
1. **Within 5 min:** ReadOnlyProvider engages; freeze writes.
2. **Within 30 min:** assess scope; identify last-known-good state.
3. **Within 4 hours:** restore Neon PITR to a fresh project at last-known-good timestamp; reconcile R2 + Inngest queue against restored state.
4. **Within 24 hours:** customer comms, post-mortem started.
5. **Within 48 hours:** post-mortem complete; remediation plan owns the gap that allowed the corruption.

**Tested:** Not yet. Year-1 H2 goal: PITR restoration drill on dev.

### Scenario F: Founder unavailable (medical, transit, or worse)

**Detection:** founder absence + ongoing customer impact.

**Response:**
1. Until first hire: customers contact `support@docket.tax` (alias forwards to founder). On founder-unavailability, alias bounces with a "we'll respond within 24h" auto-reply.
2. **Single-point-of-failure mitigation:** founder maintains a "break glass" handoff doc at a known offsite location (`~/Documents/docket-bog.md`) with credentials to read-only investigate + shut down if needed. Updated quarterly.
3. **Hire-1 mitigation:** within first 6 months, second person has founder-equivalent BCP responder access.
4. **Beyond hire-1:** rotate on-call; the org becomes resilient to single-person absence.

**Tested:** No formal test. Founder runs through the BOG doc semi-annually.

### Scenario G: Regional internet outage (founder's region)

**Detection:** founder cannot access development or production tooling from primary location.

**Response:**
1. Mobile hotspot fallback for short outages.
2. Backup machine at offsite location enables continued operation.
3. Production is not impacted (it's all hosted; founder's connectivity is independent).

**Tested:** Mobile hotspot tested informally.

---

## 6. Communication during incidents

- Internal: incident channel in Slack (when team grows; today, founder solo with handoff doc).
- Customer-facing: status page at `https://docket.tax/status` (URL TBD; placeholder until launch). Status banner in both apps for active incidents.
- Critical incidents: direct email to firm-owners of affected tenants within 4 hours of detection.

---

## 7. DR drill schedule

- **Annually:** one Tier-1 scenario tested end-to-end. Year 1: Bedrock fallback (already tested in CI). Year 1 H2: PITR restoration drill on dev.
- **Semi-annually:** review this plan, update RTO/RPO if customer expectations have shifted, update vendor exit plans, refresh test results.
- **After any incident:** the relevant scenario gets re-evaluated based on what we learned.

---

## 8. Capacity + scaling

- Neon Launch tier (4 GB, 1 CPU, no auto-suspend) supports the v1 cohort + design partner #2. Scale to Scale tier when active-client count crosses ~500 across all tenants.
- Vercel Pro auto-scales on traffic.
- Inngest auto-scales on queue depth.
- R2 has no practical capacity limit at our scale.

Tax-season traffic spike (Jan–Apr): plan for 3–5x baseline. Capacity confirmed sufficient on all tiers; load-test in Year 1 H2 confirms.

---

**Last reviewed:** 2026-05-09 (initial draft, founder)
**Next review:** 2026-11-09 (semi-annual cadence)
**Next DR drill:** 2026-Q4 (PITR restoration on dev)
