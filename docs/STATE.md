# Docket — Live State

> *Single source of truth for "what's connected, configured, applied."*
> *Read at session start. Updated when integrations or env state change.*
> *Solves the Twilio-keys-forgetfulness problem — checks here BEFORE asking.*

**Last verified**: 2026-05-09 (manual sync from this session)

---

## How to use this file

If you (Claude) are about to ask the user "do you have X configured" or "can you give me Y key" — STOP and read this file first. If the answer is here, don't ask. If the answer is NOT here, you may ask, AND when you get the answer, update this file in the same commit.

If you're unsure whether something has been done, run `/check-state` for an authoritative status snapshot.

---

## 🔌 Connected systems

| System | Status | Where credentials live | Notes |
|---|---|---|---|
| **Clerk** | ✅ Connected | env vars (`CLERK_*`) | Phone OTP working for Vazant tenant. Free tier up to 10K MAU. |
| **Twilio** | ✅ Connected | `tenant_credentials.data` (encrypted) per tenant | Vazant has SID + sender ID + auth token. SMS in/out flows working (commit `de266f9`). 10DLC campaign registration pending on prod. |
| **DocuSign** | ✅ Connected | `tenant_credentials.data` (encrypted) per tenant | JWT user-app working. Sandbox installed (commit see project memory). KBA via LexisNexis configured. Connect webhook configured manually; polling fallback shipped (`c12c217`). |
| **Square** | ✅ Connected | `tenant_credentials.data` (encrypted) per tenant; env for app-level | Sandbox installed. Square Web Payments SDK B (embedded card form) shipped (`7438e40`). Production switch pending operator. |
| **Gmail** | ✅ Connected | `tenant_credentials.data` (encrypted) per tenant; OAuth refresh token | OAuth working. `gmail-poll.ts` fully shipped + `classify-gmail-message.ts`. Feature flag `ENABLE_GMAIL_POLL` controls cron. |
| **Sentry** | ✅ Connected | env vars (`SENTRY_DSN_*`) per app | Both apps wired with `app:` tag (commits `a122ae5` → `95e2629` → `40c5caa`). Test endpoints allowlisted in Clerk middleware. |
| **Anthropic** | ✅ Connected | env var (`ANTHROPIC_API_KEY`) | Direct API + ZDR. Prompt caching wired into runDocketAgent. |
| **AWS Bedrock** | ✅ Connected (fallback) | env vars (AWS_*) | Bedrock fallback in `runDocketAgent` (commit `303f886`). 38/38 unit + 4/4 smoke tests. |
| **Cloudflare R2** | ✅ Connected | env vars (`R2_*`) | Doc uploads working. Cross-region replication is V1.5. |
| **Neon (primary)** | ✅ Connected | env var (`DATABASE_URL`) | Launch tier ($19/mo, auto-suspend OFF). |
| **Neon (read replica)** | 🟡 Configured but not routed | env var (`DATABASE_URL_READ_REPLICA`) | Substrate exists (`getReadReplicaDb()`). Not yet routing reads. V1.5 wiring per CLAUDE.md `B3`. |
| **Inngest** | ✅ Connected | env vars + Vercel integration | Cron jobs registered: `gmail-poll`, `classify-gmail-message`, `classify-document`, `classify-notice`, `finalize-document`, `verify-actions-chain`, `cost-runaway-alert`, `cost-outlier-alert` (`af808e7`), `cost-spike-alert` (`af808e7`). |
| **Vercel deploys** | ✅ Both apps READY | Vercel dashboard | `docket-command-room` + `docket-portal`. Latest verified READY 2026-05-09 (~2h post-push at that time). |
| **claude-mem** | ✅ Installed (v13.0.1, 2026-05-10) | `~/.claude-mem/` (per-machine, local-only) | Memory across Claude Code sessions. Worker NOT yet started — run `npx claude-mem start` to activate, then keep `http://localhost:37777` open. Memory injection begins on second session per project. Auto-memory currently disabled via `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`. Optional `/learn-codebase` to pre-ingest the repo. |
| **Understand-Anything** | ✅ Installed (Lum1104/Understand-Anything, 2026-05-10) | Claude Code plugin marketplace | Multi-agent codebase knowledge graph. Restart Claude Code to activate. Slash commands: `/understand` (build graph), `/understand-dashboard` (visualize), `/understand-chat` (Q&A), `/understand-diff` (impact), `/understand-explain` (deep-dive), `/understand-onboard` (new-team-member guide), `/understand-domain` (extract business domains). Pairs with /grand-context (file-based) + claude-mem (cross-session) for the full memory stack. |

## 📦 Vendors NOT yet connected

| Vendor | Status | Why deferred / Blocked on |
|---|---|---|
| **Voyage AI** | ⏳ Not yet | Memory layer ingestion not started; will sign up when knowledge corpus ingestion begins (~Phase 2-expansion Wks 4-6). |
| **Cohere Rerank** | ⏳ Not yet | Same as above; needed for memory retrieval pipeline. |
| **Deepgram** | ⏳ Not yet | Voice transcription not yet wired; v1 target. |
| **Gladia** | ⏳ Year 2 | Migrate from Deepgram once $4K/yr commit threshold makes sense (~50 firms with avg 1hr/client/mo voice). |
| **Drata or Vanta** | ⏳ Deferred | SOC 2 attestation tooling. Capital-gated. Controls being built into codebase NOW; tooling lands when capital does. |
| **IRS Tax Pro Account integration** | ⏳ Phase 5 | Browser automation. Antonio uses TPA manually today. Pre-filing IRS reconciliation depends on this. |
| **OLT browser automation** | ⏳ Phase 3-4 | Antonio's tax software. Critical for Docket Prep pillar. 4-6 wk build per target. |
| **Drake browser automation** | ⏳ Phase 4-5 | Largest small-firm install base. After OLT. |
| **Voyage AI for tax-domain embeddings** | ⏳ Same as Voyage above | Lock decision per CLAUDE.md L4. |
| **CA Secretary of State API** | ⏳ Phase 2-expansion | Verified real public API at `calicodev.sos.ca.gov` (subscription-key auth). Integration prototype is part of Foundational substrate Wks 3-4. |
| **FinCEN BOI E-Filing** | ⏳ Phase 2-expansion (Tier 1 compliance) | API exists. Integration is part of BOI reporting feature. |

---

## 🔧 Migrations applied

| Migration | Dev | Prod |
|---|---|---|
| 0000 → 0025 | ✅ | ✅ (per CLAUDE.md previous status) |
| 0026 (signatures envelope_id idx) | ✅ (applied 2026-05-09 via `apply-26-27.ts`) | ⚠️ **NOT YET — waiting on user OK** |
| 0027 (kba-failed signature status) | ✅ (applied 2026-05-09 via `apply-26-27.ts`) | ⚠️ **NOT YET — waiting on user OK** |

To apply pending prod migrations: user authorizes → run `bun run packages/db/scripts/apply-26-27.ts` against PROD `DATABASE_URL`. Idempotent (IF NOT EXISTS guards).

---

## 🌐 Deployed surfaces

| App | URL | Status | Last deploy verified |
|---|---|---|---|
| **command-room** | (Vercel dashboard URL — see `vercel ls` for current production hostname) | ✅ READY | 2026-05-09 |
| **client-portal (production)** | https://docket-portal.vercel.app | ✅ READY | 2026-05-09 |
| **client-portal (legacy demo)** | https://docket-client-portal.vercel.app | ✅ READY (mocks; do NOT point real flows here) | Marketing/Loom only |

---

## 🧪 What's been smoke-tested vs not

✅ Verified end-to-end (smoke or e2e):
- Webhook signature verification (32/32 tests, `b31e91f`+`00cd377`)
- Bedrock fallback (38/38 + 4/4 smoke, `303f886`)
- Audit chain (chain_seq + prev_hash + row_hash, `0680874`+`5b4ef92`)
- AAD-bound AES-GCM (`2c5db11`, 7 new tests, 34/34 encryption tests)
- KEK rotation (rotate-kek.ts, `3bd42b1`)
- Cost outlier + spike alerts (smokes shipped `5b5bb4e`)
- Notice-drafter trust gate (`494cb66`, 4 codex passes)
- /e2e suite (last passed at `5b5bb4e`, 2026-05-09)

🟡 Substrate-shipped, not yet smoke-tested in flow:
- DocuSign void-envelope (`6ecb672`, manual flow not yet exercised)
- TCPA SMS consent flow (`73ee0db`, no real client signing yet)

⏳ Not built yet (per Phase 2-expansion roadmap):
- CA SoS API integration
- BOI reporting flow
- HoH qualification sub-flow
- MFS Form 8958 allocation
- Audit defense workspace
- Pre-filing IRS reconciliation
- Existing client migration / OLT export parser
- Prior-year return parser
- White-label firm branding
- Multi-entity typed graph
- All 5 grand-vision pillars at full depth

---

## 🛠 Active development tasks

| Task | Status | Spawned where |
|---|---|---|
| Intake "Take photo" + upload-arrow dead links (P0 from Antonio call) | 🟡 Spawned task in flight | session-spawn-task chip; touching `apps/client-portal/src/app/portal/docs/page.tsx` |
| Entity-type branching (Corp showing W2) (P0 from Antonio call) | 🟡 Spawned task in flight | session-spawn-task chip |
| Background codex-rescue on prior 8 commits | 🟡 Running (long-running agent) | spawned at start of 2026-05-09 session |

---

## 🔐 SOC 2 controls — currently in codebase

✅ Already built (architecturally):
- Per-tenant DEK encryption (AES-256-GCM, two-tier KEK + DEK, AAD-bound)
- Cryptographic audit chain (chain_seq + prev_hash + row_hash, `0680874`+`5b4ef92`)
- RLS policies on every tenant-scoped table (migration 0001)
- KEK rotation runbook + script (`2d63206` + `3bd42b1`)
- Per-tenant DEK rotation walker (`reencrypt-legacy.ts`)
- MFA via Clerk (phone OTP)
- Encryption-at-rest (Neon TLS storage; R2 server-side encryption)
- Encryption-in-transit (HTTPS everywhere; TLS 1.3 for DB connections)
- Webhook HMAC signature verification (`@docket/shared/webhooks`, 32/32 tests)
- Append-only audit trail (migration 0007 trigger)
- PII regex scrubber (`8f0c2d5`, 32 tests)
- Anti-tampering hooks (protocol-gate, codex review enforcement)

⏳ Documentation work (`docs/security/` stub coming):
- Information security policy (formal doc)
- Access control policy
- Change management policy
- Incident response plan
- Vendor management policy
- Business continuity plan
- Employee training cadence
- Cyber insurance certificate

When capital arrives, Drata/Vanta reads existing posture + documentation; we pay for attestation, not re-architecture.

---

## 📝 How to update this file

This file is the runtime answer to "is X configured?" Keep it accurate.

**Update triggers**:
- Any commit touching `tenant_credentials.ts`
- Any new MCP server or external integration
- Any migration applied (dev OR prod)
- Any deploy verified READY post-push
- Any vendor signup

**Frequency**: should be updated within the SAME commit that changes the underlying state. Drift between this file and reality is the bug it's designed to prevent.

If you find STATE.md is out of date, fix it in your current commit and add a Compliance-Check trailer noting the sync.
