# Hosting & Infrastructure (LOCKED)

Decision date: 2026-04-30. Locked after deep comparison across 8 stacks. Full research in [`HOSTING-RESEARCH.md`](HOSTING-RESEARCH.md).

## Stack A — locked

| Layer | Vendor | Tier | v0 cost |
|---|---|---|---|
| Next.js apps (client portal + Command Room) | **Vercel Pro** | Pro | **$20/mo** |
| Postgres + pgvector + RLS | **Neon** | Launch | **$19/mo** (auto-suspend DISABLED) |
| Background workers + cron | **Inngest** | Free → Pro at tenant 5–10 | $0 → $75 |
| Auth (phone OTP + email + Organizations) | **Clerk** | Free | $0 (≤10k MAU) |
| Document storage | **Cloudflare R2** | Pay-as-you-go | ~$1 |
| SMS (OTP + outbound) | **Twilio** | Pay-as-you-go | ~$5 |
| Payments + KYC | **Stripe** + **Stripe Identity** | Standard | per-txn |
| AI inference | **Anthropic API direct** + ZDR | per-token | $50–200/mo (separate budget) |

**v0 total: ~$45/mo infra + $50–100/mo Anthropic = ~$95–145/mo.**
**Year-1 (10 tenants): ~$155/mo infra + $200–500/mo Anthropic = ~$355–655/mo.**

Vendor count: **8** (down from 16 in the original plan). Manageable for 1.5 FTE.

## Critical correction — Vercel Pro from day 1

Vercel Hobby's [Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage) prohibit commercial use, defined as *"any deployment used for the purpose of financial gain of anyone involved in any part of the production of the project, including a paid employee or consultant writing the code."* Docket fails this from day 1. **We start on Pro ($20/mo), not Hobby.**

## What we explicitly REJECTED

- **Cloudflare-only stack** — D1 has no RLS, Workers can't run Playwright, no HIPAA BAA for Workers. Adapter friction would burn 60–100 engineering hours during the sprint.
- **Fly.io-only stack** — Fly Postgres is unmanaged + had multi-day outages in 2023–24. Reconsider only if Playwright browser automation moves into v0 scope (currently v1+).
- **AWS Amplify + RDS + Cognito + Fargate** — Right at tenant 30+ if a compliance customer demands it. Wrong for v0 (120–200 hours setup, 6–10× ops burden vs. Stack A, no scale-to-zero economics).
- **Convex** — No RLS, hand-wrapped authorization in server functions, hardest migration cost of any option. Skip — a multi-tenant compliance product needs Postgres RLS.
- **Render / Railway** — Each loses on one component (Render lacks Inngest-quality cron; Railway has no first-class cron primitive at all).
- **Supabase as primary** — Supabase Auth lacks an Organizations primitive equivalent to Clerk. Pair Supabase with Clerk = redundant. Pick Clerk.

## Why R2 stays even on Vercel

Vercel Blob is integrated, but R2 wins on storage economics for taxpayer documents:

| | R2 | Vercel Blob | S3 |
|---|---|---|---|
| Storage | $0.015/GB | $0.023/GB | $0.023/GB |
| Egress | **Free** | $0.05/GB | $0.09/GB |
| Reads | $0.36/M | $0.40/M | $0.40/M |

Preparers download PDFs frequently. Free egress at scale is meaningful. R2 dashboard cost = one extra vendor relationship, ~$0 incremental complexity.

## Compliance posture

All 8 vendors have **SOC 2 Type II**. The audit-evidence trail is straightforward:
- Vercel Pro — SOC 2 II ✓ ([trust.vercel.com](https://trust.vercel.com))
- Neon Scale tier — SOC 2 II ✓, BAA available ([neon.com/blog/hipaa](https://neon.com/blog/hipaa))
- Inngest — SOC 2 II ✓, BAA available
- Clerk Enterprise — SOC 2 II ✓, BAA available ([clerk.com/pricing](https://clerk.com/pricing))
- Cloudflare R2 — SOC 2 II ✓ ([cloudflare.com/trust-hub](https://www.cloudflare.com/trust-hub/compliance-resources/soc-2/))
- Twilio — SOC 2 II ✓, HIPAA BAA available
- Stripe — SOC 2 II ✓, PCI-DSS Level 1 ✓
- Anthropic — SOC 2 II ✓, ZDR contract in place

**SOC 2 path:** start formal audit Q3 2026 (6–9 month engagement → Type II report by partner #5 onboarding). Not v0.

## Dropped from earlier plan

| Was | Drop status | Replacement |
|---|---|---|
| Honeycomb (observability) | Drop until tenant 20 | Vercel logs + Neon analytics + structured `actions` table queries |
| Infisical (credential vault) | Drop until tenant 5 | Vercel env vars + encrypted Postgres column for per-tenant credentials |
| Bedrock toggle | Defer | Per-tenant flag in tenants table (already in schema). Flip when first compliance customer asks. |

## Setup actions this week (April 30 → May 6)

1. **Vercel Pro team account** — transfer to Docket org email (not personal Gmail)
2. **Neon project** on Launch tier, **auto-suspend DISABLED**, pgvector enabled
3. **Clerk app** — phone OTP (taxpayer audience) + email + Organizations primitive (preparer audience)
4. **Cloudflare R2 bucket** with per-tenant prefix scheme (`/tenants/{tenant_id}/{client_id}/...`) + presigned URL flow
5. **Inngest** dev + production environments, every-10-min Gmail poll function with idempotency keys
6. **Twilio** account, dedicated number for SMS OTP, separate number for outbound
7. **Stripe** + **Stripe Identity** standard accounts
8. **BAAs requested where available** — Vercel Pro, Neon (on Scale upgrade), Clerk (Enterprise request)
9. **`SECURITY.md`** documenting tenant-isolation pattern (audit evidence trail starts here)

Total setup time: **20–30 hours of focused work** across days 1–3 of the 15-day sprint. Parallel with schema/seed-data work.

## Migration cost if we ever outgrow Stack A

Low. Postgres is the most portable database; Next.js runs everywhere; Clerk-to-WorkOS is a documented migration path. We're not vendor-locked. The total cost of switching any single component is days, not months.
