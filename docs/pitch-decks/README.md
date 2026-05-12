# Pitch Decks — audience-segmented per MARKETING-FRAMES Option B

> *Five deck scripts. Each one is a slide-by-slide structure + copy + speaker notes — drop into Pitch / Figma / Keynote / Slides for design.*
> *Created 2026-05-11.*

---

## Files

| File | Audience | When to use | Length |
|---|---|---|---|
| [`ea-cpa-sales-deck.md`](ea-cpa-sales-deck.md) | Solo EAs + small-firm CPAs (Antonio segment) | NAEA chapter dinners · Dr. Boney-Henderson network presentations · cold-outbound Zoom demos · the 20-EA validation sprint | 10 slides |
| [`yc-interview-deck.md`](yc-interview-deck.md) | YC partners (if invited to interview post-application) | YC interview (10 min Q&A, 0-3 slides max during interview but full deck ready for offline reference) | 12 slides |
| [`vc-preseed-deck.md`](vc-preseed-deck.md) | Pre-seed / Seed VCs (SAFE round outside YC) | Investor meetings, dataroom uploads | 16 slides |
| [`mid-market-firm-deck.md`](mid-market-firm-deck.md) | Regional CPA firm owners / managing partners (20-100 staff; partner #2 candidates) | Partner #2 candidate pitches · AICPA ENGAGE booth conversations | 12 slides |
| [`path2-partner-deck.md`](path2-partner-deck.md) | Other AI tax tool companies integrating via Docket's public API + MCP server | Path 2 Partner-tier customer acquisition · developer-to-developer technical conversations | 10 slides |

---

## Why audience-segmented decks (per MARKETING-FRAMES.md Option B)

Same product, different doors. The hierarchy:

| Audience | Lead-with framing | Why |
|---|---|---|
| YC / VC / press | "**Operating system** that runs the tax practice" | Platform potential, Path 2 upside, sounds like infrastructure |
| EA / solo CPA cold | "**AI defense layer** for tax practices" | Emotionally hot. Fits the IRS-AI-audit moment + ChatGPT-armed-clients reality |
| Mid-market firm owner | "**Closed-loop OS** that replaces 80% of junior preparer work" | Cost-discipline + risk-reduction math; FTE replacement framing |
| Path 2 partner | "**Compliance + audit substrate** for the AI tax stack" | Technical infrastructure language; for buyers who already adopted an AI tool and want the audit layer underneath it |

Use the right lead-with for the audience reading. Mixing them costs conversion.

---

## How to use these files

Each deck file is structured as:

```
## Slide N — Title
[Slide content: headline, sub-headline, bullet points, key visual notes]

**Speaker notes:**
[What David says when this slide is up. 20-60 seconds of speaking per slide.]
```

To produce the actual visual deck:
1. Open the audience-appropriate file
2. Copy slide-by-slide into Pitch / Figma / Keynote / Slides
3. Use the Docket design tokens (editorial cream + forest green oklch + Fraunces serif headings + DM Sans body) from `packages/ui/src/tokens.ts`
4. Practice the speaker notes verbatim 10-15 times before any pitch — the verbatim repetition is what makes the timing land

---

## Universal slide design discipline (applies to every deck)

Per the anti-AI-slop rules in CLAUDE.md §19 + the L9 + L11 locks:

- **No decorative AI imagery**. No abstract neural-network gradients. No "AI assistant" character. Real people, real numbers, real screenshots.
- **One claim per slide.** If you need to say two things, that's two slides.
- **Numbers are concrete.** "$650 per failure" beats "expensive penalties." "1,038-node knowledge graph audited 2026-05-11" beats "comprehensive substrate."
- **Cite primary sources on screen** when claiming a stat. The IRS Rev. Proc. cite for the §6695(g) penalty. The Pitchbook funding figure for competitors. Always link.
- **No em dashes in slide copy.** No AI vocabulary (delve, crucial, robust, comprehensive, nuanced). Per CLAUDE.md voice rules.
- **Antonio's name appears verbatim** ("Antonio Vazquez, EA, Vazant Consulting"). Real name = real customer = real proof point.
- **Speaker notes are practice scripts**, not bullet expansion. Read them out loud. Time them. Adjust until each slide lands in <60 seconds spoken.

---

## What's NOT in this set

Things deliberately deferred because the timing isn't right yet:

- **Demo Day deck** (YC). Comes after acceptance + during batch. Different format (2 min, 4-5 slides max).
- **Series A deck**. Pre-revenue → $1K/mo MRR is too early. Revisit when MRR > $50K/mo.
- **Conference talk deck** (NAEA Tax Pro Forum, AICPA ENGAGE). Use the EA-CPA deck as starting point.
- **Investor update deck** (for monthly LP updates). Different format; build when first investor is on board.
- **Press one-pager**. The MARKETING-FRAMES.md content is the press source-of-truth for now.

---

## Update discipline

Each deck file gets refreshed when:
- The strategic-conversation thread produces a positioning shift
- A new competitor lands ($X funding) that changes the "competitive landscape" slide
- Revenue crosses a meaningful threshold ($5K / $10K / $25K MRR)
- A new product capability ships that changes the "what you get" slide
- Antonio's case study evolves (new audit, new outcome, new client metric)

Re-read every deck before any pitch. Drift between the deck and the canonical docs (CLAUDE.md, PRODUCT-ROADMAP.md, MARKETING-FRAMES.md, COVERAGE-MAP.md) is the bug this directory is designed to prevent.

---

*Last reviewed: 2026-05-11. Add to STATE.md when any deck has been used in a live pitch + outcome captured.*
