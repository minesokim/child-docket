// Cron: every 10 minutes per tenant, poll Gmail for new messages, persist to
// gmail_threads, classify each via triage-classifier, surface as issues.
//
// v0 placeholder: Gmail OAuth not yet wired (Antonio onboards day 14). For now,
// this function is a STRUCTURAL skeleton — it iterates tenants, would fetch
// messages, would classify, would persist. Real Gmail fetch lands when OAuth
// flow is built in apps/command-room.

import { inngest } from '../inngest-client.js';

export const gmailPoll = inngest.createFunction(
  {
    id: 'gmail-poll',
    name: 'Gmail poll (every 10 min per tenant)',
    concurrency: { limit: 10 },
  },
  // Cron expression: every 10 minutes. Switch to per-tenant schedules once
  // tenant scheduling is in place (week 4+).
  { cron: '*/10 * * * *' },
  async ({ step, logger }) => {
    // Step 1 — list active tenants with Gmail integration
    const tenants = await step.run('list-tenants-with-gmail', async () => {
      // TODO(week-1): replace with real query against tenants + integrations table
      // SELECT t.id FROM tenants t JOIN integrations i ON i.tenant_id = t.id
      //   WHERE i.kind = 'gmail' AND i.status = 'active'
      logger.info('list-tenants-with-gmail (placeholder)');
      return [] as Array<{ id: string }>;
    });

    if (tenants.length === 0) {
      logger.info('no tenants with gmail integration; sleeping');
      return { polled: 0, classified: 0 };
    }

    // Step 2 — for each tenant, fetch recent messages
    let totalNew = 0;
    let totalClassified = 0;
    for (const tenant of tenants) {
      const newMessages = await step.run(`gmail-fetch:${tenant.id}`, async () => {
        // TODO(week-1): real Gmail history API call
        // GET /gmail/v1/users/me/history?startHistoryId={lastSeenHistoryId}
        // Filter to messageType=messageAdded, dedupe by gmailMessageId
        logger.info(`gmail-fetch (placeholder) for tenant ${tenant.id}`);
        return [] as Array<{ id: string; threadId: string }>;
      });
      totalNew += newMessages.length;

      // Step 3 — for each new message, fire 'gmail/message.received' event
      // (which the triage-classifier function picks up)
      for (const msg of newMessages) {
        await step.sendEvent(`emit-classify:${msg.id}`, {
          name: 'gmail/message.received',
          data: {
            tenantId: tenant.id as never,
            gmailMessageId: msg.id,
            gmailThreadId: msg.threadId,
          },
        });
        totalClassified++;
      }
    }

    return { polled: totalNew, classified: totalClassified };
  },
);
