---
name: Docket Tech Foundation (locked decisions)
description: Locked architecture decisions for Docket — Claude Agent SDK substrate, MCP gateway, browser automation, deterministic rules, multi-tenant from day 1
type: project
originSessionId: d8e77b0b-2644-4132-9c90-4769d6f50780
---
Architectural lock-ins. These should NOT change as we build out:

**Reasoning + tool orchestration substrate: Claude Agent SDK.**
- MCP-native, deepest tool integration
- Lifecycle hooks (sessions, sub-agents, tool gates) map directly to Docket's trust escalation model
- Same tech FluentOS uses (proven productized-consulting pattern)
- Pairs cleanly with Computer Use for browser automation
- DON'T anchor everything to it — write our own thin orchestrator on top for: multi-tenant isolation, practice ledger, audit trail, agent fleet abstraction, MCP tool registry

**Integration substrate: MCP gateway as only abstraction.**
- Browser automation AND API integrations both wrapped as MCP tools
- Agent doesn't know or care which path is used
- Build-vs-adopt rules: vendor has open API + friendly → adopt community MCP server; vendor has API but hostile → don't bet on them, design around; vendor has no API (Drake, OLT) → build browser-automation MCP server ourselves; custom abstraction → always build

**Primary integration mechanism: browser automation.**
- Computer Use / Playwright underneath
- Vendor-neutral, works against any system
- TaxGPT/Filed/Grove validate the pattern
- Design partner already operates this way
- Plan for "browser automation reliability" engineering practice from day 1
- Credentials and security: SOC 2 Type 2, encrypted credential vault, scoped per-action authorization

**Rules layer: deterministic engine OUTSIDE the LLM.**
- LLM reasons, graph knows, rules calculate, tools act
- Tax calculations, threshold/phaseout logic, form mappings → TypeScript rules engine, never the model
- Never let Claude do tax arithmetic on a return

**Knowledge layer: versioned tax graph.**
- Postgres + pgvector + graph metadata
- Schema: Authority · TaxConcept · WorkflowObject · FactPattern · DecisionRule · PlanningStrategy
- Effective-date versioning on every authority chunk from day 1
- Tier 1 (IRS/FTB primary) only for v1; Bloomberg/CCH/Checkpoint deferred until usage gaps demand it
- Internal playbooks (tier 3) are the real moat

**Multi-tenant from day 1.** Even consulting builds live on multi-tenant infra so they collapse into the platform later. No snowflakes.

**Inference / model providers:**
- Direct Anthropic API + ZDR for v0 and most production tenants
- Per-tenant Bedrock flag for compliance-tier customers (later)
- Orchestrator is provider-agnostic from day 1 (one env flag flips the path)
- Model tiering: Haiku 4.5 for extract/classify, Sonnet 4.6 for most agent runs, Opus 4.7 only for hard reasoning / outcome prediction
- Prompt caching aggressive on system prompts, knowledge context, playbook bundles
- Batch API for async work (morning brief generation, doc classification overnight)
- Per-call cost telemetry in orchestrator from first commit (tag every call with tenant + agent + action class)

**Dev cost discipline (locked — target: $50/mo API spend until first paying customer, plus existing Claude Code Max subscription):**
- **Claude Code Max ($100/mo, already paid)** is the primary dev tool. All code-writing, debugging, file editing routes through it. Absorbs ~80% of build cost.
- **Default test model: Haiku 4.5.** Every prompt iteration runs on Haiku (~4× cheaper than Sonnet). Promote to Sonnet only for end-of-week integration tests.
- **Prompt caching wired into orchestrator from first commit.** System prompts and long-context bundles cached aggressively (80–90% cost reduction on repeated calls).
- **Computer Use deferred to week 7+.** The first 6 weeks of build are cheap (Morning Brief, knowledge layer, agents, orchestrator) — no expensive browser-automation API calls.
- **External integrations mocked during dev** via VCR-style cassettes / fixtures. No firing real Computer Use against OLT 200×/day to test logic.
- **Free-tier infrastructure** until first paying customer: Neon Postgres free tier (or local Docker), Vercel Hobby, Clerk free (≤10k MAU), Cloudflare R2 (~$0/mo at v0 scale).
- **Per-tenant cost telemetry from day 1** — every API call tagged with tenant + agent + action class. Soft + hard usage caps prevent any one tenant from blowing margin.

**Why $50/mo is achievable:** Hello-world cost $0.0005. Even 200 Sonnet runs/day × 30 days = ~$30/mo. Haiku-first dev with caching brings it to ~$10–$20/mo. The expensive class of calls (Computer Use) is deferred to phase 3 of the build.

**How to apply:** Before writing a new test or running an iteration, ask: (1) can this run on Haiku? (2) is the system prompt cached? (3) is the external API mocked? (4) am I about to run Computer Use without a real demo reason? If yes to #4, stop.

**Language: TypeScript end-to-end.** Python only for ingestion if Node PDF libs fall short — wrapped as a service, not a fragmented stack. Junior dev's FastAPI/Python instinct rejected because Docket is B2B SaaS-with-Claude, not ML-first.

**Auth: Clerk** with phone-based SMS OTP (Twilio backed) + organizations primitive for multi-tenant.

**KYC: Stripe Identity** required before 8879 e-signing (IRS mandate for individual e-file authorization). One-time per client, ~$1.50–$2.00. Webhook unlocks signing flow.

**Frontend: Next.js 15 App Router + Tailwind v4** for layout/utilities, but **custom Docket design tokens** (NOT default shadcn aesthetic). Design system primitives ported from `tokens.jsx` (Fraunces serif, DM Sans, editorial cream + forest green oklch). Inline styles preserved for design-locked components; Tailwind for new layout work. Both apps consume from `packages/ui/`.

**Repo structure:** Monorepo at `C:\Users\minse\projects\docket\` (local) → `child-docket` private GitHub repo.

**Audit trail: first-class, every tool call logged with who/what/when/citation.** This IS the product (armor against clients, regulatory hardening). No shortcuts.

**Trust escalation: Level 1 (suggest, every action approved) → Level 4 (full autopilot for known patterns)** per practice, per agent, per action class. Already in [Docket AI Layers memory](project_docket_ai_layers.md).

**What we explicitly REJECTED as base:**
- OpenClaw — personal AI, single-tenant, full-trust permission model. Adopt patterns (local gateway, messaging-as-UI), not codebase.
- Hermes Agent — same problem. Adopt the skills/learning loop concept (write reusable skill docs, search past), not the framework.
- LangGraph — overkill for our orchestration; pick later if checkpoint/time-travel becomes critical
- CrewAI — nice prototyping DSL, you'll outgrow it
- Mastra — option B if we go TS-only and need serverless

**Why:** These decisions interlock — changing one (e.g., abandoning MCP) forces re-architecture across all the others. The substrate is small enough that we can ship fast; the orchestrator on top is where Docket's IP lives.

**How to apply:** Before introducing a new framework, library, or abstraction, check: does it sit ABOVE the substrate (fine) or replace part of it (requires re-evaluation)? Default answer: build on top, don't replace.
