# Backup + restore procedure

The SOC 2 evidence trail for "we can recover from data loss." Two parts: what's backed up automatically, and how we prove it works under fire.

> **Scope.** Production data is the Postgres database (Neon). Cloudflare R2 (Phase 2 — documents) inherits S3-compatible cross-region replication; that procedure lives at the bottom. Vercel build artifacts are deterministic from the git ref + env vars and are not backed up.

---

## 1. What's backed up automatically (Neon)

Neon Postgres on the **Launch** tier (current) provides:

| Capability | What it covers | How long |
|---|---|---|
| Point-in-time recovery (PITR) | Continuous WAL retention, restore to any second | 7 days |
| Branch snapshots | A clone of the DB at any retained point, addressable via Neon API | 7 days |
| Cross-AZ replication | Hot standby in a second AZ within the region | Always-on |

**No manual backup script is required for v0.** PITR + branching is the backup. The procedure below proves we can actually restore from it.

If we move to a higher tier later (Pro / Scale), retention windows extend; the procedure below stays the same.

---

## 2. Encryption posture

Backups inherit the application's encryption-at-rest model:

- **Field-level encryption.** SSN / EIN / bank routing / bank account in `intake_responses.answers` (JSONB) are AES-256-GCM with per-tenant DEKs (see [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) § 2). A dump or PITR snapshot contains the same `{iv, data, tag}` blobs.
- **Volume-level encryption.** Neon's underlying storage uses cloud-provider-managed disk encryption (AES-256). Backup volumes inherit this.
- **In-transit encryption.** All connections (app → DB, restore → DB, snapshot replication) require TLS 1.2+.

A restored database is unreadable without the master KEK (env var `DOCKET_MASTER_KEK_BASE64`) AND the per-tenant DEK rows. **The KEK is not in the database.** Restoring data to a fresh environment without re-supplying the KEK yields ciphertext only.

---

## 3. Restore drill — quarterly

We prove the backup works once per quarter. Schedule: first Monday of each quarter, on-call engineer runs the drill. Outcome lands in `docs/BACKUP-DRILL-LOG.md` (created on first run).

### Drill procedure

1. **Pick a target time.** Use `now() - interval '6 hours'` so we exercise the PITR path, not just the latest snapshot.
2. **Create a Neon branch from that timestamp.** Neon UI: Branches → New branch → Restore from time → paste the timestamp. Branch name: `restore-drill-YYYY-MM-DD`.
3. **Get the branch connection string** from the Neon UI.
4. **Run a smoke-test query** against the branch to confirm the data is real:
   ```bash
   DATABASE_URL=postgres://...branch-url... psql -c \
     "SELECT count(*) AS tenants, (SELECT count(*) FROM clients) AS clients FROM tenants;"
   ```
   Expected: counts match what production looked like 6 hours ago (within reason — a few rows of drift is fine).
5. **Run the RLS regression suite against the branch.** This proves the security model survives a restore:
   ```bash
   DATABASE_URL_RLS_TEST=postgres://...branch-url... \
     pnpm --filter @docket/db test
   ```
   Expected: 27 passes, 1 skip, 0 fails (same as the regular run).
6. **Decrypt one sensitive field** end-to-end. Pick a tenant + client where you know the SSN. Run `revealIntakeField('personal.ssn')` against the branch (use a temporary test deployment or a one-shot script). Confirm the plaintext returns correctly — proves the per-tenant DEK encrypted in `tenants.dek_encrypted` survives a restore intact.
7. **Delete the branch** when finished. Neon UI: Branches → restore-drill-... → Delete.
8. **Log the drill** in `docs/BACKUP-DRILL-LOG.md` with date, target timestamp, branch name, smoke-test outcome, RLS test result, decrypt result, total wall time.

### Why these specific checks

- Step 4 (smoke counts) catches "the snapshot is empty / corrupt."
- Step 5 (RLS suite) catches "RLS policies didn't survive the restore" — the failure mode that breaks tenant isolation post-recovery.
- Step 6 (decrypt) catches "the DEK didn't survive the restore" — the failure mode that makes everything ciphertext-only forever.

A drill that passes all three answers the SOC 2 question "have you tested your backups in the last 90 days." A drill that fails at any step is a paging incident — the on-call follows up to make sure either the backup is actually broken (escalate to Neon) or our procedure has drifted (fix + re-run within 48 hours).

---

## 4. Disaster restore — production data is destroyed

If production data is destroyed (corrupted update, malicious DROP, bug that wiped a table), the restore path is:

1. **Stop writes.** In Vercel: pause deployments. In Neon: scale the compute to 0 to prevent any further app traffic.
2. **Identify the last known good time.** Use the audit log (actions table) to bisect when the bad event happened. The append-only constraint on `actions` (migration 0007) means the audit trail itself can't have been tampered with from app-level access.
3. **Restore from PITR to that time.** Neon UI: Branches → New branch → Restore from time → confirm. Promote the branch to be the new primary (or repoint `DATABASE_URL` to it).
4. **Run the same drill checks** (smoke counts, RLS suite, sample decrypt) to confirm the restore is healthy.
5. **Resume writes.** Re-enable Vercel deployments + scale Neon compute back up.
6. **Document the event.** A Sev-1 incident postmortem in `docs/incidents/YYYY-MM-DD-<slug>.md`. SOC 2 expects every restore-from-backup event to be logged with root cause, time-to-detect, time-to-recover, blast radius (rows / tenants / clients affected).

**RTO target:** 1 hour from "we know data is gone" to "production traffic resumed." Neon PITR + branch promotion is fast; the bottleneck is human bisection of when the bad event happened.

**RPO target:** ≤ 5 minutes. Neon's WAL is continuously replicated; the worst case is whatever was in flight when the event fired.

---

## 5. KEK loss — the unrecoverable scenario

If the master KEK is lost AND the env var has rotated such that no copy of the old KEK exists, all encrypted fields become permanently unreadable. The data still exists in the database; nobody can decrypt it.

**Mitigations:**

- KEK is stored in three places: Vercel env vars (prod), `.env.local` on the lead engineer's machine (dev), and an offline backup in 1Password (recovery). Loss of any one is recoverable; loss of all three is not.
- Pre-rotation procedure (when we ever rotate the master KEK): the new KEK is added BEFORE removing the old one. A migration re-encrypts every per-tenant DEK with the new KEK. Only after the migration completes does the old KEK rotate out.
- Annual KEK rotation drill: schedule with 1Password access controls audit. Confirms the offline copy is reachable + correct.

This is a known SOC 2 risk that we document, mitigate, and test rather than try to engineer away. There is no third-party HSM in v0 — that's a v1+ decision once the customer base justifies the cost.

---

## 6. Cloudflare R2 (Phase 2 — documents pipeline)

Once the docs pipeline ships (Day 10–12 build window), the same procedure-and-test approach applies to R2:

| Capability | What | When |
|---|---|---|
| Versioning on the R2 bucket | Every object kept for 30 days post-overwrite | Bucket setup |
| Cross-region replication | R2 mirrors to a second region (eu-west or ap-southeast) | Phase 2 |
| Manifest verification | Daily job lists every `documents.r2_key` and 200s the HEAD against R2 to detect bit-rot or accidental deletes | Phase 2 |

The procedure for R2 lands as `docs/BACKUPS.md § 6` filled in when the pipeline ships. Until then this section is a placeholder so the doc is complete-but-honest.

---

## 7. References

- [`packages/db/README.md`](../packages/db/README.md) — schema, migrations, RLS regression suite
- [`packages/db/test/audit-immutability.test.ts`](../packages/db/test/audit-immutability.test.ts) — proves the actions table can't be silently rewritten post-restore
- [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) — encryption boundary, multi-tenant isolation
- [`docs/HOSTING.md`](./HOSTING.md) — Neon Launch tier, why auto-suspend is OFF

*Last updated: May 1, 2026.*
