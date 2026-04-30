---
name: Docket Strategic Anchor (Apr 30, 2026)
description: Master strategic synthesis — vision, business model, tech foundation, design partner, what NOT to do. Full brief lives at C:\Users\minse\OneDrive\Desktop\Docket-Project-Brief.md
type: project
originSessionId: d8e77b0b-2644-4132-9c90-4769d6f50780
---
**Vision:** Docket is the agentic operator for a tax practice. Top-tier preparer-grade AI animates every surface; drives the existing tax stack (OLT, IRS Solutions, Xero, etc.) via browser automation. Pitch: *"Your practice. Every tool. One operator."*

**Business model — dual flywheel (Palantir/Foundry pattern):**
- **Today (services):** AI engineering for tax practices. Forward-deployed builds. $10k–$25k Foundation + $2k–$5k/mo retainer. Reference: [FluentOS](https://www.fluentaiconsulting.com/fluentOS).
- **Tomorrow (platform):** Docket the tax practice OS. After 5–15 engagements, ~70% module reuse → SaaS unlocks at $99–$299/mo + usage.
- Every engagement runs on the same multi-tenant substrate. No snowflakes.

**Two product surfaces:**
1. Command Room (preparer's main pane) — morning brief, pipeline, unified inbox, practice intelligence, outcome prediction, command palette
2. Client Portal (taxpayer-facing) — AI-mediated, every AI action gated by the preparer

**Locked tech decisions:**
- Repo: `C:\Users\minse\projects\docket\` (local) ↔ `child-docket` (private GitHub)
- Substrate: **Claude Agent SDK** (same tech FluentOS uses)
- Language: **TypeScript end-to-end** (Python only for ingestion if Node libs fall short)
- Inference: **Direct Anthropic API + ZDR + prompt caching + model tiering** from day 1. Bedrock as per-tenant flag for compliance customers later. SOC 2 Type II audit by year 2.
- Integration: **MCP gateway** as only abstraction; browser automation + APIs both wrapped as MCP tools
- Primary integration: **browser automation** (Computer Use / Playwright) — works against any system
- Rules: **deterministic engine outside the LLM** — LLM reasons, rules calculate
- Knowledge: **versioned tax graph** (Postgres + pgvector + graph metadata), IRS + CA FTB tier 1
- Multi-tenant from day 1, audit trail on every tool call
- Outcome prediction: partner Blue J API v1 → native model on practice ledger by year 2
- Auth: **Clerk** with phone-based SMS OTP (Twilio)
- Payments: **Stripe** (deposit) + **Stripe Identity** (KYC for 8879 e-signing)
- Storage: Cloudflare R2
- Background jobs: Inngest
- Frontend: Next.js 15 App Router + Tailwind v4 + custom Docket design tokens (no default shadcn aesthetic)

**Design partner:** **Antonio at Vazant Consulting** — California EA running both prep + rep work. Stack: **OLT + IRS Solutions + Xero**. Already uses browser automation in current workflows. (Earlier "Maria" framing was a hypothetical persona; real partner is Antonio.) OLT = forced moat integration. IRS Solutions = the rep pillar — we orchestrate, don't replace.

**Design source:** Mobile-first iOS portal at 390×780. 36 screens across intake (31 screens, 13-step flow) + returning portal (5 tabs: home/docs/messages/signatures/profile). Editorial cream + forest green oklch + Fraunces serif + DM Sans. Source files: `C:\Users\minse\Downloads\docket-portal-design\` (extracted from Downloads zip).

**The seven white-space bets (ranked):**
1. PM × return intelligence union (nobody owns both)
2. Mediated taxpayer portal (PM incumbents treat portal as doc-drop)
3. EA representation rights pillar (2848/8821/transcripts/notices)
4. Bilingual + voice-aware substrate (Spanish/Mandarin/Vietnamese as config)
5. Practice intelligence as paid module ($99–$299/mo standalone)
6. YoY change explainer + source-to-return traceability
7. OLT integration as a moat (every other AI-native skips OLT)

**Explicit NOs:**
- Not competing on autonomous return prep for big firms (Black Ore / Accrual / Basis lane)
- Not building a consumer tax filer (Deduction / Taylor / Perplexity / Rally lane)
- Not WhatsApp in v1 (SMS + email + voice + portal chat is enough)
- Not building a return calculation engine (OLT/Drake do that)
- Not OpenClaw / Hermes as a base (personal AI, not multi-tenant B2B)
- Not Bloomberg/CCH/Checkpoint editorial year 1 (tier 1 + internal playbooks)
- Not default shadcn aesthetic — design fidelity is non-negotiable
- Not Claude Code CLI subscription as production inference (against ToS, can't multi-tenant, no SLA)

**Why this matters:** The well-funded AI-native competitors ($235M+ combined) are economically forced up-market. They cannot serve Antonio's segment. The PM incumbents (TaxDome/Canopy/Karbon) ship shallow AI features but lack return intelligence. The third layer — practice + relationship + rep — is open. Docket's structural lane.

**How to apply:** When building any new feature or engagement, check: (1) does it run on the multi-tenant substrate? (2) does it produce reusable platform IP? (3) does it fit the seven white-space bets? (4) does it fall under any explicit NO? If a "yes" to #4 or "no" to any of #1–3, refuse the work or rescope.

**Boot-up doc:** `C:\Users\minse\OneDrive\Desktop\Docket-Project-Brief.md` — full strategic brief.
