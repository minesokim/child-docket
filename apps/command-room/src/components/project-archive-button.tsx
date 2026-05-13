// ProjectArchiveButton — firm_owner-only archive / unarchive toggle on
// /projects/[id] header. Inline confirm pattern: click once → confirm
// state with explicit Archive / Cancel; click Archive → server action
// fires. Skipping a confirm modal entirely; the inline expand is the
// operational-modern equivalent and matches the EngagementProjectNotes
// shape.
//
// EDGE CASES
//   - Action returns error → inline banner above the button
//   - Already in target state → server is idempotent; returns ok
//   - Concurrent toggle from another tab → last-write-wins; the page
//     reflects whichever commit landed last after revalidatePath fires

'use client';

import { useState, useTransition } from 'react';
import {
  archiveProject,
  unarchiveProject,
} from '@/app/projects/actions';

type Props = {
  projectId: string;
  isActive: boolean;
};

export function ProjectArchiveButton({ projectId, isActive }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleAction() {
    setError(null);
    startTransition(async () => {
      const res = isActive
        ? await archiveProject(projectId)
        : await unarchiveProject(projectId);
      if (!res.ok) {
        setError(res.error);
      } else {
        setConfirming(false);
      }
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        style={{
          padding: '6px 12px',
          background: 'transparent',
          color: isActive ? 'oklch(45% 0.13 28)' : 'oklch(42% 0.09 150)',
          border: `1px solid ${isActive ? 'oklch(85% 0.06 28)' : 'oklch(82% 0.04 150)'}`,
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 500,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {isActive ? 'Archive' : 'Unarchive'}
      </button>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        alignItems: 'flex-end',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 6,
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: 'oklch(40% 0.01 85)',
            marginRight: 4,
          }}
        >
          {isActive
            ? 'Archive this project? Engagements stay attached.'
            : 'Unarchive this project?'}
        </span>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
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
            fontFamily: 'inherit',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleAction}
          disabled={pending}
          style={{
            padding: '4px 10px',
            background: isActive
              ? 'oklch(45% 0.13 28)'
              : 'oklch(42% 0.09 150)',
            color: 'oklch(98% 0.01 85)',
            border: 'none',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 500,
            cursor: pending ? 'wait' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {pending
            ? isActive
              ? 'Archiving…'
              : 'Unarchiving…'
            : isActive
              ? 'Archive'
              : 'Unarchive'}
        </button>
      </div>
      {error && (
        <div
          style={{
            padding: '6px 8px',
            background: 'oklch(96% 0.02 28)',
            border: '1px solid oklch(88% 0.04 28)',
            borderRadius: 6,
            fontSize: 11,
            color: 'oklch(35% 0.06 28)',
            maxWidth: 280,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
