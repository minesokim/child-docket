// Event-driven: when 'gmail/message.received' fires, fetch the message body,
// classify it via triage-classifier, persist a row to issues if confidence is
// high enough. Surfaces the issue in the Triage view.
//
// v0 placeholder: real Gmail fetch + DB writes wired when OAuth + Postgres
// connection lands (week 1).

import { inngest } from '../inngest-client.js';
import { classifySignal } from '../agents/triage-classifier.js';
import type { TenantId, ClientId } from '@docket/shared';

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
          bodyText: message.bodyText,
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

    // Step 5 — emit downstream event so the Inbox Drafter can draft a reply
    await step.sendEvent('emit-issue-created', {
      name: 'issue/created',
      data: {
        tenantId,
        issueId,
        type: classification.output.issueType,
        severity: classification.output.severity,
      },
    });

    return {
      classified: true,
      issueId,
      issueType: classification.output.issueType,
      severity: classification.output.severity,
      confidence: classification.output.confidence,
      costUsd: classification.costUsd,
    };
  },
);
