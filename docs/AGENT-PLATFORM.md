# Docket Agent Platform — Architecture, Implementation, Integration Roster

> *Source-of-truth for the agent runtime, MCP gateway, skills registry, and integration policy.*
> *Reference architecture is Anthropic's Claude Cowork (launched 2026-05-13). Docket adapts the same substrate — Agent SDK + MCP + Skills — to a multi-tenant SaaS runtime with tax-vertical depth.*

**Last updated**: 2026-05-13 evening. Initial draft captures Cowork research synthesis + integration roster + build plan.

---

## 1. Reference architecture — what Claude Cowork actually is

Cowork is Anthropic's first general-knowledge-work agent product, launched January 2026 as a desktop research preview, productized for SMBs in May 2026 with a "Claude for Small Business" preset. It's built on the **Claude Agent SDK** (same SDK that powers Claude Code) and ships four composable primitives:

```
┌────────────────────────────────────────────────────────────────────┐
│ Claude Cowork = Claude Agent SDK + macOS desktop runtime + UI shell │
│ (shared substrate with Claude Code; runs locally; per-user OAuth)   │
└────────────────────────────────────────────────────────────────────┘
        │
        ├── Projects: persistent workspaces (files + chat history + scoped knowledge)
        ├── Skills:   directory-based methods Claude applies (SKILL.md spec)
        ├── Connectors: external app reach (MCP-powered, OAuth'd per-user)
        └── MCP:      open-standard protocol underneath connectors
                      (Anthropic donated MCP to the Agentic AI Foundation, 2026)
```

Anthropic's own framing: *"Projects hold context. Skills hold method. Connectors give reach. MCP is the protocol layer for custom reach."* They compose, they don't substitute.

### 1.1 Skills — the load-bearing primitive

A Skill is a **directory** containing a `SKILL.md` file with YAML frontmatter (required keys: `name`, `description`) followed by markdown instructions. Skills can also bundle scripts, templates, and data files.

**Three-tier progressive disclosure** drives loading:
- **L1** — only `name` + `description` get preloaded into the system prompt at session start. Skill becomes discoverable without burning context budget.
- **L2** — when Claude decides the skill is relevant to the user's request, the full `SKILL.md` is loaded into context.
- **L3** — bundled scripts/templates/data files are loaded ONLY when Claude navigates to them via the Bash tool.

Scripts execute **deterministically** via Bash — they don't go into context, they just run. A "monthly close" skill can do real arithmetic on financial data without burning tokens or risking hallucination.

**Cross-platform**: the same SKILL.md format runs in Claude.ai, Claude Code, Cowork, the Agent SDK, and the Claude Developer Platform. Write once, run anywhere.

### 1.2 MCP — the connector substrate

Model Context Protocol is Anthropic's open-source standard (launched November 2024) for connecting AI systems to tools and data. As of May 2026, Anthropic donated MCP to the **Agentic AI Foundation** (Linux Foundation; co-founded with Block + OpenAI; supported by Google, Microsoft, AWS, Cloudflare, Bloomberg). The official MCP Registry hosts 14,000+ servers; Anthropic's Connectors directory lists 75+ partner-vetted ones.

Three primitives per MCP server:
- **Tools** — writable actions (post invoice, send message, file form)
- **Resources** — readable data (transactions, messages, customer records)
- **Prompts** — reusable templates Claude can invoke

The Intuit + Anthropic partnership (announced Feb 2026, rollout Spring 2026) = Intuit ships an Intuit MCP server hosting QuickBooks / TurboTax / Credit Karma / Mailchimp; Anthropic products mount that server. **Anthropic doesn't touch QuickBooks data directly** — Intuit's compliance posture + auth + storage stays Intuit's. This is the model for every major vendor partnership.

### 1.3 Autonomy model — plan-then-approve, granular by connector

- User initiates each task ("close the books for April").
- Claude generates a plan (the multi-step decomposition with intended tool calls).
- User approves the plan.
- Per-tool execution: vendor-shipped connectors require explicit approval per action; user-built custom connectors can be auto-invoked.
- Audit chain captures every action (Cowork uses the desktop's local audit log; Docket uses the cryptographic `actions` table — see §2.4).

---

## 2. How Docket implements the same pattern

Docket adopts the Cowork substrate (Agent SDK + MCP + Skills) but adapts the runtime envelope for our segment:

| | Cowork (reference) | Docket (target) |
|---|---|---|
| Runtime location | Desktop app (macOS), per-user | Multi-tenant server (Inngest workers + Next.js server actions) |
| File access | Local FS, user-selected folders | Cloudflare R2 + Postgres, RLS-scoped per tenant |
| Auth model | Per-user OAuth tokens in OS keychain | Per-tenant encrypted `tenant_credentials` table (AAD-bound, AES-256-GCM, already shipped C2) |
| Approval surface | Desktop UI plan-confirm dialog | Web command-room queue (per CLAUDE.md §8 trust levels L1-L4) |
| Connector breadth | Horizontal SMB (~11 apps) | Tax-vertical deep (OLT, IRS Solutions, Drake, ProConnect, Xero, IRS Tax Pro Account) |
| Skills | Anthropic-shipped + user-authored | Docket-shipped + firm-authored (Magic Buttons surface per CLAUDE.md §4) |
| Audit | Local log file | Cryptographic chain (`chain_seq` + `prev_hash` + `row_hash` on every action, shipped C4) |

**Critical principle**: the desktop-vs-server difference is the BIG one. Cowork serves individual operators; Docket serves practices and their clients. But the substrate primitives (Agent SDK + MCP + Skills + plan-then-approve) translate cleanly to either runtime.

### 2.1 The four primitives mapped to Docket

| Cowork primitive | Docket equivalent | Status |
|---|---|---|
| **Projects** (workspaces) | Per-tenant scope (RLS) + per-client context (memories + facts) + per-engagement state | ✅ Shipped substrate (RLS, clients, engagements, client_memories, client_facts) |
| **Skills** (SKILL.md directories) | `packages/skills/` with the same SKILL.md format | ⬜ Not yet built. Closest analog: `@docket/prompts` (C6) + agents in `services/workers/src/agents/` |
| **Connectors** (per-app OAuth) | MCP gateway routing (tenantId, connector) → MCP server instance with token from `tenant_credentials` | ⬜ Paper-spec'd (CLAUDE.md §10) but not built |
| **MCP** (open standard) | Direct adoption of `@modelcontextprotocol/sdk` + per-vendor server packages under `mcp-servers/` | ⬜ Directory exists but empty per CLAUDE.md §10 |

**The substrate is ~30% built.** Multi-tenant primitives, per-tenant DEK, audit chain, RLS, agent fleet (5 agents), prompt registry — all shipped. The missing piece is the MCP gateway + Skills registry + Agent SDK migration.

### 2.2 The agent SDK migration

`@anthropic-ai/claude-agent-sdk` is already in `package.json` per CLAUDE.md §6. The current orchestrator (`services/orchestrator/runDocketAgent`, 109 LOC) wraps the direct Anthropic SDK. The migration flips it to Agent SDK but preserves:
- Cost telemetry (per-action $ tagged with tenant + agent + action class)
- Audit hook (writes to actions table with chain hash)
- Prompt caching (90% discount on cached input tokens, per L4)
- Bedrock fallback (transparent failover on Anthropic outage, shipped B1)
- Model tiering (Haiku/Sonnet/Opus selection per agent class)

**Why migrate**: Agent SDK gives us first-class tool routing through MCP, lifecycle hooks (pre-action, post-action), and the same skill-loading machinery Cowork uses. Worth ~2d of focused work.

### 2.3 The Universal MCP shape

Every external connector follows this template:

```
mcp-servers/{vendor}/
  src/
    server.ts           // MCP server entry (uses @modelcontextprotocol/sdk)
    auth/oauth.ts       // OAuth handshake → tenant_credentials encrypted
    tools/              // writable actions (post invoice, send message, etc.)
      *.ts              // each tool exports {name, description, inputSchema, handler}
    resources/          // readable data (transactions, messages, etc.)
      *.ts              // each resource exports {uri, name, mimeType, handler}
    prompts/            // reusable templates for Claude
      *.ts
  skills/               // optional: vendor-specific Skills shipped with the connector
    {skill-name}/
      SKILL.md
      scripts/
  package.json
```

The `mcp-gateway` service routes calls from the agent through this hierarchy:

```
agent → mcp-gateway → (tenantId, vendor) lookup
                  → pull OAuth token from tenant_credentials (decrypt with tenant DEK)
                  → instantiate {vendor} MCP server with token
                  → forward tool/resource call
                  → audit row written via actions table (chain hash + cost telemetry)
                  → return result to agent
```

**Result**: whether the vendor is QuickBooks (🟢 Intuit MCP server), Plaid (🟡 thin REST wrap), or OLT (🔴 browser automation), the agent sees ONE interface — MCP tools + MCP resources. Claude doesn't know which path it's on. **That's the Cowork architecture replicated, applied to tax-vertical depth.**

### 2.4 The cross-context intelligence pattern

The 1099-vs-QuickBooks-discrepancy use case (the founder's framing) is a multi-retrieval pattern:

1. Skill `tax-reconciliation` invoked from a client page (scope: client X, tax year N)
2. Skill calls `documents` MCP: list classified 1099/W-2/K-1 for this client + year
3. Skill calls `quickbooks` MCP (via Intuit): list income transactions for same period
4. Skill stuffs both result sets into one Claude context window
5. Claude reasons across them, emits structured `Discrepancy` objects with:
   - Type (`doc_not_in_qb` | `qb_not_in_docs` | `amount_mismatch`)
   - Cite to source doc chunk ID + cite to QB transaction ID
   - Dollar delta
   - Confidence score
6. Each Discrepancy persisted to `client_facts` (kind=`'discrepancy'`, source_tier=`'computed'`) — already-shipped substrate
7. Surfaces on `/clients/[id]` Open Issues section

**Refusal floor** (per Position Framework, CLAUDE.md L3): if Claude cannot cite BOTH sources for a Discrepancy, do NOT emit. Compliance-first discipline forces ground-truth citations.

**This is not architecture-novel.** It's RAG with multiple retrievers feeding one context window, then structured-output extraction with mandatory citations. The Skills + MCP substrate makes it composable: same pattern works for "Reconcile 1099s vs QB", "Reconcile bank deposits vs invoices", "Reconcile prior-year return vs current-year facts", etc.

---

## 3. Status — what's built, what's queued

### 3.1 What's actually shipped (as of 2026-05-13 evening)

| Layer | Substrate | Shipped commits |
|---|---|---|
| **Per-tenant runtime** | RLS, tenant_credentials (AES-256-GCM, AAD-bound), audit chain, cost telemetry | C1-C5 (this week), 0680874, 5b4ef92 (earlier) |
| **Orchestrator** | `runDocketAgent` with cost telemetry, prompt caching, audit hook, Bedrock fallback | 303f886 (B1), 109 LOC |
| **Agent fleet** | 5 agents — triage-classifier, inbox-drafter, discovery-agent (RAG), memory-curator, nudge-agent | Various; latest C19/C20/C7 |
| **Prompt registry** | `@docket/prompts` with hash-drift detection | fbae613, extended C7 |
| **Retrieval** | PostgresRetriever (BM25 + cosine + RRF, 7 codex rounds) | c66b0a0 (C6) |
| **Position library** | 20 positions + 115 chunks + reviewStatus gate | f13e595 (C5) |
| **Trust gate** | `assertTrustGate` helper (15 tests) | 3929fef |
| **Authority retrieval** | searchAuthorities + lookupAuthorityByCitation with reviewStatus default-deny | Shipped per C5 |
| **Projects primitive** | 4 commits this overnight (C24-C27) — drill-down + assignment + notes + archive | b028270, 96ebb76, 13cc9d6, 092b705, ad1be24 |

### 3.2 What's paper-spec'd but NOT built

| Item | Status | Effort | Blocks |
|---|---|---|---|
| **mcp-gateway service** | Paper spec only (CLAUDE.md §10) | ~3d | Every external connector |
| **`packages/skills/` registry** | Not built; Skills as a formalized primitive doesn't exist yet | ~2d | Magic Buttons, all vertical workflows |
| **Agent SDK migration** | SDK is a package.json dependency; not imported | ~2d | First-class tool routing through MCP |
| **`mcp-servers/` first servers** | Directory exists, zero servers built | ~3d each | All cross-context skills |
| **Per-firm trust escalation enforcement** | Substrate shipped (`assertTrustGate`); no consumer wiring | ~5d | Auto-execute at trust levels L2-L4 |
| **Magic Buttons UI surface** | Concept (CLAUDE.md §4); no implementation | ~3d | Firm-authored workflow library |
| **Plan-then-approve UI** | Concept; no implementation | ~3d | Cowork-style approval gate |

### 3.3 The honest gap

**The Discovery agent (C7) bypasses MCP and calls authority retrieval directly via the PostgresRetriever module.** That's fine for v0 — the substrate works — but it sets a pattern that doesn't scale. Every new agent or skill is currently a bespoke module import path. The Cowork pattern would have everything route through MCP tools.

**Recommendation**: lock the mcp-gateway + Skills registry build BEFORE the next vertical-deep agent ship. Otherwise we accumulate more bespoke-import-path tech debt that future migration has to unwind.

---

## 4. Build order — the four waves

Replace CLAUDE.md §10 + §15 Phase 4-5 with this Cowork-informed sequence. Total: ~9 weeks; maps to CLAUDE.md §15 Phase 4 (weeks 7-8) + Phase 5 (weeks 9-10) + Phase 6 (weeks 11-12).

### Wave 1 — substrate (3 weeks)

```
C28  mcp-gateway service
     - Multi-tenant scoping wrapper around @modelcontextprotocol/sdk
     - Maps (tenantId, connectorName) → MCP server instance
     - Pulls OAuth tokens from tenant_credentials (encrypted, per-tenant DEK,
       AAD-bound — already shipped C2)
     - Audit hook on every tool call → actions table (chain hash, shipped C4)
     - Routes calls to either remote MCP servers (Intuit) or local in-process
       servers (ledger, knowledge)
     ~3 days

C29  @docket/skills registry (mirrors @docket/prompts pattern from C6)
     - packages/skills/ directory; each skill is a folder with SKILL.md
     - Same SKILL.md format Anthropic ships (YAML frontmatter + markdown)
     - Hash-drift detection on load (matching the prompt registry pattern)
     - Three-tier progressive disclosure: metadata always in system prompt;
       SKILL.md on-demand; bundled scripts execute via Bun.spawn
     - Server-side loader (skills run in Inngest workers / server actions)
     ~2 days

C30  Agent SDK migration
     - Flip services/orchestrator/runDocketAgent to use
       @anthropic-ai/claude-agent-sdk
     - Tool calls route through mcp-gateway
     - Preserve existing cost telemetry + audit hook + prompt caching +
       Bedrock fallback (all shipped)
     - Backward-compatible: existing agents (triage-classifier,
       inbox-drafter, discovery-agent, memory-curator, nudge-agent) keep
       their current invocation surface during migration
     ~2 days
```

### Wave 2 — integrations (3 weeks, 5 MCP servers)

```
C31  ledger MCP server (internal)
     - tools: log_action, query_actions, get_audit_trail, get_client_state
     - resources: actions table reads (RLS-scoped)
     - Wraps existing audit + actions substrate
     ~3 days

C32  knowledge MCP server (internal)
     - tools: search_authority (wraps PostgresRetriever C6), lookup_citation,
       get_playbook
     - resources: authority chunks, position library memos
     - Reuses C5 ingestion + C6 retrieval
     ~3 days

C33  documents MCP server (internal)
     - tools: classify_doc (wraps doc-classifier), get_doc, ocr_doc,
       extract_fields
     - resources: documents table + R2 storage URLs (signed)
     ~3 days

C34  Intuit MCP for QuickBooks (adopt — Intuit ships the server)
     - Multi-tenant scoping wrapper only; Intuit hosts the server
     - Wire OAuth flow: client redirects to Intuit, callback stores token
       in tenant_credentials encrypted
     - Add quickbooks kind to TenantCredentials enum
     ~1 day

C35  Gmail MCP (adopt official Google MCP or thin-wrap)
     - Same pattern as Intuit (Google MCP server hosted; we scope it)
     - Per CLAUDE.md L10: firm's OWN Gmail via OAuth, NOT @docket.com aliases
     - 80% already shipped (existing Gmail integration); reshape as MCP
     ~2 days
```

### Wave 3 — skills (4 weeks, 5 cross-context skills)

```
C36  reconciliation skill (the founder's 1099-vs-QB use case)
     SKILL.md instructs Claude to:
       1. Call ledger MCP: list engagements + intake_responses for tax_year N
       2. Call quickbooks MCP: list transactions for same period
       3. Call documents MCP: list 1099s / W-2s / K-1s for same client + year
       4. Stuff all three result sets into context
       5. Identify discrepancies (1099 amount ≠ QB income entry ≠ intake-reported)
       6. Emit structured Discrepancy objects: client_id, source_a (ref),
          source_b (ref), delta_amount, confidence, cited authority
       7. Persist to client_facts (kind='discrepancy', source_tier='computed')
     Refusal floor: cannot cite BOTH sources → do NOT emit.
     ~3 days

C37  discovery skill (reshape C7 agent as Skill)
     - C7 already does authority-grounded discovery; this just repackages
       it as a SKILL.md that the Skills registry can load + dispatch
     ~2 days reshape

C38  notice-response skill (Notice Triage Agent paper-specced → ship as skill)
     - CP2000 / CP504 / LT11 triage
     - Pulls source notice from documents MCP
     - Drafts response with cited authority
     ~3 days

C39  pre-meeting-brief skill
     - Fires N hours before calendar_events row tagged client meeting
     - Aggregates: top-5 Memories + last-3 messages + pending TaxPositions
       + open issues + overdue payments
     - Emits 1-page brief renders on the meeting card
     ~3 days

C40  memory-curator skill (reshape C19 agent + wire to Inngest cron)
     - Background sweep extracts plain-English Memories from messages,
       intake responses, doc-classifier output, meeting transcripts
     - Writes client_memories rows tagged source_kind + extracted_by_agent
     ~2 days
```

### Wave 4 — UX (1 week)

```
C41  Magic Buttons surface in command-room
     - Settings → AI → Magic Buttons: firm composes button library
     - Each button = (Skill, scope, trust_gate_class)
     - Click in Ask Docket chat → plan generated → user approves → executes
     - Plan-then-approve UI: shows Claude's intended tool calls before
       running them
     ~3 days

C42  Per-firm trust escalation enforcement (CLAUDE.md §8 levels L1-L4)
     - Substrate (assertTrustGate) already shipped
     - Wire into mcp-gateway action-class gating
     - Firm-owner can configure: L1 (everything approved) → L4 (autopilot)
     ~2 days
```

---

## 5. Integration roster

The full universe of tax-preparer-adjacent software, categorized by integration approach:

- 🟢 **MCP available** — adopt directly (Anthropic registry or partner-shipped). 0-2 days to wrap in tenant scoping.
- 🟡 **OAuth REST API, mature** — wrap as thin MCP server. 1-3 days.
- 🟠 **Official API but limited / paid / approval-gated** — wrap-able with friction. 3-7 days.
- 🔴 **Browser automation only** — Playwright + Computer Use. 8-14 days each, brittle.
- ⚫ **No API, no automation viable** — manual workflows only.

### 5.1 TIER 1 — Core tax practice stack

**Tax prep engines** (the form-fillers):
| Vendor | Segment | Integration | Notes |
|---|---|---|---|
| Drake Tax | Solo / small EA | 🔴 Browser automation | ~70K tax pros. Antonio's competitor. No API. |
| UltraTax CS (Thomson Reuters) | Small/mid CPA | 🟠 CS Connect (partial) + 🔴 browser | Deep workflow needs browser. |
| Lacerte (Intuit) | Mid CPA | 🟡 Intuit MCP partial + 🔴 browser | Lacerte itself not in Intuit MCP yet; likely follows. |
| ProSeries (Intuit) | Solo/small | 🟡 Same as Lacerte | Bundled with Intuit Accountants. |
| ProConnect (Intuit) | Cloud solo/small | 🟡 Intuit cloud API + QBO integration | Best API surface of the Intuit suite. |
| CCH Axcess Tax (Wolters Kluwer) | Mid/large CPA | 🟠 CCH OIP API (enterprise-paid) | |
| CCH ProSystem fx | Mid/large desktop | 🔴 Browser automation | On-prem legacy. |
| ATX (Wolters Kluwer) | Small/mid | 🔴 Browser automation | No API. |
| TaxAct Professional | Solo/small | 🔴 Browser automation | |
| TaxSlayer Pro | Storefront | 🔴 Browser automation | |
| **OnLine Taxes / OLT** | Storefront EA (Antonio's) | 🔴 Browser automation | **Zero AI-native competitors integrate — forced moat per CLAUDE.md §13.** |
| Crosslink (Petz) | Franchise/storefront | 🔴 Browser automation | |

**Practice management** (day-to-day ops):
| Vendor | Position | Integration |
|---|---|---|
| TaxDome (#1, 10K+ firms) | 🟡 REST API + webhooks | Competitor — not adopt. |
| Canopy | 🟠 Limited partner API | Reseller of IRS transcript pulls (competitor). |
| Karbon | 🟡 Karbon Public API | |
| Firm360 | 🟡 Zapier + limited REST | |
| Liscio | 🟠 Partner API | Communication-strong. |
| Practice CS (Thomson) | 🟠 CS Suite integration | Tied to UltraTax. |
| CCH Axcess Practice | 🟠 OIP API | |

**IRS-facing services**:
| Service | Purpose | Integration | Notes |
|---|---|---|---|
| IRS e-Services TDS API | Transcript delivery | 🟠 Invitation-only | 12-24mo public horizon. Canopy is in. Apply early. |
| IRS MeF (Modernized e-File) | E-file returns | 🟠 EFIN + Software Developer status | Multi-month approval. v1.5+ ship. |
| IRS IRIS | 1099/1098/1042-S filing | 🟠 A2A access (newer/easier) | More approachable. |
| IRS Tax Pro Account | 2848 / 8821 / CAF | 🔴 Browser automation only | Per CLAUDE.md §15 Phase 5 (D6 descoped from v1). |
| IRS Direct Pay / EFTPS | Tax payments | 🟠 EFTPS Batch Filer API | Registered batch filer status required. |

**State tax authorities** (long tail):
| State | Integration | Notes |
|---|---|---|
| California FTB | 🔴 Browser; no taxpayer-account API | |
| California CDTFA | 🟡 Tax Rate API (public) + 🔴 account browser | |
| California EDD | 🔴 Browser automation | |
| New York DTF | 🔴 Browser automation | |
| Texas Comptroller | 🔴 Browser automation | |
| Florida DOR | 🔴 Browser automation | |
| Other 47 states | 🔴 Browser automation (typical) | Per CLAUDE.md §13 — multi-state deferred beyond CA. |

**Tax research databases**:
| Vendor | Integration | Notes |
|---|---|---|
| Bloomberg Tax (BNA Portfolios) | 🟠 Terminal API ($$$$) | Per L13 — deferred year 1. |
| Thomson Reuters Checkpoint | 🟠 Enterprise API | $$$ Big-4 pricing. |
| CCH AnswerConnect | 🟠 OIP API | Enterprise tier. |
| Tax Notes (Tax Analysts) | 🟠 Tax Notes API | $$ mid-firm. |
| PPC | 🟠 Bundled in Checkpoint | |
| IRS.gov + CALI eLangdell | 🟢 Public scrape → MCP | Per L13 — Tier 1 primary is the moat. C5 Position Library substrate already shipped. |

### 5.2 TIER 2 — Accounting + financial substrate

**Bookkeeping**:
| Vendor | Integration | Notes |
|---|---|---|
| **QuickBooks Online** | 🟢 Intuit MCP (live Feb 2026) | **The marquee adoption (C34).** |
| QuickBooks Desktop | 🟠 QBXML SDK + 🔴 RDS browser | Legacy SMB. |
| Xero | 🟡 Xero REST API (mature) | Community MCP wrappers exist. v1.5 adopt. |
| FreshBooks | 🟡 FreshBooks REST API | Smaller share. |
| Wave | 🟡 GraphQL API | |
| Sage Intacct | 🟠 Sage API (enterprise) | Mid-market push (Phase 6). |
| NetSuite | 🟠 SuiteTalk API | Enterprise. |
| Zoho Books | 🟡 REST API | International. |

**Payroll**:
| Vendor | Integration |
|---|---|
| Gusto | 🟡 Gusto Partner API + Embedded |
| ADP | 🟡 ADP Marketplace API (REST, since 2017) |
| Rippling | 🟡 Rippling API (500+ integrations) |
| Paychex | 🟡 Paychex Flex API |
| OnPay | 🟡 REST API |
| QuickBooks Payroll | 🟢 Via Intuit MCP |
| Square Payroll | 🟡 Square API (Antonio uses) |

**Bank data aggregators**:
| Vendor | Integration | Notes |
|---|---|---|
| Plaid | 🟡 Plaid API (mature OAuth) | 12,000+ institutions. SMB-fintech standard. |
| MX | 🟡 MX API | Best data cleanliness. |
| Finicity (Mastercard) | 🟡 Finicity API | Lending/income focus, VOI/VOA reports. |
| Yodlee (Envestnet) | 🟡 Yodlee API | Legacy huge coverage. |
| Codat | 🟡 Codat API | Unified across QBO/Xero/Sage + banks. |

**Payments**:
| Vendor | Integration |
|---|---|
| Stripe | 🟢 Stripe MCP (official) — currently deferred per CLAUDE.md §6 |
| Square | 🟡 Square API — already integrated (Antonio uses) |
| PayPal | 🟢 PayPal MCP (in Cowork connector set) |
| Mercury / Bluevine | 🟡 REST API |

### 5.3 TIER 3 — Workflow + communication

**E-signature** (NIST IAL2 KBA constraint for 8879):
| Vendor | Integration | Notes |
|---|---|---|
| DocuSign | 🟢 DocuSign MCP / 🟡 REST + LexisNexis KBA | Per CLAUDE.md §6 — chosen for v0 8879. |
| Adobe Acrobat Sign | 🟡 REST + LexisNexis KBA | Alt. |
| Documenso (open-source) | 🟡 REST self-hosted | Per CLAUDE.md §6 — planned v1+ replacement. |
| Dropbox Sign | 🟡 REST API | **No KBA** — fails IRS Pub 1345 for 8879. |
| BoldSign | 🟡 REST API | **No KBA.** |
| SignWell / SignNow / Eversign | 🟡 REST API | **No KBA.** |

**Document storage / portal**:
| Vendor | Integration |
|---|---|
| SmartVault | 🟡 SmartVault API (CPA-specific) |
| Liscio | 🟠 Partner API |
| Citrix ShareFile | 🟡 ShareFile API |
| Verifyle | 🟠 Limited API |
| Google Drive | 🟢 Google MCP |
| Microsoft OneDrive / SharePoint | 🟢 Microsoft Graph MCP |
| Dropbox | 🟡 Dropbox API |
| Cloudflare R2 | 🟡 S3-compatible API — **Docket's own** |

**Communications**:
| Vendor | Channel | Integration |
|---|---|---|
| Twilio | SMS / voice / MMS | 🟡 Twilio API (Antonio uses) — already integrated |
| SendGrid (Twilio) | Email | 🟡 SendGrid API |
| Resend | Email (dev-focused) | 🟡 Resend API — already integrated (C10) |
| Postmark | Email | 🟡 Postmark API |
| Gmail | Inbox | 🟢 Google MCP — 80% shipped per CLAUDE.md L10 |
| Microsoft Outlook / 365 | Inbox | 🟢 Microsoft Graph MCP |
| Slack | Team chat | 🟢 Slack MCP (official) |
| Microsoft Teams | Team chat | 🟢 Microsoft Graph |
| Front | Shared inbox | 🟡 Front API |

**Scheduling / calendar**:
| Vendor | Integration |
|---|---|
| Google Calendar | 🟢 Google MCP — planned v0 per CLAUDE.md §10 |
| Microsoft Outlook Calendar | 🟢 Microsoft Graph MCP |
| Calendly | 🟡 Calendly API — per §14 integrate, don't compete |
| Acuity (Squarespace) | 🟡 Acuity API |
| Cal.com | 🟡 Cal.com API |

**Video conferencing**:
| Vendor | Integration | Notes |
|---|---|---|
| Zoom | 🟢 Zoom MCP | Universal. |
| Google Meet | 🟢 Google MCP | |
| Microsoft Teams | 🟢 Microsoft Graph | |
| Otter.ai | 🟡 Otter API | Transcription. |
| Fathom | 🟡 Fathom API | Meeting AI. |
| Fireflies | 🟡 Fireflies API | |
| Read.ai | 🟡 Read API | |

Per CLAUDE.md §9 Notetaker Agent — V1.5 ship. Adopt Otter/Fathom rather than build.

### 5.4 TIER 4 — Business operations

**CRM / marketing**:
| Vendor | Integration |
|---|---|
| HubSpot | 🟢 HubSpot MCP (in Cowork connector set) |
| Pipedrive | 🟡 Pipedrive API |
| Salesforce | 🟢 Salesforce MCP |
| ActiveCampaign | 🟡 ActiveCampaign API |
| Mailchimp (Intuit) | 🟢 Via Intuit MCP partnership |
| Constant Contact | 🟡 REST API |
| Klaviyo | 🟡 REST API |

**Entity filing / compliance**:
| Service | Integration | Notes |
|---|---|---|
| FinCEN BOI E-Filing | 🔴 Browser; ⚫ partial deprecation | Post-2025 domestic exemption; reduced scope. State BOI laws (NY, CA) still apply. |
| CA Secretary of State (bizfile) | 🔴 Browser; partial XML | |
| DE / WY / NV SoS | 🔴 Browser automation each | |
| State Statement of Information | 🔴 Browser per state | |
| Registered Agent services (Northwest, Harbor) | 🟡 Partner APIs | Northwest has reseller API. |
| LegalZoom / Rocket Lawyer | 🟡 Partner API | Tertiary. |

**Project management** (firm-internal):
| Vendor | Integration | Notes |
|---|---|---|
| Notion | 🟢 Notion MCP (official) | |
| Asana | 🟢 Asana MCP | |
| Monday.com | 🟡 Monday API | |
| Trello | 🟡 Trello API | |
| Jira | 🟢 Atlassian MCP | |
| ClickUp | 🟡 ClickUp API | |
| Linear | 🟢 Linear MCP (community) | |

Per CLAUDE.md §4 — Docket subsumes this layer for tax firms (Need You queue + Projects + Calendar primitives).

### 5.5 TIER 5 — Document intelligence (OCR / extraction)

| Vendor | Position | Integration | Notes |
|---|---|---|---|
| K1x | K-1 / 1099 / W-2 specialist | 🟡 K1x API | $175M growth 2026; 40+ Top-100 firms. **Integration target, not competitor** (CLAUDE.md §17). |
| Hubdoc (Xero) | Receipt + bank | 🟡 Hubdoc API via Xero | |
| Dext (Receipt Bank) | Bookkeeping capture | 🟡 Dext API | 99.9% claim on Western-language docs. |
| Vic.ai | AP automation | 🟡 Vic.ai API | |
| Botkeeper | AI bookkeeping | 🟡 Partner API | |
| Greenback | SMB expense | 🟡 API | |
| Docparser / Parseur / Mindee | Generic doc extraction | 🟡 REST APIs | Build-block. |
| AWS Textract | OCR primitive | 🟡 AWS API | |
| Google Document AI | OCR primitive | 🟡 Google Cloud API | Has prebuilt W-2 / 1099 / 1040 models. |
| Azure Document Intelligence | OCR primitive | 🟡 Azure API | Prebuilt US tax document model. |
| Klippa / Doxis | Tax-doc extraction SaaS | 🟡 REST API | |

**For Docket reconciliation skill (C36)**: K1x OR Azure Document Intelligence prebuilt tax model is the right adopt-target. Per CLAUDE.md §17 — integrate K1x as the data layer rather than build.

### 5.6 TIER 6 — AI tax competitors (watchlist, NOT integration targets)

| Vendor | What | Funding | Threat tier |
|---|---|---|---|
| Black Ore | Tax Autopilot (autonomous prep, 99%) | $60M, GA Apr 2026 | Big-4/Top-25 |
| Accrual | Every fed/state form prep+review | $75M, Feb 2026 | Top firms |
| Basis | Long-horizon agents, autonomous 1065 | $1.15B val, $100M Series B | Top firms |
| Filed | Extraction + simple logic | Smaller | Mid-firm |
| Juno | Extraction + 1040 review + AI assistant | $12M seed Apr 2026 | Mid-firm, year-round HNW |
| **TaxGPT** (Agent Andrew) | Research + planning + **OLT browser automation** | Mar 2026 | **Direct browser-automation overlap — closest competitor on technical approach** |
| Stanford Tax | Workpaper assembly | Seed | Mid-firm |
| Grove / SmartRequestAI / Soraban / Taxlytic | Niche AI | Seed | |
| Gelt | Year-round HNW | $13M Series A Sep 2025 | HNW |
| Rally Tax | YC year-round HNW subscription | YC | HNW |
| Deduction / Taylor CPAI | Consumer | $2.8M Nov 2025 | Consumer (not your lane) |
| April | B2B2C embedded | $38M Series B 2025 | Wealth/payroll embed |
| Perplexity Computer for Taxes | Consumer $17/mo | Apr 2026 | Consumer |
| CPA Pilot / Instead | Notice triage / planning | Smaller | Niche |

Per CLAUDE.md §14 — do NOT compete head-on on autonomous prep for big firms.

---

## 6. Adoption priority

Per the founder's "easiest UX = OAuth MCP" preference + CLAUDE.md §10 build-vs-adopt policy:

**Build/adopt in this exact order**:

1. **Wave 1 substrate** (C28-C30) — mcp-gateway + Skills registry + Agent SDK migration. **Blocks everything else.**
2. **Internal MCP servers** (C31-C33) — ledger + knowledge + documents. Wraps already-shipped substrate as MCP tools.
3. **Marquee external adopt** (C34-C35) — Intuit QuickBooks + Gmail. Partner-shipped MCP; tenant-scoping wrapper only.
4. **Cross-context skills** (C36-C40) — reconciliation + discovery + notice-response + pre-meeting-brief + memory-curator.
5. **UI surface** (C41-C42) — Magic Buttons + trust escalation enforcement.
6. **V1.5 expansion** — Plaid (bank data) + Xero + K1x + browser-automation MCPs for OLT / IRS Solutions / IRS Tax Pro Account / CA state authorities.

**Explicit NOs** (per CLAUDE.md §13/§14):
- ❌ Drake desktop browser automation (tertiary segment; deferred)
- ❌ CCH ProSystem fx (legacy on-prem-only)
- ❌ Bloomberg Tax / Checkpoint / CCH AnswerConnect (enterprise pricing; deferred year 1 per L13)
- ❌ Lacerte desktop (Intuit cloud surfaces preferred)
- ❌ Multi-state beyond CA (deferred until mid-market partner #2)
- ❌ Compete with AI competitors on autonomous prep for top firms (per §14)

---

## 7. Open questions / decisions queued

1. **When does mcp-gateway ship?** Currently paper-spec'd in CLAUDE.md §10 with no committed date. **Recommend C28 next ship** (after this overnight's C24-C27a Projects-primitive batch); the longer it waits, the more bespoke import paths agents accumulate.

2. **Skills registry — `@docket/skills` or `services/workers/src/skills/`?** Anthropic ships Skills as portable directories that work across Claude.ai + Claude Code + Cowork. We want server-side execution. Recommendation: `packages/skills/` (workspace package, like `@docket/prompts`) so the Skills are framework-agnostic and can be exported to Claude Code as gstack-style skill files if firms want to run them desktop-side.

3. **MCP server runtime: in-process vs separate processes?** For internal servers (ledger, knowledge, documents) — in-process inside the Inngest worker. For external (Intuit, Plaid) — remote MCP per Anthropic's "remote MCP via Messages API" feature. Hybrid.

4. **Plan-then-approve UI shape on web vs Cowork's desktop dialog?** Recommendation: render the plan inline in the Ask Docket chat (3-scope per CLAUDE.md §4) as a structured tool-call preview. Approve / Edit / Cancel buttons. Approval state stored ephemerally per session.

5. **Trust escalation enforcement timing?** L1 (every action approved) is the safe default. L2-L4 require firm-owner opt-in via Settings → AI → Trust Tier. Wire into mcp-gateway action-class gating in C42.

6. **Skill-authoring UI for firms (Magic Buttons)?** v1 ships the registry + button surface. v1.5 ships a no-code skill composer (compose existing tools + prompts into custom buttons without editing SKILL.md by hand). Defer the composer.

---

*Last updated: 2026-05-13. Initial draft synthesizes Claude Cowork architecture research (post-launch 2026-05-13) + the master integration roster + the build plan that replaces CLAUDE.md §10 + §15 Phase 4-5 with a Cowork-informed sequence. Re-read at every agent-platform decision boundary. When this doc and CLAUDE.md disagree on agent-platform architecture or integration roster, **this doc wins** until folded back into CLAUDE.md.*

## Sources (Cowork research, 2026-05-13)

- [Introducing Claude for Small Business (Anthropic, 2026-05-13)](https://www.anthropic.com/news/claude-for-small-business)
- [Equipping agents for the real world with Agent Skills (Anthropic Engineering)](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
- [Projects vs Skills vs Connectors vs MCP (Cowork Operator)](https://www.coworkoperator.com/p/projects-vs-skills-vs-connectors)
- [Plugins for Claude Code and Cowork (Anthropic)](https://claude.com/plugins)
- [Agent SDK overview (Claude Code Docs)](https://code.claude.com/docs/en/agent-sdk/overview)
- [Agent Skills (Claude API Docs)](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- [MCP connector — Claude API Docs](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector)
- [Get started with custom connectors using remote MCP](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
- [Official MCP Registry](https://registry.modelcontextprotocol.io/)
- [Donating MCP to the Agentic AI Foundation (Anthropic)](https://www.anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation)
- [Claude Connectors directory](https://www.anthropic.com/partners/mcp)
- [Intuit + Anthropic press release](https://investors.intuit.com/news-events/press-releases/detail/1305/intuit-and-anthropic-partner-to-bring-trusted-financial-intelligence-and-custom-ai-agents-to-consumers-and-businesses)
- [Claude Cowork Tutorial (DataCamp)](https://www.datacamp.com/tutorial/claude-cowork-tutorial)
- [Anthropic releases Cowork as Claude's local FS agent (MarkTechPost, Jan 2026)](https://www.marktechpost.com/2026/01/13/anthropic-releases-cowork-as-claudes-local-file-system-agent-for-everyday-work/)
- [2025 Tax Software Survey (Journal of Accountancy)](https://www.thetaxadviser.com/issues/2025/aug/2025-tax-software-survey/)
- [IRS e-Services API Authorization User Guide](https://content.govdelivery.com/attachments/USIRS/2022/11/21/file_attachments/2335011/IRS%20eServices%20API%20Authorization%20User%20Guide.pdf)
- [Payroll API Developer Guide (Knit)](https://www.getknit.dev/blog/payroll-api-integration-developer-guide-to-adp-gusto-rippling-paychex)
- [Banking Data Aggregation APIs comparison (Open Banking Tracker)](https://www.openbankingtracker.com/banking-data-aggregation)
- [FinCEN BOI Reporting (post-2025 domestic exemption)](https://www.fincen.gov/boi-faqs)
- [Best practice management software 2026 (TaxDome)](https://taxdome.com/blog/best-tax-practice-management-software)
- [K1x AI tax data extraction](https://k1x.io/)
- [Document Intelligence US tax documents (Microsoft Azure)](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/prebuilt/tax-document?view=doc-intel-4.0.0)
- [AI Tax landscape (Filed/Black Ore/Basis)](https://blackore-ai.com/2025/08/20/ai-tax-automation-filed-black-ore-basis/)
