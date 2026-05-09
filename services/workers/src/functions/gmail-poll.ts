// Cron: every 10 minutes per tenant, poll Gmail for new messages, fire
// gmail/message.received events that the per-message classifier picks up.
//
// FLOW
//   Step 1: list-tenants-with-gmail   — query tenant_credentials kind=gmail
//   Step 2 (per tenant): fetch        — refresh access token + history.list
//                                       (or bootstrap historyId on first sync)
//   Step 3 (per message): emit event  — fire gmail/message.received
//   Step 4: cursor advance            — UPSERT gmail_sync_state.lastHistoryId
//
// SECURITY
//   Each per-tenant fetch runs inside withTenant(). Decryption fetches
//   the per-tenant DEK; access tokens live ONLY on the function
//   invocation stack — never logged, never persisted.
//
// FEATURE FLAG
//   ENABLE_GMAIL_POLL=true to arm the cron. When unset, the function
//   bails on entry. Stays registered so we can flip without redeploying.
//   This is the v0 conservative posture; once Antonio's real Gmail
//   load lands, default flips to on.
//
// EDGE CASES HANDLED (per /e2e + /edge-cases)
//   - No tenant has gmail cred → return early
//   - Refresh token expired (test apps: 7d) → auth-failed + Sentry + skip
//   - lastHistoryId older than ~7d → 404 → bootstrap from getProfile
//   - First sync (no row in gmail_sync_state) → bootstrap path
//   - Gmail 429 → in-step retry then surface (Inngest's outer retry handles)
//   - Skip own-sends (labelIds includes SENT) — handled in classify-gmail-message

import { sql } from 'drizzle-orm';
import { inngest } from '../inngest-client.js';
import {
  getAdminDb,
  getTenantCredential,
  withTenant,
  type GmailCredentials,
} from '@docket/db';
import { asTenantId } from '@docket/shared';
import {
  mintAccessToken,
  gmailHistoryList,
  gmailGetCurrentHistoryId,
} from '../lib/gmail.js';

const GMAIL_POLL_ENABLED = process.env.ENABLE_GMAIL_POLL === 'true';

interface TenantWithGmail {
  tenant_id: string;
  // Index signature required by drizzle's db.execute<T> generic
  // (T must extend Record<string, unknown>).
  [key: string]: unknown;
}

export const gmailPoll = inngest.createFunction(
  {
    id: 'gmail-poll',
    name: 'Gmail poll (every 10 min per tenant)',
    concurrency: { limit: 5 },
  },
  { cron: '*/10 * * * *' },
  async ({ step, logger }) => {
    if (!GMAIL_POLL_ENABLED) {
      logger.info('gmail-poll feature-flagged off (set ENABLE_GMAIL_POLL=true to enable)');
      return { polled: 0, classified: 0, skipped: 'flag_disabled' };
    }

    // Step 1 — list tenants with a Gmail credential installed.
    // Joins tenant_credentials directly; no separate integrations
    // table. Per CLAUDE.md, the credential ITSELF is the source of
    // truth for "this tenant has Gmail wired."
    const tenants = await step.run('list-tenants-with-gmail', async () => {
      const adminDb = getAdminDb();
      const rows = await adminDb.execute<TenantWithGmail>(sql`
        SELECT tenant_id::text AS tenant_id
        FROM tenant_credentials
        WHERE kind = 'gmail'
      `);
      return (rows as unknown as TenantWithGmail[]).map((r) => ({ id: r.tenant_id }));
    });

    if (tenants.length === 0) {
      logger.info('no tenants with gmail integration; sleeping');
      return { polled: 0, classified: 0 };
    }

    let totalNew = 0;
    let totalEmitted = 0;
    const failures: Array<{ tenantId: string; reason: string }> = [];

    for (const tenant of tenants) {
      const tenantId = tenant.id;

      // Step 2 — fetch new messages for this tenant.
      // Wrapped in step.run so Inngest treats per-tenant fetch as a
      // checkpoint: a failure in tenant N doesn't reset the whole
      // poll cycle; tenant N+1 still runs.
      //
      // Transient failures (network, rate-limited, unknown) THROW so
      // Inngest's outer retry layer (default 3x) fires on transient
      // blips. Permanent failures (auth-failed, no-credential) return
      // softly so we don't burn retries on a refresh-token revocation.
      const result = await step.run(`gmail-fetch:${tenantId}`, async () => {
        const r = await fetchTenantNewMessages(tenantId, logger);
        if (!r.ok && (r.reason === 'network' || r.reason === 'rate-limited' || r.reason === 'unknown')) {
          // Throwing inside step.run triggers Inngest's outer retry.
          throw new Error(`gmail-fetch transient (${r.reason}): ${r.message}`);
        }
        return r;
      });

      if (!result.ok) {
        failures.push({ tenantId, reason: result.reason });
        // Soft fail — auth-failed / no-credential. Continue to next
        // tenant. The user will see the failure surfaced in
        // gmail_sync_state's stale last_polled_at + the credentials
        // UI's "Test connection" button.
        continue;
      }

      totalNew += result.messageIds.length;

      // Step 3 — fire one event per new message. Inngest fans these
      // out to classify-gmail-message in parallel (up to that
      // function's concurrency limit of 5).
      for (const msg of result.messageIds) {
        await step.sendEvent(`emit-classify:${msg.id}`, {
          name: 'gmail/message.received',
          data: {
            tenantId: tenantId as never,
            gmailMessageId: msg.id,
            gmailThreadId: msg.threadId,
          },
        });
        totalEmitted++;
      }
    }

    return {
      polled: totalNew,
      classified: totalEmitted,
      tenantsChecked: tenants.length,
      failures: failures.length,
    };
  },
);

// ────────────────────────────────────────────────────────────────
// Per-tenant fetch: refresh token → history.list (or bootstrap) →
// update sync state cursor → return new message IDs.
//
// Lives outside the inngest function so it's testable from a smoke
// script without spinning up Inngest's dev server.
// ────────────────────────────────────────────────────────────────

interface FetchResult {
  ok: true;
  messageIds: Array<{ id: string; threadId: string }>;
  newHistoryId: string | null;
}

interface FetchFailure {
  ok: false;
  reason: 'no-credential' | 'auth-failed' | 'rate-limited' | 'network' | 'unknown';
  message: string;
}

export async function fetchTenantNewMessages(
  tenantId: string,
  logger: { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void },
): Promise<FetchResult | FetchFailure> {
  return await withTenant(asTenantId(tenantId), async (db) => {
    // Pull credential. Decrypts via tenant DEK.
    const cred = (await getTenantCredential(
      db,
      asTenantId(tenantId),
      'gmail',
    )) as GmailCredentials | null;

    if (!cred) {
      // Race: tenant in step-1 list but cred gone now. Treat as soft
      // skip (could happen if cred was deleted between list + fetch).
      return {
        ok: false as const,
        reason: 'no-credential' as const,
        message: 'gmail credential not found',
      };
    }

    // Mint access token.
    const tokenResult = await mintAccessToken(cred.refreshToken, cred.clientId, cred.clientSecret);
    if (!tokenResult.ok) {
      // auth-failed = refresh token revoked/expired (very common in dev
      // since unverified-app refresh tokens expire after 7 days).
      // Surface to Sentry so the user sees it; don't crash the cron.
      // Workers don't have @sentry/nextjs (apps-only). Log structured
      // warning for downstream observability via Vercel logs + the
      // /api/admin/cost dashboard's failures counter.
      logger.warn(`[gmail-poll] mintAccessToken failed for ${tenantId}: ${tokenResult.reason}`);
      return {
        ok: false as const,
        reason: tokenResult.reason,
        message: tokenResult.message,
      };
    }
    const accessToken = tokenResult.accessToken;

    // Read existing sync state. If absent or historyId null, bootstrap.
    const stateRows = await db.execute<{ last_history_id: string | null }>(sql`
      SELECT last_history_id FROM gmail_sync_state WHERE tenant_id = ${tenantId}::uuid
    `);
    const stateRow = (stateRows as unknown as Array<{ last_history_id: string | null }>)[0];
    const cursorBefore = stateRow?.last_history_id ?? null;

    let messageIds: Array<{ id: string; threadId: string }> = [];
    let newHistoryId: string | null = null;
    const polledAt = new Date();

    if (cursorBefore == null) {
      // Bootstrap: get current historyId via getProfile + don't process
      // any backlog. Antonio's first poll cycle just sets the cursor;
      // subsequent cycles see real new messages.
      const profile = await gmailGetCurrentHistoryId(accessToken);
      if (!profile.ok) {
        logger.warn(`[gmail-poll] bootstrap getProfile failed for ${tenantId}: ${profile.reason}`);
        return {
          ok: false as const,
          reason: (profile.reason === 'auth-failed' ? 'auth-failed' : 'unknown') as
            | 'auth-failed'
            | 'unknown',
          message: profile.message,
        };
      }
      newHistoryId = profile.historyId;
      logger.info(`[gmail-poll] bootstrap: tenant=${tenantId} historyId=${newHistoryId}`);
    } else {
      // Normal incremental fetch.
      const historyResult = await gmailHistoryList(accessToken, cursorBefore);
      if (!historyResult.ok) {
        logger.warn(`[gmail-poll] history.list failed for ${tenantId}: ${historyResult.reason}`);
        return {
          ok: false as const,
          reason: historyResult.reason,
          message: historyResult.message,
        };
      }

      if (historyResult.status === 'history-too-old') {
        // Cursor aged out (>7 days). Bootstrap to current historyId
        // and skip the backlog. This loses messages received during
        // the gap — acceptable v1 tradeoff (Antonio polling every 10
        // min means a 7-day gap implies a service outage we'd manually
        // backfill from gmail_threads.raw_payload anyway).
        const profile = await gmailGetCurrentHistoryId(accessToken);
        if (!profile.ok) {
          // Pass through the actual reason rather than collapsing to
          // 'unknown' — auth-failed during recovery is meaningfully
          // different from a network hiccup.
          return {
            ok: false as const,
            reason: (profile.reason === 'auth-failed' ? 'auth-failed' : 'unknown') as
              | 'auth-failed'
              | 'unknown',
            message: profile.message,
          };
        }
        newHistoryId = profile.historyId;
        logger.warn(`[gmail-poll] cursor too old; reset tenant=${tenantId} new historyId=${newHistoryId}`);
      } else {
        messageIds = historyResult.messageIds;
        newHistoryId = historyResult.nextHistoryId ?? cursorBefore;
      }
    }

    // Update / insert the sync state row. Only bump last_advanced_at
    // when we actually saw new messages (so the dashboard "last
    // activity" timestamp is meaningful).
    const advancedAt = messageIds.length > 0 ? polledAt : null;
    await db.execute(sql`
      INSERT INTO gmail_sync_state
        (tenant_id, last_history_id, last_polled_at, last_advanced_at, total_classified)
      VALUES
        (${tenantId}::uuid, ${newHistoryId}, ${polledAt.toISOString()}::timestamptz,
         ${advancedAt ? advancedAt.toISOString() : null}::timestamptz,
         ${messageIds.length})
      ON CONFLICT (tenant_id) DO UPDATE SET
        last_history_id = EXCLUDED.last_history_id,
        last_polled_at = EXCLUDED.last_polled_at,
        last_advanced_at = COALESCE(EXCLUDED.last_advanced_at, gmail_sync_state.last_advanced_at),
        total_classified = gmail_sync_state.total_classified + ${messageIds.length}
    `);

    return {
      ok: true as const,
      messageIds,
      newHistoryId,
    };
  });
}
