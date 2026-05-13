// EngagementProjectNotes — thin client wrapper that lazy-loads the
// heavy editor only after the user clicks Edit / + Add note.
//
// CODEX ROUND 1 P2 (C26): without the lazy split, every engagement
// row on /projects/[id] (up to 500 per the LIMIT 500 list) would
// hydrate a stateful textarea + handlers + autofocus effects, even
// for users who never edit notes. With the split, only useState +
// a tiny button-and-text shell hydrates per row; the textarea +
// save handlers + char-count + 23505/error handling all live in
// engagement-project-notes-editor.tsx which loads on demand.
//
// VOICE
//   Operational-modern. View-mode renders saved text in a faint
//   italic block; edit affordance is an upper-case "+ Add note"
//   when empty or "Edit" inline-link when populated.
//
// EDGE CASES (delegated to editor)
//   - >500 chars → server rejects; editor surfaces banner
//   - Whitespace-only → server collapses to NULL; we update local
//     saved state to '' so the empty-state surface returns
//   - Stale attachment → "Attachment not found. Attach the project
//     first." → editor banner
//   - Cross-tenant / cross-role → action gates; surfaces as error

'use client';

import { lazy, Suspense, useEffect, useState } from 'react';

const EngagementProjectNotesEditor = lazy(
  () => import('./engagement-project-notes-editor'),
);

type Props = {
  engagementId: string;
  projectId: string;
  initialNotes: string | null;
  canEdit: boolean;
};

export function EngagementProjectNotes({
  engagementId,
  projectId,
  initialNotes,
  canEdit,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(initialNotes ?? '');

  // Re-sync when server prop changes (e.g., after a sibling action
  // fired revalidatePath and the page rehydrated with new notes).
  useEffect(() => {
    if (!editing) setSaved(initialNotes ?? '');
  }, [initialNotes, editing]);

  if (!canEdit) {
    if (!saved) return null;
    return <SavedNoteView text={saved} />;
  }

  if (editing) {
    return (
      <Suspense fallback={<EditorFallback />}>
        <EngagementProjectNotesEditor
          engagementId={engagementId}
          projectId={projectId}
          initialNotes={saved}
          onSaved={(newValue) => {
            setSaved(newValue);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </Suspense>
    );
  }

  if (!saved) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        style={{
          marginTop: 4,
          padding: '2px 6px',
          background: 'transparent',
          color: 'oklch(50% 0.01 85)',
          border: 'none',
          fontSize: 10,
          letterSpacing: 0.3,
          textTransform: 'uppercase',
          cursor: 'pointer',
          alignSelf: 'flex-start',
        }}
      >
        + Add note
      </button>
    );
  }

  return (
    <div
      style={{
        marginTop: 6,
        padding: '6px 8px',
        background: 'oklch(98% 0.005 85)',
        border: '1px solid oklch(94% 0.008 85)',
        borderRadius: 6,
        fontSize: 11,
        color: 'oklch(40% 0.01 85)',
        whiteSpace: 'pre-wrap',
        fontStyle: 'italic',
        lineHeight: 1.5,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>{saved}</span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        style={{
          flexShrink: 0,
          padding: '0 4px',
          background: 'transparent',
          color: 'oklch(50% 0.01 85)',
          border: 'none',
          fontSize: 10,
          letterSpacing: 0.3,
          textTransform: 'uppercase',
          cursor: 'pointer',
          fontStyle: 'normal',
        }}
        title="Edit note"
      >
        Edit
      </button>
    </div>
  );
}

function SavedNoteView({ text }: { text: string }) {
  return (
    <div
      style={{
        marginTop: 6,
        padding: '6px 8px',
        background: 'oklch(98% 0.005 85)',
        border: '1px solid oklch(94% 0.008 85)',
        borderRadius: 6,
        fontSize: 11,
        color: 'oklch(40% 0.01 85)',
        whiteSpace: 'pre-wrap',
        fontStyle: 'italic',
        lineHeight: 1.5,
      }}
    >
      {text}
    </div>
  );
}

function EditorFallback() {
  return (
    <div
      style={{
        marginTop: 6,
        fontSize: 11,
        color: 'oklch(55% 0.01 85)',
        fontStyle: 'italic',
      }}
    >
      Loading editor…
    </div>
  );
}
