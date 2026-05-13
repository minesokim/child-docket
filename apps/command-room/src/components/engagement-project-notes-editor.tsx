// EngagementProjectNotesEditor — the heavy editor half. Only mounts
// when the user clicks Edit on a row; lazy-loaded by the thin
// EngagementProjectNotes wrapper. Codex round 1 P2 (C26): without
// the lazy split, every engagement row on /projects/[id] (up to 500)
// would hydrate a stateful textarea + handlers + effects, even for
// users who never edit notes.

'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { setEngagementProjectNotes } from '@/app/clients/[id]/projects/actions';

const NOTES_MAX_LENGTH = 500;

type Props = {
  engagementId: string;
  projectId: string;
  initialNotes: string | null;
  onSaved: (newValue: string) => void;
  onCancel: () => void;
};

export default function EngagementProjectNotesEditor({
  engagementId,
  projectId,
  initialNotes,
  onSaved,
  onCancel,
}: Props) {
  const [draft, setDraft] = useState(initialNotes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Autofocus + cursor-to-end on mount.
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(draft.length, draft.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSave() {
    setError(null);
    const trimmed = draft.trim();
    const initialTrimmed = (initialNotes ?? '').trim();
    if (trimmed === initialTrimmed) {
      // No-op save — close without server roundtrip.
      onSaved(trimmed);
      return;
    }
    startTransition(async () => {
      const res = await setEngagementProjectNotes(
        engagementId,
        projectId,
        draft,
      );
      if (res.ok) {
        onSaved(trimmed);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div style={{ marginTop: 6 }}>
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={pending}
        maxLength={NOTES_MAX_LENGTH}
        rows={2}
        placeholder="Add a note for this attachment..."
        style={{
          width: '100%',
          padding: '6px 8px',
          fontSize: 12,
          fontFamily: 'inherit',
          lineHeight: 1.5,
          border: '1px solid oklch(85% 0.008 85)',
          borderRadius: 6,
          background: 'oklch(99% 0.005 85)',
          color: 'oklch(20% 0.01 85)',
          resize: 'vertical',
          boxSizing: 'border-box',
        }}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 4,
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 10,
            color:
              draft.length > NOTES_MAX_LENGTH * 0.9
                ? 'oklch(45% 0.13 28)'
                : 'oklch(55% 0.01 85)',
            letterSpacing: 0.2,
          }}
        >
          {draft.length} / {NOTES_MAX_LENGTH}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            style={{
              padding: '4px 10px',
              background: 'transparent',
              color: 'oklch(45% 0.01 85)',
              border: '1px solid oklch(88% 0.008 85)',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 500,
              cursor: pending ? 'wait' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            style={{
              padding: '4px 10px',
              background: 'oklch(42% 0.09 150)',
              color: 'oklch(98% 0.01 85)',
              border: 'none',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 500,
              cursor: pending ? 'wait' : 'pointer',
            }}
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      {error && (
        <div
          style={{
            marginTop: 4,
            padding: '6px 8px',
            background: 'oklch(96% 0.02 28)',
            border: '1px solid oklch(88% 0.04 28)',
            borderRadius: 6,
            fontSize: 11,
            color: 'oklch(35% 0.06 28)',
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
