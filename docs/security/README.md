# Docket Security Posture

> *Per L8 lock (CLAUDE.md): build SOC 2 Type II controls into the codebase NOW, document policies in `docs/security/`, defer Drata/Vanta tooling until capital lands.*
> *When capital arrives, the auditor reads the existing posture; we pay for attestation, not for re-architecture.*

**Last reviewed:** 2026-05-09

---

## What this directory is

The complete SOC 2 Type II policy + procedure set that documents controls that already live in the Docket codebase. Reading order:

1. [`information-security-policy.md`](information-security-policy.md) — overarching policy, scope, roles, responsibilities
2. [`access-control-policy.md`](access-control-policy.md) — identity, authentication, authorization, periodic access review
3. [`change-management-policy.md`](change-management-policy.md) — code review, protocol gate, deploy gates, rollback
4. [`incident-response-plan.md`](incident-response-plan.md) — detect → escalate → contain → eradicate → recover → post-mortem
5. [`vendor-management-policy.md`](vendor-management-policy.md) — vendor list, sub-processor map, exit plans
6. [`business-continuity-plan.md`](business-continuity-plan.md) — RTO/RPO, backup strategy, DR drills
7. [`data-classification-and-handling.md`](data-classification-and-handling.md) — Public / Internal / Confidential / Restricted, encryption, retention
8. [`logging-and-monitoring.md`](logging-and-monitoring.md) — what is logged, where it goes, how alerts fire
9. [`employee-training-and-awareness.md`](employee-training-and-awareness.md) — onboarding, annual refresh, phishing simulation
10. [`risk-management-policy.md`](risk-management-policy.md) — risk register, scoring, treatment, review cadence
11. [`controls-matrix.md`](controls-matrix.md) — every SOC 2 CC, A, C, P criterion mapped to the file/commit/runbook implementing it

---

## Trust Services Criteria in scope

For v1: **Security + Availability + Confidentiality**.

- **Security (CC1–CC9)** — full coverage; controls implemented, documentation present.
- **Availability (A1)** — covered via `business-continuity-plan.md`. RTO 4h, RPO 1h for production.
- **Confidentiality (C1)** — covered via `data-classification-and-handling.md` + per-tenant DEK encryption.
- **Processing Integrity (PI1)** — deferred to v1.5 (depends on agent fleet maturation; meanwhile: rules-layer arithmetic is outside the LLM, every agent output cited, audit chain immutable).
- **Privacy (P1–P8)** — deferred. PII handling is documented in `data-classification-and-handling.md` but formal Privacy attestation requires CCPA / CPA / state-privacy-law mapping work that is not v1 scope.

---

## Architecturally implemented controls (already in codebase)

These do NOT need to be built; they need to be audited.

| Control | Where it lives | Commit / file |
|---|---|---|
| Per-tenant DEK encryption (AES-256-GCM, two-tier KEK + DEK, AAD-bound) | `packages/db/src/encryption.ts` | `2c5db11` (AAD binding) + 34/34 tests |
| Cryptographic audit chain (chain_seq + prev_hash + row_hash) | `packages/db/migrations/0007_*.sql` + nightly verifier | `0680874` + `5b4ef92` |
| Row-level security (RLS) on every tenant-scoped table | `packages/db/migrations/0001_*.sql` (ENABLE + FORCE) | n/a — substrate from day 1 |
| KEK rotation runbook + script | `packages/db/scripts/rotate-kek.ts` | `2d63206` + `3bd42b1` |
| Per-tenant DEK rotation walker | `packages/db/scripts/reencrypt-legacy.ts` | n/a |
| MFA via Clerk (phone OTP) | `apps/client-portal/src/lib/intake/auth.ts` | n/a |
| Encryption at rest (Neon TLS storage; R2 server-side encryption) | infra defaults | n/a |
| Encryption in transit (HTTPS everywhere; TLS 1.3 for DB) | Vercel + Neon defaults | n/a |
| Webhook HMAC signature verification | `@docket/shared/webhooks` | `b31e91f` + `00cd377` (32/32 tests) |
| Append-only audit trail | `packages/db/migrations/0007_*.sql` (trigger) | n/a |
| PII regex scrubber | `packages/shared/src/scrub-pii.ts` | `8f0c2d5` (32 tests) |
| Anti-tampering protocol gate | `scripts/protocol-gate.ts` + `.githooks/commit-msg` | enforced as of 2026-05-08 |
| Codex review enforcement on every feat/fix | `scripts/protocol-gate.ts` + Codex-Reviewed trailer | baked-in 2026-05-09 |
| Bedrock fallback for vendor resilience | `services/orchestrator/runDocketAgent` | `303f886` (38/38 unit + 4/4 smoke) |
| Health gate + read-only mode | `apps/*/src/app/api/health/*` + `HealthStatusGate` | `c72ba1b` + `0521701` |

---

## Documentation work (this directory)

These are the formal policy docs the auditor reads. Each one references the implementing commit / file from the table above and adds the policy framing (purpose, scope, roles, review cadence).

When Drata or Vanta lands, they ingest this directory + the controls matrix + the audit chain export. The attestation delta is the gap between "controls work" and "controls work AND the policy says so AND we can prove enforcement at every quarterly review."

---

## Update discipline

- Any change to a security control updates the implementing file + the matching policy doc in the same commit.
- Quarterly review: the founder + (when hired) the security-and-compliance lead read every doc in this directory; bump `Last reviewed` dates; surface deltas in `/decisions-log`.
- Annual: external auditor (Drata or Vanta) reads the whole set + samples evidence (audit-chain rows, access-review logs, change-management commit history, vendor exit-plan tests). Findings file as protocol-skip entries with remediation deadlines.

If you find a doc here is out of date, fix it in your current commit and add a Compliance-Check trailer noting the sync.
