# Cost Discipline

Target: **$50/mo Anthropic API spend** during the v0 build (plus existing Claude Code Max $100/mo subscription).

## Rules

1. **Claude Code Max is the dev tool.** All code-writing, debugging, file editing routes through your Claude Code subscription. Don't burn API tokens on coding-loop activity.

2. **Default test model: Haiku 4.5.** Every prompt iteration runs on Haiku first (~$0.80/M input, ~$4/M output — about 4× cheaper than Sonnet). Promote to Sonnet only for end-of-week integration tests or production-equivalent demos.

3. **Prompt caching, always.** Pass `cachedSystem: true` whenever the system prompt is reused (90%+ of calls). Cached input tokens cost 10% of normal — system prompts and knowledge bundles drop ~80–90%.

4. **Computer Use is deferred to week 7+.** The expensive class of calls. Don't fire real Computer Use against OLT/IRS Solutions until phase 3 of the build. Mock the UI during phase 1–2.

5. **External integrations: mocked during dev.** VCR-style cassettes for HTTP calls, fixtures for OLT pages. Real API hits only on end-to-end demo runs.

6. **Free-tier infrastructure** until first paying customer:
   - Postgres: Neon free tier (or local Docker)
   - Vercel: Hobby
   - Clerk: free (≤10k MAU)
   - Cloudflare R2: pennies/mo at v0 scale

## Budget guardrails per agent

When designing a new agent, set:

```ts
runDocketAgent({
  modelTier: 'haiku-4-5',         // default
  cachedSystem: true,              // always
  maxTokens: 1024,                 // tight cap, raise only if output truncated
  // Promote to 'sonnet-4-6' only when proving production behavior
})
```

## Cost telemetry

Every call goes through `runDocketAgent`, which logs:
- `tenantId`, `agentId`, `actionClass`
- `modelUsed`, `inputTokens`, `outputTokens`, `cachedTokens`, `costUsd`
- `latencyMs`, `success`, `errorMessage`

Aggregate weekly. If any tenant or agent exceeds 2× expected spend, investigate before next iteration.

## Reference numbers (April 2026)

| Model | Input ($/M) | Output ($/M) | Cached input ($/M) |
|---|---|---|---|
| Haiku 4.5 | $0.80 | $4.00 | $0.08 |
| Sonnet 4.6 | $3.00 | $15.00 | $0.30 |
| Opus 4.7 | $15.00 | $75.00 | $1.50 |

A typical hello-world (32 in / 28 out, no cache) on Sonnet = **$0.0005**.
On Haiku = **$0.0001**.
With 5k cached system prompt + 28 out on Haiku = **$0.0001** (cache amortized).

## When to lift the budget

- First Foundation customer signs → their inference is now revenue-funded
- Production demo for a new prospect → fire real Sonnet/Computer Use
- Knowledge ingestion run (one-time, ~$5–$20)

Otherwise: Haiku, cached, mocked.
