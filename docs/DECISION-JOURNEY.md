# Decision Journey

How Docket converged from "research AI-native tax startups" to its current shape. Preserved so any future session can see the WHY behind the WHAT — what we considered, what we rejected, and what reasoning sits under each lock-in.

This is a narrative companion to [CLAUDE.md](../CLAUDE.md). When CLAUDE.md says "no Bedrock from day 1" and you wonder if that should be revisited, this doc tells you we considered Bedrock for compliance posture, weighed latency + feature-lag costs, and locked the decision based on Antonio not being a compliance-tier buyer. If something changes (first compliance customer signs), revisit.

**Source:** Synthesis of the strategic conversation that produced this repo (April 2026).

---

## Phase 1 — Initial framing: "deeper than any CPA"

**Trigger:** User asked to research AI-native tax startups deeply (Accrual, Basis, Gelt, Deduction, Black Ore, K1x, Rally, April).

**First ask, verbatim:**
> "I want to make an AI with the deduction and intelligence power of deduction.com and the intelligence of Gelt. I need it to deeply understand the tax field deeper than any CPA or EA or tax attorney. It needs to be cream of the crop. I also want this AI to be agentic and do automations."

**Where we landed:** Build a tax intelligence system, not "one super-model." Four layers: knowledge / orchestration / deterministic rules / trust. Multi-agent stack (intake, doc, research, issue-spotting, planning, return-construction, review, notice, ops).

**What we rejected here:** The framing of "one giant model that knows tax better than humans." Replaced with: governed tax knowledge layer + multi-agent workflow + deterministic calculation + human-grade review. **LLM reasons, graph knows, rules calculate, tools act.**

---

## Phase 2 — Knowledge sources: "where will be the source of truth?"

**Trigger:** User asked: "What should be our source of truth for tax knowledge? How do those companies build a knowledge base that good?"

**Researched:** Bloomberg Tax, Thomson Reuters Checkpoint, CCH AnswerConnect, IRS primary sources, FTB primary sources, internal playbooks.

**Where we landed:** Tiered authority stack —
1. Primary law and agency guidance (IRS Title 26 + regs + forms + IRM + Tax Court; CA FTB + CDTFA + EDD)
2. Editorial research (Bloomberg/Checkpoint/CCH) — **deferred to year 2**, expensive, unnecessary for v0
3. Internal firm playbooks — **the real moat**
4. Consumer translation layer

Schema: Authority · TaxConcept · WorkflowObject · FactPattern · DecisionRule · PlanningStrategy. Effective-date versioning from day 1.

**What we rejected here:** Pure vector DB over PDFs ("don't store tax knowledge as a pile of PDFs"). Replaced with versioned tax graph + concept-aware retrieval.

**Locked here:** California-first ("we will start with California but will expand"). Claude Agent SDK + MCP for tool layer.

---

## Phase 3 — The first reframe: practice management, not research

**Trigger:** User pushed back: "Not exactly what we are building. We are trying to build an agentic-first, practice management in a sense?"

Then handed me a long passage about a hypothetical persona named **Maria the EA** in Riverside, 58 years old, 240 clients, mostly Latino small business owners, 70 hours/week in busy season. Verbatim from the user — see [SLICES.md](SLICES.md) for full text.

Key reframes:
- "TaxGPT solves tasks. Docket solves the day." (the user's exact framing — load-bearing)
- The currency is mental load, not research speed
- WhatsApp/Spanish/voice as substrate (later dropped WhatsApp)
- The practice ledger is the moat (every interaction, doc, payment, promise, scope-creep moment)
- Audit trail = armor against clients ("I told you to..." disputes)
- The "fire the bad client" product (margin/friction across the book)
- The "proactive co-pilot for the inbox" (47 unread emails)
- The phone tax = the single biggest hidden cost

**Where we landed:** Practice management is the lane, not return prep. Solo/small-firm EAs are the underserved market. The persona is mental-load-bound, not research-bound.

**What we rejected here:** "AI tax research/calculation engine for high-income taxpayers" framing. Replaced with: practice OS for the preparer, with tax-grade intelligence baked into every surface.

---

## Phase 4 — Slice integration: "puzzle the pieces together"

**Trigger:** User said: "Try to puzzle the pieces together. We are trying to have an amazing agentic AI bundled into a practice management. The preparer will have an AI that will be top of the line."

**The synthesis (load-bearing):**
- Slice 3 (Maria/practice) decides WHERE the AI shows up
- Slice 1 (preparer-grade depth) decides HOW SMART the AI has to be
- Slice 2 (knowledge stack) decides WHAT THE AI IS ALLOWED TO CLAIM

Pulled together: practice surfaces + preparer-grade AI engine + governed tax knowledge layer + practice ledger as moat data, all wired through MCP tools.

**Where we landed:** The same agent fleet from Phase 1 is the engine room under the practice surfaces. Six Docket intelligence layers (Comms · Documents · Pipeline · Financial · Prep/Return · Practice-level) are powered by the agent fleet. **Trust escalation model** Level 1–4.

**Open questions left for later phases:**
1. Preparer vs taxpayer in the surface (resolved later: client portal exists, AI-mediated, preparer-gated)
2. Where AI is allowed to act vs only suggest (resolved: trust escalation per tenant × agent × action class)
3. Whose workflows we copy first (resolved later: Antonio, EA-shaped)
4. AI personality across surfaces (still open)
5. Cross-tenant case memory pooling (deferred)

---

## Phase 5 — Client portal added + field research

**Trigger:** User added: "There will be a client portal web app that the taxpayers will use." Then: "Research the field of AI right now. TaxGPT recently came out with Agent Andrew."

**Researched (April 2026):**
- TaxGPT Tax Prep Agent + Agent Andrew (browser automation, ~$1.6k/seat)
- Accrual ($75M Feb 2026, every fed/state form)
- Basis ($100M Series B, $1.15B valuation, autonomous 1065)
- Black Ore Tax Autopilot (GA Apr 29 2026, top-25 firm distribution)
- K1x ($175M growth round, K-1 data layer)
- Perplexity Computer for Taxes ($17/mo consumer)
- Juno, Filed, Grove, StanfordTax, Soraban, Taxlytic, Instead, CPA Pilot
- TaxDome / Canopy / Karbon shipping AI features

**Where we landed:** Three layers of the AI-tax stack are forming:
- **Data layer** — K1x owns it. Integrate, don't compete.
- **Return-prep agent layer** — Accrual / Basis / Black Ore / TaxGPT racing. **Don't compete head-on.**
- **Practice + relationship layer** — empty for AI-native. **Docket's lane.**

**The seven white-space bets ranked:**
1. PM × return intelligence union
2. Mediated taxpayer client portal
3. EA representation rights pillar (2848/8821/transcripts/notices)
4. Bilingual + voice-aware substrate
5. Practice intelligence as paid module
6. YoY change explainer + source-to-return traceability
7. OLT integration as a moat (every other AI-native skips OLT)

---

## Phase 6 — Predictive outcomes + Command Room metaphor + engineering hell

**Trigger:** User added: "Blue J — predictive outcome tool. I also want this in our product."

Then: "Docket is the command room for the entire tax workflow... it can also do things via MCP servers... sort of like OpenClaw where you operate a lot of different things from openclaw via integrations. What do you think? Is this engineering hell?"

**Where we landed:**
- **Outcome prediction service** as a distinct capability the agent fleet calls. Partner Blue J via API for v1; build native model on practice ledger by year 2.
- **Command Room frame** — single pane shows where every client is, what the practice needs, what the AI thinks, what to do next. Every "do" routes through MCP integrations.
- **Engineering hell? No, but discipline matters.** Tractable: MCP substrate, agent fleet, command palette UX, audit trail. Hard but worth it: tax software integrations (Drake/OLT/IRS portal — no APIs), cross-system state freshness, audit ledger fidelity. Hellish (avoid): being the system of record for return calculations; supporting every tax form on day 1; custom integrations per customer.
- **MCP build-vs-adopt rules** locked.

**What we rejected here:** Anchoring the company to anyone's agent runtime SDK. Use Claude as one reasoning engine, MCP as vendor-neutral connector standard, own the orchestrator/memory/permissions/audit ourselves.

---

## Phase 7 — Browser automation + "OS not PM" pivot

**Trigger:** User said: "I think we will go the browser automation route. Especially because our client right now uses browser automation. Also Canopy released a triage feature which we were thinking of implementing but they got it first. They are all releasing AI features. Which is why we don't necessarily want to be practice management but a gray area. More of an operating system of some sort."

**Where we landed:**
- **OS, not PM.** Don't fight TaxDome/Canopy/Karbon on feature parity in PM. Sit above the existing tax stack as the agentic operator.
- **Browser automation locked** as the primary integration substrate. Vendor-neutral, works against any system, TaxGPT/Filed/Grove validate the pattern, Antonio already operates this way.
- **Canopy shipping triage isn't a threat** if Docket is the layer above — Canopy becomes a tool Docket can drive, not a competitor.
- **Pricing model cleaner under OS framing:** $99–$299/mo per preparer + usage-based add-ons (per notice handled, per return prepared end-to-end).
- **Browser automation maintenance** is a real ongoing cost. Plan for "browser automation reliability" engineer role from day 1. Credentials and security non-negotiable: SOC 2 Type 2, encrypted credential vault, scoped per-action authorization.

**What we rejected here:** Being categorized as PM (vulnerable to PM incumbents adding AI). Replaced with: agentic operator above any tax stack, system of record only for the practice ledger.

---

## Phase 8 — Dual business model + framework lock

**Trigger:** User shared FluentOS link, said: "We have a design partner/client who we're building this for. But this is the long term goal. In the short term goal, we are trying a hustle R&D route business model. Dual business model. One with way less barrier to entry of developing. We aren't selling to enterprise or even mid market but more so smaller firms. More so positioning ourselves as AI consultants or custom software guys. We are going the Palantir Foundry route."

Then asked about framework choice: Claude Agent SDK vs OpenClaw / Hermes / Viktor.

**Researched:** FluentOS architecture (Foundation 3-day + retainer + ownership path, built on Claude Code), Hermes Agent (Nous Research, skills/learning loop), OpenClaw (247k stars, personal AI), Viktor (engineering vertical), Claude Agent SDK vs LangGraph/CrewAI/Mastra.

**Where we landed:**
- **Dual business model locked.** Today: AI engineering for tax practices ($10–25k Foundation, $2–5k/mo retainer). Tomorrow: Docket platform after 5–15 engagements.
- **Substrate: Claude Agent SDK.** MCP-native, deepest tool integration, lifecycle hooks map to trust escalation, same tech FluentOS uses, pairs cleanly with Computer Use.
- **OpenClaw / Hermes rejected as base** — personal AI, single-tenant, full-trust permission model. Adopt patterns (skills loop, messaging-as-UI), not codebases.
- **Brand structure:** TBD. Two names recommended (Docket platform / parent brand consulting). Decide later.

**What we rejected here:** Raising-money-then-building-platform path (slow, expensive, no validation). Replaced with services-first revenue + each install informs platform.

---

## Phase 9 — Lock-in: "lets go claude agent sdk"

**Trigger:** User said: "I'll get the name later. OK lets go Claude Agent SDK. We want to get as close as possible to our parent product but using Claude SDK. They are on OLT, IRS Solutions, Xero. California. And yes save this to memory. Put it on Desktop so I can boot it up whenever."

**Where we landed:**
- Claude Agent SDK locked as substrate
- Antonio at Vazant Consulting confirmed as design partner (correcting earlier "Maria" hypothetical)
- Stack: OLT (browser automation only) + IRS Solutions (rep platform) + Xero (Xero MCP)
- California-first knowledge layer
- Strategic anchor saved to memory + Desktop brief at `C:\Users\minse\OneDrive\Desktop\Docket-Project-Brief.md`

**Then user added:** "Stripe Identity KYC as it is needed for signing the 8879."

**Locked:** Stripe Identity for KYC before 8879 e-signing. ~$1.50–$2/verification.

---

## Phase 10 — Tech foundation discussion

**Trigger:** User asked: "What about using Claude Code CLI instead of direct API? So it's a subscription bill instead of a giant fat bill?" Then: "What FluentOS does to make them SOC 2 certified is they do AWS Bedrock for the AI so that the sensitive data never trains the model. Is this the move? Also my junior dev talked about using FastAPI and Python backend. Take as grain of salt but is this also a good idea?"

**Researched:** Bedrock + Computer Use availability (Sonnet 4.6 confirmed on Bedrock as of Feb 2026), Claude Agent SDK Bedrock support, Claude Code subscription ToS for production multi-tenancy.

**Where we landed:**

| Decision | Reasoning |
|---|---|
| **Direct Anthropic API + ZDR** for v0 | Anthropic ZDR is a perfectly defensible compliance story. Bedrock adds 50–200ms latency, has 1–4 week feature lag, has cost markup. Antonio doesn't care about Bedrock. Build provider-agnostic so we can flip to Bedrock per-tenant when first compliance customer asks. |
| **Bedrock deferred to per-tenant flag** | Compliance-tier customers later get Bedrock. v0 doesn't need it. SOC 2 Type II audit by year 2 (~$30–60k engagement). |
| **TypeScript end-to-end (Python rejected)** | Frontend-backend cohesion, Claude Agent SDK is TS-first, Inngest is TS-native. We're B2B SaaS-with-Claude, not ML-first. Junior dev's instinct toward Python comes from ML-tutorial bias. |
| **Claude Code CLI subscription as production inference REJECTED** | Against Anthropic ToS (Pro/Max are personal, not commercial multi-tenant). No SLA. No multi-tenant attribution. Use Claude Code for DEV velocity (already paying $100/mo Max), not production. |

---

## Phase 11 — Cost shock + $50/mo discipline

**Trigger:** I projected $2k–$4k for 12-week dev. User: "Holy SHIT that is expensive. OK... I need this to be extremely cost effective. Max I can spend is like $100 or $200. Maybe we look for an alternative then. Maybe something open source. Maybe something like an enterprise version of OpenClaw somewhere out there... or a harness open source that can be customized. That is way too expensive. The best optimal path would be to develop it all in Claude Code. How do you think FluentOS did it?"

**Honest reframe:** My $2k–$4k projection assumed normal dev intensity. With discipline:
- Claude Code Max ($100/mo, already paid) absorbs ~80% of dev cost
- Haiku-first testing: ~4× cheaper than Sonnet. Default test model.
- Prompt caching: 80–90% reduction on repeated calls
- Computer Use deferred to week 7+ — that's the expensive class
- External integrations mocked during dev
- Free-tier infrastructure: Neon, Vercel, Clerk, R2

**Honest correction on harness vs model:** Switching to OpenClaw/Hermes does NOT reduce inference cost. The harness is free; the model is what costs money. Self-hosting is more expensive at our scale, not less. Quality of cheaper open-source models (Llama 3.3 etc.) is not safe for tax-correctness work.

**Where we landed:**
- Target: **$50/mo Anthropic API spend** until first paying customer
- Plus existing Claude Code Max $100/mo
- Total monthly burn during v0: **$110–$140**
- See [`COSTS.md`](../COSTS.md) for the full discipline rules

**FluentOS economics (best read):** Claude Code subscription absorbs ~80% of build cost. Customer retainers ($300–$1k/mo) cover their inference. They eat costs during build and recover quickly because they have customers within weeks (3-day Foundation), not months. Same playbook for us.

---

## Phase 12 — Scaffold

**Trigger:** "Sure lets do that. Put it on `C:\Users\minse\projects\docket\`. API key, I'll rotate it later... yes create a private GH repo, name it child-docket. Don't worry about the other existing anything Docket — we are starting fresh here."

**Built:** Turborepo + pnpm + TS monorepo. Next.js 15 client-portal + command-room. Drizzle schema (multi-tenant). orchestrator with `@anthropic-ai/sdk` + `@anthropic-ai/claude-agent-sdk`. `packages/ui` with Docket tokens. `.env.local` (gitignored). `.env.example`.

**Verified:**
- `pnpm install` clean
- Both Next.js apps build (105 kB first-load JS, 137 B per route)
- Hello-world Claude SDK: Sonnet 4.6, **$0.0005**, 1.8s latency

**Pushed:** [github.com/minesokim/child-docket](https://github.com/minesokim/child-docket) (private).

**Inline-styles question:** User asked what "inline styles approach" meant, said "I want the app and dashboard to be beautiful. I don't wanna use default shadcn look... I am looking to try to make the client intake 1 to 1 including the design."

**Locked:** Port design components AS-IS with inline styles for design-locked surfaces. Tailwind v4 for layout utilities only. NO default shadcn aesthetic. Ever.

---

## Phase 13 — gstack install

**Trigger:** User: "Do you think using gstack would be really good for this project?" then "Yes install it. I also want every single bit of important context from here to be ported to there like nothing is lost."

**Researched:** [Garry Tan's gstack](https://github.com/garrytan/gstack) — 23 specialist roles + 8 power tools, MIT-licensed, free, designed for TS+React+Playwright. Free to use (runs through Claude Code subscription, not API).

**Installed:**
- Globally at `~/.claude/skills/gstack/`
- Setup completed (Playwright + Chromium downloaded, all 40+ skills linked)
- Team mode enabled in repo (`.claude/hooks/check-gstack.sh`, `.claude/settings.json` with PreToolUse hook)
- `CLAUDE.md` upgraded from gstack stub to full project context port

**This file (DECISION-JOURNEY.md) added** so future sessions can see how we got here, not just where we landed.

---

## What this journey teaches

**Pattern 1 — Slices, not specs.** The user fed me one slice at a time (Maria, Command Room, OS-not-PM, dual business model, gstack). Each slice reframed something. The product converged through synthesis, not from a specification handed down whole.

**Pattern 2 — The destination keeps moving until enough slices stack.** "Tax research engine" → "practice management" → "agentic operator above any tax stack" → "consulting that becomes a platform." Each shift was right at the time and only obvious in retrospect.

**Pattern 3 — Cost discipline isn't optional.** The $2k → $50/mo correction was a forcing function. Discipline as a first-class engineering constraint changed how we use Haiku, prompt caching, mocking, and Claude Code itself.

**Pattern 4 — Verbatim user voice matters.** The user wrote some framings that ARE the product (`TaxGPT solves tasks. Docket solves the day.`). Preserved in [SLICES.md](SLICES.md). When in doubt, re-read those.

---

## Future revisits

When something in CLAUDE.md is "locked" today but conditions change, this is how to think about whether to revisit:

| Lock-in | Revisit when |
|---|---|
| Direct Anthropic + ZDR (no Bedrock) | First compliance-tier customer asks for Bedrock |
| Computer Use deferred to week 7+ | Browser automation phase begins (week 7) |
| Bloomberg/CCH/Checkpoint deferred | Real usage gaps in primary sources show up |
| WhatsApp deferred | A specific design partner needs WhatsApp |
| Tailwind for layout only | Never — design fidelity is non-negotiable |
| TypeScript end-to-end | Never — fragmenting the stack is forbidden |
| Claude Code subscription is dev-only | Never — production needs API |
| OpenClaw / Hermes not base | If someone builds a multi-tenant version (unlikely soon) |
| Maria → Antonio | Antonio is the real partner. Maria framing returns only as illustrative copy |

---

*Last updated: April 30, 2026. Read alongside CLAUDE.md.*
