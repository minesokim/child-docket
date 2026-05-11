# Marketing Frames — locked

> *The one-liner + 3 supporting frames + use/never-say lists for every external-facing surface.*
> *Locked 2026-05-11 (post-AI-defense-layer thread).*

This doc is the canonical voice + framing reference. Pitch decks, landing pages, sales emails, Loom titles, Twitter bios — all pull from here. When in doubt, re-read.

---

## ⭐ The locked one-liner

> **Docket is the AI defense layer for tax practices.**

That's it. Eight words. Person-readable in <2 seconds.

**Why "AI defense layer"** (not "AI assistant," not "AI co-pilot," not "AI agent for tax"):

- **"Defense"** is the orientation. Every other AI tax tool sells offense ("find more deductions," "save more money," "maximize your refund"). We sell defense: every position the AI surfaces carries cited authority, every action lands in an audit trail, every position above Reasonable Basis refuses by default. The PTIN — Antonio's professional license — is what we defend.
- **"Layer"** signals what we are structurally. We're not the tax software. We're not the practice management. We're the intelligence + audit substrate that sits between the firm's existing stack and the agent fleet that operates on it. Path 2 (L1) makes this literal: public API + MCP server means other AI tax tools can plug into Docket's defense layer too.
- **"For tax practices"** is the segment. Not consumers. Not Big-4. Solo EAs through mid-market firms — the lane the funded competitors are economically forced out of.

**Anti-frames the one-liner deliberately rejects:**
- "AI tax prep" → wrong category (Black Ore / Accrual / Basis lane)
- "AI accounting assistant" → wrong audience (consumer / small business owner)
- "AI for your tax firm" → too generic, sounds like AI-bolt-on-PM
- "Tax automation platform" → loses the compliance frame, sounds like Zapier

---

## The 3 supporting frames

When the one-liner has 30 seconds to land — pitch, deck, landing page hero — pair it with one of these three depending on audience.

### Frame 1: Compliance-First (Antonio's segment, EAs + small-firm CPAs)

**Headline support:**
> *"Catches every defensible deduction your team would have caught with unlimited time — and refuses everything below Reasonable Basis. Audit trail on every position."*

**Why this frame for this audience:**
- EAs at the down/mid-market segment cannot adopt a loophole-finder tool. Their PTIN is on every return.
- The Position Framework (4-tier confidence: Settled / Substantial / Reasonable Basis with 8275 / More Likely Than Not, plus refusal floor) IS the product differentiator. Big-4-targeted competitors sidestep this because in-house tax counsel handles the compliance line. **Nobody at this segment is building the compliance-first frame.**
- "PTIN-safe AI" is a phrase that means something to EAs and means nothing to anyone else. Use it in EA-facing copy. Skip for general audiences.

**The line you can repeat:**
> *"AI that defends your PTIN."*

### Frame 2: Closed-Loop OS (mid-market firms, partner #2 candidates)

**Headline support:**
> *"Your preparer doesn't talk to an AI chat surface. The AI surfaces what needs attention — the preparer decides. Every artifact captured. Every action reversible. Memory scoped to the client."*

**Why this frame for this audience:**
- Mid-market firms have already tried AI chat tools and bounced. The chat surface is the wrong UX for a 100-staff regional firm. They want intelligence acting on real client state with the partner approving outcomes — not a Slackbot.
- The L9 lock (NO AI-as-chat-character) is structurally what this frame markets.
- "Memory scoped to the client" (from L2 / §1) is the line that lands for managing partners who have watched institutional knowledge walk out the door when senior staff retire.

**The line you can repeat:**
> *"Your practice. Every tool. One operator."*

### Frame 3: Orchestration / Path 2 (developer / partner-tier API users)

**Headline support:**
> *"Public API + MCP server. Embed Docket's compliance + audit + Position Framework in your AI tax tool. Built on Claude, ZDR + Bedrock fallback for resilience. SOC 2 controls in codebase."*

**Why this frame for this audience:**
- Path 2 (L1) is the swing-for-unicorn bet — the orchestration platform play that turns Docket into the substrate the entire AI tax stack runs through.
- This audience is technical and skeptical: they want to see real architecture, not marketing. Lead with the substrate facts (Claude + ZDR + Bedrock + SOC 2).
- API tier pricing (Developer free, Partner $999/mo, Platform custom — per L6) lives behind this frame.

**The line you can repeat:**
> *"The compliance + audit substrate for the AI tax stack."*

---

## Use / Never-Say lists (locked)

### ✅ Use freely
- "The AI defense layer for tax practices."
- "AI that defends your PTIN."
- "Catches every defensible deduction your team would have caught with unlimited time."
- "Audit trail built in for every position taken."
- "Compliance-first AI that won't put your PTIN at risk."
- "The only tax AI where every action is reversible and audit-defensible."
- "Type what you want watched. Watch it forever." (AI Tasks, v1+)
- "Your practice. Every tool. One operator."
- "Memory scoped to the client."
- "The closed-loop AI for tax practices."
- "Refuses everything below Reasonable Basis."
- "Every position cited. Every action audit-trailed."

### ❌ Never say
- "Maximize your client's refund." → wrong audience signal, repels EAs
- "Find loopholes." → attracts evaders, repels professionals
- "AI does your taxes." → black-box framing, opposite of what we sell
- "Deeper than any CPA." → table stakes by 2027, weak headline
- "Bloomberg Terminal alternative" energy → not our category
- "Saves you time" without qualification → every AI tool says this; says nothing
- "Revolutionary," "game-changing," "next-gen" → AI vocabulary, scrub on sight
- "Practice management with AI" → wrong category (PM is dying, we're not that)
- "Tax automation" → too generic, loses the compliance frame
- "AI co-pilot" → already saturated (GitHub Copilot, Microsoft Copilot, etc.)
- "Chat with your tax firm" → violates L9 NO-AI-as-chat-character lock
- Any borrowed swagger from generic AI marketing language

---

## Audience-mode quick reference

| Audience | Lead with | Avoid |
|---|---|---|
| Solo EA (Antonio segment) | Frame 1 — Compliance-First, PTIN defense | "Practice management" language; Big-4 references |
| Small-firm CPA (1-10 staff) | Frame 1, soft-pitch Frame 2 on retention | Tax-prep-only framing |
| Mid-market regional firm (20-100 staff) | Frame 2 — Closed-Loop OS | "Replace your team" language |
| Tax franchise corporate (Liberty Tax / Jackson Hewitt) | Frame 2 + custom licensee language | Storefront-only language |
| Developer / partner-tier API | Frame 3 — Orchestration / Path 2 | Marketing fluff; lead with architecture |
| Investor / accelerator | Path 2 narrative + the compliance-first moat | Hyper-fast-growth language without unit economics |
| Press / public | Frame 1 + the "we don't do consumer tax" guard | Anything that implies competition with TurboTax/H&R |

---

## Client-facing marketing — **not Docket's job**

Antonio's firm (and every firm using Docket) sets its own client-facing posture. We give every firm the **range** of positions to take; the firm chooses its own posture within compliance. Marketing copy aimed at the taxpayer (the firm's client) is the firm's own work. We don't ship templates or assets for that surface.

---

## Where the framing lives in code

- L3 lock (5 capability pillars) — `CLAUDE.md` §🔒
- Position Framework — `docs/POSITION-FRAMEWORK.md` (the mechanism behind Frame 1)
- Marketing positioning section — `docs/PRODUCT-ROADMAP.md` §6
- Pricing tiers (the Frame 3 API tier prices) — `docs/PRODUCT-ROADMAP.md` §8

When marketing copy and the framing here disagree, **this doc wins** for external surfaces and the source files get a docs-pass on the next session.

---

*Last reviewed: 2026-05-11 (initial lock, post-AI-defense-layer thread). Re-read before any external-facing copy ships. Drift between this doc and external copy is the bug it's designed to prevent.*
