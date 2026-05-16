// Webhook replay-protection dedup tests (Tier 0 — boundary security).
//
// Pairs with migration 0037 (webhook_events table) +
// packages/db/src/webhook-dedup.ts. Proves the dedup primitive
// behaves correctly under the contracts described in the source
// header:
//
//   - First-seen (provider, event_id): isFirst=true.
//   - Replay (same tuple): isFirst=false.
//   - Same event_id under a different provider: isFirst=true (the
//     UNIQUE constraint is on the tuple, not event_id alone).
//   - Missing event_id: isFirst=true (better to over-process than
//     silently drop a legit event with a missing id).
//
// Run requirements:
//   - DATABASE_URL_RLS_TEST env var pointing at a database with
//     migrations 0000-0037 applied.
//
// Run:
//   DATABASE_URL_RLS_TEST=postgres://... bun test packages/db/test/webhook-dedup.test.ts
//
// Skipped (no-op) if DATABASE_URL_RLS_TEST is unset.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { sql as drizzleSql } from 'drizzle-orm';
import postgres, { type Sql } from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { randomUUID } from 'node:crypto';
import * as schema from '../src/schema.js';
import { tryRecordWebhookEvent } from '../src/webhook-dedup.js';

const DB_URL = process.env.DATABASE_URL_RLS_TEST;

if (!DB_URL) {
  describe.skip('Webhook dedup (skipped — DATABASE_URL_RLS_TEST not set)', () => {
    test('placeholder', () => {});
  });
} else {
  describeDedupSuite(DB_URL);
}

function describeDedupSuite(dbUrl: string) {
  let client: Sql;
  let db: PostgresJsDatabase<typeof schema>;

  // Suffix to namespace test rows so a re-run after a partial-cleanup
  // leftover doesn't collide on the UNIQUE constraint.
  const SUFFIX = randomUUID();

  beforeAll(async () => {
    client = postgres(dbUrl, { max: 4, prepare: false });
    db = drizzle(client, { schema });
  });

  afterAll(async () => {
    // Clean up any rows we wrote. webhook_events has no FK so
    // direct DELETE is fine.
    await db.execute(
      drizzleSql`DELETE FROM webhook_events WHERE event_id LIKE ${`webhook-dedup-${SUFFIX}%`}`,
    );
    await client.end();
  });

  describe('Webhook dedup primitive', () => {
    test('first-seen (provider, event_id) returns isFirst=true', async () => {
      const eventId = `webhook-dedup-${SUFFIX}-first`;
      const result = await tryRecordWebhookEvent(
        db as unknown as Parameters<typeof tryRecordWebhookEvent>[0],
        'square',
        eventId,
      );
      expect(result.isFirst).toBe(true);
    });

    test('replay of same (provider, event_id) returns isFirst=false', async () => {
      const eventId = `webhook-dedup-${SUFFIX}-replay`;
      const first = await tryRecordWebhookEvent(
        db as unknown as Parameters<typeof tryRecordWebhookEvent>[0],
        'docusign',
        eventId,
      );
      expect(first.isFirst).toBe(true);

      const replay = await tryRecordWebhookEvent(
        db as unknown as Parameters<typeof tryRecordWebhookEvent>[0],
        'docusign',
        eventId,
      );
      expect(replay.isFirst).toBe(false);
    });

    test('same event_id under a different provider is NOT a replay', async () => {
      const eventId = `webhook-dedup-${SUFFIX}-crossprovider`;

      const squareInsert = await tryRecordWebhookEvent(
        db as unknown as Parameters<typeof tryRecordWebhookEvent>[0],
        'square',
        eventId,
      );
      expect(squareInsert.isFirst).toBe(true);

      // Same event_id, different provider — distinct tuple.
      const twilioInsert = await tryRecordWebhookEvent(
        db as unknown as Parameters<typeof tryRecordWebhookEvent>[0],
        'twilio',
        eventId,
      );
      expect(twilioInsert.isFirst).toBe(true);
    });

    test('empty event_id returns isFirst=true (no dedup possible)', async () => {
      // Documented contract: when the provider's webhook payload
      // doesn't carry an event id, the helper can't dedup. Better
      // to over-process than silently drop a legit event with a
      // missing id. The caller logs a warning so an operator
      // chases the payload-shape regression.
      const result = await tryRecordWebhookEvent(
        db as unknown as Parameters<typeof tryRecordWebhookEvent>[0],
        'twilio',
        '',
      );
      expect(result.isFirst).toBe(true);

      // And again — no UNIQUE-constraint contention since we
      // didn't actually insert.
      const result2 = await tryRecordWebhookEvent(
        db as unknown as Parameters<typeof tryRecordWebhookEvent>[0],
        'twilio',
        '',
      );
      expect(result2.isFirst).toBe(true);
    });

    test('CHECK constraint rejects non-allowlisted provider', async () => {
      // The provider column has a CHECK constraint
      // (square | docusign | twilio | resend). A typo or future
      // bug passing a different string should error at the DB
      // layer. We don't surface this through tryRecordWebhookEvent
      // because the TypeScript type (WebhookProvider) already
      // restricts callers — but the DB-layer check is the
      // defense-in-depth catch.
      await expect(
        db.execute(drizzleSql`
          INSERT INTO webhook_events (provider, event_id)
          VALUES ('forged-provider', ${`webhook-dedup-${SUFFIX}-bad`})
        `),
      ).rejects.toThrow();
    });
  });
}
