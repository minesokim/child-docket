# Landing page copy — production-ready body copy for every public surface

> *Drop-in copy for Docket's marketing site. Every page below maps to a real route + an acquisition goal.*
> *Locked 2026-05-11. Re-read every Friday during the 100-by-8/1 sprint.*

This directory is the source of truth for **what's on the page**. Voice + framing rules live in [`docs/MARKETING-FRAMES.md`](../MARKETING-FRAMES.md). Page-level structure + technical wiring lives per-file. Pricing math lives in [`docs/PRICING-PAGE-SPEC.md`](../PRICING-PAGE-SPEC.md).

---

## Files

| File | Route | Audience | Acquisition role |
|---|---|---|---|
| [`discovery-scan-landing-copy.md`](discovery-scan-landing-copy.md) | `/scan` | EAs + small-firm CPAs hitting cold-outreach or Boney-Henderson referral | Volume-funnel offer. Free 24-hour Discovery Scan in exchange for redacted return upload. **The primary cold-traffic conversion surface.** |
| [`homepage-copy.md`](homepage-copy.md) | `/` | All cold traffic, mostly EAs but YC-reviewer-safe | Category-setting + frame-confirming. Hero confirms what the reader is looking at; body confirms the trust posture. Routes warm traffic to `/scan` or `/pricing`. |
| [`pricing-page-copy.md`](pricing-page-copy.md) | `/pricing` | Prospects deep in evaluation; sales-call closers | Penalty-anchored pricing math. Cost-of-Not-Using calculator is the load-bearing widget — calculator spec at [`PRICING-PAGE-SPEC.md`](../PRICING-PAGE-SPEC.md). |

---

## How to use these files

1. Pick the route. The copy file maps 1-to-1 to a Next.js page.
2. Drop the H1/H2/H3 + body text into the route's React component verbatim. **Do not "improve" the copy in-component** — drift between this file and the deployed page is the bug.
3. Style with editorial-warm portal language (Fraunces serif + DM Sans + cream canvas + forest green primary). See `packages/ui/src/tokens.ts`.
4. Voice-pass once with David. Lock by 5/25 (production-ship target for `/scan`).

---

## Universal copy discipline (applies to every page)

Per [`docs/MARKETING-FRAMES.md`](../MARKETING-FRAMES.md) + CLAUDE.md §19 anti-AI-slop:

- **No em dashes.** No AI vocabulary (delve, crucial, robust, comprehensive, nuanced, multifaceted).
- **One claim per paragraph.** If you need to say two things, that's two paragraphs.
- **Real names. Real numbers. Real cites.** "Antonio Vazquez, EA, Vazant Consulting, ~250 active clients, defending two active 2026 IRS audits" beats "our design partner."
- **Penalty-anchored pricing appears on every page where price is mentioned.** $650/failure §6695(g), $250/mo founder rate, "one prevented penalty pays for half a year."
- **CTA is always a real button** with a real route ("Run my scan" → `/scan`; "Lock my founder slot" → `/sign-up`; "See the math" → `/pricing#calculator`).
- **No decorative AI imagery.** No abstract neural-network gradients. Editorial photography of real people, real screens, real numbers.

---

## Update discipline

Each copy file gets refreshed when:
- A new positioning surface is added (e.g., Path 2 partner page)
- Revenue tier hits ($5K / $10K / $25K MRR)
- A new product capability ships that changes what's on offer
- Antonio's case study evolves (new audit, new outcome)
- A competitor moves and the differentiation tightens

Drift between these files and the deployed site is the bug this directory is designed to prevent.

---

*Last reviewed: 2026-05-11. Voice-pass each file with David before public launch.*
