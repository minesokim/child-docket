# Cyber Insurance Recommendation — Tax SaaS, Pre-Revenue→$1K/mo MRR

> *Research synthesis for David, 2026-05-11. Apply by 2026-05-30 to be bound before Antonio's full client base lands on prod-grade substrate.*

**TL;DR:** Apply to **Vouch first**, **Embroker as backup**. Buy **Tech E&O + Cyber bundle** (not standalone cyber). Target **$1M aggregate / $1M per occurrence** with **AI-affirmative coverage**. Realistic premium: **$2,000–4,000/yr** (~$165–335/mo). Apply this week; bind before 2026-05-30.

---

## Why this is urgent (the 5/30 deadline)

Antonio's 200+ client base lands on production-grade Docket substrate per CLAUDE.md Phase 2 sub-milestone — 2026-05-30. The moment real taxpayer SSNs / EINs / W-2s flow through R2 + Neon + audit chain, Docket carries breach + tax-position liability that should be insured. **Lead time on insurance is 1-3 weeks**: online quote → underwriting questions → bind. Start the application now to have coverage by 5/30.

---

## Why a Tech E&O + Cyber bundle, not standalone cyber

The classic insurance pairing for a SaaS company is **Tech E&O + Cyber**. They cover different risks and the gap between them is exactly where Docket's tax-AI exposure lives.

| Coverage | What it pays for | Why Docket needs it |
|---|---|---|
| **Cyber** | Data breach response, regulatory fines (where insurable), customer notification cost, business interruption, ransomware recovery | Per-tenant DEK encryption + audit chain controls reduce probability but not consequence — a real breach involving Antonio's 200 clients still triggers CCPA notification + remediation cost. |
| **Tech E&O** (Errors & Omissions) | Customer financial loss caused by software failure or professional error | Docket drafts tax positions. A bad position from the Discovery agent that Antonio accepts and files could trigger malpractice claim. Even refused-correctly-but-mis-routed positions create exposure. |
| **AI-affirmative rider** (inside Tech E&O) | Specifically covers AI-caused harm: hallucinated outputs, biased predictions, model-driven financial loss downstream | Anthropic's models surface positions. Bedrock fallback firing during outage might produce different output than primary. The trust gate (L1 lock on `file` action class) reduces consequence but doesn't eliminate exposure. |

**Stand-alone cyber alone is insufficient** because it doesn't pay when a Docket-surfaced tax position causes financial loss to Antonio's client — that's E&O territory. **Stand-alone Tech E&O alone is insufficient** because it doesn't pay when a credential leak exposes 200 clients' SSNs — that's cyber territory. The bundled product covers both with one carrier, one deductible, one claims handling team.

A separate **agent E&O policy** (carried by Antonio for his own PTIN work) does NOT cover Docket — that policy explicitly excludes claims arising from licensed/embedded tech vendor tools. Per [recent industry analysis](https://riskadvisor.insure/blog/eo-gap-agent-built-ai-tools/), Docket needs its own Tech E&O specifically because Antonio's PTIN-side carrier will argue the claim belongs to the tech vendor.

---

## Recommended carriers (apply to both, take the better quote)

### 1. Vouch — primary

[vouch.us/technology/saas](https://www.vouch.us/technology/saas)

**Why first:**
- **Built for tech / SaaS startups.** YC-friendly. ~81% same-day quote rate per their site.
- **Integrated program** — Tech E&O + Cyber + D&O + Product Liability + Downtime in one quote, one renewal cycle, one broker relationship. Avoids carrier-juggling overhead.
- **AI-affirmative coverage** is increasingly standard in their Tech E&O. Specifically responds when a model hallucinates, produces biased outputs, or causes downstream financial harm to a customer.
- **Pre-Series-A pricing path.** They explicitly support founders pre-funding with paid pilots — Antonio's $1k/mo retainer fits this profile.

**Cost expectation:** $1,500–3,000/yr for Tech E&O + Cyber bundle with $1M aggregate, before AI affirmative + tax-data risk adjustments. Tax-data + AI-agent surfaces will push toward the upper end. Realistic landing: **$2,500–3,500/yr ($210–290/mo)** for $1M Tech E&O + $1M Cyber.

**Apply:** [vouch.us/coverage-recommendation](https://www.vouch.us/coverage-recommendation) — multi-step online form. Budget 30-45 min.

### 2. Embroker — alternative

[embroker.com/coverage/tech-errors-omissions](https://www.embroker.com/coverage/tech-errors-omissions/)

**Why second:**
- Similar profile to Vouch. Online application, instant-quote tooling, Tech E&O + Cyber bundle, startup-specific path.
- Useful as a price-comparison if Vouch's quote runs high.
- Public benchmarking — typical Tech E&O starter premium ~$372–1,836/yr for $1M aggregate; bundling Cyber adds ~$500–1,500/yr.

**Cost expectation:** likely $2,000–4,000/yr at our risk profile (tax data, AI agents, 1 customer).

**Apply:** [app.embroker.com](https://app.embroker.com) — also multi-step online.

---

## Coverage targets

| Coverage | Target limit | Notes |
|---|---|---|
| **Tech E&O aggregate** | **$1M** | Seed-stage standard. Move to $2M at Series A. |
| **Cyber aggregate** | **$1M** | Same; covers breach response + notification + regulatory. |
| **Per-occurrence** | **$1M each** | Sufficient for first claim. |
| **AI-affirmative rider** | **Required** | Get this in writing. Not all carriers include it by default. |
| **Retention (deductible)** | **$2,500–5,000** | Lower deductibles cost more premium; this range is the sweet spot for our revenue level. |

### Specific coverages to confirm are INCLUDED

- Data breach response cost (forensics, legal, customer notification)
- Regulatory defense + fines where insurable (CCPA notification cost is the main one; state breach laws)
- Business interruption from cyber event (Neon outage chained to a triggering event)
- Third-party liability — **critical**: when a Docket-drafted position lands on a return that gets audited, Antonio's downstream claim chains to us. Our policy must respond to **third-party** (Antonio's client) claims, not just first-party (Antonio).
- AI-affirmative: hallucinated outputs, biased predictions, model-driven downstream harm
- Ransomware recovery (extortion payment + restoration)
- Cyber crime (social engineering / wire transfer fraud)

### Specific coverages to DEFER

- **D&O insurance** → defer until priced equity round (Series Seed or A). Pre-revenue solo founder has minimal D&O exposure. Vouch will offer it; decline for now. ~$2,000–5,000/yr you don't need yet.
- **General liability** → not relevant. We don't have a physical office or customer foot traffic.
- **Umbrella** → defer to Series A+.
- **Employment Practices Liability (EPL)** → defer until hire #2.
- **Property** → not relevant; no physical assets.

---

## What underwriters will ask for (we already have)

The application form will ask security questions. Our answers are strong:

| Question | Our answer | Doc reference |
|---|---|---|
| MFA enforced on every account? | Yes, via Clerk + 1Password vault | `docs/security/access-control-policy.md` §3 |
| Encryption at rest? | AES-256-GCM with per-tenant DEK, AAD-bound to (tenant_id, client_id, path) | `packages/db/src/encryption.ts`, commit `2c5db11` |
| Encryption in transit? | HTTPS everywhere, TLS 1.3 for DB connections | `docs/security/data-classification-and-handling.md` §3 |
| Backup strategy + tested? | Neon PITR (7-day) + weekly pg_dump to R2, encrypted with separate KEK | `docs/security/business-continuity-plan.md` §4 |
| Incident response plan documented? | Yes, full lifecycle (detect → escalate → contain → eradicate → recover → post-mortem) | `docs/security/incident-response-plan.md` |
| Vendor risk management? | 14 sub-processors enumerated with DPAs + exit plans + SOC 2 reports | `docs/security/vendor-management-policy.md` §4 |
| Audit trail on every action? | Cryptographic chain (chain_seq + prev_hash + row_hash); nightly tamper verifier | `packages/db/migrations/0007_*.sql`, commit `0680874`+`5b4ef92` |
| Access reviews? | Quarterly, founder + future security lead | `docs/security/access-control-policy.md` §6 |
| Employee training? | Onboarding + annual refresher + phishing simulation; logged | `docs/security/employee-training-and-awareness.md` |
| Risk register maintained? | 15 risks scored Likelihood × Impact with treatments + owners + deadlines | `docs/security/risk-management-policy.md` §4 |
| SOC 2 status? | Type II controls in codebase per L8; Drata/Vanta attestation deferred until capital | `docs/security/controls-matrix.md` |

**Strong underwriting story.** The 12-doc SOC 2 set (commit `f4e8c2e`) is a real differentiator vs typical solo-founder applications. Underwriters reading these get a "controls actually built" signal that most pre-revenue startups can't deliver. Expect rate at the lower end of the range, not the upper.

---

## Cost framing against $1k/mo revenue

| Scenario | Annual cost | Monthly | % of $12K ARR | Status |
|---|---|---|---|---|
| **Recommended (year 1)** | $2,500-3,500 | $210-290 | 21-29% | Yes — buy this |
| Standalone cyber only | $2,000-4,000 | $165-335 | 17-33% | No — covers wrong gap |
| Tech E&O only | $1,500-3,000 | $125-250 | 13-25% | No — covers wrong gap |
| Vouch full integrated (E&O+Cyber+D&O+Product+Downtime) | $5,000-8,000 | $415-665 | 42-67% | No — too much pre-Series-A |
| No insurance | $0 | $0 | 0% | **No** — one breach event = company-ending |

**Reality check on "% of revenue":** at $1k/mo MRR Antonio is your only paying customer. The 21-29% looks expensive against that single customer. But:

1. **The breach scenario it insures is company-ending.** A CCPA-triggering breach of 200 clients × ~$750/client notification cost = **$150K minimum** in just notification + remediation, before any settlement or legal cost. Without insurance, that's the end. With $1M cyber, it's a deductible + a survivable incident.
2. **Revenue scales fast post-5/30** as Antonio's onboarding proves the model. By month 6 you'll likely be at $5-10K MRR. The fixed insurance premium becomes 5-10% of revenue, then 2-3% as you onboard partner #2.
3. **Required by mid-market partner #2.** Most regional CPA firms require evidence of cyber + Tech E&O before signing a vendor contract. The insurance isn't just risk transfer — it's sales-cycle plumbing.

---

## Concrete action plan (this week)

| Day | Action | Time | Output |
|---|---|---|---|
| **Mon 5/12** | Apply to Vouch (`vouch.us/coverage-recommendation`) | 45 min | Underwriting questions answered, initial quote within 24h |
| **Mon 5/12** | Apply to Embroker (`app.embroker.com`) in parallel | 45 min | Alternative quote within 24h |
| **Tue 5/13** | Review both quotes, ask each carrier for AI-affirmative rider clarification | 30 min | Final coverage scope confirmed |
| **Wed 5/14** | Choose carrier, request binder + payment instructions | 15 min | Coverage active within 24-48h |
| **Thu 5/15** | Receive certificate of insurance (COI); save to `docs/security/coi-2026.pdf` | 5 min | Evidence ready for partner #2 sales cycle |
| **Fri 5/16** | Update `docs/security/vendor-management-policy.md` §4 to record the cyber insurance carrier as Docket's risk-transfer partner | 5 min | Doc reflects reality |

---

## What I'm NOT recommending and why

| NOT recommended | Why |
|---|---|
| **Coalition** | Broker-only intake, slower for solo founders; better fit at $25K+ MRR with broker relationship |
| **Travelers / Chubb / Hartford** | Traditional carriers; enterprise-mid-market focus; slow underwriting; doesn't fit pre-Series-A timing |
| **At-Bay** | Cyber-only specialist; great rates but doesn't bundle Tech E&O (which we need) |
| **CFC** | UK-origin; US presence solid but pre-revenue rates run higher |
| **Hiscox** | Small-business focus, lower coverage limits, simpler product but weak on tech-specific Tech E&O |
| **Cowbell** | Cyber + Tech E&O combined but pricing typically lands at mid-market scale, not pre-revenue |
| **D&O standalone now** | Defer until equity round closes |
| **No insurance ("we have SOC 2 controls")** | SOC 2 controls reduce probability, not consequence. A breach with controls still costs $150K+ in CCPA + remediation |

---

## When to reassess

| Trigger | Action |
|---|---|
| MRR crosses $10K (~partner #2 onboarded) | Raise Tech E&O + Cyber aggregate to $2M each |
| First priced equity round (Seed or Series A) | Add D&O insurance ($2-5K/yr) |
| Hire #2 | Add EPL (Employment Practices Liability) at low limit |
| Annual renewal | Re-quote with both Vouch + Embroker; market is competitive, switch if savings >$500/yr at same coverage |
| Material incident (any P1 or P2 per IR plan) | Notify carrier within 24h; consider mid-policy increase to limits |
| Filing surface lands (2848 / 8879 + BOI) | Confirm filing-related liability is named; may need separate Filing E&O endorsement |
| Brokerage or financial-services adjacent feature | Specifically endorse for that exposure (the broader the product, the more granular the coverage scope) |

---

## Sources

- [Vouch — Insurance for SaaS](https://www.vouch.us/technology/saas)
- [Vouch — Startup Insurance Costs](https://www.vouch.us/insurance101/start-up-insurance-costs-how-much-to-pay)
- [Vouch — Tech E&O Insurance Cost](https://www.vouch.us/blog/tech-errors-and-omissions-insurance-cost)
- [Embroker — Tech E&O Coverage](https://www.embroker.com/coverage/tech-errors-omissions/)
- [Embroker — Tech E&O for Startups](https://www.embroker.com/blog/errors-and-omissions-for-startups/)
- [Coalition — Cyber Insurance Platform](https://www.coalitioninc.com/)
- [Cyber Insurance for Tech Companies 2026 (SeedpodCyber)](https://seedpodcyber.com/cyber-insurance-for-tech-companies/)
- [SaaS Insurance Guide 2025 (Hotaling)](https://hotalinginsurance.com/his-blogs%E2%80%8B/saas-insurance-in-2025-costs-coverage-vc-essentials)
- [The E&O Gap with Agent-Built AI Tools (RiskAdvisor)](https://riskadvisor.insure/blog/eo-gap-agent-built-ai-tools/)
- [BOXX — Next-Gen Tech E&O](https://boxxinsurance.com/us/en/newsroom/boxx-insurance-launches-next-gen-tech-eo-product/)

---

*Created 2026-05-11 in response to founder request: "$1k/mo from Antonio, lot of costs going in, find cyber insurance that makes sense." This doc is the research synthesis; the actual buying decision needs founder approval after seeing real quotes from Vouch + Embroker.*
