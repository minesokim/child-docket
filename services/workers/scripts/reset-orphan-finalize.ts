// services/workers/scripts/reset-orphan-finalize.ts
//
// Reset documents that are stuck at parse_phase='finalizing' from
// pre-fix attempts (before P0 onFailure handler landed). Inngest
// gave up on those runs silently; rows never advanced to 'final'
// or 'failed'.
//
// What it does, per row that matches:
//   1. UPDATE documents SET parse_phase='accepted', clears any
//      partial final_* metadata, clears error_message.
//   2. Re-fires the 'document/accepted' Inngest event so the
//      finalize worker re-attempts with current code.
//
// Usage:
//   bun run services/workers/scripts/reset-orphan-finalize.ts
//   bun run services/workers/scripts/reset-orphan-finalize.ts --dry
//
// The default --dry mode lists what would change without actually
// updating. Pass --apply to commit.

/* eslint-disable no-console */

import { eq, and, isNull, inArray } from 'drizzle-orm';
import { withTenant, getAdminDb, schema } from '@docket/db';
import { asTenantId, asClientId } from '@docket/shared';
import { inngest } from '@docket/shared/inngest';

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');

  console.log(`${YELLOW}━━ reset-orphan-finalize${apply ? ' (APPLY)' : ' (DRY-RUN — pass --apply to commit)'} ━━${RESET}`);
  console.log('');

  // Find candidates: stuck at 'finalizing' OR stuck at 'accepted'
  // for too long (> 30 min — P2 fix should have rolled back, but
  // catch stragglers).
  const adminDb = getAdminDb();
  const stuck = await adminDb
    .select({
      id: schema.documents.id,
      tenantId: schema.documents.tenantId,
      clientId: schema.documents.clientId,
      parsePhase: schema.documents.parsePhase,
      slotId: schema.documents.slotId,
      aiClassification: schema.documents.aiClassification,
      finalStorageKey: schema.documents.finalStorageKey,
      acceptedAt: schema.documents.acceptedAt,
      createdAt: schema.documents.createdAt,
    })
    .from(schema.documents)
    .where(
      and(
        inArray(schema.documents.parsePhase, ['finalizing', 'accepted']),
        isNull(schema.documents.mergedIntoDocumentId),
      ),
    );

  if (stuck.length === 0) {
    console.log(`${GREEN}no stuck rows — nothing to reset${RESET}`);
    return 0;
  }

  console.log(`Found ${stuck.length} candidate row(s):`);
  for (const row of stuck) {
    const ageMin = row.acceptedAt
      ? Math.round((Date.now() - row.acceptedAt.getTime()) / 60_000)
      : Math.round((Date.now() - row.createdAt.getTime()) / 60_000);
    console.log(
      `  ${DIM}${row.id}${RESET}  phase=${row.parsePhase}  slot=${row.slotId ?? '-'}  age=${ageMin}m  classified=${row.aiClassification ?? '<none>'}`,
    );
  }
  console.log('');

  // Skip rows without aiClassification — those need a fresh upload,
  // not a retry. The retry worker requires aiClassification to be set.
  const eligible = stuck.filter((r) => r.aiClassification);
  const skipped = stuck.filter((r) => !r.aiClassification);
  if (skipped.length > 0) {
    console.log(`${YELLOW}skipping ${skipped.length} row(s) with no aiClassification (need re-upload)${RESET}`);
    for (const row of skipped) {
      console.log(`  ${DIM}${row.id}  phase=${row.parsePhase}${RESET}`);
    }
    console.log('');
  }

  if (!apply) {
    console.log(`${YELLOW}--dry mode: would reset ${eligible.length} row(s) and re-fire 'document/accepted'${RESET}`);
    console.log(`${YELLOW}re-run with --apply to commit${RESET}`);
    return 0;
  }

  console.log(`${YELLOW}APPLYING — resetting ${eligible.length} row(s)…${RESET}`);
  console.log('');

  let resetCount = 0;
  let eventCount = 0;
  let failCount = 0;

  for (const row of eligible) {
    try {
      // Reset to 'accepted' inside RLS-scoped tenant context.
      await withTenant(asTenantId(row.tenantId), async (db) => {
        await db
          .update(schema.documents)
          .set({
            parsePhase: 'accepted',
            errorMessage: null,
            finalStorageKey: null,
            finalFilename: null,
            finalSizeBytes: null,
            finalMimeType: null,
            finalizedAt: null,
            binarized: false,
          })
          .where(eq(schema.documents.id, row.id));

        // Audit row.
        await db.insert(schema.actions).values({
          tenantId: row.tenantId,
          clientId: row.clientId,
          userId: null,
          agentId: 'reset-orphan-finalize-script',
          actionClass: 'mutate-intake',
          toolName: 'resetOrphanFinalize',
          toolInput: {
            documentId: row.id,
            previousPhase: row.parsePhase,
          },
          toolOutput: { ok: true },
          latencyMs: 0,
          success: true,
        });
      });
      resetCount++;
      console.log(`  ${GREEN}reset${RESET}  ${row.id}  was=${row.parsePhase} → accepted`);

      // Fire the event OUTSIDE withTenant so a partial failure here
      // doesn't roll back the reset (the next script run would catch
      // any rows still at 'accepted' that we couldn't dispatch for).
      try {
        await inngest.send({
          name: 'document/accepted',
          data: {
            tenantId: asTenantId(row.tenantId),
            clientId: asClientId(row.clientId),
            documentId: row.id,
          },
        });
        eventCount++;
        console.log(`         ${DIM}sent 'document/accepted' event${RESET}`);
      } catch (eventErr) {
        failCount++;
        console.log(
          `         ${RED}event send failed${RESET}  ${(eventErr as Error).message}`,
        );
      }
    } catch (err) {
      failCount++;
      console.log(
        `  ${RED}reset failed${RESET}  ${row.id}  ${(err as Error).message}`,
      );
    }
  }

  console.log('');
  console.log(
    `${YELLOW}━━ done: reset=${resetCount} eventsSent=${eventCount} failed=${failCount} ━━${RESET}`,
  );

  // Wait a moment then re-query to show the new state.
  await new Promise((r) => setTimeout(r, 1500));
  const after = await adminDb
    .select({
      id: schema.documents.id,
      parsePhase: schema.documents.parsePhase,
      slotId: schema.documents.slotId,
    })
    .from(schema.documents)
    .where(
      inArray(
        schema.documents.id,
        eligible.map((r) => r.id),
      ),
    );

  console.log('');
  console.log('Current state:');
  for (const row of after) {
    console.log(
      `  ${DIM}${row.id}${RESET}  phase=${row.parsePhase}  slot=${row.slotId ?? '-'}`,
    );
  }

  return failCount > 0 ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(`${RED}FATAL${RESET}`, e);
    process.exit(2);
  });
