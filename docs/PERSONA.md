# Persona — Antonio at Vazant Consulting

## Who he is
California EA running both **tax preparation AND representation work** (the full lifecycle: prep → represent → defend). Already uses browser automation in current workflows.

## His stack
- **OLT (OnLine Taxes)** — primary tax prep software. No public API. Browser automation is the only integration path. Critical: **zero AI-native competitors integrate with OLT** — this is a forced moat for Docket.
- **IRS Solutions** ([irssolutions.com](https://www.irssolutions.com/)) — tax resolution platform. Auto-fills and e-signs 2848 / 8821. Pulls IRS transcripts. IRS Advance Notice (IAN) monitors client transcripts for liens, audits, OIC activity, installment changes. OIC calculator trained on IRM.
- **Xero** — bookkeeping. API-first.

## Why this stack matters for Docket
- Antonio does both prep + rep, so Docket spans both pillars from v1 (not "prep first, rep later")
- OLT browser automation = forced integration moat (no AI-native targets it)
- IRS Solutions integration via browser automation gives rep-pillar capability without us building 2848/transcript/OIC plumbing ourselves
- Xero feeds practice intelligence (revenue, AR, margin per client)

## Pain (what to solve first)
1. **Mental load** across many simultaneous engagements
2. **Inbox/phone tax** — replies pulled from real client status
3. **Doc chasing** — knowing who's missing what, batching reminders
4. **Margin/friction blindness** across the book
5. **Audit-trail-as-armor** — timestamped receipts of every promise
6. **Notice-response volume** — off-season recurring revenue

## What he is NOT
- Not a CPA at a 12-person advisory firm
- Not a return-prep automation buyer (the Black Ore/Accrual ICP)
- Not someone who reads memos
- Not enterprise — pricing must be in his band ($99–$299/mo or $10–25k Foundation)

## The earlier "Maria" framing
We earlier used a hypothetical persona named "Maria" — 58-year-old EA in Riverside, 240 clients, mostly Latino small business owners, 70 hr/week busy season, runs practice on WhatsApp. **That was illustrative.** The real partner is Antonio. Where they conflict, Antonio wins. Where the underlying truth holds (solo/small-firm EAs are mental-load-bound, not research-bound), it still anchors the product.

## The wedge agent for v1 (decided in Antonio discovery week 1)
Three candidates ranked:
1. **Notice triage + draft response** — highest value if rep work is volume-heavy
2. **Doc-chase across active clients** — highest value during prep season
3. **Return-prep handoff into OLT via browser automation** — highest demo value, the "holy shit" moment for prospects

Pick one based on what hurts Antonio most.

## California-first knowledge layer
Antonio is in California, so the tier-1 knowledge base ingests:
- IRS forms/instructions/pubs + Title 26 + Treas. Regs + IRB + IRM + Tax Court
- **California FTB** forms/pubs/Legal Rulings + Residency & Sourcing Technical Manual + procedure manuals
- **CDTFA** (sales/use tax) and **EDD** (payroll/worker classification) where rep work touches them

Expand to other states as we add design partners outside California.

## Design source
Mobile-first 390×780 iOS portal at `C:\Users\minse\Downloads\docket-portal-design\` — 36 screens already authored for Vazant Consulting. Antonio's headshot in `assets/antonio.webp`.

Editorial cream + forest green oklch (150 hue) + Fraunces serif + DM Sans body. Already ported to `packages/ui/`.
