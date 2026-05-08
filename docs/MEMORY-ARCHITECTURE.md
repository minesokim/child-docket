# Memory Architecture

> *Make it feel like the AI has unlimited memory and gets smarter every day. Without burning $30/day per EA in tokens.*

This document is the canonical answer to: how does Docket give the AI long-term, ambient memory of every client, every artifact, every decision — without the context window or the bill exploding?

The naive architecture (dump everything into the prompt every call) breaks at three thresholds — token limits, cost (linear with context size), quality (attention degradation past ~50K tokens). A vector-search-only architecture breaks because it's recency-blind, structure-blind, and identity-blind.

The right answer is layered memory + active curation + aggressive caching. This doc walks through each.

---

## 1. The six memory layers

Each layer has different write cadence, decay rules, and retrieval semantics. The context assembler picks the right slice per call.

| Layer | What it holds | Write cadence | Decay | Retrieval pattern |
|---|---|---|---|---|
| **Working** | Current task / conversation / artifact being processed | Real-time | Per-task | Always full |
| **Episodic** | Recent events: emails, docs, decisions, signatures | Real-time | Time-weighted (recent > old) | By client + time + semantic |
| **Semantic** | Tax authority (IRC / Treas Regs / cases), position library, firm playbooks | Curated | None (versioned by `effective_from`) | By query similarity + tier filter |
| **Procedural** | How this firm/EA works: voice profile, tier preferences, response patterns, client comm preferences | Slow (extracted weekly from artifacts) | Slow (overwritten as patterns drift) | Always loaded for that firm |
| **Relational** | Per-client multi-year context: prior returns, life events, preferences, risk tolerance | Real-time + extraction | Year-tagged, never decayed (legal retention) | Always loaded when client is active |
| **Pattern** | Cross-client/firm aggregates: "Antonio's Tier-3 acceptance rate," "first-time abatement success patterns" | Background-job nightly | Replaces stale | On-demand for analytics + practice intelligence |

The substrate for layers 1, 2, 3, 5 already exists in the schema (`actions`, `documents`, planned `authority_chunks`, `intake_responses`). The new pieces are 4 (procedural) and 6 (pattern) plus the **context assembler** that orchestrates them.

---

## 2. Schema additions

```typescript
// PROCEDURAL MEMORY — how this firm/EA works
firm_profile {
  tenantId: TenantId  // PK, one row per tenant
  // Voice profile (extracted weekly from sent communications)
  tone_descriptor: text  // "warm-direct, prefers short sentences, uses 'I show' instead of 'you owe'"
  voice_examples: jsonb  // 5-10 representative snippets
  // Tier preferences per position type
  position_tier_preferences: jsonb {
    "augusta_rule": { default_tier: "reasonable_basis", acceptance_rate: 0.85 },
    "qbi_aggregation": { default_tier: "substantial", acceptance_rate: 0.95 }
  }
  response_cadence: jsonb  // by channel + topic
  updated_at: timestamptz
  version: int  // monotonic
  prior_versions: jsonb[]  // last 5 versions kept for rollback
}

// PATTERN MEMORY — cross-client aggregates per firm
firm_patterns {
  id: ULID
  tenantId: TenantId
  pattern_type: text  // "examiner_response" | "deduction_hit_rate" | "client_segment_metric"
  pattern_key: text   // e.g., "examiner.glendale.mike_chen"
  pattern_value: jsonb
  observation_count: int  // how many data points support this
  last_observed_at: timestamptz
  created_at: timestamptz
  confidence: float  // 0..1
  unique(tenantId, pattern_type, pattern_key)
}

// CLIENT FACTS — atomic facts extracted from narratives
client_facts {
  id: ULID
  tenantId: TenantId
  clientId: ClientId
  fact_key: text  // "home_office_pct" | "primary_residence_state" | "filing_status"
  fact_value: jsonb
  tax_year: int  // year-tagged
  source_action_id: ULID  // which artifact this came from
  source_tier: text  // "client_assertion" | "third_party_doc" | "irs_transcript" | "computed"
  confidence: float  // 0..1
  observed_at: timestamptz
  superseded_by: ULID  // nullable; points at the row that replaced this fact
  // RLS: scoped to (tenantId, clientId)
  index(tenantId, clientId, fact_key, tax_year)
}
```

`client_facts.superseded_by` makes facts a temporal log. Maria's `primary_residence_state` was `CA` in 2024, then `TX` in 2025. Both rows exist. The 2024 row's `superseded_by` points at the 2025 row. Year-tagged retrieval gives correct year context; the chain shows life-event timeline.

Migrations: `0019_firm_profile.sql`, `0020_firm_patterns.sql`, `0021_client_facts.sql`.

---

## 3. The context assembler

Single function, called by every agent: `assembleContext({ agentName, tenantId, clientId?, taskType, query? })`.

It returns a structured context object that the agent serializes into the prompt. The assembler decides which memory slices to include based on `agentName` + `taskType`.

```typescript
type AssembledContext = {
  // STATIC PREFIX — cache-eligible, identical across calls within a session
  systemPrompt: string
  firmProfile: string  // procedural memory rendered
  positionLibrary?: string  // semantic memory, only when relevant agent
  voiceProfile?: string  // procedural memory subset

  // DYNAMIC CONTEXT — fresh per call
  workingMemory: string  // current task
  episodicSlice: string  // recent artifacts relevant to query
  relationalSlice: string  // per-client context (when clientId given)
  patternSlice?: string  // pattern memory subset (analytics agents only)

  // METADATA — observability
  assemblerVersion: string
  totalTokens: number
  cachedPrefixHash: string  // for cache-hit verification
}
```

Per-agent recipes (initial v1 set):

| Agent | Static prefix (cached) | Dynamic context (fresh) |
|---|---|---|
| **Inbox drafter** | systemPrompt + firmProfile + voiceProfile | working (current message) + relational (recent comm with this client) |
| **Discovery agent** | systemPrompt + firmProfile + positionLibrary | working (target client's facts) + episodic (recent artifacts) |
| **Position agent** | systemPrompt + firmProfile + positionLibrary | working (proposed position + facts) + episodic (similar prior positions taken) |
| **Pre-signature checklist** | systemPrompt + firmProfile + positionLibrary | working (return draft) + relational (prior-year return) + pattern (typical issue list) |
| **Strategy agent** | systemPrompt + firmProfile + positionLibrary | working (strategy prompt) + relational (full client multi-year) + pattern (firm's tier acceptance) |

---

## 4. Cost optimization — the lever that changes the bill

Without prompt caching, naive memory architecture burns $30/day per EA in tokens. With aggressive caching, the same architecture runs at $3-5/day. **Caching is not an optimization, it's the cost strategy.**

### Anthropic prompt caching mechanics

- Cache TTL: 5 minutes (rolling — each access extends 5 min)
- Cached input: $0.30/M tokens on Sonnet (vs $3/M fresh) — **90% discount**
- Cached input: $0.08/M tokens on Haiku (vs $0.80/M fresh) — **90% discount**
- Cache write: same as fresh input cost (one-time per cache window)
- Minimum cacheable size: 1024 tokens
- `cache_control: { type: "ephemeral" }` markers — placed at boundary between static and dynamic content

### The sequencing rule

The prompt MUST be assembled in this order, with cache markers at each boundary:

```
<system_prompt>             ← cache boundary (1024+ tokens, often)
<firm_profile_render>       ← cache boundary
<position_library>          ← cache boundary (when relevant)
<voice_profile>             ← cache boundary (inbox-drafter only)
<task_specific_static>      ← cache boundary (per-agent constants)
─────────────────────────── ← LAST CACHE MARKER
<dynamic_context>           ← fresh every call
<working_memory>            ← fresh every call
<user_query>                ← fresh every call
```

Anything before the last cache marker is matched against the cache. Anything after is fresh.

### Per-call cost math

Typical Discovery agent call against Maria's bank-feed:

| Section | Tokens | Status | Rate ($/M) | Cost |
|---|---|---|---|---|
| systemPrompt + firmProfile + positionLibrary | 80,000 | cached | $0.30 | $0.024 |
| episodicSlice + workingMemory + query | 10,000 | fresh | $3.00 | $0.030 |
| Output (TaxPosition rows) | 5,000 | n/a | $15.00 | $0.075 |
| **Total** | | | | **$0.13** |

Without caching: $0.30 + $0.075 = $0.375 per call. **2.9x markup just from skipping cache.**

In a busy session (50+ calls within 5 min, cache stays warm): cache hit rate is ~95%, effective cost ~$0.05/call.

### What this means for memory layers

- **Procedural memory must fit in a stable cache prefix.** Voice profile, tier preferences, firm settings — these change slowly (weekly), so they're cache-stable. Render them once per session, cache for the whole session.
- **Position library is cached even though it's "semantic memory."** It's the static-est thing in the system. Top-50 positions render once, cache hits forever (until library version bumps).
- **Relational memory CANNOT be in the static prefix** — it's per-client and would invalidate cache on every client switch. It goes in the dynamic section.
- **Pattern memory is cached when used by analytics agents** that always ask the same pattern questions; uncached for ad-hoc analysis.

### Cache invalidation

Cache invalidates when ANY token before a cache marker changes. So:

- Adding a new position to the library → invalidates `position_library` cache for everyone (next call rebuilds).
- Antonio updates voice profile (weekly extraction job) → invalidates his `firmProfile` cache.
- Bumping system prompt version → invalidates everything.

**Discipline rule**: never include a timestamp, request ID, or any varying token in the cacheable section. Even one byte change kills the cache.

---

## 5. Bloat solutions — five mechanisms, used together

Even with caching, raw artifact volume grows unboundedly. Five mechanisms keep memory tight without losing the "feels unlimited" property.

### A. Tiered storage with cascade summarization

Three tiers per artifact, nightly job demotes:

| Tier | Age | Fidelity | Retrieval cost |
|---|---|---|---|
| **Hot** | 0-30 days | Full content | Low (indexed) |
| **Warm** | 1-12 months | Structured fields + LLM-generated summary | Medium |
| **Cold** | 1-7 years | Structured fields only; raw retrievable from R2 archive on demand | High (network round-trip) |

Tax law requires 7-year retention so we can't delete, but most retrievals never touch Cold. Storage costs grow logarithmically, not linearly.

### B. Hierarchical summarization

Daily → weekly → monthly → quarterly → yearly summaries. Multi-resolution retrieval:
- "What did Maria say in October?" → hits monthly summary first → if enough, no further retrieval
- "What was the exact wording in Maria's Oct 14 email?" → drills to raw artifact

Summaries are written by background jobs, indexed for retrieval, ~10x more compact than raw.

### C. Fact extraction over narrative storage

LLM extracts atomic facts from artifacts at write time. Narrative kept for audit; facts queryable instantly.

```
Narrative artifact (in actions table):
  "Maria mentioned in her March email that her home office is approximately
  12% of her home and she uses it exclusively for her bakery's bookkeeping."

Extracted facts (in client_facts):
  home_office_pct = 12 (source: actions/abc-123, tier=client_assertion, conf=0.9)
  home_office_use = exclusive_business (source: actions/abc-123, conf=0.85)
  business_type = bakery_bookkeeping_at_home (source: actions/abc-123)
```

Discovery agent queries `client_facts WHERE client_id=X` instead of retrieving and re-parsing the March email. 100x faster, 50x cheaper, more accurate (facts have explicit confidence + source).

### D. Importance-weighted retention

Not all artifacts are equal:

| Importance | Examples | Retention |
|---|---|---|
| Audit-trail-relevant | positions taken, signatures, payments, e-files | Forever (legal) |
| Decision-relevant pending | unresolved action items | Full fidelity until acted on, then summarize |
| Recurring patterns | confirmed Antonio behaviors | Extracted to procedural memory; raw can decay |
| Routine high-volume | auto-categorized bank transactions, bulk emails | Aggressive decay; only structured fields kept after 90d |
| Anxiety chatter | repeated client check-ins ("just making sure") | Aggressive decay; first one kept, repeats summarized |

### E. Active curation

Weekly background job surfaces curation prompts to Antonio:

> "We noticed you rejected 8 Tier-3 home-office suggestions in a row. Want to lower default tolerance for this position type?"
>
> "Maria has confirmed her home office details 3 times. Upgrade from `client_assertion` to `confirmed_pattern`?"
>
> "We've stored 47 emails from Acme Corp's HR over 6 months. Summarize and archive?"

Antonio confirms → procedural / pattern memory updates. No confirmation in 30 days → auto-decision per default rules.

This serves two purposes: curation (memory stays clean) AND a stickiness mechanism (Antonio sees the AI getting smarter, week over week).

---

## 6. The "feels unlimited" tricks

Two patterns make memory FEEL unlimited even though it's bounded:

### A. Always-warm relational layer

When Antonio opens Maria's record, her FULL relational memory loads into Working — not summarized, full. 5 years of context fits in ~30K tokens for a typical client. AI feels like "it remembers Maria like I do."

The reality: assembler put Maria's full relational layer in Working memory because she's the active subject. Cost is one-time at client-switch.

### B. On-demand drill from summary to raw

Antonio asks: "what did Maria say in March?" → AI answers from monthly summary.

He asks: "show me the actual email" → AI fetches raw from `actions` (or `archive` for Cold tier).

User never sees the gap. Feels like every word is remembered. Reality: most queries answer from compressed; raw fetch is rare and latent.

---

## 7. The "smarter every day" mechanisms

Three concrete mechanisms make the AI demonstrably better over time:

### A. Edit-diff feedback loop

Every AI draft Antonio edits before sending → diff captured (`proposals.draft_text` vs `proposals.sent_text`). Background job extracts pattern: "Antonio softens 'You owe $X' to 'I show $X owed' in 80% of edits."

Pattern feeds procedural memory → next draft uses softer phrasing automatically.

### B. Acceptance/rejection learning

Every Tier-3 position Antonio accepts vs rejects shifts his procedural profile. After 50 acceptances of Augusta rule and 8 rejections, the agent's prompt for Augusta-shaped fact patterns shifts from "this is borderline, recommend with caution" to "Antonio typically accepts; recommend with high confidence."

Tracked in `firm_profile.position_tier_preferences[position_type].acceptance_rate`.

### C. Pattern memory feeds specialists

Pattern layer's outputs become INPUTS to specialist agents:

- Discovery agent reads `firm_patterns`: "Coworking-charge → home-office classification has 87% Antonio-confirm rate. Surface aggressively."
- Inbox drafter reads `firm_patterns`: "Antonio's median response time on payment-question is 2 hours. If draft is good, queue for 2-hour delay before send to match cadence."
- Position agent reads `firm_patterns`: "Antonio's Tier-3 disclosure rate is 35% — within firm-norm range. No alert needed."

User experience: AI gets faster, more accurate, more "in their voice" every week. Reality: 30 days of procedural deltas have accumulated; today's prompt is meaningfully different from 30 days ago.

---

## 8. Privacy + ownership rules

These rules prevent classes of leak that would burn months of trust:

- **RLS on every memory layer.** `client_facts` + `firm_patterns` + `firm_profile` all RLS-bound to tenantId. Cross-tenant retrieval returns zero rows even if attempted.
- **PII regex scrub before vector indexing.** Inbound SMS / email scanned for SSN / EIN / bank-account / DL-number patterns. Matched tokens replaced with `[REDACTED-SSN]` markers BEFORE the artifact gets fact-extracted or vector-indexed. Original kept in `actions` (encrypted via per-tenant DEK), never embedded.
- **Procedural memory ownership = firm_id.** Antonio's voice profile belongs to the firm, not personally. If he leaves, firm keeps the pattern data; he can extract a personal copy IF it includes voice biometrics (those are his by ethics).
- **Cross-client pattern surfacing must be aggregate.** "8 of your clients have X anomaly" is fine. "Maria, John, Taylor [...] have X" is not — the pattern recognition feature anonymizes clients in surface UI even when underlying SQL knows the IDs.
- **Cross-firm aggregation is differential-privacy-protected.** When (in v2) we aggregate examiner intelligence across firms, no single firm's data is identifiable. K-anonymity with k≥10 minimum.
- **Conflict detection.** Maria says CA-resident in March, TX-resident in October. Both facts get stored with `superseded_by` chain. Discovery surfaces conflict to Antonio for resolution rather than silently picking one.

---

## 9. What we build vs defer

### V1 (in scope, ~3 weeks)

- Schema migrations 0019-0021 (firm_profile, firm_patterns, client_facts)
- Context assembler with 5 agent recipes (inbox-drafter, discovery, position, pre-signature, strategy)
- Aggressive prompt caching wired into `runDocketAgent`
- Fact extraction on artifact write (background job)
- Tiered storage: Hot tier only at v1 (Warm/Cold defer to v1.5 — volume isn't there yet)
- Basic active curation surface in command-room (`/curation` weekly digest)

### V1.5 (post-launch)

- Cascade summarization (Hot → Warm → Cold)
- Hierarchical summaries (daily/weekly/monthly/quarterly/yearly)
- Importance-weighted retention with auto-decay
- Cross-client pattern recognition surface
- Edit-diff feedback loop with prompt updates
- R2 archive for Cold tier

### V2

- Cross-firm anonymized aggregation (network effects through pattern memory)
- Per-firm fine-tuning / LoRA distillation of voice profile
- Memory marketplace (anonymized examiner intelligence as a paid module)

---

## 10. Read also

- [`docs/POSITION-FRAMEWORK.md`](POSITION-FRAMEWORK.md) — the position framework that semantic memory feeds
- [`docs/PRODUCTION-READINESS.md`](PRODUCTION-READINESS.md) — dev-process gaps including memory observability
- [`CLAUDE.md` §8](../CLAUDE.md) — the six AI intelligence layers
- [`COSTS.md`](../COSTS.md) — cost discipline ($50/mo target during v0; this doc explains how memory architecture stays inside that budget)

---

*Last updated: 2026-05-08. The cost-optimization shape (cache the static prefix, dynamic dynamic-only) was forced by experience scaling memory architectures elsewhere. The bloat solutions are conventional — five mechanisms used together, not one silver bullet. Re-read §4 (cost optimization) before changing the prompt assembly order; cache invalidation is silent and expensive when broken.*
