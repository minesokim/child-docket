# DocuSign Connect setup

How to wire DocuSign's webhook (Connect) so envelope-completed events
fire against `/api/webhooks/docusign/connect` and flip
`signatures.status='signed'` automatically when a client signs.

> One-time setup per DocuSign app (sandbox vs production are separate
> apps). Antonio's setup goes against the demo/sandbox app for v0.

## What this enables

When a taxpayer signs the 8879 in the embedded iframe:

1. DocuSign verifies the signature internally
2. DocuSign POSTs an `envelope-completed` event to your webhook URL
3. The webhook handler verifies HMAC, looks up the signatures row
   by `auditPayload.envelopeId`, and UPDATEs:
   - `status = 'signed'`
   - `signed_at` (DocuSign's `completedDateTime`)
   - `signed_by_ip` + `signed_by_user_agent`
   - `kba_passed_at` (when `recipientAuthenticationStatus.idQuestionsResult.status = 'passed'`)
4. Antonio sees the signed state on `/clients/[id]` Signatures section

Without Connect configured, the database stays at `status='pending'`
forever — you'd have to manually flip rows or build a polling cron.

## Steps

### 1. Generate an HMAC signing secret

DocuSign uses HMAC-SHA256 over the raw request body to sign
webhook payloads. You generate the secret; DocuSign signs with it;
your webhook verifier checks the signature.

```bash
openssl rand -hex 32
```

Copy the output. This is `DOCUSIGN_CONNECT_HMAC_KEY`.

### 2. Set the env var in Vercel

For BOTH `docket-command-room` AND any future apps that handle
DocuSign webhooks:

1. Vercel dashboard → docket-command-room → Settings → Environment Variables
2. Add `DOCUSIGN_CONNECT_HMAC_KEY` = (the hex string from step 1)
3. Production environment
4. Save
5. Redeploy (Deployments → latest → ⋯ → Redeploy → uncheck Build Cache)

### 3. Register the webhook URL with DocuSign

#### Sandbox (Vazant's current setup)

1. https://admindemo.docusign.com → log in
2. Settings → Integrations → Connect → **Add Configuration** → **Custom**
3. Configuration:
   - **Name**: `Docket production webhook`
   - **URL to publish to**: `https://docket-command-room.vercel.app/api/webhooks/docusign/connect`
   - **Sign Message Data**: ✅ Enabled (required for HMAC)
   - **Include HMAC Signature**: ✅ Enabled
4. **HMAC Settings** → **Add Secret** → paste the hex string from step 1
5. **Trigger Events**:
   - Envelope Completed ✅
   - Recipient Completed ✅ (optional; useful for partial signing audit)
6. **Settings** → ensure **Format**: JSON
7. **Save**

#### Production (when Antonio graduates)

1. https://admin.docusign.com → log in
2. Same steps as above, BUT URL points to your production Vercel
   command-room deploy
3. Use a DIFFERENT HMAC secret (don't share between sandbox + prod)

### 4. Test the wiring

After redeploy, with a sandbox signature in flight:

```bash
# Trigger a test event from DocuSign Admin
# Settings → Connect → your config → "Send Test Notification"
```

Check Vercel function logs for `/api/webhooks/docusign/connect`:

- 200 OK + log `signature {id} flipped to signed; envelope=...` =
  webhook works end-to-end
- 401 = HMAC mismatch — secret in DocuSign doesn't match the
  Vercel env var
- 500 + log `DOCUSIGN_CONNECT_HMAC_KEY env not set` = env var
  missing in Vercel
- No request reaches Vercel = DocuSign webhook URL is wrong

### 5. Key rotation (annual or after suspected leak)

DocuSign Connect supports two HMAC secrets simultaneously for zero-
downtime rotation. The verifier accepts signatures from either:

1. Generate a NEW hex string (`openssl rand -hex 32`)
2. In Vercel: rename `DOCUSIGN_CONNECT_HMAC_KEY` → `DOCUSIGN_CONNECT_HMAC_KEY_PREVIOUS` (or set both vars)
3. Set new value as `DOCUSIGN_CONNECT_HMAC_KEY`
4. Redeploy
5. In DocuSign Admin → Connect config → HMAC Settings → add the new secret AS PRIMARY, keep the old one
6. Wait 24h for in-flight events to drain on the old key
7. Remove the old secret from DocuSign + unset `DOCUSIGN_CONNECT_HMAC_KEY_PREVIOUS` in Vercel

The verifier in `@docket/shared/webhooks` (`verifyDocuSignSignature`)
already supports the rotation-tolerant array shape.

## Failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| Webhook fires but status stays 'pending' | HMAC mismatch (logs show 401) | Re-check secret on both sides |
| `DOCUSIGN_CONNECT_HMAC_KEY env not set` | Env var missing or redeploy didn't pick up | Set in Vercel, redeploy with cache OFF |
| `envelope X not in signatures table` | Event from a different DocuSign app on shared URL | Drop is correct; check DocuSign config target URL |
| Webhook never fires | DocuSign URL config wrong, or Vercel deploy ERROR'd | Verify URL + check Vercel function logs |
| KBA didn't pass but status='signed' | Webhook payload claims passed=true; check `audit_payload.recipientAuthenticationStatus` | Likely a sandbox quirk; verify in production |

## Pre-public-launch removal checklist

When Antonio's first non-design-partner client onboards:

- [ ] Confirm `DOCUSIGN_CONNECT_HMAC_KEY` is the production secret
      (not sandbox)
- [ ] Confirm DocuSign webhook URL points to production app domain
- [ ] Confirm tenant_credentials.kind='docusign' authHost is
      'account.docusign.com' (not -d.) for the production tenant
- [ ] Run a real-money test: send a sandbox 8879, verify webhook
      lands, verify KBA passed, verify all 4 timestamps populated

## Related

- Webhook verifier: [`packages/shared/src/webhook-verification.ts`](../packages/shared/src/webhook-verification.ts)
- Webhook handler: [`apps/command-room/src/app/api/webhooks/docusign/connect/route.ts`](../apps/command-room/src/app/api/webhooks/docusign/connect/route.ts)
- IRS Pub 1345: <https://www.irs.gov/pub/irs-pdf/p1345.pdf> §6 (Authentication of Form 8879)
