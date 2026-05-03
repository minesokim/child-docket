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
  //   2. Kind-based matchUploadToSlot fallback — for legacy rows with
  //      slot_id = NULL (uploaded before 0017, or via the future
  //      "Other" surface).
  //
  // DL slots are special: the overview slot is `identity-dl` (or
  // `identity-spouse-dl`), but uploads carry side-specific slot_ids
  // `<slot.id>-front` and `<slot.id>-back`. The per-slot page walks
  // the user through Step 1 (front) → Step 2 (back) and we compute
  // which side is active from the DB state.
  const docList = await listDocuments();
  const allDocs = docList.ok ? docList.documents : [];

  // ─── DL slot: front-then-back sequential flow ───
  if (slot.kind === 'drivers_license') {
    const frontSlotId = `${slot.id}-front`;
    const backSlotId = `${slot.id}-back`;

    // Most recent doc per side (in case of retakes).
    const frontDoc = allDocs.find((d) => d.slotId === frontSlotId) ?? null;
    const backDoc = allDocs.find((d) => d.slotId === backSlotId) ?? null;

    // A side is "done" once the user has accepted its classification.
    // We don't gate on full finalization (final phase) because the
    // user shouldn't have to wait for the binarize+PDF pipeline before
    // moving to the next side.
    const VERIFIED: ReadonlySet<string> = new Set(['accepted', 'finalizing', 'final']);
    const frontDone = !!frontDoc && VERIFIED.has(frontDoc.parsePhase);
    const backDone = !!backDoc && VERIFIED.has(backDoc.parsePhase);

    let dlStep: 'front' | 'back' | 'done';
    let activeDoc: typeof frontDoc;
    let effectiveSlotId: string;
    if (!frontDone) {
      dlStep = 'front';
      activeDoc = frontDoc;
      effectiveSlotId = frontSlotId;
    } else if (!backDone) {
      dlStep = 'back';
      activeDoc = backDoc;
      effectiveSlotId = backSlotId;
    } else {
      dlStep = 'done';
      activeDoc = backDoc;
      effectiveSlotId = backSlotId;
    }

    return (
      <DocSlotClient
        slot={slot}
        initialDoc={activeDoc}
        dl={{
          step: dlStep,
          effectiveSlotId,
          frontFilename: frontDoc?.finalFilename ?? null,
          backFilename: backDoc?.finalFilename ?? null,
        }}
      />
    );
  }

  // ─── Non-DL slots: the original lookup strategy ───
  const filledSlotIds = new Set<string>();
  let matchedDoc = null;
  for (const d of allDocs) {
    if (!d.slotId) continue;
    if (filledSlotIds.has(d.slotId)) continue;
    filledSlotIds.add(d.slotId);
    if (d.slotId === slot.id) {
      matchedDoc = d;
    }
  }

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
