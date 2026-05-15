# Email Templates — full lifecycle suite

> *Every email Petal sends, end-to-end. Transactional + lifecycle + manual outreach.*
> *Locked 2026-05-11. Re-read every Friday during the 100-by-8/1 sprint.*

This file is the source of truth for **what Petal emails look like**. Cold outreach copy lives in [`docs/pitch-decks/cold-outreach-templates.md`](pitch-decks/cold-outreach-templates.md). Voice rules in [`docs/MARKETING-FRAMES.md`](MARKETING-FRAMES.md). All emails sent via Resend (free tier sufficient for v0; upgrade at 3K/mo sends).

---

## ⭐ Universal voice rules

Per [`docs/MARKETING-FRAMES.md`](MARKETING-FRAMES.md) + CLAUDE.md §19 anti-AI-slop:

1. **From line is always a real human**: `David Kim <david@petal.com>` for prospect-facing, `Petal <hello@petal.com>` for transactional only.
2. **Subject lines are conversational**, not marketing-y: "Your Petal Discovery Scan is ready" beats "📊 Your Tax Insights Report 📊".
3. **No emojis. No em dashes. No AI vocabulary**: no delve, crucial, robust, comprehensive, nuanced.
4. **Real names. Real numbers. Real cites.** Antonio's full credential block when relevant.
5. **Penalty-anchored P.S.** on every prospect-facing email where it fits naturally (founder rate $250/mo, $650 §6695(g), "one prevented penalty pays for half a year").
6. **Plain text → HTML rendering**. No image-heavy templates. Editorial-warm: Fraunces serif for any image headers, DM Sans body. Cream + forest green only.
7. **Unsubscribe footer on lifecycle emails** (legally required for CAN-SPAM). NOT required on transactional (receipts, scan delivery, OTP).
8. **Reply-able**. Every email except OTP must be reply-to a real human inbox.

---

## Email categories

| Category | Examples | Send mechanism |
|---|---|---|
| **Transactional — system** | OTP, scan-link-delivered, scan-PDF-delivered, payment receipt | Resend transactional, triggered by code |
| **Transactional — onboarding** | Discovery Scan welcome, founder-tier signup welcome, scheduling confirmation | Resend transactional, triggered by form submit |
| **Lifecycle — prospect** | Discovery Scan delivery, scan walkthrough offer, founder-rate scarcity reminder | Manual or HubSpot drip, David-signed |
| **Lifecycle — customer** | Onboarding sequence, first-month check-in, quarterly business review, referral activation | Manual or HubSpot, David-signed |
| **Event-driven** | Boney-Henderson presentation invite, NAEA chapter dinner follow-up, conference outreach | Manual, David or Antonio signed |

---

## TRANSACTIONAL — system

### Email 1: Discovery Scan upload link (auto-sent on form submit)

| | |
|---|---|
| Trigger | Prospect submits `/scan` form |
| From | `David Kim <david@petal.com>` |
| Reply-to | `david@petal.com` |
| Send timing | Immediate (< 5 min) |

```
Subject: Your Petal Discovery Scan request — upload link inside

Hi [First name],

Thanks for requesting a Discovery Scan for [Firm name]. Quick note on
what happens next.

Step 1 — Upload your redacted return.
Secure upload link: [unique link, expires 72h]
PDF or PDF + workpapers, max 25MB.

Before uploading, strip:
- Client name + address
- SSNs (replace with XXX-XX-XXXX)
- EINs (replace with XX-XXXXXXX)
- Bank account numbers

Keep:
- Entity type
- AGI / income bucket
- All schedules, line items, dollar amounts
- State of residence
- Any unusual transactions, K-1s, foreign income, depreciation, NOLs

Step 2 — We run the Position Framework.
Once your return is in, we run a full 4-tier analysis. 24-hour turnaround.
The result is a Petal-branded PDF with every defensible deduction
surfaced + classified + cited.

Step 3 — You get the PDF.
Delivered to this email address. Optional: 20-minute walkthrough call
where we go through positions together and talk about whether the $250/mo
founder rate makes sense for [Firm name].

No commitment either way. If the scan surfaces real money, we talk. If
not, you keep the PDF.

Questions? Just reply to this email.

David Kim
CEO, Petal

P.S. The §6695(g) due-diligence penalty is $650 per failure (Rev. Proc.
2025-32). Petal founder rate is $250/mo. One prevented penalty pays for
half a year. The math is the offer.

---
You're receiving this because you signed up for a free Discovery Scan at
petal.com/scan. Reply to ask questions, or ignore if no longer interested.
petal.com · david@petal.com
```

### Email 2: Discovery Scan PDF delivered (auto-sent when agent completes)

| | |
|---|---|
| Trigger | Discovery agent completes + manual review approved (first 30) OR auto-deliver (after first 30) |
| From | `David Kim <david@petal.com>` |
| Reply-to | `david@petal.com` |
| Send timing | Within 24 hours of upload |
| Attachment | PDF (the Discovery Scan output) |

```
Subject: Your Petal Discovery Scan — [Firm Name]

Hi [First name],

Your Discovery Scan is ready. Attached is the PDF.

Quick walkthrough:

WHAT WE SCANNED
[N] returns from [Year]. Full Position Framework run (Tier 1 Settled /
Tier 2 Substantial Authority / Tier 3 Reasonable Basis + 8275 /
Tier 4 MLTN) with IRC cites attached at decision time.

WHAT WE SURFACED
$[X] in additional defensible deductions across [N] positions. Every
position carries a confidence tier + cited authority + draft 8275
(if Tier 3).

WHAT WE FLAGGED AS OUT-OF-SCOPE
[N] positions below Reasonable Basis. The system refused — that is the
design.

THE AUDIT-DEFENSE STORY
Every position is logged with prep date, cited authority, and confidence
rating. If any of these returns gets audited, the defense file is one
click away.

Want to walk through the PDF together? 20 minutes works for me [day/time].
Or reply with questions on any specific position.

Founder rate is $250/mo locked for life, [X] of 50 remaining. Happy to
walk through what an ongoing engagement looks like for [Firm name].

David Kim
CEO, Petal

P.S. Every position in the scan has a draft 8275 attached if it is Tier 3
(Reasonable Basis with disclosure). That is not a feature, it is the
design — Petal refuses to surface a position without the disclosure
pre-drafted.

---
petal.com · david@petal.com
```

### Email 3: Phone OTP (existing — already shipped in production)

| | |
|---|---|
| Trigger | User attempts login |
| From | `Petal <noreply@petal.com>` |
| Reply-to | None (do-not-reply) |
| Send timing | < 5 seconds |

```
Subject: Your Petal login code

Your Petal login code is: 384729

This code expires in 10 minutes. If you didn't request this, you can
ignore this email.

---
For questions: hello@petal.com
```

### Email 4: Payment receipt (founder tier signup confirmation)

| | |
|---|---|
| Trigger | Square payment success webhook |
| From | `Petal <hello@petal.com>` |
| Reply-to | `david@petal.com` |
| Send timing | Within 60s of payment success |

```
Subject: Welcome to Petal — receipt + next steps

Hi [First name],

Welcome. Receipt below.

PLAN          Founder tier — $250/mo (locked for life)
NEXT BILLING  [date]
PAYMENT       Visa ending in [X] · ID [Square transaction ID]
FIRM          [Firm name]
USER          [First Last] · [email]
SLOT          Founder slot [N] of 50

WHAT HAPPENS NEXT

Within 24 hours:
- David will email you to schedule a 30-min onboarding call
- We'll provision your Petal tenant
- We'll send you your first-login link (separate email)

Within 1 week:
- Your firm's tax stack credentials get connected (OLT, IRS Solutions, Xero)
- Antonio + David walk through Position Library specific to your client mix
- Your audit-trail substrate is provisioned and tested

If anything looks wrong on the receipt, reply to this email immediately.

Welcome to the founder cohort.

David Kim
CEO, Petal

---
hello@petal.com · petal.com
```

---

## TRANSACTIONAL — onboarding

### Email 5: Founder-tier welcome (David personal, within 24h of payment)

| | |
|---|---|
| Trigger | David sends manually within 24h of payment receipt |
| From | `David Kim <david@petal.com>` |
| Reply-to | `david@petal.com` |
| Send timing | Within 24h |

```
Subject: Welcome to Petal — let's get you set up

Hi [First name],

Thanks for signing up. You're founder slot [N] of 50.

I block a 30-min onboarding call with every founder cohort firm because
the substrate handoff matters. We'll cover:

1. YOUR TAX STACK — what software you use, what we automate first
   (OLT browser automation, IRS Solutions API access, Xero integration)
2. YOUR CLIENT MIX — what % EITC/CTC/AOTC, multi-state, multi-entity,
   high-rep practice. Drives which Position Library entries surface first.
3. YOUR FIRM-OWNER WORKFLOW — what your morning brief should look like,
   what your day-end check-in looks like, how the audit-trail substrate
   feeds your existing tools.
4. ANTONIO HANDOFF — Antonio Vazquez (our on-platform tax advisor) reviews
   every Position Library entry that ships to your account. I'll introduce
   you on the call.

Book a 30-min slot here: [Calendly link]

Two days I'm holding open this week: [day1 + day2 with times].

David Kim
CEO, Petal

P.S. The founder rate is locked. Even when standard tiers go up, your
$250/mo doesn't. As long as you remain in good standing, the rate is
yours.

---
petal.com · david@petal.com
```

### Email 6: Onboarding call confirmation (auto-send via Calendly)

| | |
|---|---|
| Trigger | Calendly booking |
| From | `David Kim <david@petal.com>` |
| Send timing | Immediate |

```
Subject: Onboarding call confirmed — [day] at [time]

Hi [First name],

You're confirmed for a 30-min onboarding call on [day] at [time] [zone].

Zoom link: [auto-generated]

Three things to have ready:
1. Your current tax-prep software credentials (sandbox or test login if you
   prefer not to share prod yet)
2. A typical client return you'd want surfaced as the first scan
3. Any questions on the Position Framework or Coverage Map (petal.com/coverage)

Looking forward.

David Kim

---
Need to reschedule? [Calendly reschedule link]
```

### Email 7: Onboarding call follow-up (David personal, post-call)

| | |
|---|---|
| Trigger | David sends manually after onboarding call |
| From | `David Kim <david@petal.com>` |
| Send timing | Within 24h of call |

```
Subject: Recap + next steps for [Firm name]

Hi [First name],

Great talking with you. Quick recap of what we agreed:

YOUR PRIORITY POSITIONS (Antonio is loading these first)
1. [Position 1 — e.g., R&D credit claims for biotech client cluster]
2. [Position 2 — e.g., S-corp reasonable comp for service business cluster]
3. [Position 3]

YOUR FIRST INTEGRATIONS (Haokun is wiring these this week)
1. OLT browser automation (read-only first; write actions Phase 2)
2. IRS Solutions API (Antonio's path; partner #2 mid-market uses different)
3. Xero (API-first; OAuth tomorrow)

YOUR NEXT MILESTONE
First Position Framework scan on a real client's prepped return by [date].
Antonio reviews; you get the PDF.

ANY TIMING / SCOPE CHANGES — reply to this email.

David Kim

---
petal.com · david@petal.com
```

---

## LIFECYCLE — prospect

### Email 8: Discovery Scan walkthrough offer (manual, 2-3 days post-delivery)

| | |
|---|---|
| Trigger | David sends manually 2-3 days after PDF delivered, if prospect didn't reply |
| From | `David Kim <david@petal.com>` |
| Send timing | 2-3 days after PDF delivery, only if no reply |

```
Subject: Your Discovery Scan PDF — any questions?

Hi [First name],

Checking in. Sent your Discovery Scan PDF for [Firm name] two days ago.

A few questions usually come up after the PDF lands:

- "Position #3 looks aggressive — would Petal really surface that on every
  return like this?" (Answer: only when the cited authority supports it
  at that tier. The Position Library is Antonio-validated before it ships.)
- "What about state coverage?" (CA is in the seed library; other states
  flagged out-of-scope.)
- "What does the audit-trail substrate actually look like in production?"
  (5-min screen-share works; happy to walk through.)

Want to grab 20 minutes? [Calendly link]

Or just reply with questions.

David Kim
CEO, Petal

P.S. [X] of 50 founder slots remaining at $250/mo locked-for-life. After
50, the rate jumps to $350/mo for the next 25, then $400 for the final 25.
The math gets worse the longer it takes.

---
petal.com · david@petal.com
```

### Email 9: Founder-slot scarcity reminder (manual, when slot count crosses threshold)

| | |
|---|---|
| Trigger | David sends manually when founder slots cross 40, 45, 48, 50 (last call) |
| From | `David Kim <david@petal.com>` |
| Send timing | At thresholds; max 2 sends per prospect |

```
Subject: [N] founder slots left — last call before $350/mo

Hi [First name],

Quick update. Founder cohort has [N] of 50 slots remaining. After 50,
the rate is $350/mo for the next 25 firms, then $400/mo for the final 25.

You ran a Discovery Scan with us on [date] — saw the [$X] in defensible
deductions we surfaced. The founder rate covers the entire scan output
in [Y] months of subscription.

If now is the time, I can have you onboarded this week. 20 minutes for
a quick call: [Calendly link]

If not now, when does the timing make sense? I want to honor the
relationship even if the founder rate is gone by then.

David Kim
CEO, Petal

P.S. Just to keep the math current: $650/failure §6695(g), $1,000-5,000
§6694, $20K average audit defense at realization rate. Founder rate
$3,000/yr. One prevented penalty pays the year.

---
petal.com · david@petal.com
```

---

## LIFECYCLE — customer

### Email 10: Week-1 check-in (David personal)

| | |
|---|---|
| Trigger | 7 days after founder-tier signup |
| From | `David Kim <david@petal.com>` |
| Send timing | Day 7 post-signup |

```
Subject: Week 1 — how is it going for [Firm name]?

Hi [First name],

It's been a week. Quick check-in.

What's working: [pre-fill based on Sentry events + CRM notes — e.g., "your
team has run 23 Position Framework scans this week, with average
$2,400 in surfaced deductions per return"]

What's stuck: [pre-fill from support tickets or "nothing reported" if no
issues]

Three questions:
1. What would have made the first week smoother?
2. What surprises you about the product?
3. What's one thing you wish Petal did that it doesn't?

I read every reply.

David Kim
CEO, Petal

---
petal.com · david@petal.com
```

### Email 11: Quarterly Business Review invite (David personal)

| | |
|---|---|
| Trigger | Manual, every 90 days post-signup |
| From | `David Kim <david@petal.com>` |
| Send timing | Quarterly |

```
Subject: Quarterly check-in for [Firm name] — 30 min, on me

Hi [First name],

It's been 90 days. Want to do a quarterly business review?

I do these with every founder-cohort firm because the early-stage signal
matters. What I'd cover:

1. YOUR DATA (last 90 days):
   - Returns scanned: [N]
   - Defensible deductions surfaced: $[X]
   - Refusal floor invocations: [N]
   - Audit-trail substrate writes: [N]
   - Time saved estimate: [hours]

2. WHAT'S WORKING + WHAT ISN'T:
   - What's the highest-value workflow Petal touches for [Firm name]?
   - What's the lowest? Should we cut it or fix it?

3. ROADMAP PREVIEW:
   - What's shipping in the next 90 days that's relevant to your practice
   - What I'd love your input on

30 minutes. Pick a slot: [Calendly link]

David Kim
CEO, Petal

---
petal.com · david@petal.com
```

### Email 12: Referral activation (auto-send post-30-day mark)

| | |
|---|---|
| Trigger | 30 days post-signup |
| From | `David Kim <david@petal.com>` |
| Send timing | Day 30 |

```
Subject: Refer an EA / small-firm CPA → 1 month free per close

Hi [First name],

You've been on Petal for 30 days. Time to talk referrals.

THE PROGRAM (simple):
- Refer 1 EA or small-firm CPA who signs founder tier → 1 month free
- Refer 3 firms who sign → 1 free Discovery Scan credit ($750 value)
- Refer 5 firms who sign → lifetime free upgrade to next tier

WHY I'M ASKING:
The next 30-50 founder slots are likely going to come from your network.
You know which EAs would benefit. Warm intros close 4-5x faster than
cold outreach.

HOW IT WORKS:
1. Forward them petal.com/scan with a 1-line intro ("Hey [Name], wanted
   to share this with you — David built something for our segment.")
2. They run a free Discovery Scan.
3. They sign founder tier → your referral credit fires automatically.

Or just reply with names + I'll reach out direct. Whichever feels right.

David Kim
CEO, Petal

P.S. [X] of 50 founder slots left. Refer fast — the rate they get is
locked at signup, so the earlier the warmer-intro hits, the better the
math for them.

---
petal.com · david@petal.com
```

---

## EVENT-DRIVEN

### Email 13: Boney-Henderson presentation invite (Antonio + David, joint)

| | |
|---|---|
| Trigger | Manual, when Antonio confirms date with Boney-Henderson |
| From | `Antonio Vazquez <antonio@vazantconsulting.com>` |
| Cc | `David Kim <david@petal.com>` |
| Reply-to | Antonio + David |
| Send timing | 2-3 weeks before presentation |

```
Subject: 60-min Petal walkthrough for the network — [date]

[Recipients: Boney-Henderson's preparer network distribution list, with
Boney-Henderson cc'd]

Hi everyone,

A few of you have heard me mention Petal — the AI tax-OS tool David Kim
and I have been building. I've been running my book on it since [date]
and using it on two active 2026 IRS audits.

Dr. Boney-Henderson agreed to host a 60-min walkthrough for the network.
Details:

DATE: [day], [time] [timezone]
ZOOM: [link]
RSVP: [link or "reply to this email"]

WHAT WE'LL COVER:
1. Live demo on a real (anonymized) return I just prepped
2. The 4-tier Position Framework + how it differs from "AI deduction
   maximizers" (and why that difference matters for our PTINs)
3. Pricing + the founder cohort offer ($250/mo, locked for life, first 50
   firms — [X] of 50 still available)
4. Q&A — David and I both on the call

WHO SHOULD ATTEND:
Any EA or small-firm CPA who's signed a return with EITC, CTC, AOTC, or
HOH in the last 12 months — Petal's Position Framework was built for
your due-diligence exposure first.

Looking forward to seeing you.

Antonio Vazquez, EA
Vazant Consulting

---
Reply to this email or ping David Kim at david@petal.com.
```

### Email 14: NAEA chapter dinner follow-up (David personal)

| | |
|---|---|
| Trigger | Manual, 24-48h after meeting prospect at NAEA event |
| From | `David Kim <david@petal.com>` |
| Send timing | 24-48h post-event |

```
Subject: Great talking with you at [Chapter] NAEA — quick follow-up

Hi [First name],

Great talking with you last night at the [Chapter] NAEA dinner. You
mentioned [specific topic — e.g., "your frustration with TaxDome's shallow
AI features" or "the EITC client cluster you're rebuilding the workflow
for"]. Wanted to follow up.

Two paths:

1. FREE DISCOVERY SCAN — I can run a Position Framework scan on one of
   your returns this week. Redacted upload, 24-hour turnaround, PDF
   delivered. petal.com/scan or just reply with "scan me."

2. 20-MIN WALKTHROUGH — Zoom, screen-share, real product. [Calendly link]

Pick either, or both, or neither — your call.

David Kim
CEO, Petal

P.S. Antonio Vazquez (our on-platform tax advisor + founding firm partner)
is happy to take your call too if you want to talk EA-to-EA. He's
defending two active 2026 IRS audits using the product, so the production
experience is live.

---
petal.com · david@petal.com
```

### Email 15: Loom-as-CTA (manual, when prospect goes quiet)

| | |
|---|---|
| Trigger | Manual, 7+ days no response after Discovery Scan delivered |
| From | `David Kim <david@petal.com>` |
| Send timing | When prospect goes quiet |

```
Subject: 3-min Loom walking through your Discovery Scan

Hi [First name],

Recorded a quick 3-min Loom walking through the highlights of your
Discovery Scan PDF for [Firm name]. Watch when you have time:

[Loom link]

Highlights:
- $[X] in defensible deductions surfaced
- [N] Reasonable Basis + 8275 positions (draft 8275 attached on each)
- [N] refusals below Reasonable Basis (the trust-builder section)
- The audit-defense chain for [most interesting position]

If anything in the Loom raises a question, just reply. If now's not the
time, totally fine — I'll check in next quarter.

David Kim
CEO, Petal

P.S. [X] of 50 founder slots remaining. After 50, the rate is $350/mo.

---
petal.com · david@petal.com
```

---

## Resend / transactional email production setup

### Domain authentication

- SPF: `v=spf1 include:_spf.resend.com -all`
- DKIM: Generate via Resend dashboard, add CNAME records
- DMARC: `v=DMARC1; p=quarantine; rua=mailto:dmarc@petal.com`
- Reverse DNS for sending IPs (Resend manages)

### Sending addresses

| Address | Use case |
|---|---|
| `david@petal.com` | All prospect-facing + manual sends |
| `hello@petal.com` | Transactional (receipts, welcome) |
| `noreply@petal.com` | OTP only (no reply expected) |
| `antonio@vazantconsulting.com` | Antonio-from sends (Boney-Henderson invite, joint outreach) |

### Deliverability monitoring

- Bounce rate < 2% (industry threshold; >2% triggers Resend deliverability review)
- Spam complaint rate < 0.1%
- Open rate > 30% on cold outreach (lower = subject line problem)
- Reply rate > 5% on cold outreach (lower = body copy problem)

### Tracking

- All transactional emails: open + click tracking on
- All cold outreach: open tracking on, click tracking on (Lemlist or Resend)
- Lifecycle emails: open + click + unsubscribe tracking on
- CAN-SPAM compliance: unsubscribe footer on all lifecycle; not on transactional

---

## What's NOT in this file (deferred)

| Email | Why deferred |
|---|---|
| Tier-upgrade upsell sequences | Defer until 50 founder slots filled — that's when standard-tier sales kick in. |
| Annual renewal reminders | Founder tier is locked monthly. Build at v1.5 with annual prepay. |
| Failed payment / past-due collection | Build at v1.5; first 50 customers are manually managed. |
| Partner #2 (mid-market firm) outreach sequences | Different motion; covered in mid-market-firm-deck.md instead. |
| Bilingual (Spanish, Mandarin) templates | English-only v1 per CLAUDE.md. |
| SMS templates | Twilio is wired but SMS marketing is not v1. Transactional SMS (OTP) only. |
| Voicemail drop scripts | Lives in cold-outreach-templates.md (per-prospect manual use). |

---

## Update discipline

- Re-read this file every Friday during the 100-by-8/1 sprint.
- A/B test subject lines on Discovery Scan delivery + walkthrough offer after first 50 sends each.
- Update penalty math in P.S. blocks when IRS Rev. Proc. annual update lands (~December each year).
- Update founder slot counter ([X] of 50) when CRM mirrors the live count.
- Update Antonio's case study language quarterly with fresh stats from his book.

---

*Created 2026-05-11. Voice-pass each template with David before first send. Drift between this file and what Petal actually sends is the bug it is designed to prevent.*
