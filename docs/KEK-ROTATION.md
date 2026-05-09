# KEK rotation procedure

How to rotate the Master Key Encryption Key (`PII_ENCRYPTION_KEY`)
without taking the app down or losing any encrypted data.

> **Read CAUTION first.** A botched KEK rotation can lock you out
> of every per-tenant DEK, which means losing access to all PII
> in every tenant. Don't skip steps.

## What the KEK does

The two-tier hierarchy from `packages/db/src/encryption.ts`:

```
Master KEK (PII_ENCRYPTION_KEY env var)
  └── encrypts → tenants.dek_encrypted (one row per tenant)
       └── decrypts → per-tenant DEK (32 random bytes, in-memory only)
            └── encrypts → PII fields in JSONB columns
                            (intake_responses, signatures, payments, ...)
```

Three layers:

1. **PII_ENCRYPTION_KEY** is the only thing in env. Single value.
2. **tenants.dek_encrypted** is per-tenant ciphertext of a random
   32-byte DEK. Encrypted with KEK.
3. **DEK** decrypts the per-row PII fields. Per-tenant; an attacker
   with one tenant's DEK can't decrypt another tenant's data.

The KEK is at the top of the chain. Lose it → can't decrypt any
DEK → can't decrypt any PII. **Treat KEK rotation as a high-stakes
operation.**

## When to rotate

- **Annual** (best practice — rotate every 12 months minimum)
- **After any suspected leak** of the env var (shoulder-surfing,
  accidental Vercel log exposure, ex-employee with prod access)
- **After SOC 2 audit recommendation** when first audit lands
- **Never on a hunch** — rotation has a small risk of botching.
  Don't rotate without a real reason.

## The rotation procedure

The high-level flow: have the OLD key + NEW key both readable for
a brief window, decrypt every `tenants.dek_encrypted` row with the
OLD key, re-encrypt with the NEW key, then retire the OLD key.

### Step 0: Pre-flight (5 min)

Before touching anything:

1. **Confirm CURRENT KEK is functional.** If the existing KEK is
   already broken, rotation makes it worse. Test by hitting
   `https://docket-portal.vercel.app/welcome` and ensuring the page
   loads (DEK lookup happens server-side; if the KEK is broken,
   you'll see a 500).

2. **Take a fresh DB snapshot.** Neon dashboard → Branches → create
   a backup branch named `pre-kek-rotation-YYYY-MM-DD`. This is
   your hard rollback if rotation goes wrong.

3. **Pause writes during rotation.** v0 doesn't have a maintenance-
   mode flag yet (PRODUCTION-READINESS §A V1 backlog). Do this in
   off-hours and accept brief inconsistency. v1.5 ships a real
   read-only mode toggle that pairs with this procedure.

4. **Notify Antonio.** A 5-minute brownout during rotation means
   any save attempt fails. Email/text him the timing window.

### Step 1: Generate the new KEK (1 min)

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save the 64-char hex output. This is the **new** KEK.

### Step 2: Set both keys in Vercel (3 min)

In BOTH `docket-command-room` AND `docket-portal` Vercel project
settings → Environment Variables:

1. Rename existing `PII_ENCRYPTION_KEY` → `PII_ENCRYPTION_KEY_PREVIOUS`
   (the OLD value, kept for the migration window).
2. Set `PII_ENCRYPTION_KEY` to the NEW value from Step 1.
3. Save both vars on both projects.
4. **Don't redeploy yet** — both keys need to be present BEFORE the
   migration script runs, but the running lambdas can keep using
   the old value until the script completes.

### Step 3: Run the rotation script (5-15 min depending on tenant count)

A rotation script is the cleanest path. v0 doesn't ship one yet
(this doc is the spec). The script lives at
`packages/db/scripts/rotate-kek.ts` once shipped:

```bash
PII_ENCRYPTION_KEY="<NEW>" PII_ENCRYPTION_KEY_PREVIOUS="<OLD>" \
  bun run packages/db/scripts/rotate-kek.ts --dry-run
```

`--dry-run` reports how many tenants will be re-encrypted without
writing anything. Confirm the count matches your tenants table.

Then for real:

```bash
PII_ENCRYPTION_KEY="<NEW>" PII_ENCRYPTION_KEY_PREVIOUS="<OLD>" \
  bun run packages/db/scripts/rotate-kek.ts
```

The script does, per tenant, in a transaction:
1. Decrypt `tenants.dek_encrypted` with OLD key
2. Re-encrypt the same DEK bytes with NEW key
3. UPDATE `tenants.dek_encrypted` with the new ciphertext
4. Verify by decrypting the NEW ciphertext with NEW key
5. Commit the transaction

If verification fails, the transaction rolls back and the tenant
stays on the OLD key. Other tenants are not affected.

Output should be:
```
[rotate-kek] Tenant 1 / N: re-encrypted (id=...)
[rotate-kek] Tenant 2 / N: re-encrypted
...
[rotate-kek] N / N tenants re-encrypted; 0 failed
```

### Step 4: Redeploy both apps (3 min)

After all tenants are re-encrypted with the NEW key:

1. Vercel `docket-command-room` → Deployments → ⋯ → Redeploy
   (uncheck Build Cache)
2. Vercel `docket-portal` → same
3. Wait for both Ready.

The running lambdas now use the NEW key for all reads + writes.

### Step 5: Smoke test (2 min)

Hit a real PII-bearing surface to confirm decryption works:

1. https://docket-portal.vercel.app/welcome — should load
2. Sign in with Antonio's phone, navigate to `/clients/[id]` for
   any tenant client
3. Click "Show SSN, EIN, bank" → unlock should succeed
4. Verify masked + unmasked values match the data you'd expect

If anything 500s, INVESTIGATE BEFORE PROCEEDING. The fallback path
in `decryptIfMarkedForTenant` accepts master KEK ciphertext as a
last resort, so if the rotation script left some tenants on OLD
key, those tenants will fail decryption on read with the new env.
Re-run the script for the failed tenants.

### Step 6: Retire the old key (1 min)

After 24 hours of clean reads + writes:

1. Vercel both apps → Settings → Environment Variables → DELETE
   `PII_ENCRYPTION_KEY_PREVIOUS`.
2. Redeploy both apps.

Now only the NEW KEK is on the server. The old value is gone from
your control plane; if it was leaked, it's now useless.

## What goes wrong + how to recover

### "Tenants table has rows the script can't decrypt with OLD key"

The OLD key value in `PII_ENCRYPTION_KEY_PREVIOUS` doesn't match
what was used to encrypt those DEKs. Either:
- The OLD value you set in Vercel is wrong (typo on the rename)
- The DEKs were encrypted with an even-older KEK that's no longer
  available (this would only happen if a previous rotation went
  wrong and left mixed state)

Recovery: restore from the pre-rotation Neon snapshot. Investigate
which key encrypted those rows BEFORE attempting the rotation again.

### "All tenants re-encrypted but the running app can't decrypt anymore"

The redeploy in Step 4 didn't pick up the new env var. Vercel
sometimes caches the build. Redeploy with **Build Cache OFF**.

### "Script crashed mid-rotation"

Some tenants are on NEW key, some on OLD. The script is idempotent —
re-run it. Tenants already on NEW skip cleanly (the script verifies
NEW-key decrypt before re-writing, so a successful re-run no-ops
for already-rotated tenants).

### "Total disaster — can't decrypt any PII"

Restore Neon snapshot from Step 0. You're back to the OLD key state.
Rotate again with proper Step 0 prep.

## What this DOESN'T do

- **Doesn't rotate per-tenant DEKs.** Each tenant's DEK stays the
  same; only the KEK that encrypts it rotates. A leaked DEK requires
  a separate per-tenant rotation procedure (V1.5).
- **Doesn't migrate to KMS.** The migration to AWS KMS / GCP KMS
  is a separate effort (PRODUCTION-READINESS §A V1.5). KEK rotation
  procedure works the same after KMS migration; just the key
  storage location changes.
- **Doesn't rotate the master-KEK fallback ciphertexts.** Pre-tenant-
  DEK data still encrypted with master KEK directly (see
  `decryptIfMarkedForTenant` legacy path) needs the
  `pnpm --filter @docket/db reencrypt-legacy` script run BEFORE
  KEK rotation, OR the legacy fallback path needs the OLD KEK
  preserved indefinitely. The reencrypt-legacy script is the right
  fix; run it per the procedure in `encryption.ts` line ~206.

## Pre-rotation checklist

Run through this BEFORE rotating:

- [ ] Pre-flight Step 0 done (working baseline + snapshot)
- [ ] Off-hours window communicated to Antonio
- [ ] `pnpm --filter @docket/db reencrypt-legacy` has been run
      (no master-KEK-encrypted PII left in the DB)
- [ ] Rotation script `packages/db/scripts/rotate-kek.ts` exists and
      `--dry-run` mode works against staging
- [ ] You have BOTH the new key value AND a copy of the old key
      saved somewhere recoverable (1Password, etc) for at least
      Step 6 + 24h after

## Audit trail

Every rotation should leave a trace:

- Commit `chore(security): KEK rotation YYYY-MM-DD` to the repo
  (no code change; just an empty commit with a note)
- Annotate `docs/AUTONOMOUS-DECISIONS.md` with the rotation ID
- Tag the Vercel env-var change in your password manager / vault

The actions table doesn't auto-log KEK rotation because the script
runs via `getAdminDb()` which bypasses RLS + skips audit. Manual
trace is the substitute for v0.

## Related

- Encryption hierarchy: [`packages/db/src/encryption.ts`](../packages/db/src/encryption.ts)
- DEK cache: [`packages/db/src/dek-cache.ts`](../packages/db/src/dek-cache.ts)
- Reencrypt legacy script: [`packages/db/scripts/reencrypt-legacy.ts`](../packages/db/scripts/reencrypt-legacy.ts)
- Production readiness: [`docs/PRODUCTION-READINESS.md`](PRODUCTION-READINESS.md) §D
