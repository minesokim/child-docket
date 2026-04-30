---
name: Docket Design Partner (Antonio at Vazant)
description: First design partner — Antonio at Vazant Consulting, CA EA running prep + rep practice on OLT + IRS Solutions + Xero
type: project
originSessionId: d8e77b0b-2644-4132-9c90-4769d6f50780
---
First design partner is **Antonio at Vazant Consulting** — a California EA who does both **tax preparation AND representation work** (the full lifecycle: prep → represent → defend). Already uses browser automation in current workflows.

**Their stack:**
- **OLT (OnLine Taxes)** — primary tax prep software. No public API. Browser automation is the only integration path. Critical: zero AI-native competitors integrate with OLT, so this is a forced moat for Docket.
- **IRS Solutions** ([irssolutions.com](https://www.irssolutions.com/)) — tax resolution platform. Auto-fills and e-signs 2848 / 8821. Pulls IRS transcripts. IRS Advance Notice (IAN) monitors client transcripts for liens, audits, OIC activity, installment changes. OIC calculator trained on IRM.
- **Xero** — bookkeeping. API-first, mature MCP wrapper available.

**Why this stack matters for build order:**
- Partner does both prep + rep, so Docket spans both pillars from v1 (not "prep first, rep later")
- OLT browser automation = forced integration moat
- IRS Solutions integration via browser automation gives rep-pillar capability without us building 2848/transcript/OIC plumbing ourselves
- Xero feeds practice intelligence (revenue, AR, margin per client)

**California-first knowledge layer fits naturally:** IRS primary + CA FTB (forms, pubs, Legal Rulings, Residency & Sourcing Technical Manual) + CDTFA + EDD where rep work touches them.

**Client portal design source:** `C:\Users\minse\Downloads\docket-portal-design\` — 36 mobile-first screens already designed. Intake (13-step flow) + returning portal (5 tabs). Editorial cream + forest green oklch + Fraunces serif + DM Sans. Antonio's headshot in `assets/antonio.webp`.

**Why:** This partner represents the EA-with-rep-practice segment that is the wedge ICP. They're already paying for the existing stack and want AI to operate it, not replace it. Their browser-automation-already-in-use validates Docket's primary technical bet. The portal design is far enough along that we port it directly into v0 rather than redesigning.

**How to apply:** When prioritizing what to build first in the Foundation package, weight toward what hurts Antonio most. Three candidates ranked: (1) notice triage + draft response if rep work is volume-heavy, (2) doc-chase across active clients during prep season, (3) return-prep handoff into OLT via browser automation (highest demo value, "holy shit" moment for prospects). Decide in week 1 discovery.
