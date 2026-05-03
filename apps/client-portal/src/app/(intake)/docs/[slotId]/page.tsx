// Focused per-doc upload page.
//
// Server component:
//   1. Resolves auth → redirects to /login or /no-access on miss.
//   2. Reads intake → derives the expected list.
//   3. Looks up the slot by id from the URL.
//   4. Fetches existing docs, finds the one (if any) matched to this
//      slot via matchUploadToSlot.
//   5. Hands all three to DocSlotClient for the upload + verification UX.
//
// Slot id 404:
//   If the URL slot id doesn't match any expected doc (e.g., user
//   bookmarked /docs/foo, or intake answers changed and a slot is
//   no longer applicable), redirect to /docs.

import { redirect, notFound } from 'next/navigation';
import { resolveClient } from '@/lib/intake/auth';
import { getOrCreateIntakeAnswers } from '@/lib/intake/read';
import { listDocuments } from '@/lib/docs/list';
import {
  matchUploadToSlot,
  requiredDocsFor,
  type ExpectedDocKind,
} from '@docket/shared';
import { DocSlotClient } from './doc-slot-client';

export default async function DocSlotPage({
  params,
}: {
  params: Promise<{ slotId: string }>;
}) {
  const auth = await resolveClient();
  if (auth.kind === 'no_session') redirect('/login');
  if (auth.kind === 'no_invite') redirect('/no-access');

  const bundle = await getOrCreateIntakeAnswers();
  if (!bundle) redirect('/docs');

  const { slotId } = await params;
  const decodedSlotId = decodeURIComponent(slotId);

  const expected = requiredDocsFor(bundle.answers);
  const slot = expected.find((s) => s.id === decodedSlotId);
  if (!slot) {
    // Slot id from URL doesn't match the expected list (probably
    // intake state changed since the link was created). Bounce back
    // to the overview rather than 404 — the user just sees the
    // updated checklist.
    redirect('/docs');
  }

  // Find the doc currently filling this slot.
  //
  // Strategy:
  //   1. Direct slot_id match — anything uploaded from a focused
  //      per-slot page since migration 0017 carries slot_id on the row.
  //      Most-recent-first wins (a re-upload supersedes the old one).
  //   2. Kind-based matchUploadToSlot fallback — for legacy rows with
  //      slot_id = NULL (uploaded before 0017, or via the future
  //      "Other" surface). Walk in upload order, fill slots greedily.
  const docList = await listDocuments();
  const allDocs = docList.ok ? docList.documents : [];

  // Pre-claim: rows with slot_id set go straight to that slot.
  const filledSlotIds = new Set<string>();
  let matchedDoc = null;
  for (const d of allDocs) {
    if (!d.slotId) continue;
    if (filledSlotIds.has(d.slotId)) continue; // older duplicate
    filledSlotIds.add(d.slotId);
    if (d.slotId === slot.id) {
      matchedDoc = d;
    }
  }

  // Fallback: kind-based fill for slot_id-less rows.
  if (!matchedDoc) {
    for (const d of allDocs) {
      if (d.slotId) continue;
      const kind = (d.classification?.docKind ?? null) as ExpectedDocKind | null;
      if (!kind) continue;
      const matchedSlotId = matchUploadToSlot({
        uploadKind: kind,
        expected,
        filledSlotIds,
      });
      if (matchedSlotId) {
        filledSlotIds.add(matchedSlotId);
        if (matchedSlotId === slot.id) {
          matchedDoc = d;
        }
      }
    }
  }

  return <DocSlotClient slot={slot} initialDoc={matchedDoc} />;
}
