# Access Control Policy

**Version:** 1.0
**Effective:** 2026-05-09
**Owner:** Founder (security lead)
**Review cadence:** quarterly + after every personnel change

---

## 1. Purpose

Define how Docket grants, modifies, reviews, and revokes access to production systems, customer data, and supporting infrastructure (cloud accounts, source repositories, vendor consoles, secret stores).

---

## 2. Scope

Covers every system that holds Internal, Confidential, or Restricted data per [`data-classification-and-handling.md`](data-classification-and-handling.md). Specifically:

- Source code: GitHub `minesokim/child-docket` (private repo)
- Production app hosting: Vercel (`docket-command-room`, `docket-portal`)
- Production database: Neon (Launch tier, prod branch)
- Object storage: Cloudflare R2
- Secret store: env vars on Vercel + future Infisical (per L6 lock; not yet adopted)
- Auth provider: Clerk (production instance)
- Background jobs: Inngest production environment
- Observability: Sentry organization
- Vendor consoles: Twilio, DocuSign, Square, Anthropic, AWS (Bedrock fallback)

---

## 3. Identity & authentication

### Personnel (founder + future hires + contractors)

- **MFA mandatory** on every system. No exceptions. SMS-only MFA disallowed for vendor consoles when TOTP is available.
- **Passwords managed in 1Password** (founder's vault; future shared vault when team grows). No passwords in plain text, in commit history, in Slack, or in handoff docs.
- **Hardware security keys (YubiKey)** for the highest-value root accounts: GitHub org owner, Vercel org owner, Neon billing owner, AWS root, Cloudflare root. Founder maintains 2 keys (primary + offsite backup). One per future security lead.
- **GitHub PAT scopes** are minimum-necessary; no `admin:org` on day-to-day tokens. Fine-grained PATs preferred over classic.
- **OAuth tokens** (Gmail per-tenant) are stored encrypted in `tenant_credentials.data` per L10 lock. Never logged. Refresh tokens rotate per Google's defaults.

### Customer firm-owners (tenants)

- Phone-OTP via Clerk + Twilio. The OTP is the auth.
- Phone-binding gate redirects unbound numbers to `/no-access`.
- Future tenants can opt into Clerk Organizations + email/password + TOTP MFA when v1.5 lands the multi-firm flow.

### Customer taxpayers (clients of firm-owners)

- Phone-OTP only. Each firm's clients log in via the firm's portal (`docket-portal.vercel.app`) with the phone they received the invite at.
- No password support. The portal is invite-bound.

---

## 4. Authorization

### Principle: least privilege

Every role gets the smallest set of permissions that lets it do its job. Permissions widen only on demonstrated need (and quarterly access review revokes unused widening).

### App-layer authorization

- **Multi-tenant isolation via Postgres RLS** (`ENABLE + FORCE` on every tenant-scoped table). Every read/write wraps in `withTenant(tenantId, ...)` which `SET LOCAL app.current_tenant_id` for the transaction.
- **Two callers bypass RLS via `getAdminDb()`** — the Clerk-resolution helper in `apps/client-portal/src/lib/intake/auth.ts` and the user-resolution helper in `apps/command-room/src/lib/current-user.ts`. Both have a written justification. **Adding a third caller requires a SECURITY.md justification + founder approval** (CLAUDE.md §18).
- **Role hierarchy** within a tenant: `firm_owner > preparer > reviewer > client`. Permissions checked at server-action level.
- **PII unlock** (SSN/EIN reveal) on command-room is per-session, 15-min TTL, role-gated (firm_owner / preparer / reviewer), 6/min rate-limited, 1 audit row per unlock. See `apps/command-room/src/lib/intake/unlock.ts` + `pii-unlock-button.tsx`.
- **Trust gate** (per-tenant × agent × action-class) substrate exists at `assertTrustGate` (15 tests, commit `3929fef`). Consumer wiring is Phase 3 of v1 plan.

### Infra-layer authorization

- **GitHub:** founder is org owner. `child-docket` repo is private. Branch protection on `main` requires PR + status checks (typecheck, tests, protocol-gate, codex review). No direct pushes to `main`.
- **Vercel:** founder is owner. Deploy-from-main is the production path. Preview deploys for PRs.
- **Neon:** founder is owner. Production branch is the only branch with the production `DATABASE_URL`. Dev branch can be reset; prod cannot.
- **Cloudflare:** founder is owner. R2 buckets are namespaced by tenant. Bucket-level public access disabled by default; only signed URLs serve files.
- **Anthropic / AWS / Twilio / DocuSign / Square:** founder is owner. API keys live in env vars. Rotated on personnel change or suspected compromise.

---

## 5. Provisioning, modification, deprovisioning

### Onboarding (new contractor or hire)

1. Founder creates GitHub account invite (read-only on `child-docket` initially).
2. Founder grants 1Password vault access (project vault).
3. Founder adds to Vercel team (developer role).
4. Onboarding doc walks through MFA setup + reading every policy in `docs/security/`.
5. First commit by new personnel triggers founder review of the onboarding-completion checklist.

### Modification (role change)

1. Founder approves in writing (Slack + commit trailer or PR comment).
2. Permissions updated in each affected system.
3. Logged in `docs/security/access-changes.jsonl` with timestamp, principal, before, after, reason.

### Deprovisioning (offboarding or compromised account)

1. **Within 1 hour:** suspend GitHub access, revoke Vercel membership, expire 1Password vault sharing, expire any vendor console access.
2. **Within 24 hours:** rotate any secret the offboarded principal had access to (env vars on Vercel, vendor API keys, KEKs if relevant).
3. Logged to `docs/security/access-changes.jsonl`.

---

## 6. Periodic access review

**Quarterly.** Founder + (when hired) security lead review:
- Every active GitHub principal on `child-docket` and the org.
- Every active Vercel team member.
- Every active Neon, Cloudflare, Anthropic, Twilio, DocuSign, Square, Sentry seat.
- Every `tenants` row's `clerk_org_id` and the firm-owner principals attached to each Clerk Organization.
- Every API key in env vars (rotated annually minimum, immediately on suspected compromise).

The review produces a list of changes (revocations, role downgrades, key rotations). Logged to `docs/security/access-reviews/`.

---

## 7. Privileged access

The founder currently holds all privileged roles. When the team grows, privileged access is split per the principle of least privilege:

- Production-database write access: only Inngest workers + on-call engineer (with audit trail).
- Production-secret rotation: only the security lead.
- Branch protection bypass: nobody. PR + checks always.
- Customer-data access: only on documented incident or support ticket; logged in audit trail with justification.

---

## 8. Customer-data access (operational)

Docket personnel **do not access customer (taxpayer) data** in the normal course of work. Exceptions:
- Founder support to firm-owner during onboarding (with firm-owner consent).
- Incident response per [`incident-response-plan.md`](incident-response-plan.md).
- Audit chain verification (read-only).

Every customer-data access leaves an audit-chain row. Quarterly review samples 5 random rows and verifies justification.

---

## 9. Anti-patterns blocked

- Shared accounts. Every principal is named.
- Service accounts without rotation policy. Every API key has a documented owner + rotation cadence.
- "Temporary" elevation that becomes permanent. Elevation has an expiration date.
- "Read-only" access to PII without audit logging. Every PII read logs.

---

**Last reviewed:** 2026-05-09 (initial draft, founder)
**Next review:** 2026-08-09
