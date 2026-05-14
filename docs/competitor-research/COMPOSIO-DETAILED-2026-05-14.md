# Composio — Detailed Build-Decision Brief

**Date:** 2026-05-14
**Context:** Docket build decision. Hybrid architecture under `@docket/mcp-gateway` (C28, `1ac47fc`) — Composio for the OAuth long-tail, in-house connectors for tax-specific systems. This brief verifies the tradeoffs against current Composio docs, pricing, GitHub repos, podcast appearances, and competitor positioning as of May 2026.

---

## 1. Pricing × tool availability matrix (verified)

Verified May 14, 2026 from `composio.dev/pricing` and `composio.dev/enterprise`:

| Tier | $/mo | Tool calls/mo | Overage / 1K | Support | Apps/Tools |
|---|---|---|---|---|---|
| **Totally Free** | $0 | 20,000 | not stated (cap-only) | Community | Full library |
| **Ridiculously Cheap** | $29 | 200,000 | $0.299 | Email | Full library |
| **Serious Business** | $229 | 2,000,000 | $0.249 | Slack (1K+/mo) | Full library |
| **Enterprise** | Custom | Custom volume | Custom | Dedicated | Full library |

**The "is it all the tools at every tier" question — answered:** Yes. Composio's pricing model is **metered by tool calls, not gated by app catalog**. Free, $29, and $229 plans all see the same ~1,000-toolkit / ~50,000-tool library (Karan Vaidya, Cognitive Revolution podcast, 2026-03-22). Third-party comparison sites that list "250+ tool integrations" with a checkmark across tiers (e.g. aisotools.com) are simply stale. The real gate is the call budget and the auth/feature tier.

**What IS gated above $29:**
- **MCP API-key auth as default** (March 4, 2026 changelog) — gating policies and rate-limit posture
- **Webhook + trigger volume** — webhooks count as tool calls; Pro tier survives realistic firm volume, Starter does not
- **White-label OAuth screens** — supported via custom auth configs, but per-tenant rotation at scale realistically needs Pro
- **SSO (SAML/OIDC), SCIM, RBAC** — gated to Enterprise (per `composio.dev/mcp-gateway`)
- **VPC / on-prem / customer-managed cloud** — Enterprise only, includes helm-charts deployment (see ComposioHQ/helm-charts repo)
- **SOC 2 Type II + ISO 27001:2022 contractual coverage** — Enterprise only; lower tiers benefit from the same security posture but no contractual SLA
- **PII redaction, granular tool scoping, human-in-the-loop policies** — Enterprise framing on the gateway product page

**Auth methods (all tiers):** OAuth 2.0 / 2.1, API key, basic auth, custom auth flows via `auth_configs.create()`. BYO OAuth credentials work on every paid tier (`use_custom_auth` scheme).

**Math for Docket:** A typical mid-size firm (50 preparers × 200 active 1040 + 30 active business clients) at scale runs ~30K–80K tool calls/month per firm just for email triage + doc fetch + QBO sync if everything routes through the gateway. **The $229 Pro tier is the realistic starting point** once Docket has 20+ firms onboarded. The $29 tier is fine for pilot/demo. Free is fine for prototyping Cmd+K against your own personal Gmail.

---

## 2. Custom MCP server support — what's actually possible

**Verified mechanism (May 2026):**

Composio's MCP product surface is **server creation, not server registration**. The endpoint is `POST /v3/mcp/servers/custom` (and `/mcp/servers` for single-toolkit). What you supply is a list of toolkits + allowed tools + an auth config. What you get back is a Composio-hosted URL:

```
https://backend.composio.dev/v3/mcp/{SERVER_ID}?user_id={USER_ID}
```

That URL is callable from Claude Desktop, Cursor, Anthropic Messages API (`mcp_servers` parameter), OpenAI Responses API, Mastra, etc. Transport is **Streamable HTTP only** — no stdio.

**Can you point Composio at a self-hosted MCP server you wrote?** Officially documented answer: **no**. The "create MCP server" endpoint provisions a Composio-hosted facade over Composio toolkits. There is no first-class "register external MCP URL → proxy under our gateway" feature. A community discussion (#1916 on ComposioHQ/composio) explicitly asked for this in 2024; as of pull date it had zero replies.

**The self-hosted backdoor that does exist:** ComposioHQ/composio (28.2K stars, MIT, last release `@composio/claude-agent-sdk@0.9.2` on 2026-05-13) is the SDK + runtime in TypeScript and Python. The `helm-charts` repo provides Kubernetes deployment for the platform. The `rube` repo is an MCP server that connects to 500+ apps and is compatible with Claude Desktop / Cursor — effectively their open MCP front-end. So **you can self-host the Composio runtime** and run your own gateway behind their SDKs, but at that point you're operating Composio as software, not as a managed service — most of the value-add (managed OAuth refresh, audit retention, telemetry, integration upkeep) becomes your problem.

**Auth model for custom MCP servers:**
- `x-api-key` header (default-required for all orgs created after 2026-03-05)
- `user_id` query param maps to the multi-tenant boundary
- Connected accounts must exist before MCP URL is callable; Composio refuses tool execution if no connected account for the toolkit

**Pricing implications:** Every tool invocation through an MCP URL counts as a tool call against your monthly budget. There is no separate MCP-specific meter and no discount for MCP-routed calls vs SDK-routed calls. A Cmd+K session that fans out to Gmail + Drive + QBO = 3 calls.

**Latency:** Composio markets themselves as "optimized for low latency" but does not publish numbers. The MCP-gateway comparison piece on their own site benchmarks competitors transparently (TrueFoundry <5ms p95, Lunar.dev MCPX ~4ms p99, Bifrost <3ms) and notably does not put a number on Composio's own latency — they position breadth over speed. Realistic expectation: **50–200ms gateway overhead** on top of the vendor API roundtrip, based on the general "managed platforms ~10ms overhead" claim being aspirational rather than typical for OAuth-mediated, multi-tenant routing with token refresh and audit writes.

---

## 3. Custom OpenAPI tool support — limits

**Three tiers of "custom" in Composio:**

1. **Custom Python/TS functions** (`@composio.tools.custom_tool` decorator, `createCustomTool()`). Documented as **in-memory only — not persisted**. "Tools need to be recreated when the application restarts." This means they live in your runtime, not Composio's. Fine for dynamic per-request tools, useless for a production directory.

2. **Custom OpenAPI toolkit** (the documented "Custom Tools Using OpenAPI Spec" flow at `docs.composio.dev/introduction/foundations/components/integrations/custom-integration`). You provide an OpenAPI spec + an `integrations.yaml` describing auth scheme, and Composio generates a connector. Auth schemes supported: OAuth2, API key, Basic, custom. This is **the** path for wrapping a tax-specific REST API (e.g. an OLT API if one existed, an IRS Tax Pro Account API, a CDTFA REST endpoint) under the Composio umbrella.

3. **Custom Tools & Toolkits (Experimental)** — launched 2026-03-23 per changelog. This is the "build a proprietary integration without writing an OpenAPI spec" path. Limited public documentation; still labeled experimental.

**Browser automation — the hard question:** Composio is **strictly request-response over HTTP**. The Streamable HTTP MCP transport doesn't support long-running, stateful browser sessions. There is a "Dynamic Sandbox" feature (remote ephemeral environments for multi-step workflows) but it's marketed for code execution, not Selenium/Playwright sessions. **Implication for Docket:** OLT browser automation, Drake/Lacerte/ProConnect/CCH scrapers, IRS TDS transcript pulls, FTB ePOA flows — none of these belong inside Composio. They need a Docket-native browser-automation runtime (likely Inngest-orchestrated Browserbase/Playwright workers) that Composio can call as an external HTTP tool, but cannot host itself.

**Long-running OpenAPI calls:** Composio's proxy execute endpoint (post-2026 security update) requires the outbound endpoint URL to share scheme + registrable domain with the connection's resolved `base_url`. This blocks the "use the OAuth token from connector A to call random domain B" pattern — a sensible security tightening, but it means a Composio-wrapped FTB connector can only call FTB-domain URLs.

---

## 4. Per-tenant isolation at scale

**The model:** `user_id` (formerly `entity_id`) is the multi-tenant primitive. Each user_id has its own credential namespace. `composio.create(user_id="user_123")` scopes the session.

**One user can have multiple connected accounts per toolkit** (e.g. "Work Gmail" + "Personal Gmail" both linked under user_id `firm_42_partner_ana`). For Docket's firm-and-client topology, the natural mapping is:

```
user_id = firm_id::client_id      (when acting on a client's behalf)
user_id = firm_id::preparer_id    (when acting as a preparer)
auth_config_id = one per firm per toolkit (for BYO OAuth)
connected_account_id = one per (user_id, auth_config_id) pair
```

**White-label OAuth per-firm:** Fully supported. Programmatic auth config creation with `use_custom_auth` lets a firm bring their own Google Cloud OAuth client / Slack app / etc. Lifecycle is create → link → reuse → destroy. The docs explicitly call out the "for your users' users" pattern — i.e. Docket's multi-tier multi-tenancy (Docket → firm → client) is the supported pattern, not a stretch.

**Scaling to 100s of firms × 10s of connectors × 1000s of clients:** No documented hard cap, but a few realistic stress points:

- **Auth config explosion:** 200 firms × 8 connectors = 1,600 auth configs to manage. The lifecycle API supports it; the operational burden of "firm rotates Gmail OAuth credentials" lands on Docket.
- **Connected account explosion:** 200 firms × 1000 clients × 5 connectors per client = 1,000,000 connected accounts. Composio does not publish a connected-account ceiling. Enterprise customers have presumably stress-tested this; Pro tier customers likely have not.
- **Per-request user_id resolution:** Every tool call carries `user_id`; the dispatch is O(1) lookup on Composio's side. Not a scaling problem.
- **Token refresh blast radius:** When a vendor rotates OAuth secrets (Google has done this with little warning historically), you re-auth N firms simultaneously. Composio absorbs the refresh logic, but Docket owns the firm-facing UX for re-consent.

**Nango's critique, verified:** Nango's competitive blog claims Composio has "no per-customer configuration." This is **wrong** — `auth_configs.create()` with custom credentials is exactly per-customer configuration. What Nango is probably pointing at is **per-customer field mappings and custom auth validation** (e.g. "for firm X, the Salesforce `Account.taxId` field maps to `Client.ein` in our schema"). That kind of declarative field-mapping is not in Composio. For Docket, that maps to Docket's own intake / normalization layer.

---

## 5. Compliance posture for tax workflows

**SOC 2 Type II + ISO 27001:2022:** Verified on `composio.dev/mcp-gateway` and `composio.dev/enterprise`. Independent audits, end-to-end encryption, zero-day log retention by default, regular third-party penetration testing.

**Data residency:** US default. Enterprise tier offers "run on your own cloud" — this is the helm-charts-based deployment that gives full data residency control. For lower tiers, no documented EU-region option as of May 2026.

**BAA / HIPAA:** Not advertised on the public enterprise page. Per third-party compliance write-ups (MintMCP, Comp AI), BAA availability is "should be independently verified" — i.e. not standard, requires negotiation. For Docket's tax-only scope this is mostly irrelevant; if Docket ever touches healthcare-tax-adjacent work (medical practice 1120-S returns with patient data leaking through email), this becomes an issue.

**§7216 implications:** This is the load-bearing question for Docket. Section 7216 makes it a federal crime for a preparer to disclose or misuse taxpayer information. 26 CFR § 301.7216-2 carves out disclosures to "third-party service providers engaged by the tax return preparer that is providing services related to the preparation, processing, or electronic filing of the tax return" — **no consent required for those**.

The structural question: does Composio sitting in the call path qualify as a §301.7216-2 service provider? Three things determine this:

1. **Contractual posture** — the service provider must be engaged by the preparer for tax-related processing. The firm signs Composio's standard TOS, which is not a tax-service-provider engagement. Docket needs to flow down a §7216-compliant data processing agreement (DPA) to Composio, OR Docket itself acts as the §7216 service provider and treats Composio as a sub-processor with its own DPA.
2. **Data retention** — Composio markets "metadata-only storage" with "zero-day log retention by default" for the gateway. Tool-call payloads are routed but, per the marketing, not retained. Credential redaction for managed auth shipped 2026-04-22. **This is the right posture** for §7216 — but it needs to be contractually nailed down, not just trusted from marketing copy.
3. **Use restriction** — §7216 prohibits the service provider from using tax data for other purposes. Composio's "Constant Evolution — accuracy improved through millions of real-world tool calls" claim is a yellow flag: if Composio uses tool-call traffic to train models or improve schemas, that's a §7216 violation. **This needs explicit contractual carve-out** before any 1040 data flows through.

**Concrete §7216 risk grade per connector:**
- Gmail / Drive / Dropbox / OneDrive (document fetch) — **HIGH** §7216 exposure (raw return data flowing)
- QuickBooks Online / Xero (G/L sync) — **MEDIUM** (financial data but not return-final)
- Slack / Teams (notifications) — **LOW** (metadata only if Docket disciplines what it sends)
- HubSpot / Salesforce (CRM intake) — **LOW** (pre-engagement contact data)
- Stripe (billing) — **LOW** (firm-side, not taxpayer data)

---

## 6. Vendor lock-in + migration path

**BYO OAuth credentials:** Yes, fully supported via custom auth configs. **The OAuth refresh tokens themselves are held by Composio**, not exported. Migration means re-OAuthing every firm's every connector.

**Open-source path:** ComposioHQ/composio is MIT-licensed, 28.2K stars, actively maintained (last release 2026-05-13). The repo includes the SDK + runtime. ComposioHQ/helm-charts is the Kubernetes deployment. ComposioHQ/rube is a 500+ app MCP server, also MIT. Theoretically you could self-host the entire stack. Practically, the **managed integration catalog** (the ~1000 toolkits including OAuth app credentials for Composio's house Google/Slack/etc. apps) is the proprietary asset. Self-hosting means giving up the managed catalog and re-doing OAuth-app provisioning yourself — most of the value evaporates.

**Comparable alternatives (verified May 2026):**

| Vendor | Posture | Pricing signal | Migration difficulty from Composio |
|---|---|---|---|
| **Nango** | Code-first, self-hostable, 700+ APIs, OSS, OpenTelemetry, deep observability | Free OSS + paid cloud | Medium — re-write tool defs as TS functions, re-OAuth firms |
| **Arcade.dev** | Governance-first, "agents act as users" via OAuth delegation, audit logs | Per-seat / enterprise | Medium — Arcade's permission model differs |
| **Pipedream Connect** | **Acquired by Workday late 2025** — 3,000+ connectors, 10K+ tools, serverless workflow | Bundled into Workday now | High — Workday acquisition makes this a non-starter for independent product |
| **Workato** | Enterprise iPaaS, predefined business workflows | $$$$ enterprise | High — different paradigm |
| **MintMCP** | Compliance-focused MCP gateway, narrower scope | Custom | Low — similar gateway model |
| **TrueFoundry** | Performance-first (<5ms p95) | Custom | Medium |

**The 6-month wean-off plan is in §11.**

**Strategic read on Pipedream's Workday acquisition (late 2025):** This is the canary for the space. Pipedream had 3,000+ connectors and 10K+ tools — bigger catalog than Composio — and got absorbed. Composio's $25M Series A (Lightspeed-led, July 2025, $29M total) and 100K-developer claim makes them an obvious acquisition target for: ServiceNow, Salesforce (MuleSoft replacement), Microsoft (Power Platform), Workday (now they have Pipedream, but consolidation continues), an AI lab (Anthropic or OpenAI taking a tools layer in-house), or a private-equity rollup. **Treat acquisition within 18 months as a 30–40% probability event.**

---

## 7. Latency benchmarks

Composio does not publish public p50/p95/p99 latency numbers. Their own gateway comparison piece benchmarks competitors transparently and conspicuously omits Composio's own numbers. Inferred budget:

| Hop | Realistic latency |
|---|---|
| Docket app → Docket MCP gateway | 5–15ms (intra-VPC) |
| Docket gateway → Composio gateway | 30–80ms (cross-region, TLS, auth) |
| Composio → vendor API (Gmail, QBO, etc.) | 80–300ms (vendor-dependent) |
| **Total round-trip via Composio** | **~150–400ms** for a typical OAuth-mediated call |

Compare to **direct vendor call from Docket worker:** 80–300ms (just the vendor hop). So Composio adds ~70–100ms of overhead on a hot path.

**Decision implication:**
- **Cmd+K (Ask Docket)** is interactive. The user can perceive ~200ms but not ~400ms. **Cmd+K tools that fan out to multiple OAuth services should run a Composio→vendor call in parallel** (3 calls in parallel ≈ slowest single call + ~30ms overhead).
- **Inngest workers** (overnight batch, document classification, reminder cadence) — latency is irrelevant. Anything routes through Composio fine.
- **Tax-deadline-critical paths** (e-file submission to OLT, IRS) — these need to be Docket-native anyway because Composio doesn't host them.

---

## 8. Strategic signals + risk reads

**Funding:** $25M Series A led by Lightspeed Venture Partners, announced 2025-07-22. Total funding $29M. Existing backers Elevation Capital and Together Fund participated. Angel list includes Gokul Rajaram, Soham Mazumdar (Rubrik), Dharmesh Shah (HubSpot), Guillermo Rauch (Vercel). HQ San Francisco + Bengaluru. 59 employees as of Mar 31, 2026 (Tracxn).

**Founders:** Soham Ganatra (CEO) + Karan Vaidya (CTO). Both technical, both shipping. Karan is the visible one on dev podcasts.

**Karan Vaidya, Cognitive Revolution podcast (2026-03-22):** The episode is the cleanest signal on where they're going. Key claims:
- 50,000+ tools across 1,000+ apps
- "Smart tools" — AI-powered continuous improvement: detect when a tool is failing for an agent, generate a new version in real time, hot-swap in
- "Excellence in tooling avoids model lock-in" — pitch is that great instructions + great tools let you switch frontier models freely
- Working on "meta-skills" — translation layer between model providers

**The strategic read:** Composio is positioning as **the tools/skills layer** for the AI agent industry. They're not trying to be an iPaaS. They're trying to be the kit that every model-shop ships agents with. This means: (a) high pressure to keep prices low (because they're courting developer ubiquity), (b) they will get acquired or vertically integrate, (c) their integration catalog quality has to keep improving fast enough that DIY isn't competitive.

**Karan on Scaling DevTools podcast** is the other recent appearance — "MCP use cases & Elon retweets" episode covers their viral growth moment.

**Other ComposioHQ repos worth noting:**
- `agent-orchestrator` (7K stars) — parallel coding agents with autonomous CI/merge
- `awesome-codex-skills` (9.5K stars) — Python automation workflows for Codex CLI
- `trustclaw` (594 stars) — self-hostable personal AI agent with Composio + Telegram

This breadth suggests Composio is not narrowly betting on integration — they're betting on **agent infrastructure** broadly. That increases their long-term staying power but also increases the surface area where they might deprioritize the integration catalog if a new bet wins.

**Customer logo wall (from composio.dev):** agent.ai, Zoom, Letta, Glean, HubSpot, Wabi. Heavy on AI-native companies, light on F500 enterprise.

**100K developer claim:** Cited in Lightspeed announcement and Capterra. 200+ paying companies. The gap (paid:dev = 1:500) is normal for dev-tools but worth noting: this is a freemium business with most usage on free tier.

---

## 9. What's NOT in Composio (Docket still owns)

Even with a maximally-aggressive Composio adoption, these stay in-house for Docket. There is no path where Composio covers them in the next 18 months because they're outside the OAuth-API world.

**Tax software (browser automation, no public API):**
- OLT Pro (Online Taxes) — return prep + e-file
- Drake Tax — desktop + web, no public API
- Lacerte (Intuit) — desktop, screen-scrape only
- ProConnect Tax (Intuit) — web, no public OAuth
- CCH Axcess (Wolters Kluwer) — partial API, mostly browser
- UltraTax CS (Thomson Reuters) — desktop
- TaxAct Professional — limited integrations

**IRS systems (no third-party OAuth, ID.me-gated):**
- e-Services / TDS (Transcript Delivery System)
- Tax Pro Account (CAF management, POA filing)
- IRIS (1099/W-2 filing portal)
- EFAST2 (Form 5500 filing)

**State tax agencies (each is a custom scraper):**
- California: FTB MyFTB, CDTFA online services, CA SoS
- New York: NY DTF Online Services
- Texas: Comptroller eSystems
- (40+ other states, each their own beast)

**Tax research corpus (licensed content, not API):**
- Thomson Reuters Checkpoint
- CCH IntelliConnect / AnswerConnect
- Bloomberg Tax
- Tax Notes
- IRS publications (public, but need indexed retrieval, not OAuth)

**Tax-specific business logic that lives in Docket regardless:**
- §7216 consent ledger
- Engagement letter generation
- IRS notice classification (CP14, CP2000, LT11, etc.)
- E-file rejection diagnosis
- Multistate apportionment
- §199A QBI optimization

---

## 10. The hybrid pattern, refined

Verdict per connector — what routes through Composio under `@docket/mcp-gateway`, what stays Docket-native, what's borderline:

| Connector | Verdict | Reasoning |
|---|---|---|
| **Gmail / Google Drive** | ✅ Composio | OAuth long-tail, high-volume reads, no §7216 stretch with proper DPA, well-supported toolkit |
| **Outlook / OneDrive / Office 365** | ✅ Composio | Same as Google. Required for the firms that aren't Google-native |
| **Slack** | ✅ Composio | Notifications + intake; low §7216 risk; mature toolkit |
| **Microsoft Teams** | ✅ Composio | Same as Slack |
| **Dropbox / Box** | ✅ Composio | Document fetch; HIGH §7216 — needs DPA flow-down |
| **QuickBooks Online** | ✅ Composio | Standard OAuth, mature toolkit. Watch token refresh edge cases |
| **Xero** | ✅ Composio | Same as QBO |
| **HubSpot** | ✅ Composio | CRM intake, pre-engagement only |
| **Salesforce** | ✅ Composio | Same as HubSpot — enterprise firms with SFDC |
| **Calendly / Cal.com** | ✅ Composio | Scheduling, no taxpayer data |
| **DocuSign / Adobe Sign** | ⚠️ Borderline | Composio has DocuSign toolkit, but signature evidence is §7216-and-litigation-relevant — Docket should keep the evidence chain native, use Composio only for the API call |
| **Stripe** | ✅ Composio | Firm-side billing only |
| **OLT Pro** | ❌ Docket-native | Browser automation, no API |
| **Drake / Lacerte / ProConnect / CCH** | ❌ Docket-native | Same |
| **IRS TDS, Tax Pro Account, e-Services** | ❌ Docket-native | ID.me, no third-party OAuth, screen automation |
| **CDTFA / FTB / CA SoS / NY DTF / etc.** | ❌ Docket-native | Per-agency scrapers |
| **Tax research (Checkpoint, CCH AnswerConnect)** | ❌ Docket-native | Licensed content, custom RAG, no public OAuth |

**The architectural shape under `@docket/mcp-gateway`:**

```
                    Ask Docket (Cmd+K) / Inngest workers
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │   @docket/mcp-gateway        │
                  │   - trust gates              │
                  │   - audit chain              │
                  │   - tenant routing           │
                  │   - §7216 consent check      │
                  └──────────────┬───────────────┘
                                 │
                ┌────────────────┼─────────────────┐
                ▼                ▼                 ▼
        ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐
        │  Composio   │  │ Docket      │  │ Docket           │
        │  (OAuth     │  │ browser-    │  │ tax-research     │
        │  long-tail) │  │ automation  │  │ + IRS systems    │
        │             │  │ workers     │  │                  │
        └─────────────┘  └─────────────┘  └──────────────────┘
              │                │                  │
         Gmail/Drive/      OLT/Drake/        Checkpoint/CCH/
         QBO/Slack/...     IRS/FTB/...       TDS/MyFTB/...
```

The gateway is the trust boundary. Composio is one of three downstream specialists. The audit chain ensures every tool call, regardless of downstream, lands in the same evidence ledger.

---

## 11. The migration-off-Composio plan

Concrete 6-month wean-off architecture if Composio (a) raises prices materially, (b) gets acquired by a hostile incumbent (e.g. Intuit, Workday), or (c) has a sustained outage / breach.

**Month 0 (today): Architectural insurance**
- Every connector in `@docket/mcp-gateway` exposes a stable **Docket-internal MCP interface** (gmail.search, drive.list, etc.). Composio is one implementation; the interface does not leak Composio types.
- Every tool call is **logged with the abstract tool name** (gmail.search), not Composio's tool slug. The audit chain doesn't care what backed the call.
- All connected account state (firm_id, user_id mapping) is **stored in Docket's database**, not derived from Composio. Composio's connected_account_id is treated as a foreign key, not source of truth.

**Month 1–2: Nango shadow deployment**
- Stand up self-hosted Nango (their OSS path, open-source, TypeScript-native, fits Docket stack).
- Implement gmail + drive + qbo connectors in Nango behind the same Docket-internal MCP interface.
- Dual-write: every production call routes Composio (primary) + Nango (shadow) and compares results. Catches behavioral drift before flipping.

**Month 3: Live migration of low-risk connectors**
- Flip Calendly, Stripe, HubSpot, Slack to Nango (low §7216 risk, low call volume).
- Keep Composio for Gmail/Drive/QBO until shadow soaks for 30+ days clean.

**Month 4–5: Live migration of document/PII connectors**
- Per-firm re-OAuth flow: firms re-authorize Gmail/Drive/Dropbox against Nango's OAuth app.
- Provide migration UI: "We're upgrading our infrastructure. Click here to reconnect Gmail (90 seconds)."
- Run Composio + Nango in parallel for 2 weeks per firm, then disable Composio.

**Month 6: Decommission Composio**
- Last firms migrated.
- Composio subscription cancelled.
- Composio connected_account_ids zeroed in Docket DB.
- Auth configs revoked.

**Estimated cost of migration:** ~6 person-months of engineering time + ~1 day of per-firm re-consent UX. **Estimated cost of NOT having this insurance:** unbounded — if Composio is acquired by Intuit, Docket loses access overnight on hostile-acquirer terms.

**The insurance pattern is the migration plan.** If `@docket/mcp-gateway` is built with Composio as a vendor-swappable specialist from day one, the wean-off is mechanical. If it's built with Composio as the gateway, the wean-off is a re-architecture.

---

## 12. Recommended Docket actions

**Immediate (this week):**
1. **Sign up for Composio Pro at $229/mo.** Not Starter — the call budget at Starter doesn't survive 10 firms. The $200/mo delta vs Starter is rounding error against the risk of throttling during deadline week.
2. **Negotiate a §7216-compliant DPA** with Composio before any firm onboards. Specifically nail down: (a) zero-day retention as contractual, not marketing copy, (b) no use of tool-call payloads for "Constant Evolution" / model training / schema improvement, (c) sub-processor list, (d) breach notification timeline, (e) data deletion on termination.
3. **Wire Composio behind `@docket/mcp-gateway`'s vendor-swappable interface.** Not as the gateway. As a vendor.

**First 30 days:**
4. **Ship Gmail + Drive + QBO via Composio.** These cover ~70% of firm OAuth surface. Get one design partner firm fully OAuthed and dogfooding.
5. **Set up white-label OAuth per firm** using `auth_configs.create()` with custom credentials. Per-firm Google Cloud OAuth client = clean §7216 posture (the firm is the data owner) + no Composio shared-OAuth-app rate limit.
6. **Wire audit chain to capture every Composio tool call** with: firm_id, preparer_id, taxpayer_id (if applicable), tool name (abstract, not Composio slug), inputs hash, outputs hash, latency, success/failure. This is the §7216 evidence layer.

**First 90 days:**
7. **Stand up Nango self-hosted as shadow.** Even if you never flip, the shadow deployment is the migration insurance.
8. **Build out Docket-native browser automation for OLT + IRS TDS.** These are non-negotiable in-house. Inngest + Browserbase or self-hosted Playwright workers.
9. **Build Docket-native FTB / CDTFA scrapers.** California-first since that's the design-partner geography (assumption — verify).
10. **Reach out to Composio about Enterprise tier roadmap** even if not signing yet. The conversation surfaces what they'd contractualize on §7216, data residency, custom SLA, BAA. Signal that Docket is a tax-vertical use case so they think about HIPAA-adjacent and §7216 carve-outs.

**Tier transition signals:**
- **Hit Enterprise tier when:** (a) 20+ firms in production, (b) MCP API key auth needs SSO/SCIM, (c) need contractual SOC 2 / DPA terms beyond standard TOS, (d) need VPC deployment for a strategic firm.

**Red-flag monitoring:**
- Composio announces a model-training or "agent improvement" feature that uses customer tool-call data → reconsider §7216 posture immediately
- Composio acquired by Intuit / Workday / Thomson Reuters / Wolters Kluwer → execute Month 1 of the migration plan
- Composio raises prices >2x → re-evaluate Nango migration ROI
- Composio has a multi-hour outage during tax season → the migration insurance pays for itself; flip critical connectors immediately

---

## 13. Citations

**Composio official:**
- [Composio Pricing](https://composio.dev/pricing)
- [Composio Enterprise](https://composio.dev/enterprise)
- [Composio MCP Gateway](https://composio.dev/mcp-gateway)
- [Composio Docs](https://docs.composio.dev/)
- [Custom Tools docs](https://docs.composio.dev/docs/custom-tools)
- [MCP Overview](https://docs.composio.dev/docs/mcp-overview)
- [MCP Providers](https://docs.composio.dev/docs/mcp-providers)
- [Create custom MCP server API](https://docs.composio.dev/api-reference/mcp/post-mcp-servers-custom)
- [Custom Tools Using OpenAPI Spec](https://docs.composio.dev/introduction/foundations/components/integrations/custom-integration)
- [Programmatic Auth Configs](https://docs.composio.dev/docs/programmatic-auth-configs)
- [Composio Changelog](https://docs.composio.dev/docs/changelog)
- [MCP Gateways: Developer's Guide 2026](https://composio.dev/content/mcp-gateways-guide)
- [Best MCP Gateways for Developers 2026](https://composio.dev/content/best-mcp-gateway-for-developers)
- [APIs for AI Agents: 5 Integration Patterns 2026](https://composio.dev/content/apis-ai-agents-integration-patterns)
- [Hosted MCP Platforms](https://composio.dev/content/hosted-mcp-platforms)

**Composio GitHub:**
- [ComposioHQ org](https://github.com/ComposioHQ)
- [ComposioHQ/composio (main SDK, MIT)](https://github.com/ComposioHQ/composio)
- [Discussion #1916 — self-hosted MCP request](https://github.com/ComposioHQ/composio/discussions/1916)

**Funding + strategic:**
- [Lightspeed announcement — Investing in Composio](https://lsvp.com/stories/investing-in-composio-building-the-backbone-of-ai-agent-intelligence/)
- [Entrepreneur — $25M Series A coverage](https://www.entrepreneur.com/en-in/news-and-trends/composio-raises-usd-25-mn-from-lightspeed-to-advance/494938)
- [Together Fund — Investing in Composio](https://www.together.fund/perspectives/insights/investing-in-composio-building-the-learning-layer-for-agentic-ai)
- [Tracxn company profile](https://tracxn.com/d/companies/composio/__S4CqdyIkWZd1BSTOwnjS82Hz0ppMkmDoAP_j4_oMBfk)
- [PitchBook company profile](https://pitchbook.com/profiles/company/539999-65)

**Podcasts + founder voice:**
- [Karan Vaidya on Cognitive Revolution, 2026-03-22](https://www.cognitiverevolution.ai/your-agent-s-self-improving-swiss-army-knife-composio-cto-karan-vaidya-on-building-smart-tools-newsletter/)
- [Karan Vaidya on Scaling DevTools](https://scalingdevtools.com/podcast/episodes/from-viral-moments-to-mcp-scaling-kaposios-ai-integration-story)

**Competitive landscape:**
- [Nango — Composio alternatives blog](https://nango.dev/blog/composio-alternatives/)
- [Nango — Best unified API platform for AI agents 2026](https://nango.dev/blog/best-unified-api-platform-for-ai-agents-and-rag/)
- [Scalekit — Composio alternatives 2026](https://www.scalekit.com/blog/composio-alternatives)
- [AgentPatch — Composio alternatives 2026](https://agentpatch.ai/blog/best-composio-alternatives-2026/)
- [MintMCP — Best MCP Gateways for HIPAA Compliance 2026](https://www.mintmcp.com/blog/mcp-gateways-hipaa-compliance)

**Compliance + §7216:**
- [IRS Section 7216 Information Center](https://www.irs.gov/tax-professionals/section-7216-information-center)
- [26 CFR § 301.7216-2 — permissible disclosures](https://www.law.cornell.edu/cfr/text/26/301.7216-2)
- [The Tax Adviser — Many implications of Sec. 7216](https://www.thetaxadviser.com/issues/2024/jan/the-many-implications-of-sec-7216/)

**Third-party pricing aggregators (corroboration):**
- [AISO Tools — Composio Pricing 2026](https://aisotools.com/pricing/composio)
- [Capterra — Composio Pricing 2026](https://www.capterra.com/p/10021083/Composio/pricing/)
- [AgentsIndex — Composio Pricing 2026](https://agentsindex.ai/pricing/composio)
