# Docket — Live State

> *Single source of truth for "what's connected, configured, applied."*
> *Read at session start. Updated when integrations or env state change.*
> *Solves the Twilio-keys-forgetfulness problem — checks here BEFORE asking.*

**Last verified**: 2026-05-12 morning (rolling sync — 5/10 added the 12-doc SOC 2 set + PRODUCT-ROADMAP grand-vision update + BUILD-KICKOFF-2026-05-11 + 7-doc accelerator-applications draft batch + Understand-Anything Saturday-evening cadence; 5/11 morning added two P0 fixes from Antonio call (entity-filing W2 skip faaa579 + portal/docs Take-photo wire-up 9975978) + intake-frame.tsx 'use client' unblocker 961857b + /e2e PASS 8/8 at 961857b + claude-mem worker started + Understand-Anything plugin built + OVERNIGHT-HANDOFF-2026-05-10.md; 5/11 afternoon added Haokun co-founder lock + Antonio 1% advisor + Option B positioning + §6695(g) penalty-anchored pricing + Coverage Map + SOC 2 Type I outreach + Contracted Expert Outreach + Cyber Insurance Recommendation + 5 audience-segmented pitch decks + Vory founder video scripts + ICP wedge specification + 6 accelerator applications refreshed + YC Fall 2026 application; 5/11 evening added L16 lock for 100-customers-by-8/1 + DESIGN-PARTNER-ACQUISITION-PLAN.md + cold-outreach playbook + DISCOVERY-SCAN-OPERATIONAL.md (fe01250) + landing page copy x3 + email template suite + Discovery Scan sample PDF + PRICING-PAGE-SPEC + WISP draft + OVERNIGHT-HANDOFF-2026-05-11.md; **5/11 late evening: C1 production-coding commit 851894c — feat(intake) AAD-bound encryption on intake-write + all 8 readers migrated + reencrypt-walker AAD-aware + script threads aadBuilder + 17 new tests; 3 rounds of codex review (5 findings + clean round 3); /e2e PASS 8/8 at 851894c1; closes CLAUDE.md §15 Phase 2 AAD-binding gap**)

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
| **claude-mem** | ✅ Installed (v13.0.1) + worker ready (2026-05-11) | `~/.claude-mem/` (per-machine, local-only); marketplace plugin at `~/.claude/plugins/marketplaces/thedotmack/plugin/` | Memory across Claude Code sessions. **Windows-quirk fix applied 2026-05-11**: marketplace plugin missing `node_modules` (zod/v3 import failed); ran `pnpm install --ignore-scripts --no-frozen-lockfile` in marketplace plugin dir to populate deps. Worker now reports `{"status":"ready"}` on `npx claude-mem start`. Memory injection begins on second session per project. Auto-memory disabled via `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`. Optional `/learn-codebase` to pre-ingest the repo. |
| **Understand-Anything** | ✅ Installed + **built** (Lum1104/Understand-Anything v2.6.3, 2026-05-11) | Claude Code plugin marketplace at `~/.claude/plugins/cache/understand-anything/understand-anything/2.6.3/` | Multi-agent codebase knowledge graph. **Windows-quirk fix applied 2026-05-11**: marketplace install ships source only, no `dist/`; ran `pnpm install --prod=false && pnpm -r build` in plugin root to populate `packages/core/dist/` + `packages/dashboard/dist/`. Slash commands: `/understand` (build graph), `/understand-dashboard` (visualize), `/understand-chat` (Q&A), `/understand-diff` (impact), `/understand-explain` (deep-dive), `/understand-onboard` (new-team-member guide), `/understand-domain` (extract business domains). Pairs with /grand-context (file-based) + claude-mem (cross-session) for the full memory stack. **Cadence (locked 2026-05-09)**: rebuild `/understand` graph every Saturday evening (end of sprint). Run `/understand-onboard` the day a new hire signs. Run `/understand-diff` before any migration crossing 3+ packages. Run `/understand-domain` when tax co-founder asks "where does X live?". Claude calls `/understand` at session start when the task spans more than one package. **Phase 0.5 .understandignore already generated at `.understand-anything/.understandignore`** (493 analyzable files in repo, will hit Phase 1 100-file gate). First full-repo analysis deferred to 5/11 Saturday cadence. |

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
| 0026 (signatures envelope_id idx) | ✅ (applied 2026-05-09 via `apply-26-27.ts`) | ✅ (confirmed 2026-05-11 via `apply-26-27.ts` against PROD DATABASE_URL pulled from Vercel) |
| 0027 (kba-failed signature status) | ✅ (applied 2026-05-09 via `apply-26-27.ts`) | ✅ (confirmed 2026-05-11 — Postgres NOTICE "enum label kba-failed already exists, skipping") |
| 0028 (authority_chunks.embedding vector(1024) + HNSW index) | ✅ (applied 2026-05-12 via `apply-28.ts`) | ✅ (same Neon endpoint per below) |

**Important discovery 2026-05-11**: PROD `DATABASE_URL` (pulled from Vercel via `vercel env pull --environment=production`) and local `.env.local` `DATABASE_URL` point to the **same Neon endpoint** (`ep-twilight-violet-anb70ud4`), only differing by pooler suffix. So the 2026-05-09 "dev" application was effectively against the same database as prod. The 2026-05-11 re-run via the Vercel-pulled URL is now the formal confirmation. STATE.md previously called this a "dev vs prod" delta — that was inaccurate. There's only one Neon branch active.

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
| Intake "Take photo" + upload-arrow dead links (P0 from Antonio call) | ✅ Shipped 9975978 | session-spawn-task chip |
| Entity-type branching (Corp showing W2) (P0 from Antonio call) | ✅ Shipped faaa579 | session-spawn-task chip |
| Background codex-rescue on prior 8 commits | ✅ Closed | 2026-05-09 |
| **100-by-8/1 acquisition sprint** | 🟢 ACTIVE (L16-locked) | DESIGN-PARTNER-ACQUISITION-PLAN.md + cold-outreach playbook + landing-pages/ + email-templates + Discovery Scan operational + PRICING-PAGE-SPEC + WISP |
| Discovery Scan landing page (`/scan` route in client-portal) | ⬜ Spec'd, Haokun queue | DISCOVERY-SCAN-OPERATIONAL.md + discovery-scan-landing-copy.md — target 5/25 |
| Discovery agent (`services/workers/src/agents/discovery-agent.ts`) | ⬜ Spec'd, Haokun queue | DISCOVERY-SCAN-OPERATIONAL.md Discovery agent tech spec — target 6/8 |
| Cost-of-Not-Using calculator widget (`/pricing`) | ⬜ Spec'd, Haokun queue | PRICING-PAGE-SPEC.md — target 6/8 |
| Voice-pass on 9 new docs (landing pages + emails + Discovery sample PDF + WISP) | ⬜ David action | This week before production deploy |
| Sales VA hire ($20-40/hr, 10-20 hrs/wk) | ⬜ David action | Target hire: 5/31 |
| Boney-Henderson presentation (Antonio's mentor network, 1000+ preparers) | ⬜ Antonio + David action | Target delivery: Week 4 (~6/1) |
| **C1 AAD on intake-write** | ✅ Shipped 851894c (2026-05-11 late evening) | All 8 readers migrated to AAD-aware decrypt; walker AAD-aware; script threads aadBuilder; 17 new tests; 3 rounds codex (5 findings + clean round 3); /e2e PASS at 851894c1 |
| **C2 AAD on tenant-credentials** | ✅ Shipped 646c124 (2026-05-12 morning) | setTenantCredential + getTenantCredential migrated; AAD=`deriveAAD({tenantId, path: kind})`; smoke-credentials-roundtrip OK for all 4 kinds (twilio/square/docusign/gmail) + rotation + delete + validator; codex clean first-round; /e2e PASS at 646c1243. Twilio inbound webhook pre-existing bugs spawned as separate task (out of scope). |
| **C4 migration 0028 — embedding column on authority_chunks** | ✅ Shipped ab46c05 (2026-05-12) | vector(1024) column + HNSW index (vector_cosine_ops); Drizzle `vector1024` customType; apply-28.ts smoke confirmed column + index + non-colinear cosine ordering (A=0/B=0.5/C=2) + BM25 co-existence; 2 rounds codex (round 1: 2 findings P1 bootstrap + P2 colinear vectors, both fixed; round 2 clean); /e2e PASS at ab46c057; `bootstrap` script added to packages/db/package.json chaining drizzle-kit migrate + apply-17-22 + apply-26-27 + apply-28 for fresh-env onboarding. Unblocks C5 (Position Library ingestion) + C6 (PostgresRetriever). |
| C3 reencrypt-legacy-walker run against PROD + remove master-KEK fallback | ⬜ Queued (gated on C1 + C2 complete) | Operational + 1 code commit. Closes the master-KEK SOC 2 audit smell |
| C4 embedding column migration 0028 (vector(1024) + IVF index) | ⬜ Queued | Unlocks Discovery agent retrieval substrate |
| C5 Position Library v0 ingestion script | ⬜ Queued | Reads `content/position-library/v0/positions/*.md` (20 entries) → `authority_chunks` rows |
| C6 PostgresRetriever (BM25 + cosine + score fusion) | ⬜ Queued | Implements `KnowledgeRetriever` interface in `packages/tax-graph` |
| C7-C12 Discovery agent + PDF + Resend delivery | ⬜ Queued | Target 6/8 per Phase 3 production coding plan |

---

## 🔐 SOC 2 controls — currently in codebase

✅ Already built (architecturally):
- Per-tenant DEK encryption (AES-256-GCM, two-tier KEK + DEK, **AAD-bound on intake_responses since 851894c + tenant_credentials since 646c124. Remaining: C3 — run reencrypt-legacy walker against PROD to migrate any remaining master-KEK leaves; C4 — remove master-KEK fallback in encryption.ts**)
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

✅ Documentation work shipped (in `docs/security/`):
- Information security policy ✅ shipped 5/9 (f4e8c2e)
- Access control policy ✅ shipped 5/9
- Change management policy ✅ shipped 5/9
- Incident response plan ✅ shipped 5/9
- Vendor management policy ✅ shipped 5/9
- Business continuity plan ✅ shipped 5/9
- Employee training cadence ✅ shipped 5/9
- Data classification and handling ✅ shipped 5/9
- Logging and monitoring ✅ shipped 5/9
- Risk management policy ✅ shipped 5/9
- Controls matrix (SOC 2 criterion → control → file mapping) ✅ shipped 5/9
- **WISP (Written Information Security Plan)** ✅ shipped 5/11 (this session) — IRS Pub 4557 + FTC Safeguards Rule + MA 201 CMR 17 compliant

⏳ Still pending (operational, not documentation):
- Cyber insurance certificate — target 5/16 binding via Vouch primary + Embroker backup per `docs/CYBER-INSURANCE-RECOMMENDATION.md`
- Drata or Vanta vendor engagement — target within 5 business days per `docs/SOC2-TYPE-I-OUTREACH.md` (Q4 2026 Type I attestation goal)
- David + Haokun WISP signature acknowledgment
- Legal counsel review of WISP (optional but recommended)

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
