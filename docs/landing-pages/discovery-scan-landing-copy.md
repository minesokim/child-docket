# Landing page copy — `docket.com/scan`

> *The free Discovery Scan landing page. Primary cold-traffic conversion surface for the 100-by-8/1 push.*
> *Route: `apps/client-portal/src/app/scan/page.tsx`. Live target: 5/25/2026.*

Drop-in copy below. Technical spec + form schema + Discovery agent design at [`docs/DISCOVERY-SCAN-OPERATIONAL.md`](../DISCOVERY-SCAN-OPERATIONAL.md).

---

## Page metadata

| Field | Value |
|---|---|
| `<title>` | Free Discovery Scan — Docket |
| `meta description` | Free 24-hour Position Framework scan on one of your returns. Every defensible deduction surfaced, cited authority attached, draft 8275 on every Tier 3 position. First 30 EAs and small-firm CPAs. |
| `og:image` | Docket wordmark over cream canvas with forest green accent + tagline "The AI defense layer for tax practices." |
| `canonical` | `https://docket.com/scan` |

---

## Above the fold

```
[eyebrow]
FREE DISCOVERY SCAN — first 30 EAs and small-firm CPAs

[H1, Fraunces 56-72px]
Find every defensible deduction
your last return missed.
Cited authority on each one.

[subhead, DM Sans 18-20px, max 2 lines]
24-hour turnaround. Real Position Framework run on a redacted return.
PDF delivered with IRC cites, 4-tier confidence ratings, and draft 8275s.

[primary CTA — forest green button, white text]
→ Run my scan

[trust anchor, DM Sans 13-14px, italic, max 3 lines below CTA]
Antonio Vazquez, EA at Vazant Consulting (CA, ~250 active clients), runs his
book on the same Position Framework. Currently defending two active 2026 IRS
audits using Docket as the substrate.
```

---

## Section 1 — "What you get in the PDF"

```
[eyebrow]
THE PDF

[H2, Fraunces 36-44px]
Three things on every page of your scan.

[3-column layout, DM Sans 16px body, Fraunces 20px callout titles]

[col 1] EVERY DEFENSIBLE DEDUCTION
Every position the AI surfaces carries a 4-tier confidence rating
(Settled law / Substantial Authority / Reasonable Basis + 8275 / MLTN)
with the IRC cite attached at decision time. Numbers, not vibes.

[col 2] THE REFUSAL FLOOR
Positions below Reasonable Basis get refused with a documented reason.
We do not surface aggressive territory unsupported. That refusal is part
of your audit defense, not a hole in the product.

[col 3] DRAFT 8275 ON TIER 3 POSITIONS
Every Reasonable Basis position arrives with the disclosure pre-drafted.
That is not a feature. It is the only way the Position Framework can run
honestly.
```

---

## Section 2 — "How it works"

```
[eyebrow]
THE PROCESS

[H2]
Four steps. 24 hours.

[numbered, 4 cards, image + caption + body in each]

1. UPLOAD A REDACTED RETURN
   PDF or PDF + workpapers. Max 25MB. Strip client name, address, SSN —
   keep entity type, AGI bucket, schedules, line items. We send the
   secure upload link by email after you submit the form below.

2. DOCKET RUNS THE POSITION FRAMEWORK
   Every line item gets the 4-tier confidence pass + IRC cite + draft 8275
   where applicable. Refuses below Reasonable Basis by default.

3. 24-HOUR TURNAROUND
   You get a Docket-branded PDF in your inbox. Headline number on page 2:
   total dollars in defensible deductions surfaced across all positions.

4. OPTIONAL 20-MIN WALKTHROUGH
   We go through positions together and talk about whether the $250/mo
   founder rate makes sense for your firm. No commitment. The PDF is yours
   either way.
```

---

## Section 3 — "The math behind the offer"

```
[eyebrow]
THE PRICING MATH

[H2]
The numbers are the offer.

[body, large type, DM Sans 18px]

The §6695(g) due-diligence penalty is $650 per failure, per Rev. Proc. 2025-32.
Per failure, not per return. A single return with EITC + CTC + AOTC + HOH is
four checklists — miss all four, that is $2,600 from one client.

The §6694 understatement penalty is $1,000 to $5,000.

An audit defense engagement is 40 to 100 hours at your realization rate. Call
it $20,000 of billable work you are not doing.

[callout box, forest green border, cream fill]
Docket founder rate: $250/mo. Locked for life, first 50 firms.
One prevented §6695(g) penalty pays for half a year.
One prevented §6694 understatement pays for 18 months.
One prevented audit defense engagement pays for 5+ years.

[secondary CTA, text-only, inline]
See the full pricing math → /pricing

[link to IRS source]
Source: IRS Rev. Proc. 2025-32 (2026 inflation adjustments)
https://www.irs.gov/irb/2025-45_IRB
```

---

## Section 4 — "Who's behind this"

```
[eyebrow]
THE FOUNDERS

[H2]
Built by builders who carry the same risk you do.

[two-column layout, founder bio cards]

[col 1] DAVID KIM
CEO. Building the company-facing surfaces, the customer relationships, and
the Antonio partnership. Email: david@docket.com.

[col 2] HAOKUN YANG
CTO. Owns the codebase end-to-end. 5+ year partnership pre-Docket. UCR CS.
Built the 13-table Drizzle schema with RLS, per-tenant DEK encryption,
cryptographic audit chain, and the agent fleet currently in production.

[third row, full-width card, slightly different visual treatment]
ANTONIO VAZQUEZ, EA — On-platform tax advisor (1% equity)
Vazant Consulting (CA). 25 years EA practice. ~250 active clients. All Position
Library content, every tax-position classification, every cited-authority
decision routes through Antonio. Currently defending two active 2026 IRS audits
using Docket as the substrate. Real PTIN. Real risk. Real signal.

[substrate row, smaller type, single line callout]
Backed by 28 PROD migrations, RLS at ENABLE+FORCE, per-tenant DEK encryption,
cryptographic audit chain with nightly tamper verifier, Bedrock fallback verified
end-to-end, 12-doc SOC 2 Type II policy set in docs/security/.
```

---

## Section 5 — FAQ

```
[eyebrow]
FAQ

[H2]
The questions every EA asks.

[accordion list, collapsible items]

Q. What if my return has no defensible deductions to surface?
A. Then we tell you that. The PDF is the artifact of running the Position
Framework. If the return is already tight, that is the answer. You keep
the PDF. We part ways. We do not pretend to surface positions that are
not there.

Q. Is my redacted return data secure?
A. Yes. The Discovery Scan runs in our SOC 2 Type II-aligned substrate
(RLS at ENABLE+FORCE, per-tenant DEK encryption with AAD binding to
tenant_id + client_id + path, cryptographic audit chain with nightly
tamper verifier, encryption at rest and in transit). After 7 days, the
return is deleted. Full security posture at docs/security/.

Q. What if I do not want to commit to the $250/mo founder rate?
A. You do not have to. The scan is free, the PDF is yours, and there is no
obligation. We expect 30-50% of prospects to walk away with just the PDF.
That is the deal.

Q. Can I send multiple returns at once?
A. One per prospect, first time. After signing for the founder tier, you
can run scans on every return you prep.

Q. What states do you cover?
A. Federal first (IRS authority library is the priority). California state
coverage is in the seed library. Other states are flagged as out-of-scope
in the PDF with a "we do not cover this state's position library yet"
note. Honest-about-limits per the Coverage Map at docket.com/coverage.

Q. What is the difference between this scan and a tool like Deduction or
Perplexity Computer for Taxes?
A. Those tools are consumer-side. They help individual taxpayers find
deductions. Docket is built for the preparer's side of the desk. Every
position cites primary authority. Refuses below Reasonable Basis. Generates
the audit defense file. Different product, different audience.

Q. Why are you only offering this to the first 30?
A. Because the manual review gate on the Discovery agent is in place for
the first 30 scans (David personally reviews every output before delivery).
After 30, the gate lifts and capacity opens up. By then, the founder cohort
will be partially filled and the next 50 spots are at $350/mo.

Q. What happens after I run the scan?
A. We email you the PDF within 24 hours. If you want to talk through it,
you book a 20-min walkthrough. If you want to lock the $250/mo founder
slot, you can do that without the walkthrough. If neither, we leave you
alone unless you reach out.
```

---

## Section 6 — The form (sticky on scroll)

```
[H2, after Section 5]
Ready for your scan?

[form panel, cream background, forest green submit button]

FIRST NAME [text, required]
LAST NAME [text, required]
FIRM NAME [text, required]
DESIGNATION [select, required] — EA / CPA / PTIN-holder / Other
FIRM SIZE [select, required] — Solo / 2-5 preparers / 6-10 / 11-20 / 21+
TAX PREP SOFTWARE [select, required] — OLT / Drake / ProConnect / UltraTax / Lacerte / CCH / TaxAct / Other
EMAIL [email, required]
PHONE [tel, optional]
LINKEDIN URL [url, optional]
RETURN UPLOAD [file, optional this step — we send upload link separately] — PDF only, max 25MB
HEARD ABOUT DOCKET VIA [select, required] — Boney-Henderson / cold email / LinkedIn / NAEA event / r/taxpros / Tax Twitter / referral / search / other

[checkbox, required]
☐ I confirm the upload will be redacted of client PII (name, address, SSN, EIN, bank account numbers).

[submit button — forest green, large]
→ Run my scan

[microcopy below button]
We will email you a secure upload link within 5 minutes.
Your data is encrypted at rest with per-tenant DEK + AAD-bound AES-256-GCM
and deleted 7 days after scan delivery.
```

---

## Footer

```
[footer, dark warm-gray oklch(18% 0.01 85), cream text]

DOCKET
The AI defense layer for tax practices.

[3-column links]

PRODUCT          COMPANY          LEGAL
- Coverage Map   - About          - Terms
- Pricing        - Founders       - Privacy
- API (Path 2)   - Contact        - Security
                                  - WISP

[bottom row, small type]
david@docket.com · docket.com · © 2026 Docket
Compliance-first AI for the PTIN-carrying practice.
```

---

## Implementation notes for Haokun

| Element | Production note |
|---|---|
| H1 typography | Fraunces 56-72px responsive; line-height 1.05; tracking -0.02em |
| Body typography | DM Sans 16-18px; line-height 1.5; tracking 0 |
| Canvas | `oklch(98% 0.01 85)` (cream) |
| Primary CTA | `oklch(42% 0.09 150)` (forest green) bg + white text + 12px radius + 14-20px padding |
| Form server action | Next.js server action -> writes to `prospects` table (new migration) + sends transactional email via Resend (free tier) -> sets stage = `scan-offered` in CRM mirror table |
| Upload link | Presigned R2 URL pattern (already used in client portal). 72h expiry. 25MB max. PDF/PNG/JPEG MIME only. |
| Analytics events | `scan_form_view`, `scan_form_submit`, `scan_pdf_uploaded`, `scan_pdf_delivered`, `scan_demo_booked`, `scan_signed_founder_tier` |
| Mobile responsive | Single column under 768px. Form moves to full-width modal CTA from the sticky footer. |
| Performance budget | LCP < 1.5s on 4G; CLS < 0.05; FID < 100ms. Image lazy-loaded. Font-display: swap. |
| Accessibility | All form fields with labels + aria-describedby. Color contrast 4.5:1 minimum. Skip-to-form link at top. |

---

*Created 2026-05-11. Voice-pass with David before production deploy. Update with real conversion numbers after first 100 form submits.*
