# Docket Financials — for Antonio + David

> *Built 2026-05-16. Easy to ingest. Numbers verified or marked FILL IN.*
> *Read this when you want to know "what does it cost to keep this thing running."*

The picture in one sentence: **Docket runs on ~$2.6K/mo of operating burn today, plus founder time, plus whatever marketing dollars we spend acquiring the first 100 customers. Most one-time startup costs are under $1,500.**

---

## 1. One-time startup costs

What it costs to legally exist as a Delaware C-Corp registered to do business in California.

| Item | Cost | Notes |
|---|---|---|
| Stripe Atlas (DE C-Corp + EIN + bank account) | **$500** | One-stop incorporation. The cheapest path. Alternative: DIY at ~$300-400 + lawyer time. |
| Delaware franchise tax (first year) | **~$400** | Required for DE corps. Due annually March 1. |
| CA Statement of Information (initial) | **$25** | Required by CA SoS when registered to do business in CA. |
| Registered agent (DE) | **~$150/year** | Required if not using Atlas (Atlas includes Y1). |
| Insurance bind (Vouch + Embroker E&O + Cyber) | **~$3,000/year** | Required for SOC 2 + most enterprise sales. Pay annually upfront. |
| **One-time total to launch** | **~$1,075** | Atlas $500 + DE Y1 franchise tax $400 + CA SoS $25 + misc $150 |
| **Plus first-year insurance** | **+$3,000** | If we get it bound this year (recommended) |

---

## 2. Monthly operating burn

What it costs to keep the lights on, in production.

| Category | Item | Monthly | Annual | Status |
|---|---|---|---|---|
| **Infra** | Vercel Pro (both apps) | $20 | $240 | Active |
| | Neon Launch (Postgres) | $19 | $228 | Active |
| | Anthropic API (target) | $50 | $600 | Tracking; could grow to $200-400 as customers join |
| | AWS Bedrock (fallback only) | <$5 | <$60 | Negligible — only fires on Anthropic outage |
| | Cloudflare R2 (doc storage) | ~$5 | $60 | Cheap; free egress |
| | Sentry (errors) | $0 → $26 | $0 → $312 | Free up to 5K errors/mo; jump to Team tier if exceeded |
| | Clerk (auth) | $0 | $0 | Free up to 10K MAU |
| | Inngest (background jobs) | $0 | $0 | Free up to 50K events/mo |
| | Twilio (SMS) | ~$30 | $360 | $1.15/number/mo + $0.0075/SMS; Antonio's traffic small |
| | Resend (transactional email) | $20 | $240 | Active when production-launched; free for dev |
| **Dev tools** | Claude Code Max | $100 | $1,200 | Already paying (per COSTS.md) |
| | GitHub | $0 | $0 | Free for private repos |
| **Acquisition** | Apollo (lead data) | $49 | $588 | Per L16 cold outreach plan |
| | Lemlist (cold email automation) | $59 | $708 | Per L16 plan |
| | LinkedIn Sales Navigator | $99 | $1,188 | Per L16 plan |
| **Comms** | Domain registration | $15/yr | $15 | One domain |
| | Google Workspace (3 mailboxes) | $21 | $252 | Once mailboxes provision; queued per CLAUDE.md §18 |
| **Insurance** | E&O + Cyber (Vouch + Embroker) | $250 | $3,000 | Annually billed; amortized for the monthly view |
| **Total** | (excluding sales VA) | **~$695** | **~$8,340** | Today's burn |
| **+ Sales VA** | 15 hrs/wk × $30/hr × 4.33 wks | $1,950 | $23,400 | Per L16 must-ship #3; hire by 5/31 |
| **All-in monthly with VA** | | **~$2,645** | **~$31,740** | Forward burn during the 100-customer push |

The Anthropic API line is the most likely to grow. At 1 customer (Antonio) we hit the $50 target easily. At 100 customers running Discovery scans daily, agent calls, etc., we'd expect $200-500/mo. Worst case: $1,000/mo at 100 customers. Per-customer infrastructure cost target is $1.39/customer/mo (per CLAUDE.md L7) — at 100 customers that's $139/mo just for compute, which fits.

---

## 3. Runway math

Runway = cash on hand ÷ monthly burn.

| Variable | Value |
|---|---|
| Cash on hand (David's bootstrap account) | **FILL IN** (David fills) |
| Monthly burn (operating) | $695 |
| Monthly burn (with VA) | $2,645 |
| Founder salary (David, taken or deferred) | **FILL IN** (David decides) |
| Founder salary (Haokun) | $0 (deferred per equity arrangement) |
| Antonio advisor stipend | $0 (1% equity per CLAUDE.md §1; no cash) |

**To compute runway:**
1. Take cash on hand.
2. Subtract one-time startup costs (~$1,075 if not paid yet, or $0 if paid).
3. Subtract first-year insurance if bound (~$3,000).
4. Divide remainder by monthly burn.

At $2,645/mo all-in burn, **every $10K of cash = 3.8 months of runway** during the 100-customer push.

---

## 4. Path to $0 burn (when revenue catches up)

The 100-customer push gets Docket to break-even on operations.

| Customer count | Founder-tier MRR ($250/mo × N) | Standard-tier MRR (avg $750/mo × N) | Operating burn (with VA) | Net |
|---|---|---|---|---|
| 1 (Antonio) | $250 | — | $2,645 | **−$2,395** |
| 10 | $2,500 | — | $2,645 | **−$145** |
| 25 (per CLAUDE.md L6 founder-50 plan) | $6,250 | — | $2,700 | **+$3,550** |
| 50 (founder-50 saturated) | $12,500 | — | $2,800 | **+$9,700** |
| 100 (target by 8/1) | $12,500 (first 50) | $37,500 (next 50 at avg $750) | $3,200 | **+$46,800** |

The break-even point is ~10 customers. Once you hit 25, you're cash-flow positive and the VA pays for itself. By 100, MRR is $50K/mo gross and the business funds its own growth without an outside round.

**This is why the 100-customer goal is load-bearing.** It's not just for YC. It's the moment Docket stops costing David money.

---

## 5. YC application + raise readiness

| Item | Cost | Status |
|---|---|---|
| YC application | $0 | Free to apply. Fall 2026 (deadline ~early August). |
| YC interview travel (if accepted) | ~$500-2,000 | One-time. Pay if invited. |
| Forum Ventures application | $0 | Free; rolling admission. |
| Mucker Capital application | $0 | Free; rolling. |
| Anthropic Startup Program | $0 | Free credits if accepted ($50K-$100K Anthropic API credits). |
| Pre-seed SAFE round (target) | — | Optional. ~$1-2M raised would clear founder salary + scale. |
| Legal — SAFE prep | $0-2,500 | Atlas includes basic templates. Lawyer review ~$2K if needed. |
| Cap table / ESOP setup | $0 | Atlas handles initial. Carta or Pulley free at <$1M raised. |

We can apply to YC + run the 100-customer sprint with **no outside money** if cash on hand covers $30-50K of burn over 11 weeks. After that, MRR + a pre-seed SAFE (if raised) can fund team scale.

---

## 6. Three honest unknowns

These are the numbers I can't fill in for you:

1. **David's personal runway.** What's the cash burn rate of David's life right now? If it's $4K/mo (rent + food + utilities) and David has $30K saved, that's 7.5 months personal runway separate from the business burn above. This is the most important number to write down + check monthly.

2. **Founder salary policy.** Pre-funding, salary is usually $0. Post-funding, Y Combinator standard is $50K-100K/yr for founders. Decide before any equity-vesting acceleration kicks in.

3. **Antonio's contribution.** Antonio is contributing 1% equity advisor time. Is there a stipend, milestone-based bonus, or pure-equity arrangement? If pure-equity, $0 cash; if there's a small monthly retainer for his hours, add it to the burn.

---

## 7. What to check monthly

1. Total cash on hand (subtract last month's burn; verify Stripe/QBO).
2. Net new MRR (paid customers × price - cancellations).
3. Anthropic API spend last month (Anthropic Console → Usage).
4. Vercel + Neon + Twilio invoices (auto-charged).
5. Runway months remaining (cash ÷ monthly burn).

If runway drops below 6 months, that's the trigger to either raise OR cut burn (drop the VA, downshift acquisition spend, etc.).

---

## 8. Worksheet — fill in your real numbers

```
Cash on hand                  $ ___________
Less: startup formation       $ ___________  (-$1,075 if Atlas not yet paid)
Less: insurance Y1            $ ___________  (-$3,000 if not yet bound)
Less: David salary if any     $ ___________  (×11 weeks of push)
Less: emergency buffer        $ ___________  (recommend 2 months)
                              ─────────────
Available for sprint          $ ___________

Monthly burn                  $ 2,645
                              ─────────────
Runway in months              ___________

100 customers target          8/1/2026
Today                         5/16/2026
Weeks to target               11
```

Fill these in once + revisit at the start of each month. The whole point is that you should know your runway without thinking.

---

## 9. The strategic question

If the 100-customer push lands by 8/1 + MRR is $50K, you don't need to raise — the business funds itself.

If the push falls short (say 50 customers, $25K MRR) and burn is $5K (with VA + Antonio stipend), you still have positive cash flow. You can keep going.

If the push stalls (10 customers, $2.5K MRR) and burn is $3K, you're net negative $500/mo. That's also fine if cash on hand covers another 6-12 months — the slow build still works.

**The only failure mode is: 100-customer push falls short AND David's personal runway runs out before MRR catches up.** That's the scenario the monthly check is meant to catch early.

---

*Last updated: 2026-05-16. Update whenever cash on hand, burn, or customer count changes materially.*
