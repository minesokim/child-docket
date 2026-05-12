# Landing page copy — `docket.com` (homepage)

> *The category-setting hero + frame-confirming body. Routes warm traffic to /scan or /pricing.*
> *Route: `apps/client-portal/src/app/page.tsx` (or new marketing site at `docket.com` root once domain is locked).*

Drop-in copy below. Voice rules in [`docs/MARKETING-FRAMES.md`](../MARKETING-FRAMES.md). Pricing math in [`pricing-page-copy.md`](pricing-page-copy.md).

---

## Page metadata

| Field | Value |
|---|---|
| `<title>` | Docket — The AI defense layer for tax practices |
| `meta description` | The only AI built for the tax pro's side of the desk. Every position cited. Every action audit-trailed. Refuses below Reasonable Basis. Founder rate $250/mo, first 50 firms. |
| `og:image` | Docket wordmark + tagline + screenshot of a position with cited authority |
| `canonical` | `https://docket.com/` |

---

## Above the fold

```
[eyebrow]
COMPLIANCE-FIRST AI FOR THE PTIN-CARRYING PRACTICE

[H1, Fraunces 64-80px, max 2 lines]
The only AI built for the
tax pro's side of the desk.

[subhead, DM Sans 18-22px, max 2 lines]
Every position cites primary authority. Every action audit-trailed.
Refuses below Reasonable Basis. Generates the audit defense file as a
side effect of normal work.

[two CTAs side-by-side]
[primary, forest green] → Run a free Discovery Scan
[secondary, text + arrow] → See the pricing math →

[trust ribbon, full-width strip below CTAs]
Built on Claude · ZDR + Bedrock fallback · SOC 2 Type II controls in codebase
RLS at ENABLE+FORCE · Per-tenant DEK encryption · Cryptographic audit chain
```

---

## Section 1 — The structural lane

```
[eyebrow]
THE STRUCTURAL LANE

[H2, Fraunces 40-48px, max 2 lines]
The funded AI tax tools all target Big-4 firms.
Their in-house counsel carries the §6694 line.

[body, DM Sans 18px, max 4 lines]
EAs and small firms personally carry PTIN risk. None of those tools are
built for that math. Docket is. It is the only AI that runs the Position
Framework continuously, refuses below Reasonable Basis, and generates the
audit defense file as a side effect of normal work.

[3-column comparison table, DM Sans 14-16px]

LAYER 1 — DATA            LAYER 2 — RETURN PREP        LAYER 3 — PRACTICE + REP
K1x ($175M, 2026)         Black Ore ($60M, 2026)       (empty for AI-native)
                          Accrual ($75M, 2026)         PM incumbents ship
                          Basis ($1.15B val, 2026)     shallow AI:
                          TaxGPT, Filed, Grove,        TaxDome, Canopy, Karbon
                          Juno, StanfordTax, Soraban

[caption strip, italic, forest green underline]
Docket is the third layer. The funded competitors are economically
forced up-market. The PM incumbents lack the AI substrate to dominate
this lane. It is open. We are alone in it.
```

---

## Section 2 — The five pillars

```
[eyebrow]
WHAT DOCKET DOES

[H2]
Five pillars. One operator.

[5-card grid, two rows]

[card 1] COMPLIANCE-FIRST POSITION FRAMEWORK
4-tier confidence (Settled / Substantial Authority / Reasonable Basis +
8275 / MLTN). Refuses below Reasonable Basis. Cited authority on every
position at decision time. The structural moat.

[card 2] AMBIENT OPERATOR (CLOSED-LOOP OS)
The AI surfaces what needs attention. The preparer decides. No chat
character. The AI is around the conversation, never in it.

[card 3] AI-NATIVE CRM + MEMORY
Memory scoped to the client, not to a chat thread. Every action, doc,
message lives on the client record. Versioned, audit-trailed.

[card 4] REVIEW AUTOMATION + FORM FILLING
Junior preparer drafting + senior preparer flagging. Browser automation
into OLT, Drake, ProConnect when API is not available.

[card 5] MULTI-CHANNEL REACHABILITY
Bilingual client portal + SMS + email + voicemail. The taxpayer never
talks to an AI character. Every AI response is preparer-approved.
```

---

## Section 3 — Antonio's proof point

```
[eyebrow]
THE PROOF POINT

[H2, Fraunces 36-44px]
Antonio is running his book on it. Two active 2026 IRS audits in flight.

[layout: photo column on left (40%), body column on right (60%)]

[photo: Antonio's headshot, editorial composition, cream background]

[body, DM Sans 16-18px]
ANTONIO VAZQUEZ, EA — VAZANT CONSULTING, CALIFORNIA

25-year EA practice. ~250 active clients. Founding firm partner +
on-platform tax advisor (1% equity). Currently defending two active
2026 IRS audits using Docket as the substrate.

Every position library entry is reviewed and signed off by Antonio
before it ships to the platform. Every cited authority decision routes
through him. Contracted backup advisors handle scale-validation when
his bandwidth is constrained.

[pull quote, large type, italic, Fraunces]
"The audit defense file generated itself. Every position my AI surfaced
during the year had the IRC cite logged. When the IRS opened the exam,
I had the substrate ready. That is not a feature. That is the design."
— Antonio Vazquez, EA
```

---

## Section 4 — Penalty-anchored pricing teaser

```
[eyebrow]
THE PRICING

[H2]
$250/mo. Locked for life. First 50 firms.

[body, DM Sans 18-20px]
Less than half of one $650 §6695(g) due-diligence penalty.
Less than a tenth of one §6694 understatement.
Less than one hour of audit-defense time at your realization rate.

The pricing is not aggressive. It is the only honest price for a system
whose entire job is preventing all of the above continuously.

[CTA, forest green]
→ See the cost-of-not-using math
[Routes to /pricing#calculator]

[microcopy, italic, DM Sans 13px]
[X] of 50 founder slots remaining. After 50: $350/mo for the next 25,
$400/mo for the final 25, then standard pricing kicks in.
```

---

## Section 5 — Substrate trust ribbon

```
[eyebrow]
THE SUBSTRATE

[H2, Fraunces 32-36px]
We built compliance into the codebase before we shipped a single feature.

[grid of trust markers, 2 rows × 3 columns]

[marker 1] 28 PROD MIGRATIONS LIVE
Real schema, real data. Drizzle + Neon. Per-tenant RLS at ENABLE+FORCE
since migration 0001.

[marker 2] PER-TENANT DEK ENCRYPTION
AES-256-GCM with AAD bound to (tenant_id, client_id, path). Master KEK
rotation runbook + script live. 34/34 encryption tests pass.

[marker 3] CRYPTOGRAPHIC AUDIT CHAIN
chain_seq + prev_hash + row_hash. Nightly tamper verifier. Every action
on a tenant's data leaves a row.

[marker 4] BEDROCK FALLBACK VERIFIED
Anthropic + Bedrock orchestrator-level failover. 38/38 unit + 4/4 smoke
tests. CI-enforced.

[marker 5] WEBHOOK SIGNATURE VERIFICATION
HMAC verification helper at @docket/shared/webhooks. 32/32 tests.
Timing-safe comparison.

[marker 6] 12-DOC SOC 2 TYPE II POLICY SET
docs/security/ — Information Security Policy + Access Control + Change
Management + Incident Response + Vendor Management + BCP + 6 more. Drata
attestation when capital lands.

[caption strip]
Substrate work is the moat the funded competitors do not have at our
segment. They built features fast and are now retro-fitting compliance.
We did it the other way.
```

---

## Section 6 — Path 2 mention (lightweight, routes API partners)

```
[eyebrow]
FOR AI TAX TOOL BUILDERS

[H2]
Building AI for tax? Use Docket as your compliance substrate.

[body]
Public API + MCP server ship in v1 (deployable artifacts, partner-onboarded
by direct intro). Self-serve developer tier with billing v1.5. The
Position Framework, the refusal floor, and the audit substrate are the
hardest parts of building AI for tax. We did them. Build on top.

[CTA, secondary]
→ Path 2 partner inquiries → david@docket.com
```

---

## Section 7 — Final CTA + footer continuation

```
[eyebrow]
THE OFFER

[H2, Fraunces 44-56px]
Run a free Discovery Scan on one of your returns.

[body, DM Sans 18-20px, max 3 lines]
24-hour turnaround. Real Position Framework run on a redacted return.
PDF delivered with IRC cites + 4-tier confidence ratings + draft 8275s.
No commitment. First 30 EAs and small-firm CPAs.

[primary CTA, oversized, forest green]
→ Run my Discovery Scan

[microcopy]
Or email david@docket.com to lock a 20-minute walkthrough first.

[footer — same as discovery-scan-landing-copy.md footer block]
```

---

## Implementation notes for Haokun

| Element | Production note |
|---|---|
| Page structure | 7 sections + sticky CTA. Mobile-collapses to single column under 768px. |
| Hero variant test | A/B test "The only AI built for the tax pro's side of the desk" (current H1) vs "The AI defense layer for tax practices" (the cold-outreach lead). Track scan_form_submit conversion delta after 1,000 page-views. |
| Antonio photo | Reuse `apps/client-portal/public/antonio.webp` (already in repo). |
| Layer-1/2/3 comparison table | Use real funding figures from CLAUDE.md §17. Link competitors' Business Wire posts in `aria-describedby` tooltips. |
| Substrate trust ribbon | Each trust marker links to the relevant code path (e.g., "Per-tenant DEK" -> `packages/db/src/encryption.ts`). Aria-label only — do not expose private GitHub URLs. Link to `docs/security/` instead for buyer-readable. |
| Path 2 mailto | `mailto:david@docket.com?subject=Docket%20Path%202%20Partner%20Inquiry` |
| Performance budget | Same as Discovery Scan landing — LCP < 1.5s on 4G; CLS < 0.05. |

---

*Created 2026-05-11. Voice-pass with David before production deploy.*
