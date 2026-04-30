# Hosting + Infrastructure: Deep Comparison & Recommendation

Research conducted 2026-04-30 by a research subagent against the Docket workload profile. Compares 8 hosting stacks for the May 15 production sprint. Source of the locked decision in [`HOSTING.md`](HOSTING.md).

---

## TL;DR

**Primary: Stack A (Vercel Pro + Neon + Inngest + Clerk + R2 + Twilio + Stripe).** Backup: Stack D (Fly.io) only if browser automation moves into v0 scope.

Stack A is the only configuration where a 1.5-FTE team has zero unknowns going into a 15-day sprint. Every component has SOC 2 Type II, native Next.js 15 + RSC + Server Actions support without an adapter, official Postgres RLS guides, and a paid tier under $30/mo.

The savings from "consolidate to one vendor" stacks (Cloudflare, Fly, Railway, Render) do not show up until ~tenant 50, and most of them carry one critical gap (no BAA, broken Next.js features, or cold-start economics that punish the every-10-min Gmail poll).

---

## 1. Workload model used in costing

- **v0 (1 tenant, May 15):** ~30k Inngest executions/mo (Gmail poll every 10 min × 1 integration ≈ 4,320 + portal scans + classifiers ≈ 25k buffer), ~10 GB document storage, ~50k DB rows/mo, ~50 GB egress, ~5k MAU on auth.
- **Year-1 (10 tenants):** ~300k executions/mo, ~100 GB documents, ~500k rows/mo, ~500 GB egress, ~50k MAU.
- **50 tenants:** ~1.5M executions/mo, ~500 GB documents, ~2.5M rows/mo, ~2 TB egress, ~250k MAU.

Anthropic API spend ($50–$3,000/mo) is excluded from infra cost since it is identical across stacks.

---

## 2. Cost matrix

| Stack | v0 (1 tenant) | Year-1 (10 tenants) | 50 tenants |
|---|---|---|---|
| **A. Vercel + Neon + Inngest + Clerk + R2** | **$45** ($20 Vercel Pro + $19 Neon Launch + $0 Inngest Free + $0 Clerk Free + ~$1 R2 + ~$5 Twilio buffer) | **$155** ($20 Vercel + ~$40 Neon Launch + $75 Inngest Pro + $0 Clerk + ~$5 R2 + $15 Twilio) | **~$420** ($40 Vercel + ~$120 Neon + $150 Inngest + $25 Clerk + ~$15 R2 + ~$70 Twilio) |
| **B. Vercel + Supabase + Inngest** | **$45** ($20 Vercel + $25 Supabase Pro + $0 Inngest Free + Twilio) | **$135** ($20 Vercel + $25 Supabase + $75 Inngest + ~$15 Twilio) | **~$340** ($40 Vercel + ~$100 Supabase + $150 Inngest + ~$50 Twilio) |
| **C. Cloudflare-only** | **$10** ($5 Workers Paid + $5 Twilio buffer; R2/D1 within free tier) | **~$45** (Workers Paid + R2 ~$5 + Workers Queues + Twilio + likely Hyperdrive→Neon $19) | **~$180** (R2 storage scales free egress wins; Durable Objects bills add up) |
| **D. Fly.io-only** | **~$30** (2× shared-cpu-1x apps ~$8, Fly Postgres dev ~$15, ~$5 storage + Twilio) | **~$130** (scaled VMs ~$60, Postgres HA cluster ~$45, volumes ~$15, egress ~$10) | **~$380** (multiple regions + HA Postgres + worker fleet for Playwright) |
| **E. AWS Amplify + RDS + Cognito + S3 + Fargate** | **~$80** ($22 RDS db.t4g.micro + ~$5 S3/Cognito free + ~$30 Fargate baseline + ~$15 Amplify + Twilio) | **~$300** (RDS scales to db.t4g.medium ~$60, Fargate ~$120, NAT gateway ~$32, ALB ~$20, etc.) | **~$900–1,500** (RDS Multi-AZ, more Fargate, data transfer) |
| **F. Render** | **~$20** ($7 web × 2 + $6 Postgres Basic-256mb + cron free + R2 ~$1 + Clerk Free + Twilio) | **~$160** (Standard web $25 × 2 + Postgres $20+ + workers $25 + Inngest equivalent or self-host) | **~$500+** (Render Postgres tiers get expensive fast above ~16 GB RAM) |
| **G. Railway** | **~$25** ($20 Pro includes $20 usage + Twilio); RAM-second billing favors low-traffic apps | **~$120** | **~$400** (vCPU/RAM pricing is competitive but no built-in cron primitive) |
| **H. Vercel + Convex** | **$45** ($20 Vercel + $25 Convex Pro + Twilio) | **~$200** (Convex function-call meter at $2/M + storage + bandwidth) | **~$700+** (Convex pricing scales linearly with reactive query volume — Docket's audit-ledger reads are expensive here) |

---

## 3. Capability matrix

| Capability | A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|---|
| Setup time (1.5 FTE, hours to Antonio-ready) | **20–30** | 25–35 | 60–100 | 40–60 | 120–200 | 30–40 | 25–35 | 20–30 |
| Postgres RLS quality | Native | **Native + auth.uid() helpers** | Via Hyperdrive→Neon (D1 has no RLS) | Native | Native | Native | Native | **No RLS** — server-function authorization only |
| pgvector | Native (Neon) | Native (Supabase) | Through Hyperdrive | Native | Native | Native | Native | Built-in vector index |
| Background workers + cron | **Inngest = best-in-class** | Inngest | Workers + Queues + Cron | Fly Machines (persistent) | EventBridge + Fargate | Render Cron | Cron via deployment | Convex actions + scheduled |
| Browser automation (5–30 min Playwright jobs) | Inngest 10-min step max → needs Browserbase | Same as A | **Workers can't do it** | **Best fit** | Fargate works | Render workers OK | Railway works | **No** (10-min cap) |
| SOC 2 Type II | All vendors ✓ | All ✓ | Cloudflare ✓ | Fly ✓ (limited scope) | AWS ✓ | Render ✓ | Railway ✓ | Convex ✓ |
| HIPAA BAA available | Vercel ✓, Neon ✓, Inngest ✓, Clerk Enterprise ✓ | Supabase Team ✓ | **Cloudflare: no BAA for Workers** | Limited | **Yes (full)** | Render Pro ✓ | No | Convex Enterprise only |
| Next.js 15 RSC + Server Actions | **Native** | Native | Via @opennextjs/cloudflare — adapter friction | Standalone build | Via Amplify Gen 2 (slower deploys) | Native | Native | Vercel side: native |
| DX rating (1–10) for 1.5 FTE | **9** | 9 | 6 | 7 (great if you know Docker) | 4 | 8 | 7 | 9 |
| Production reliability | 99.99% Vercel SLA + Neon 99.95% | Supabase 99.9% Pro | Cloudflare 100% network SLA | Fly multi-day Postgres incidents 2023–24 | AWS gold standard | Solid | Good | Convex 99.9% |
| Migration cost if wrong | **Low** | Low | **High** | Medium | Medium | Low | Low | **Very high** (proprietary backend) |

---

## 4. Specific gotchas

- **Vercel Hobby commercial-use ban:** Confirmed in Fair Use docs — even pre-revenue paid SaaS code written by a "paid employee or consultant" is commercial. **Start on Pro from day 1.**
- **Neon free tier auto-suspend** after 5 min inactivity → cold start ~300–800ms first-query latency. For an app polling Gmail every 10 min per tenant, Neon will almost never sleep — but every other request type can hit that latency. **Move to Launch ($19+/mo effective), disable auto-suspend.**
- **Inngest free-tier ceiling:** 50k executions/mo. One Gmail poll every 10 min × 1 tenant ≈ 4.3k/mo. Crosses 50k around tenant 8–10 with retries.
- **Cloudflare Workers + Next.js 15:** App Router, RSC, Server Actions, ISR, streaming, SSR all supported via @opennextjs/cloudflare. The only gap is Node.js-in-middleware (Next.js 15.2+). Real but workable.
- **Cloudflare D1 has no RLS** + ~10 GB DB cap. Need Hyperdrive → Postgres anyway, weakening the single-vendor case.
- **Cloudflare BAA:** does not offer HIPAA BAA for Workers. Future tenant overlap with healthcare CPAs = problem.
- **Convex multi-tenancy:** Convex's RLS guide requires hand-wrapping `ctx.db`. Structurally different security posture from Postgres RLS, harder to defend in SOC 2 audit.
- **Supabase Auth + Organizations:** Supabase Auth has no native Organizations primitive comparable to Clerk's. Would implement manually.
- **AWS Amplify Gen 2 for Next.js 15:** Works, but rebuilds take 3–8 min vs. Vercel's 30–90s. Productivity tax during a 15-day sprint.
- **Fly Postgres incidents:** Multi-day Postgres outages 2023–24 because Fly Postgres is Stolon-on-Machines, not managed. Risk for tax product where April downtime kills you.
- **Railway cron:** No first-class cron primitive. Self-host BullMQ or run Inngest worker, defeating single-vendor consolidation.

---

## 5. Tension-by-tension analysis

### Single-vendor vs best-of-breed

At our stage, **best-of-breed wins**. The ROI on consolidating shows up at ~50 tenants and ~5 engineers, not at 1 tenant and 1.5 engineers. Stay best-of-breed; consolidate later.

### Clerk vs Supabase Auth vs WorkOS

For two-audience auth (taxpayer phone OTP + preparer email/org):
- **Clerk:** 50k MAU free, Organizations included in all tiers, native phone OTP. Setup ~2 hours.
- **Supabase Auth:** Free up to 50k MAU on Pro ($25), no native Organizations primitive — would build it. Setup ~6–10 hours.
- **WorkOS:** Best for SSO/SAML at enterprise pricing. Wrong wedge for first 12 months.

**Clerk wins.** DX win is real, price is identical to Supabase Auth's effective cost.

### Neon vs Supabase Postgres vs Fly Postgres vs RDS

- **Neon Launch** ($0.106/CU-hr + $0.35/GB-mo): true scale-to-zero, instant branching, native pgvector, ~500ms cold start. **Best for v0.**
- **Supabase Postgres:** $25 baseline includes 8 GB DB. Cheaper than Neon at low scale if using Supabase Auth + Storage anyway.
- **Fly Postgres:** unmanaged, you operate it. No.
- **RDS db.t4g.micro:** $22/mo compute alone, plus ~$10 storage + Multi-AZ for prod = ~$60/mo. No scale-to-zero.

**Neon Launch wins** unless already on Supabase for storage+auth.

### Inngest vs Vercel Cron + QStash vs Trigger.dev vs Temporal

- **Inngest:** Free 50k execs, Pro $75 for 1M. Best DX for step functions + retries + observability. Each retry counts as a separate execution.
- **Vercel Cron + Upstash QStash:** ~$0.50/100k QStash messages = much cheaper at scale, but write the retry/idempotency layer yourself.
- **Trigger.dev:** comparable to Inngest, smaller ecosystem.
- **Self-hosted Temporal:** not for 1.5 FTE.

**Inngest wins for v0–year-1.** Evaluate QStash + thin wrapper at ~tenant 15 if cost becomes a concern.

### R2 vs Supabase Storage vs S3 vs Vercel Blob

| | R2 | Supabase Storage | S3 | Vercel Blob |
|---|---|---|---|---|
| Storage | $0.015/GB | $0.021/GB | $0.023/GB | $0.023/GB |
| Egress | **Free** | $0.09/GB | $0.09/GB | $0.05/GB |
| Reads | $0.36/M | included | $0.40/M | $0.40/M |

**R2 wins by a lot** for taxpayer documents. Free egress matters when preparers download PDFs frequently.

### Convex — verdict: skip

Brilliant for greenfield reactive apps. **Wrong for multi-tenant compliance product.** No RLS, hand-wrapped authorization in server functions, hardest migration cost of any option, harder to defend in SOC 2 audit.

### AWS — verdict: skip for v0

Reconsider at tenant 30+ if compliance customers demand it. Compliance inheritance benefit is real but overstated — auditors care that you have *a* SOC 2 vendor (Vercel/Neon/Clerk/R2/Inngest all qualify), not specifically AWS. Ops burden = ~6–10× Stack A for 1.5-FTE team.

---

## 6. Final recommendation

### Primary: Stack A — Vercel Pro + Neon Launch + Inngest Free→Pro + Clerk Free + R2 + Twilio + Stripe

- **v0 cost: ~$45/mo. Year-1 cost: ~$155/mo. Setup: 20–30 hours.**
- All vendors have SOC 2 Type II.
- Postgres RLS on Neon is vanilla Postgres — copy-paste any SaaS RLS guide.
- Clerk's native Organizations primitive maps directly to preparer-side multi-tenant model.
- Migration cost if any single piece misfits is low.

### Backup: Stack D — Fly.io for everything

Pick this **only** if Playwright browser-automation workers move into v0 scope (currently v1+).

---

## Sources

- [Vercel Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines)
- [Vercel Pricing](https://vercel.com/pricing)
- [Neon Pricing](https://neon.com/pricing)
- [Neon HIPAA / SOC 2](https://neon.com/docs/security/compliance)
- [Supabase Pricing](https://supabase.com/pricing)
- [Supabase SOC 2 + HIPAA](https://supabase.com/blog/supabase-soc2-hipaa)
- [Inngest Pricing](https://www.inngest.com/pricing)
- [Clerk Pricing](https://clerk.com/pricing)
- [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare Next.js compatibility (OpenNext)](https://developers.cloudflare.com/workers/frameworks/framework-guides/nextjs/)
- [Cloudflare SOC 2](https://www.cloudflare.com/trust-hub/compliance-resources/soc-2/)
- [Fly.io Pricing](https://fly.io/docs/about/pricing/)
- [Render Pricing](https://render.com/pricing)
- [Railway Pricing](https://railway.com/pricing)
- [Convex Pricing](https://www.convex.dev/pricing)
- [Convex RLS pattern](https://stack.convex.dev/row-level-security)
- [AWS Amplify Pricing](https://aws.amazon.com/amplify/pricing/)
- [AWS RDS PostgreSQL Pricing](https://aws.amazon.com/rds/postgresql/pricing/)
- [AWS Cognito Pricing](https://aws.amazon.com/cognito/pricing/)
