// Event-driven: when 'gmail/message.received' fires, fetch the message body,
// classify it via triage-classifier, persist a row to issues if confidence is
// high enough. Surfaces the issue in the Triage view.
//
// v0 placeholder: real Gmail fetch + DB writes wired when OAuth + Postgres
// connection lands (week 1).

import { inngest } from '../inngest-client.js';
import { classifySignal } from '../agents/triage-classifier.js';
import { draftReply, isClientFacingIssue } from '../agents/inbox-drafter.js';
import type { TenantId, ClientId } from '@docket/shared';
import { scrubPII } from '@docket/shared';

export const classifyGmailMessage = inngest.createFunction(
  {
    id: 'classify-gmail-message',
    name: 'Classify Gmail message (per message)',
    concurrency: { limit: 5 },                // bounded concurrent classification
    retries: 3,
  },
  { event: 'gmail/message.received' },
  async ({ event, step, logger }) => {
    const { tenantId, gmailMessageId, gmailThreadId } = event.data;

    // Step 1 — fetch the message body from Gmail
    const message = await step.run('gmail-fetch-body', async () => {
      // TODO(week-1): real Gmail get message API
      // GET /gmail/v1/users/me/messages/{gmailMessageId}?format=full
      logger.info(`gmail-fetch-body (placeholder) ${gmailMessageId}`);
      return null as null | {
        from: string;
        to: string[];
        subject: string | null;
        bodyText: string;
        receivedAt: string;
      };
    });

    if (!message) {
      logger.warn(`message ${gmailMessageId} not fetched; abort`);
      return { classified: false };
    }

    // Step 1b — PII scrub. Per docs/MEMORY-ARCHITECTURE.md §8, inbound
    // text feeds scrubPII BEFORE the body reaches embeddings or the
    // model. Original bodyText is kept on the message object for the
    // gmail_threads insert (encrypted at rest via tenant DEK at the
    // persistence layer); the SCRUBBED body is what flows to
    // classifySignal + draftReply below.
    const scrubResult = scrubPII(message.bodyText);
    if (scrubResult.matches.length > 0) {
      logger.info('pii-scrub fired on inbound gmail body', {
        gmailMessageId,
        counts: scrubResult.counts,
        match_count: scrubResult.matches.length,
      });
    }
    const scrubbedBody = scrubResult.scrubbed;

    // Step 2 — match sender to a client (or null if unmatched — manual triage)
    const clientMatch = await step.run('match-client', async () => {
      // TODO(week-1): SELECT client by email/phone matching message.from
      logger.info(`match-client (placeholder) for ${message.from}`);
      return null as null | {
        clientId: ClientId;
        clientFullName: string;
        engagementType?: string;
        engagementStatus?: string;
        lastInteractionDays?: number;
      };
    });

    // Step 3 — classify
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
          tenantId,
          clientId: clientMatch?.clientId ?? null,
          clientFullName: clientMatch?.clientFullName,
          engagementType: clientMatch?.engagementType,
          engagementStatus: clientMatch?.engagementStatus,
          lastInteractionDays: clientMatch?.lastInteractionDays,
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

    // Step 4 — persist to issues table (skip if confidence < 0.5 — defer to manual)
    if (classification.output.confidence < 0.5) {
      logger.info(`low confidence (${classification.output.confidence}); skipping issue persist`);
      return { classified: false, lowConfidence: true };
    }

    const issueId = await step.run('persist-issue', async () => {
      // TODO(week-1): insert into issues + update gmail_threads.classified_issue_id
      logger.info('persist-issue (placeholder)');
      return 'issue-placeholder-id';
    });

    // Step 5 — draft a reply (chained, in same function for atomicity)
    // Skip drafting for internal-only issue types (ero_pending, meeting_prep)
    const issueType = classification.output.issueType;
    const shouldDraft = isClientFacingIssue(issueType) && clientMatch !== null;
    let draftActionId: string | null = null;
    let draftCostUsd = 0;

    if (shouldDraft && clientMatch) {
      const drafted = await step.run('draft-reply', async () => {
        return await draftReply({
          input: {
            issue: classification.output,
            context: {
              tenantId,
              clientId: clientMatch.clientId,
              clientFullName: clientMatch.clientFullName,
              clientFirstName: clientMatch.clientFullName.split(' ')[0] ?? clientMatch.clientFullName,
              preferredLanguage: 'en',                    // TODO(week-1): pull from clients table
              channel: 'email',                            // gmail message → reply via email
              preparerFullName: 'Antonio Vazquez',         // TODO(week-1): pull from users table
              preparerSignOff: 'Antonio',
              firmName: 'Vazant Consulting',               // TODO(week-1): pull from tenants table
              // Trust level — L1 is the conservative posture per
              // CLAUDE.md §8 trust escalation. v1 reads this from
              // tenants.defaultTrustLevel; for now hardcode to L1
              // so the trust-gate verdict on the resulting draft
              // is deterministic + permits-but-flags-for-approval.
              trustLevel: 1,
              originalMessage: {
                channel: 'email',
                body: scrubbedBody,
                receivedAt: message.receivedAt,
              },
            },
          },
          modelTier: 'sonnet-4-6',
          // draftReply owns audit-row persistence (writes the row
          // AFTER computing trustGate so tool_input.trustGate is
          // populated). The hook below fires after the row lands
          // with the new action.id — used to update issues.draft_action_id.
        });
      });

      logger.info({
        issueType,
        draftConfidence: drafted.output.confidence,
        draftCostUsd: drafted.costUsd,
        draftLatencyMs: drafted.latencyMs,
        // Trust-gate verdict — persisted into actions.tool_input
        // by draftReply. Flattened here for log readability.
        trustGateAllowed: drafted.trustGate.allowed,
        trustGateActionClass: drafted.trustGate.actionClass,
        trustGateRequires:
          drafted.trustGate.allowed === false ? drafted.trustGate.requires : null,
        draftActionId: drafted.draftActionId,
      });
      draftCostUsd = drafted.costUsd;
      draftActionId = drafted.draftActionId;

      // Link the draft action row to the issue. issues.draft_action_id
      // is the join the inbox UI uses to surface the draft preview +
      // trust-gate badge.
      if (draftActionId && issueId !== 'issue-placeholder-id') {
        await step.run('link-draft-to-issue', async () => {
          // TODO(week-1): once persist-issue is wired, do:
          //   UPDATE issues SET draft_action_id = $1 WHERE id = $2
          // For now persist-issue is still a placeholder (issueId
          // is the literal 'issue-placeholder-id') so this branch
          // doesn't fire. When persist-issue lands, this hook is
          // already in the right place.
          logger.info('link-draft-to-issue (waiting on persist-issue)');
        });
      }
    }

    // Step 6 — emit downstream event so UI surfaces the new issue
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
