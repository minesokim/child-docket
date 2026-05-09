// Event-driven: when 'gmail/message.received' fires (from gmail-poll),
// fetch the full message body, classify via triage-classifier, persist
// an issue if confidence is high enough, then chain to inbox-drafter
// for a reply draft. The draft action row links back to the issue via
// issues.draft_action_id so the inbox UI can surface it.
//
// FLOW
//   Step 1   gmail-fetch-body    — Gmail API: refresh token + messages.get
//   Step 1b  scrubPII            — SSN/EIN/BANK redaction before model sees text
//   Step 1c  skip-own-sends      — bail if labelIds includes SENT
//   Step 2   match-client        — SELECT clients WHERE email = from
//   Step 3   classify            — triage-classifier (Haiku 4.5)
//   Step 4   persist-issue       — INSERT issues (skip if confidence < 0.5)
//   Step 4b  persist-thread      — INSERT gmail_threads (raw_payload + classified_issue_id)
//   Step 5   draft-reply         — inbox-drafter (Sonnet 4.6) IF client-facing + matched
//   Step 6   link-draft          — UPDATE issues SET draft_action_id
//   Step 7   emit issue/created  — UI refresh signal

import { sql, eq, and } from 'drizzle-orm';
import { inngest } from '../inngest-client.js';
import { classifySignal } from '../agents/triage-classifier.js';
import { draftReply, isClientFacingIssue } from '../agents/inbox-drafter.js';
import type { TenantId, ClientId } from '@docket/shared';
import { scrubPII } from '@docket/shared';
import {
  getTenantCredential,
  withTenant,
  schema,
  type GmailCredentials,
} from '@docket/db';
import { asTenantId } from '@docket/shared';
import { mintAccessToken, gmailGetMessage } from '../lib/gmail.js';

// Constrained to the languages inbox-drafter supports. DB schema is
// `text` (free-form) but we narrow at the boundary.
type SupportedLang = 'en' | 'es' | 'zh' | 'vi' | 'tl';
const SUPPORTED_LANGS = new Set<SupportedLang>(['en', 'es', 'zh', 'vi', 'tl']);
function narrowLang(raw: string): SupportedLang {
  return SUPPORTED_LANGS.has(raw as SupportedLang) ? (raw as SupportedLang) : 'en';
}

interface ClientMatch {
  clientId: ClientId;
  clientFullName: string;
  clientFirstName: string;
  preferredLanguage: SupportedLang;
}

interface FirmContext {
  firmName: string;
  preparerFullName: string;
  preparerSignOff: string;
}

export const classifyGmailMessage = inngest.createFunction(
  {
    id: 'classify-gmail-message',
    name: 'Classify Gmail message (per message)',
    concurrency: { limit: 5 },
    retries: 3,
  },
  { event: 'gmail/message.received' },
  async ({ event, step, logger }) => {
    const { tenantId, gmailMessageId, gmailThreadId } = event.data;

    // Step 1 — fetch full message body via Gmail API.
    //
    // Transient failures (network, rate-limited, unknown) THROW so
    // Inngest's outer retry (3x) fires. Permanent failures
    // (auth-failed, not-found, no-credential) return softly: not-found
    // means the message was deleted; auth-failed means the refresh
    // token was revoked (no point retrying). The function exits with
    // a labeled `classified: false`.
    const fetched = await step.run('gmail-fetch-body', async () => {
      const r = await fetchMessageForTenant(tenantId, gmailMessageId, logger);
      if (!r.ok && (r.reason === 'network' || r.reason === 'rate-limited' || r.reason === 'unknown')) {
        throw new Error(`gmail-fetch-body transient (${r.reason}): ${r.message}`);
      }
      return r;
    });

    if (!fetched.ok) {
      logger.warn(`[classify-gmail] fetch failed ${gmailMessageId}: ${fetched.reason}`);
      return { classified: false, reason: fetched.reason };
    }
    const message = fetched.message;

    // Step 1b — skip own-sends. Gmail history.list?historyTypes=messageAdded
    // surfaces sent messages too (when Antonio sends, Gmail records a
    // messageAdded event). We don't want to classify Antonio's own
    // outbound — that's not an inbound triage signal.
    if (message.labels.includes('SENT')) {
      logger.info(`[classify-gmail] skipping own-send ${gmailMessageId}`);
      return { classified: false, skipped: 'own_send' };
    }

    // Step 1c — PII scrub. Per docs/MEMORY-ARCHITECTURE.md §8: inbound
    // text feeds scrubPII BEFORE model sees it. The original (unscrubbed)
    // bodyText still goes into gmail_threads.body_text — encrypted at
    // rest via tenant DEK at the persistence layer is the long-term
    // posture; for v1 it's plaintext in the row but isolated by RLS.
    const scrubResult = scrubPII(message.bodyText);
    if (scrubResult.matches.length > 0) {
      logger.info('pii-scrub fired on inbound gmail body', {
        gmailMessageId,
        counts: scrubResult.counts,
        match_count: scrubResult.matches.length,
      });
    }
    const scrubbedBody = scrubResult.scrubbed;

    // Step 2 — match the sender to a client + load firm context.
    // Both are tenant-scoped reads via withTenant.
    const ctx = await step.run('load-context', async () => {
      return await loadContextForClassification(tenantId as string, message.from, logger);
    });

    const clientMatch: ClientMatch | null = ctx.clientMatch;
    const firmContext: FirmContext = ctx.firm;

    // Step 3 — classify the signal.
    const classification = await step.run('classify', async () => {
      return await classifySignal({
        signal: {
          kind: 'gmail_message',
          from: message.from,
          to: message.to,
          subject: message.subject,
          bodyText: scrubbedBody,
          receivedAt: message.receivedAt,
        },
        context: {
          tenantId: tenantId as TenantId,
          clientId: clientMatch?.clientId ?? null,
          clientFullName: clientMatch?.clientFullName,
        },
        modelTier: 'haiku-4-5',
      });
    });

    logger.info({
      gmailMessageId,
      issueType: classification.output.issueType,
      severity: classification.output.severity,
      confidence: classification.output.confidence,
      costUsd: classification.costUsd,
      latencyMs: classification.latencyMs,
    });

    // Persist the gmail_thread row regardless of confidence — we want
    // the message stored even if we don't surface it as an issue.
    // Use message.threadId from the fetched message, NOT the event's
    // gmailThreadId — on stale replays where the event was emitted
    // for a since-merged thread, those can diverge and we'd mis-link.
    void gmailThreadId; // event-side ref kept for diagnostics; persist uses fetched
    await step.run('persist-thread', async () => {
      await persistGmailThread(
        tenantId as string,
        message,
        message.threadId,
        clientMatch?.clientId ?? null,
        null, // classifiedIssueId set in Step 4 if persisted
      );
    });

    // Step 4 — persist issue if confidence above threshold.
    // 0.5 is the v1 cutoff: under that, the classification is too
    // fuzzy to surface. The thread still lands in gmail_threads above
    // so Antonio can manually triage from the unclassified inbox.
    if (classification.output.confidence < 0.5) {
      logger.info(`low confidence (${classification.output.confidence}); skipping issue persist`);
      return {
        classified: false,
        lowConfidence: true,
        threadPersisted: true,
      };
    }

    // No client match → still persist the issue but mark for manual
    // triage. The inbox UI surfaces "unmatched-sender" as a special
    // category so Antonio can either bind the email to an existing
    // client or create a new one.
    if (!clientMatch) {
      logger.info(`[classify-gmail] no client match for ${message.from}; skipping issue persist (v1: unmatched senders go to gmail_threads only)`);
      return {
        classified: false,
        unmatched: true,
        threadPersisted: true,
      };
    }

    // Replay-safe issue creation: if the gmail_threads row already
    // has classified_issue_id set, this messageId was already
    // classified — return that issueId instead of inserting a new
    // one. Inngest retries can fire the same event multiple times;
    // we want exactly-once issue persistence per Gmail message.
    const issueId = await step.run('persist-issue', async () => {
      return await persistIssueIdempotent(
        tenantId as string,
        clientMatch.clientId,
        classification.output,
        message,
      );
    });

    // Step 5 — draft a reply when client-facing AND we have a matched
    // client. ero_pending / meeting_prep / similar are internal-only
    // issue types where there's nothing to send.
    const issueType = classification.output.issueType;
    const shouldDraft = isClientFacingIssue(issueType);
    let draftActionId: string | null = null;
    let draftCostUsd = 0;

    if (shouldDraft) {
      const drafted = await step.run('draft-reply', async () => {
        return await draftReply({
          input: {
            issue: classification.output,
            context: {
              tenantId: tenantId as TenantId,
              clientId: clientMatch.clientId,
              clientFullName: clientMatch.clientFullName,
              clientFirstName: clientMatch.clientFirstName,
              preferredLanguage: clientMatch.preferredLanguage,
              channel: 'email',
              preparerFullName: firmContext.preparerFullName,
              preparerSignOff: firmContext.preparerSignOff,
              firmName: firmContext.firmName,
              trustLevel: 1, // L1 conservative; per-tenant override v1.5
              originalMessage: {
                channel: 'email',
                body: scrubbedBody,
                receivedAt: message.receivedAt,
              },
            },
          },
          modelTier: 'sonnet-4-6',
        });
      });

      logger.info({
        issueType,
        draftConfidence: drafted.output.confidence,
        draftCostUsd: drafted.costUsd,
        draftLatencyMs: drafted.latencyMs,
        trustGateAllowed: drafted.trustGate.allowed,
        trustGateActionClass: drafted.trustGate.actionClass,
        trustGateRequires:
          drafted.trustGate.allowed === false ? drafted.trustGate.requires : null,
        draftActionId: drafted.draftActionId,
      });
      draftCostUsd = drafted.costUsd;
      draftActionId = drafted.draftActionId;

      // Step 6 — link the draft action row to the issue.
      if (draftActionId) {
        await step.run('link-draft-to-issue', async () => {
          await withTenant(asTenantId(tenantId as string), async (db) => {
            await db
              .update(schema.issues)
              .set({ draftActionId })
              .where(eq(schema.issues.id, issueId));
          });
        });
      }
    }

    // Step 6b — back-fill gmail_threads.classified_issue_id so the
    // thread row joins to the issue.
    await step.run('link-thread-to-issue', async () => {
      await withTenant(asTenantId(tenantId as string), async (db) => {
        await db
          .update(schema.gmailThreads)
          .set({
            classifiedIssueId: issueId,
            classifiedAt: new Date(),
          })
          .where(
            and(
              eq(schema.gmailThreads.tenantId, tenantId as string),
              eq(schema.gmailThreads.gmailMessageId, message.id),
            ),
          );
      });
    });

    // Step 7 — emit downstream event for UI refresh.
    await step.sendEvent('emit-issue-created', {
      name: 'issue/created',
      data: {
        tenantId,
        issueId,
        type: issueType,
        severity: classification.output.severity,
      },
    });

    return {
      classified: true,
      issueId,
      issueType,
      severity: classification.output.severity,
      confidence: classification.output.confidence,
      classifyCostUsd: classification.costUsd,
      drafted: shouldDraft,
      draftActionId,
      draftCostUsd,
      totalCostUsd: classification.costUsd + draftCostUsd,
    };
  },
);

// ────────────────────────────────────────────────────────────────
// Internal: fetch a Gmail message via tenant credential.
// Splits cleanly from the function so a smoke can call it directly.
// ────────────────────────────────────────────────────────────────

interface FetchOk {
  ok: true;
  message: import('../lib/gmail.js').GmailMessage;
}
interface FetchErr {
  ok: false;
  reason: 'no-credential' | 'auth-failed' | 'not-found' | 'rate-limited' | 'network' | 'unknown';
  message: string;
}

export async function fetchMessageForTenant(
  tenantId: string,
  gmailMessageId: string,
  logger: { info: (...a: unknown[]) => void; warn: (...a: unknown[]) => void },
): Promise<FetchOk | FetchErr> {
  return await withTenant(asTenantId(tenantId), async (db) => {
    const cred = (await getTenantCredential(
      db,
      asTenantId(tenantId),
      'gmail',
    )) as GmailCredentials | null;
    if (!cred) {
      return { ok: false as const, reason: 'no-credential' as const, message: 'gmail cred missing' };
    }

    const tokenResult = await mintAccessToken(cred.refreshToken, cred.clientId, cred.clientSecret);
    if (!tokenResult.ok) {
      // Workers don't have @sentry/nextjs (apps-only). Log structured
      // warning for downstream observability via Vercel logs.
      logger.warn(`[classify-gmail] mintAccessToken failed: ${tokenResult.reason}`);
      return { ok: false as const, reason: tokenResult.reason, message: tokenResult.message };
    }

    const result = await gmailGetMessage(tokenResult.accessToken, gmailMessageId);
    if (!result.ok) {
      if (result.reason === 'auth-failed' || result.reason === 'unknown') {
        logger.warn(`[classify-gmail] gmailGetMessage failed: ${result.reason} (${gmailMessageId})`);
      }
      return { ok: false as const, reason: result.reason, message: result.message };
    }

    return { ok: true as const, message: result.message };
  });
}

// ────────────────────────────────────────────────────────────────
// Internal: load tenant + firm-owner + client-match context.
// ────────────────────────────────────────────────────────────────

interface ContextResult {
  clientMatch: ClientMatch | null;
  firm: FirmContext;
}

export async function loadContextForClassification(
  tenantId: string,
  fromAddress: string,
  logger: { info: (...a: unknown[]) => void },
): Promise<ContextResult> {
  return await withTenant(asTenantId(tenantId), async (db) => {
    // Tenant name (for firmName).
    const tenantRows = await db
      .select({ name: schema.tenants.name })
      .from(schema.tenants)
      .where(eq(schema.tenants.id, tenantId))
      .limit(1);
    const firmName = tenantRows[0]?.name ?? 'Vazant Consulting';

    // Firm-owner user (preparerFullName + preparerSignOff). We pick
    // the firm_owner user; if multiple exist, the oldest one wins
    // (deterministic for v1 single-owner setups). Fallback hardcoded
    // to Antonio for tenants where role is misconfigured.
    const ownerRows = await db
      .select({ name: schema.users.name, email: schema.users.email })
      .from(schema.users)
      .where(and(eq(schema.users.tenantId, tenantId), eq(schema.users.role, 'firm_owner')))
      .limit(1);
    const preparerFullName = ownerRows[0]?.name ?? 'Antonio Vazquez';
    // SignOff is the first name. Antonio → "Antonio"; "Bob Smith" → "Bob".
    const preparerSignOff = preparerFullName.split(' ')[0] ?? preparerFullName;

    // Client match by email. Lower-case + trim because (a) email is
    // case-insensitive per RFC 5321 and (b) clients.email may have
    // been stored with stray whitespace at intake — sloppy stored
    // data shouldn't miss real matches.
    const fromNormalized = fromAddress.trim().toLowerCase();
    const clientRows = await db
      .select({
        id: schema.clients.id,
        fullName: schema.clients.fullName,
        preferredLanguage: schema.clients.preferredLanguage,
      })
      .from(schema.clients)
      .where(
        and(
          eq(schema.clients.tenantId, tenantId),
          // Postgres LOWER(TRIM(...)) wrapped through Drizzle's sql helper.
          sql`LOWER(TRIM(${schema.clients.email})) = ${fromNormalized}`,
        ),
      )
      .limit(1);

    let clientMatch: ClientMatch | null = null;
    if (clientRows[0]) {
      const c = clientRows[0];
      const firstName = c.fullName.split(' ')[0] ?? c.fullName;
      clientMatch = {
        clientId: c.id as ClientId,
        clientFullName: c.fullName,
        clientFirstName: firstName,
        preferredLanguage: narrowLang(c.preferredLanguage),
      };
    } else {
      logger.info(`[classify-gmail] no client match for ${fromAddress}`);
    }

    return {
      clientMatch,
      firm: { firmName, preparerFullName, preparerSignOff },
    };
  });
}

// ────────────────────────────────────────────────────────────────
// Internal: persist gmail_thread row.
// ────────────────────────────────────────────────────────────────

async function persistGmailThread(
  tenantId: string,
  message: import('../lib/gmail.js').GmailMessage,
  gmailThreadId: string,
  clientId: ClientId | null,
  classifiedIssueId: string | null,
): Promise<void> {
  await withTenant(asTenantId(tenantId), async (db) => {
    await db
      .insert(schema.gmailThreads)
      .values({
        tenantId,
        gmailMessageId: message.id,
        gmailThreadId,
        clientId,
        direction: 'inbound',
        fromAddress: message.from,
        toAddresses: message.to,
        subject: message.subject,
        bodyText: message.bodyText,
        receivedAt: new Date(message.receivedAt),
        classifiedIssueId,
        rawPayload: { historyId: message.historyId, labels: message.labels },
      })
      .onConflictDoNothing({
        // Dedupe on (tenant_id, gmail_message_id). Two history.list
        // batches can occasionally surface the same messageId — the
        // second insert is a no-op, not an error.
        target: [schema.gmailThreads.tenantId, schema.gmailThreads.gmailMessageId],
      });
  });
}

// ────────────────────────────────────────────────────────────────
// Internal: persist issue row from classification output.
// ────────────────────────────────────────────────────────────────

async function persistIssueIdempotent(
  tenantId: string,
  clientId: ClientId,
  output: Awaited<ReturnType<typeof classifySignal>>['output'],
  message: import('../lib/gmail.js').GmailMessage,
): Promise<string> {
  return await withTenant(asTenantId(tenantId), async (db) => {
    // Idempotency check: gmail_threads.classified_issue_id is the
    // dedupe key. Same messageId → same issueId, even on Inngest
    // retry. The thread row was upserted earlier with ON CONFLICT
    // DO NOTHING, so it exists by the time we reach here.
    const existing = await db
      .select({ classifiedIssueId: schema.gmailThreads.classifiedIssueId })
      .from(schema.gmailThreads)
      .where(
        and(
          eq(schema.gmailThreads.tenantId, tenantId),
          eq(schema.gmailThreads.gmailMessageId, message.id),
        ),
      )
      .limit(1);

    if (existing[0]?.classifiedIssueId) {
      return existing[0].classifiedIssueId;
    }

    // Title: subject line if non-trivial, else the first 60 chars of
    // body. Tax inboxes often have empty subjects ("Re:") so we need
    // the body fallback.
    const title =
      message.subject && message.subject.trim().length > 3
        ? message.subject.trim()
        : message.bodyText.slice(0, 60).trim() + (message.bodyText.length > 60 ? '…' : '');

    const inserted = await db
      .insert(schema.issues)
      .values({
        tenantId,
        clientId,
        type: output.issueType,
        severity: output.severity,
        status: 'open',
        title,
        summary: output.summary ?? title,
        whyThisMatters: output.whyThisMatters ?? null,
        recommendedAction: output.recommendedAction ?? null,
        sources: [
          { kind: 'gmail_message', ref: message.id, label: `Email from ${message.from}` },
        ],
        classifiedBy: 'triage-classifier',
        aiConfidence: output.confidence,
      })
      .returning({ id: schema.issues.id });

    return inserted[0]!.id;
  });
}
