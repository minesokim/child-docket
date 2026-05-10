# Change Management Policy

**Version:** 1.0
**Effective:** 2026-05-09
**Owner:** Founder (engineering lead)
**Review cadence:** quarterly + after every protocol-gate change

---

## 1. Purpose

Define how changes to Docket production code, infrastructure, secrets, and documented controls are reviewed, approved, deployed, monitored, and rolled back. The objective is auditable change history with structural enforcement (hooks, not docs).

---

## 2. Scope

Every change to:
- Source code in `child-docket` (apps, services, packages, mcp-servers, scripts, content, docs)
- Database migrations (`packages/db/migrations/*`)
- Environment variables on Vercel (production)
- Vendor configurations (Twilio numbers, DocuSign templates, Square webhook endpoints)
- Documented policies in `docs/security/`
- Locked decisions in `CLAUDE.md` §🔒

---

## 3. Change classification

| Class | Examples | Approval | Review depth |
|---|---|---|---|
| **Standard** | feat / fix commits in apps + services + packages + scripts; docs updates | Self-approval via passing protocol-gate (typecheck + tests + Codex-Reviewed + Score≥95 + Align ALIGNED + Craft + Compliance-Check) + branch-protected merge | Codex review on every feat/fix |
| **Substantial** | Schema migration (new table or destructive); new external vendor integration; auth flow change | Founder explicit approval + codex review + dev-branch test + smoke-test before prod | Codex review + design doc + smoke-test |
| **Emergency** | Production outage hotfix | Founder approval, Protocol-Skip allowed with >=10-char reason; root-cause + remediation tracked | Post-mortem within 48h |
| **Locked** | CLAUDE.md L1–L15 changes | `/decisions-log` entry first + written counter-case + founder approval + lock-mirror update | Same as substantial + decisions-log audit |

---

## 4. Standard change workflow

1. Branch off `main`.
2. Implement; run `/edge-cases` BEFORE writing code; enumerate 8–15 cases (per CLAUDE.md §23).
3. Pass `/code-quality` BEFORE commit (typecheck, tests, no console.log, no undocumented `any`, lockfile-package.json sync, pattern adherence, error handling, comment quality, atomicity).
4. UI-touching commits: pass `/craft` (Apple-bar UX gate).
5. Run `bash scripts/codex-review-staged.sh` (wraps `codex review --uncommitted`); fix all findings.
6. Commit with the required trailers per CLAUDE.md §23 (Edge-Cases, Score, Align, Craft, Codex-Reviewed, Decisions, Compliance-Check). The pre-commit + commit-msg git hooks block commits missing trailers or below thresholds.
7. Push. CI runs `protocol-gate` server-side as the second-line check.
8. Founder reviews PR. (Currently solo founder; this is a self-review pass aided by codex's independent review captured in the trailer.)
9. Merge to `main`.
10. Vercel auto-deploys to production.
11. Verify deploy READY (`curl` test endpoint + Vercel state).
12. Run `/smoke-test` if applicable.
13. Score ≥95 / Align ALIGNED / `/keep-going` to next item.

---

## 5. Substantial change workflow

In addition to the standard workflow:

- **Migrations** apply to dev branch FIRST. Verify tests pass; verify the apply script is idempotent (`IF NOT EXISTS`); verify rollback path.
- **PROD migration application** requires explicit founder authorization via STATE.md update (see migrations table in `docs/STATE.md`). Apply with `bun run packages/db/scripts/apply-MM-NN.ts` against PROD `DATABASE_URL`.
- **New vendor integrations** add a row to `docs/STATE.md` connected systems table + a sub-processor entry in `vendor-management-policy.md`. Credential rotation cadence documented.
- **Auth-flow changes** require a smoke-test that exercises the full login → tenant-bind → first-action path. Smoke evidence captured in commit body or `services/workers/scripts/smoke-*.ts`.

---

## 6. Emergency change workflow

When production is failing and standard workflow latency would extend the outage:

1. Founder declares emergency (Slack + handoff doc).
2. Hotfix branch off `main`.
3. Minimal fix; no scope creep.
4. Commit with `Protocol-Skip: <reason>` trailer; reason >=10 chars and concrete.
5. Merge to main; deploy.
6. Verify the outage is resolved.
7. Within 48 hours: post-mortem written + remediation tracked. Filed under `docs/incidents/POSTMORTEM-YYYY-MM-DD.md`.
8. The Protocol-Skip is logged forever in `docs/protocol-skips.jsonl` and surfaced in CI output.

---

## 7. Locked-decision change workflow

CLAUDE.md L1–L15 are not subject to re-debate without:
1. A `/decisions-log` entry capturing the new context that justifies revisiting.
2. A written counter-case in the same entry — what's wrong with the lock, what changes if we flip, what's the cost of being wrong.
3. Founder approval recorded in the same entry.
4. Lock mirror updated in CLAUDE.md §🔒 in the same commit that flips the behavior.

The locks are deliberate. The bar to flip is high. Most should never flip; flipping any is the rare exception.

---

## 8. Rollback

- **Code rollback:** `git revert <sha>` + push to main; Vercel auto-deploys the revert. Time to recover is < 5 min for any commit not blocked behind a substantial change.
- **Migration rollback:** every migration ships with a documented inverse path (drop / down-migrate) OR is documented as one-way with a justification. One-way migrations are exceptions, not defaults.
- **Vendor-config rollback:** change history kept in vendor console (Twilio audit log, DocuSign audit history, Square dashboard); founder snapshots major changes to `docs/vendor-changes.md`.
- **Secret rotation rollback:** never. Rotation is forward-only; new secret replaces old; verification step confirms new secret works before deleting old.

---

## 9. Segregation of duties (when team grows)

Currently solo founder; segregation by role is aspirational. When team grows:

- **Author** (writes the code) ≠ **Reviewer** (codex automated + human reviewer).
- **Deployer** (production deploy authority) ≠ **Auditor** (audit-chain reviewer).
- **Secret holder** (env var write authority) ≠ **Application principal** (the running app reads but cannot mint).

Until the team grows, codex review + automated CI gates + audit chain serve as the segregation. The founder operates with full awareness this is a transitional posture and the goal is to split roles by the first 3 hires.

---

## 10. Change records

Every commit IS the change record. Specifically:
- Commit message body documents intent, edge cases, score, codex result.
- `docs/AUTONOMOUS-DECISIONS.md` captures judgment calls.
- `docs/STATE.md` captures live-state deltas.
- `docs/protocol-skips.jsonl` captures every emergency bypass.
- Audit-chain rows on every state-changing server action capture runtime effect.
- `docs/security/access-changes.jsonl` captures access provisioning/deprovisioning events.

There is no separate change-management ticket system. The git log + the audit chain + the decisions log are the system.

---

**Last reviewed:** 2026-05-09 (initial draft, founder)
**Next review:** 2026-08-09
