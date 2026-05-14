# Anthropic Citations API — Production State Verification

**Verified:** 2026-05-14
**Primary source:** `https://platform.claude.com/docs/en/build-with-claude/citations` (the legacy `docs.claude.com` host now 302-redirects here)
**Status:** Generally available. Eligible for Zero Data Retention.

---

## 1. Current API contract (verbatim from docs)

### Request shape

Citations is enabled per-document via a `citations.enabled` flag on a `document` content block. The docs are emphatic: *"Currently, citations must be enabled on all or none of the documents within a request."*

Three document `source.type` values are supported (and three additional source variants — `url`, `base64`, `file` — for PDFs):

```python
# Plain text (inline)
{
  "type": "document",
  "source": {
    "type": "text",
    "media_type": "text/plain",
    "data": "Plain text content..."
  },
  "title": "Document Title",       # optional, length-limited
  "context": "Document metadata",  # optional, passed to model but not citable
  "citations": {"enabled": True}
}

# Custom content (user-defined chunk boundaries)
{
  "type": "document",
  "source": {
    "type": "content",
    "content": [
      {"type": "text", "text": "First chunk"},
      {"type": "text", "text": "Second chunk"}
    ]
  },
  "citations": {"enabled": True}
}

# PDF (base64 / url / file_id)
{
  "type": "document",
  "source": {"type": "base64", "media_type": "application/pdf", "data": "..."},
  "citations": {"enabled": True}
}
```

### Response shape

Responses interleave plain `text` blocks with `text` blocks carrying a `citations` array. Three citation `type` discriminants exist, each with their own location fields:

```python
# char_location (plain text source)
{
  "type": "char_location",
  "cited_text": "The grass is green.",
  "document_index": 0,            # 0-indexed across all document blocks in request
  "document_title": "My Document",
  "start_char_index": 0,          # 0-indexed inclusive
  "end_char_index": 20            # exclusive
}

# page_location (PDF source)
{
  "type": "page_location",
  "cited_text": "Water is essential for life.",
  "document_index": 1,
  "document_title": "PDF Document",
  "start_page_number": 5,         # 1-indexed inclusive
  "end_page_number": 6            # exclusive
}

# content_block_location (custom_content source)
{
  "type": "content_block_location",
  "cited_text": "These are important findings.",
  "document_index": 2,
  "document_title": "Custom Content Document",
  "start_block_index": 0,         # 0-indexed inclusive
  "end_block_index": 1            # exclusive
}
```

### Streaming

A new `citations_delta` delta type appears inside `content_block_delta` events, carrying one citation at a time appended to the current text block's `citations` list. Streaming is supported.

---

## 2. Model support

Docs say: *"All active models support citations, with the exception of Haiku 3."*

| Active model (May 2026) | API ID | Citations | Notes |
|---|---|---|---|
| Claude Opus 4.7 | `claude-opus-4-7` | Yes | 1M context, 128k output |
| Claude Sonnet 4.6 | `claude-sonnet-4-6` | Yes | 1M context, 64k output |
| Claude Haiku 4.5 | `claude-haiku-4-5` (alias) / `claude-haiku-4-5-20251001` | Yes | 200k context, 64k output |
| Claude Haiku 3 | (legacy) | **No** | Only documented exclusion |

All current API IDs are pinned snapshots; Sonnet 4.6 and Opus 4.7 IDs are dateless but still pinned (not evergreen).

---

## 3. Document caps + token economics

### Size limits

- **PDF:** Max 32 MB request payload (host-dependent); max 600 pages per request, or **100 pages** if model has a 200k context window (i.e., Haiku 4.5). Each page yields both extracted text and a page image (vision pipeline). Typical density: 1,500–3,000 tokens per page.
- **Plain text / custom content:** No documented per-document cap beyond the request-level context window.
- **Documents per request:** No explicit hard cap; bounded by context window. With Sonnet 4.6 / Opus 4.7 at 1M tokens, you can pack hundreds of cited authorities into one call.

### Token economics (verbatim)

> *"Enabling citations incurs a slight increase in input tokens due to system prompt additions and document chunking."*
>
> *"the citations feature is very efficient with output tokens. Under the hood, the model is outputting citations in a standardized format that are then parsed into cited text and document location indices. **The `cited_text` field is provided for convenience and does not count towards output tokens.**"*
>
> *"When passed back in subsequent conversation turns, `cited_text` is also not counted towards input tokens."*

This is the load-bearing economic claim. Both directions confirmed.

---

## 4. Cache compatibility

Citations is explicitly listed as compatible with prompt caching (alongside token counting and batch processing).

**Mechanism:** *"The citation blocks generated in responses cannot be cached directly, but the source documents they reference can be cached. To optimize performance, apply `cache_control` to your top-level document content blocks."*

```python
{
  "type": "document",
  "source": {"type": "text", "media_type": "text/plain", "data": long_doc},
  "citations": {"enabled": True},
  "cache_control": {"type": "ephemeral"}  # 5-min default
}
```

### TTL tiers

- `{"type": "ephemeral"}` — 5 minutes (default), auto-refreshes on hit at no extra cost
- `{"type": "ephemeral", "ttl": "1h"}` — 1 hour

### Pricing multipliers (multiplicative on base input price)

- 5-min cache write: **1.25x** base input
- 1-hour cache write: **2x** base input
- Cache read: **0.1x** base input (10%)

**Example for Sonnet 4.6** ($3/MTok input, $15/MTok output):
- 5-min cache write: $3.75/MTok
- 1-hour cache write: $6.00/MTok
- Cache read: $0.30/MTok

### Constraints

- **Minimum cacheable length:** 1,024 tokens for Sonnet 4.6 / Sonnet 4.5; **4,096 tokens for Opus 4.7, Opus 4.6, Haiku 4.5**.
- **Max 4 `cache_control` breakpoints per request** (including any auto-caching slot).
- Cache hit/miss status visible on response: `usage.cache_creation_input_tokens` and `usage.cache_read_input_tokens`.

---

## 5. Incompatibilities

### Structured Outputs — HARD BLOCK (verbatim)

> *"Citations cannot be used together with Structured Outputs. If you enable citations on any user-provided document (Document blocks or RequestSearchResultBlock) and also include the `output_config.format` parameter (or the deprecated `output_format` parameter), the API will return a **400 error**.*
>
> *This is because citations require interleaving citation blocks with text output, which is incompatible with the strict JSON schema constraints of structured outputs."*

This is unambiguous and informs the two-pass architecture below.

### Tool use — SUPPORTED

No exclusion in the citations docs. PDF docs explicitly suggest combining PDFs + citations + tool use. Citations and tool use coexist; the response simply contains text blocks (with citations) and `tool_use` blocks in the same `content` array.

### Streaming — SUPPORTED

`citations_delta` event documented in the streaming section. Same framing as `thinking` deltas.

### Batch API — SUPPORTED

Listed alongside prompt caching and token counting as compatible features.

### Image citations — NOT YET SUPPORTED

*"Note that only text citations are currently supported and image citations are not yet possible."* PDFs that are pure image scans without extractable text are not citable.

### Files API gotcha

PDF via `file_id` (and beta messages endpoint) requires the `anthropic-beta: files-api-2025-04-14` header.

---

## 6. Latency benchmarks

Anthropic does not publish official latency benchmarks for citations vs non-citations calls. The docs only say "slight" input-token overhead. Practical observations from third-party sources:

- Input overhead = system-prompt instructions + chunking metadata. For a 50k-token document, expect roughly low-single-digit % bump.
- Output tokens **decrease** in many workloads because the model no longer emits inline quotes — `cited_text` is post-parsed.
- First-token latency is dominated by document upload + chunking; this is the dominant factor and where cache hits matter most. A cache hit on a 200k-token tax-code document trims first-token latency dramatically (Anthropic claims up to 85% latency reduction for large cached prompts in prompt-caching docs).
- Streaming `citations_delta` events do not appear to materially change TTFT vs plain text streaming.

**Unverified but credible:** Citations + cache_control + Sonnet 4.6 on a 100k-token cached statute corpus should produce sub-3-second TTFT on warm cache, comparable to non-citation calls at the same size.

---

## 7. Corrections to Docket's prior framing

| Prior claim | Reality | Action |
|---|---|---|
| `custom_content` documents with `citations.enabled=true` | Confirmed. `source.type: "content"` with an inner `content` array of `{type:"text", text:"..."}` blocks. | Keep. |
| Auto-interleaved citation blocks with `cited_text`, `document_index`, `start_char_index`/`end_char_index` or `start_page_number`/`end_page_number` | Confirmed verbatim. Add: `content_block_location` variant with `start_block_index`/`end_block_index` for custom_content (which is what Docket will use most). | **Add `content_block_location` to internal types.** |
| Citation text doesn't count toward output tokens | Confirmed. **Also** doesn't count toward input on conversation turns. | Strengthen the claim. |
| "+15% recall vs prompt-based citation" | Anthropic launch blog: *"increasing recall accuracy by up to **15%**"*. The "up to" qualifier matters — it's a ceiling, not an average. | Re-phrase: "up to 15% recall improvement (Anthropic launch eval)". |
| "30-40% hallucination reduction vs zero-shot" | **Not directly substantiated by Anthropic.** Launch blog cites Endex going from 10% to 0% on source hallucinations as a single customer datapoint. 30–40% is not a number Anthropic publishes. | **Drop the 30-40% range.** Replace with: "Anthropic's launch case study (Endex) reduced source hallucinations from 10% to 0%; broader gains are workload-dependent and unmeasured by Anthropic publicly." |
| Compatible with prompt caching (`cache_control: ephemeral`) | Confirmed. Apply at document block level, not at citation level. | Keep. |
| Incompatible with Structured Outputs in the same call | Confirmed — **returns 400**. | Strengthen: API returns explicit 400, not silent degradation. |
| Sonnet 4.6 model claim | Confirmed supported. | Keep. Specify exact ID `claude-sonnet-4-6`. |
| Haiku 4.5 for extraction | Confirmed citations-capable, but **incompatible with Structured Outputs in same call**. Haiku 4.5 alone in pass 2 (no citations, with structured outputs) is the right play. | Keep two-pass. |

---

## 8. Implementation pattern for Docket

The Structured Outputs incompatibility forces a two-pass design — which is fine, because each pass uses the right model for the job.

### Pass 1 — Cited synthesis (Sonnet 4.6 + Citations API)

```python
response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=8192,
    system=[
        {"type": "text", "text": TAX_RESEARCH_SYSTEM_PROMPT,
         "cache_control": {"type": "ephemeral", "ttl": "1h"}}  # stable prompt
    ],
    messages=[{
        "role": "user",
        "content": [
            # One document per authority — IRC sections, regs, revenue rulings, cases
            {
                "type": "document",
                "source": {
                    "type": "content",
                    "content": [
                        {"type": "text", "text": chunk_text}
                        for chunk_text in authority["chunks"]  # pre-chunked for citation granularity
                    ]
                },
                "title": authority["citation"],          # e.g. "IRC § 162(a)"
                "context": authority["metadata_json"],   # jurisdiction, year, court
                "citations": {"enabled": True},
                "cache_control": {"type": "ephemeral", "ttl": "1h"}  # large stable corpus
            }
            for authority in authorities_corpus[:N]  # respect 4-breakpoint cap
        ] + [
            {"type": "text", "text": user_research_question}
        ]
    }]
)
# response.content is a list of text blocks; the ones with .citations
# carry document_index + start_block_index/end_block_index that map
# back to authorities_corpus[document_index]["chunks"][start_block_index]
```

**Why Sonnet 4.6, not Opus 4.7:** Citations is a grounded-retrieval workload, not a reasoning workload. Sonnet 4.6 is 5x cheaper input ($3 vs $5), 1.67x cheaper output ($15 vs $25), supports extended thinking if needed, and has the same 1M context. Reserve Opus 4.7 for cases where the cited synthesis is wrong on the merits.

**Cache breakpoints:** Max 4 per request. Strategy: one breakpoint on the system prompt, three on the largest/most-reused authority documents. Smaller, query-specific authorities go after the breakpoints, unencached.

### Pass 2 — Structured extraction (Haiku 4.5 → TaxPosition JSON)

Feed Pass 1's full response (text + citation metadata, serialized to a compact JSON envelope) into Haiku 4.5 with `output_config.format` enforcing the `TaxPosition` schema. No documents, no citations, no incompatibility.

```python
serialized_pass1 = {
    "synthesis": [
        {
            "text": block.text,
            "citations": [
                {
                    "authority": authorities_corpus[c.document_index]["citation"],
                    "locator": c.cited_text,  # free to include — already paid for in Pass 1, no token cost
                    "char_or_page_or_block": _extract_location(c)
                }
                for c in (block.citations or [])
            ]
        }
        for block in response.content if block.type == "text"
    ]
}

extraction = client.messages.create(
    model="claude-haiku-4-5",
    max_tokens=4096,
    output_config={"format": {"type": "json_schema", "schema": TAX_POSITION_SCHEMA}},
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "Extract TaxPosition objects from this cited synthesis."},
            {"type": "text", "text": json.dumps(serialized_pass1)}
        ]
    }]
)
```

**Why Haiku 4.5 for Pass 2:** $1/$5 per MTok is 1/3 the cost of Sonnet on input, 1/3 on output. The extraction task is schema-driven and short-context; Haiku's 200k window is plenty.

**Result:** Each `TaxPosition` carries a `cited_text` and authority pointer that survives round-tripping because Pass 1 never charged you for `cited_text` and Pass 2 never round-trips a document.

### Cost model (single research query, illustrative)

Assume: 200k cached statute corpus, 50k cached system, 2k question, 4k Pass 1 output (mostly citation pointers), 8k Pass 2 input, 1k Pass 2 output.

- Pass 1 cache write (first call): 250k × $3.75/MTok = $0.94 (1-hour tier)
- Pass 1 cache read (subsequent): 250k × $0.30/MTok = $0.075
- Pass 1 output: 4k × $15/MTok = $0.060
- Pass 2 input: 8k × $1/MTok = $0.008
- Pass 2 output: 1k × $5/MTok = $0.005

**Steady-state per query: ~$0.15 with warm cache.** First-of-hour query: ~$1.00.

---

## 9. Open questions / unverifiable claims

1. **Exact recall delta vs prompt-based on tax authorities.** Anthropic's "up to 15%" was measured on general-purpose docs. Tax authority retrieval (where exact-quote pointers matter most) may differ. **Action: run Docket's own eval on a 200-query gold set.**
2. **Hallucination reduction magnitude.** No defensible public number. Endex's 10%→0% is a single anecdote. **Action: drop quantitative claim from external comms; measure internally.**
3. **`document_title` length cap.** Docs say "limited in length" without a number. **Action: empirically probe; for now, cap titles at ~200 chars and put long metadata in `context`.**
4. **Max documents per request.** No documented hard cap. Practical cap is the context window. **Action: load-test at 100, 250, 500 document blocks to find the soft limit.**
5. **Custom content chunk count cap.** No documented cap. Practical cap is context window + chunking overhead. **Action: load-test.**
6. **Citation accuracy on highly nested PDFs** (tax court opinions with footnotes spanning pages). PDF citations are page-level only — Docket may need to convert PDFs to plain text or custom_content for sentence-level fidelity.
7. **Vertex AI / Bedrock parity.** Bedrock Converse API has an unusual interaction: visual PDF analysis *requires* citations enabled (forced coupling). Direct Anthropic API has no such forcing. **Action: if/when Docket multi-clouds, re-verify.**
8. **Latency at 1M-token cached corpus.** No published benchmark. **Action: measure TTFT at 100k / 500k / 1M cached.**

---

## 10. Citations

- [Citations — Claude API Docs (current canonical URL)](https://platform.claude.com/docs/en/build-with-claude/citations)
- [Prompt Caching — Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [PDF Support — Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/pdf-support)
- [Models Overview — Claude API Docs (May 2026)](https://platform.claude.com/docs/en/about-claude/models/overview)
- [Introducing Citations on the Anthropic API — Anthropic launch blog (Jan 2025)](https://claude.com/blog/introducing-citations-api) — source of the "up to 15% recall" and Endex 10%→0% case study claims
- [Anthropic's new Citations API — Simon Willison (Jan 2025)](https://simonwillison.net/2025/Jan/24/anthropics-new-citations-api/) — early independent walkthrough; does *not* corroborate token economics or hallucination claims
- [Citations on the Anthropic API — Hacker News discussion](https://news.ycombinator.com/item?id=42807173)
- Note on URL migration: `docs.claude.com/en/docs/build-with-claude/citations` now 302s to `platform.claude.com/docs/en/build-with-claude/citations`. Update any docs/links accordingly.
