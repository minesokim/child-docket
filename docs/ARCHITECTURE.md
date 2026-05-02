# Docket — Architecture (May 2026)

The current-state diagram. What's running in production today, what the trust boundaries are, what crosses each one. Read CLAUDE.md first for the strategic posture; this doc covers the wiring.

> **Scope.** v0 production rebuild (`apps/client-portal` + `apps/command-room` + `packages/*`). The orchestrator + MCP gateway + browser-automation workers are scaffolded but not wired into the runtime path yet — see [§ Future surfaces](#future-surfaces).

---

## 1. Top-down view

```
                         ┌──────────────────────────────────────┐
                         │ Client (mobile Safari, 390×780)      │
                         │   Real taxpayer logging in via SMS   │
                         └────────────────┬─────────────────────┘
                                          │ HTTPS only
                                          ▼
                         ┌──────────────────────────────────────┐
                         │ Vercel Pro (apps/client-portal)      │
                         │   Next.js 15 App Router              │
                         │   Server Components + Server Actions │
                         │                                      │
                         │   ── Clerk middleware ──             │
                         │     phone-OTP session, JWT in cookie │
                         │                                      │
                         │   ── Rate limit (token bucket) ──    │
                         │     per-userId, in-process           │
                         │                                      │
                         │   ── Server Action / API route ──    │
                         │     (intake/auth.ts → read/write/    │
                         │      reveal/complete)                │
                         └────────────────┬─────────────────────┘
                                          │ encrypted Postgres conn (TLS)
                                          ▼
              ┌────────────────────────────────────────────────────┐
              │ Neon Postgres 16 + pgvector                        │
              │   ┌──────────────────────────────────────────────┐ │
              │   │ Per-request tx:                              │ │
              │   │   SET LOCAL app.current_tenant_id = '<id>';  │ │
              │   │   <queries with RLS active>                  │ │
              │   │ COMMIT;                                      │ │
              │   └──────────────────────────────────────────────┘ │
              │                                                    │
              │   tenants            (NOT tenant-scoped, gated)    │
              │   users              (RLS-scoped)                  │
              │   clients            (RLS-scoped)                  │
              │   intake_responses   (RLS-scoped, JSONB encrypted) │
              │   actions            (RLS-scoped, append-only)     │
              │   documents / messages / signatures / approvals…   │
              │                                                    │
              │   pgvector embeddings (Phase 2)                    │
              └────────────────────────────────────────────────────┘
```

External services that the request path touches:

| Service | Purpose | Where |
|---|---|---|
| Clerk | Phone-OTP auth + session | `middleware.ts` + every Server Action |
| Twilio | SMS delivery for Clerk OTP | Behind Clerk |
| Sentry | Error capture (PII-scrubbed) | Both apps + every API route |
| Vercel | Hosting + edge cache + cron | Build/deploy pipeline |

External services that DON'T touch the v0 request path (yet):

- Cloudflare R2 (Phase 2 — docs pipeline)
- Square Checkout API (Day 8–9)
- DocuSign embedded signing + KBA (Day 13)
- Inngest (Phase 2 — durable workers)
- OLT + IRS Solutions browser automation (Phase 3)

---

## 2. Multi-tenant isolation

Two layers in series. Both must hold.

### Layer 1 — Postgres RLS

Every tenant-scoped table has `tenant_id NOT NULL`. The Server Action wraps every DB call in `withTenant(tenantId, async (db) => …)`. That helper:

1. Opens a Postgres tx
2. Runs `SET LOCAL app.current_tenant_id = <id>`
3. Hands the tx to the callback as `db`
4. Commits (or rolls back)

`SET LOCAL` is tx-scoped. The setting evaporates at COMMIT — no leakage to the next pooled connection. The RLS policy on each table is `tenant_id = current_tenant_id()`, where `current_tenant_id()` reads `app.current_tenant_id`. No tenant context → zero rows returned (**fail-closed**).

The migration that wires this lives in `packages/db/migrations/0001_rls_policies.sql`. The regression suite proves it: see `packages/db/test/rls.test.ts` (set tenant A, get only A; switch to B, get only B; cross-tenant INSERT rejected by `WITH CHECK`).

### Layer 2 — Per-tenant data encryption (DEK)

Sensitive fields (SSN, EIN, bank routing, bank account) are encrypted at REST in JSONB using AES-256-GCM with a per-tenant Data Encryption Key (DEK):

```
┌──────────────────────────────────────────────────────────────┐
│ Master KEK  (env var DOCKET_MASTER_KEK_BASE64)               │
│   AES-256, never on disk, never in DB                        │
│                                                              │
│ Per-tenant DEK  (random 32 bytes, stored encrypted)          │
│   tenants.dek_encrypted = AES-GCM(KEK, dek_plaintext)        │
│   getTenantDek(id) decrypts on first use, in-memory cache    │
│                                                              │
│ Field encryption                                             │
│   {iv: <96-bit>, data: <ciphertext>, tag: <128-bit>}         │
│   Stored as a small JSON object inline in the JSONB tree     │
└──────────────────────────────────────────────────────────────┘
```

Code path:

- `encryptIfMarked(value, dek)` — ENCRYPTING_PATHS list flags which leaves to wrap
- `decryptTree(node, dek)` — recursive tree walk, decrypts every marked node
- `maskSensitiveFields(tree)` — replaces decrypted SSN/EIN/bank with `·····6789` sentinels before any tree leaves the server
- `revealIntakeField(path)` — server action that returns plaintext for ONE path, audit-logs the read, rate-limited to 30/min/userId

A tenant's data, even if exfiltrated wholesale from Postgres, is unreadable without the master KEK. The master KEK + the per-tenant DEK are independent compromise surfaces — one alone gives nothing.

### Master-KEK fallback (transitional)

`decryptIfMarkedForTenant` has a master-KEK fallback for legacy data encrypted before the per-tenant DEK migration. To be removed by a one-time re-encryption migration script (Step 10 in the hardening plan).

---

## 3. Audit boundary — every write + every reveal

Every mutation touches `actions`. Every plaintext read of a sensitive field touches `actions`. The table is RLS-scoped + (Step 7) append-only via Postgres trigger.

```
intake_responses INSERT/UPDATE        ──▶  actions (action_class: 'mutate-intake')
revealIntakeField(path)               ──▶  actions (action_class: 'read', toolInput: { path })
saveIntakeField(path, v)              ──▶  actions (action_class: 'mutate-intake')
completeIntake()                      ──▶  actions (action_class: 'send-internal')
```

The action log entry shape is in `packages/shared/src/index.ts → ActionLogEntry`. Field of note: `costUsd` + `latencyMs` + `modelUsed` will be populated once Claude inference lands (Phase 2). For v0 they're nulls on every entry.

**SOC 2 evidence trail.** Every audit needs answers to "who saw what plaintext, when, for which reason." The actions table answers all four; the per-tenant DEK + RLS ensures cross-tenant evidence stays cross-tenant.

---

## 4. Request lifecycle — the canonical happy path

A taxpayer enters their SSN on the Personal screen.

1. `<input>` onChange → `useIntakeField('personal.ssn').setValue(rawDigits)`
2. `IntakeProvider` updates local React state SYNCHRONOUSLY (UI feels instant)
3. 400ms debounce fires → `saveIntakeField('personal.ssn', '123456789')` — a Server Action
4. Server Action:
   1. `auth()` (Clerk) → `userId`. Reject 401 if missing
   2. `consumeRateToken(\`save:${userId}\`, 60, 60_000)` → reject 429 if exhausted
   3. `getOrCreateClient(userId)` → resolve `tenantId + clientId` (race-safe insert)
   4. `getSchemaForPath('personal.ssn')` → Zod schema for SSN
   5. `schema.safeParse('123456789')` → reject 400 if malformed
   6. `withTenant(tenantId, async (db) => { … })`:
      a. `SELECT … FOR UPDATE` row lock on `intake_responses`
      b. Decrypt the answers tree with the tenant's DEK
      c. `setAtPath(answers, 'personal.ssn', '123456789')`
      d. Encrypt the path's leaf back with the DEK
      e. `UPDATE intake_responses SET answers = …`
      f. `INSERT INTO actions (action_class, tool_name, tool_input, …)` — audit log, fatal if it fails (no swallowing)
   7. Return the answers tree with `maskSensitiveFields` applied — the SSN comes back to the client as `·····6789`
5. Client receives masked tree. Local state stays as the user's typed plaintext until next debounce save (no clobber on stale response)

When the user clicks the SSN field to edit it later:

1. `<SSNField onReveal={revealSsn}>` calls `revealIntakeField('personal.ssn')` — a server action
2. Same auth + rate-limit gate (30/min for reveals, stricter than saves)
3. `withTenant`-scoped read, decrypt the leaf, audit-log the read
4. Plaintext returned to the input. Edit. Save runs the same write pipeline.

---

## 5. Encryption-at-rest + audit boundary diagram

```
   Server-side                            │      Client-side (browser)
                                          │
   plaintext in memory ──┐                │
                         │                │
                         ▼                │
   encryptIfMarked(dek) ──┐               │
                          │               │
                          ▼               │
   {iv,data,tag} JSON ────┐               │
                          │               │
                          ▼               │
   ┌────────────────┐   ┌──────────────┐  │   ┌──────────────────┐
   │ intake_        │   │ actions      │  │   │ React state      │
   │  responses     │   │   (audit)    │  │   │ (plaintext while │
   │  JSONB encrypt │   │              │  │   │  user is typing) │
   └────────────────┘   └──────────────┘  │   └──────────────────┘
        ▲                                 │           ▲
        │                                 │           │
   ┌────┴───────────┐                     │   ┌───────┴──────────┐
   │ decryptTree    │                     │   │ maskSensitive    │
   │   + maskSensit │                     │   │   sentinels       │
   │   on SELECT    │                     │   │   '·····6789'     │
   └────────────────┘                     │   └──────────────────┘
                                          │
   ───────  TRUST BOUNDARY  ──────────────┼───────────────────────
                                          │
   Plaintext can only cross this line via revealIntakeField,
   which is audit-logged + rate-limited.
```

---

## 6. Workspace map

```
docket/
├── apps/
│   ├── client-portal/        Live: Antonio's clients sign in here
│   │                         (apps/client-portal/CLAUDE.md has the routes)
│   ├── command-room/         Live: Antonio's admin dashboard
│   └── admin/                Empty — platform-admin surface, post-5/15
├── services/
│   ├── orchestrator/         Scaffolded: Claude Agent SDK + Docket layer
│   └── workers/              Scaffolded: Inngest jobs (Phase 2)
├── mcp-servers/              Empty — every MCP server lands here Phase 2+
├── packages/
│   ├── db/                   Drizzle schema, migrations, RLS, encryption
│   ├── shared/               Cross-app types, validators, formatters
│   └── ui/                   Design primitives + tokens
├── content/
│   ├── authority/            Empty — IRS/FTB ingest lands here Phase 2
│   └── strategy-library/     Internal playbooks (the moat)
├── docs/
│   ├── ARCHITECTURE.md       (this file)
│   ├── STRATEGIC-BRIEF.md
│   ├── DECISION-JOURNEY.md
│   ├── DOCS-CAPTURE-PIPELINE.md
│   ├── HOSTING.md
│   └── PERSONA.md
├── COSTS.md
├── CLAUDE.md                 The canonical project context
└── README.md
```

---

## 7. Future surfaces (post-5/15)

The following are scaffolded but not yet on the runtime path. Marked here so the diagram doesn't go out of date the moment they ship.

### Orchestrator (services/orchestrator/)

Wraps the Claude Agent SDK. Adds: per-tenant Anthropic API call routing, prompt-cache + cost telemetry, MCP-tool dispatch, trust-level gating before any external action. Every agent run goes through one entry point: `runDocketAgent({ tenantId, agentId, …input })`.

### MCP gateway (services/mcp-gateway/)

Tool registry + tenant scoping. Same MCP transport; Docket layer adds (a) tenant-scoped tool credentials from Infisical, (b) audit-log envelope around every tool call, (c) trust-gate refusal for `mutate-tax-software` / `file` actions when the tenant is below the required level.

### MCP servers (mcp-servers/)

`ledger`, `knowledge`, `gmail`, `xero`, `portal` first. Then `documents`. Then `olt` + `irs-solutions` (browser automation, Playwright workers in `services/workers/`).

### Inngest workers (services/workers/)

Durable execution for multi-minute browser automation runs. Resumable. Per-tenant credential vault attached to each job.

### Cloudflare R2

Document upload pipeline. Presigned URL on upload → Inngest job (Haiku 4.5 vision: classify + extract + filename JSON) → pdf-lib wrap → R2 upload → `documents` row created with status=`awaiting_review`.

---

## 8. What's NOT in this architecture

These are explicit non-goals or decisions the diagram should not mislead a reader about:

- **No Python service.** TS end-to-end. Browser-automation workers run TS Playwright, not Selenium-Python.
- **No Bedrock at v0.** Direct Anthropic + ZDR. Bedrock becomes a per-tenant flag if/when a compliance customer asks.
- **No service mesh.** Vercel + Neon + Sentry + Clerk + Twilio. v0 doesn't need k8s or Istio.
- **No separate vector DB.** pgvector inside the same Postgres. Phase 2.
- **No third-party tax-knowledge vendor.** Bloomberg / CCH / Checkpoint deferred indefinitely. Tier 1 (IRS / FTB primary sources) + Tier 3 (internal playbooks) are the moat.
- **No client-side encryption.** Plaintext crosses TLS to the server, gets encrypted there. Client-side encryption would prevent server-side validation + masking + reveal-audit-logging, all of which are SOC 2 evidence.
- **No password-based auth.** Phone-OTP only. Removes a large class of credential-stuffing + password-reuse attacks.

---

## 9. References

- [`packages/db/README.md`](../packages/db/README.md) — schema, RLS, migrations, encryption helpers
- [`packages/shared/README.md`](../packages/shared/README.md) — cross-app types, validators, formatters
- [`packages/ui/README.md`](../packages/ui/README.md) — design primitives + tokens
- [`docs/STRATEGIC-BRIEF.md`](./STRATEGIC-BRIEF.md) — strategic posture (services-first, agentic operator)
- [`docs/HOSTING.md`](./HOSTING.md) — Vercel Pro + Neon Launch + Fly.io plan
- [`docs/DOCS-CAPTURE-PIPELINE.md`](./DOCS-CAPTURE-PIPELINE.md) — Phase 2 docs pipeline design
- [`CLAUDE.md`](../CLAUDE.md) — canonical project context, build order, persona

*Last updated: May 1, 2026.*
