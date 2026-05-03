// Cron: every 10 minutes per tenant, poll Gmail for new messages, persist to
// gmail_threads, classify each via triage-classifier, surface as issues.
//
// v0 placeholder: Gmail OAuth not yet wired (Antonio onboards day 14). The
// cron is FEATURE-FLAGGED OFF by default — running it every 10 minutes
// would burn Inngest invocations on a no-op since list-tenants-with-gmail
// always returns []. Set ENABLE_GMAIL_POLL=true in env to re-arm the
// cron once OAuth lands.
//
// When enabled, this function iterates tenants, fetches Gmail history
// since lastSeenHistoryId, fires gmail/message.received events for each
// new message (which the classifier picks up), and updates the cursor.

import { inngest } from '../inngest-client.js';

const GMAIL_POLL_ENABLED = process.env.ENABLE_GMAIL_POLL === 'true';

export const gmailPoll = inngest.createFunction(
  {
    id: 'gmail-poll',
    name: 'Gmail poll (every 10 min per tenant)',
    // Concurrency 5 fits the Inngest free-tier plan limit. Bump up
    // after upgrading the plan if Gmail polling at scale starts
    // serializing. v0 has no real Gmail load anyway (feature-flagged
    // off until OAuth lands).
    concurrency: { limit: 5 },
  },
  // Cron expression: every 10 minutes. When ENABLE_GMAIL_POLL is unset
  // or false, the function bails on entry — keeping the trigger
  // registered so we can flip the flag without redeploying.
  { cron: '*/10 * * * *' },
  async ({ step, logger }) => {
    if (!GMAIL_POLL_ENABLED) {
      logger.info('gmail-poll feature-flagged off (set ENABLE_GMAIL_POLL=true to enable)');
      return { polled: 0, classified: 0, skipped: 'flag_disabled' };
    }

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
