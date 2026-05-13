// ClientProjectPicker — attach/detach/primary projects on a client's
// engagement. Lives on /clients/[id], operates against the
// engagement_projects join table via the server actions in
// /clients/[id]/projects/actions.ts.
//
// VOICE
//   Operational-modern, lives alongside the engagement section on
//   the client page. Compact: per-attachment row with project name,
//   kind, primary-star toggle, and detach button.
//
// Empty state: when no projects attached yet, show "Attach project"
// select pre-populated with available active projects (templates
// excluded — templates aren't attachment targets per the v0 model).
//
// EDGE CASES
//   - No engagement exists for the client → component hides entirely
//   - No active non-template projects → "Install templates first"
//     CTA linking to /projects
//   - Engagement already in every available project → "All available
//     projects are attached" empty-add state

'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  attachEngagementToProject,
  detachEngagementFromProject,
  setPrimaryProject,
} from '@/app/clients/[id]/projects/actions';

export type AvailableProject = {
  id: string;
  name: string;
  kind: string;
  taxYear: number | null;
  colorHint: string | null;
};

export type AttachedProject = {
  id: string;
  name: string;
  kind: string;
  taxYear: number | null;
  colorHint: string | null;
  isPrimary: boolean;
  addedAt: string;
};

type Props = {
  engagementId: string;
  attached: AttachedProject[];
  available: AvailableProject[];
  canEdit: boolean;
};

const COLOR_HINT_FILL: Record<string, string> = {
  forest: 'oklch(42% 0.09 150)',
  amber: 'oklch(58% 0.13 75)',
  terra: 'oklch(52% 0.18 28)',
  'ink-blue': 'oklch(42% 0.10 240)',
};

function colorFor(hint: string | null): string {
  if (hint && COLOR_HINT_FILL[hint]) return COLOR_HINT_FILL[hint]!;
  return 'oklch(50% 0.01 85)';
}

export function ClientProjectPicker({
  engagementId,
  attached,
  available,
  canEdit,
}: Props) {
  // available list excludes already-attached projects (caller
  // pre-filters server-side). If everything's attached, picker
  // hides the attach UI but still surfaces a status note.
  const attachedIds = new Set(attached.map((a) => a.id));
  const candidates = available.filter((p) => !attachedIds.has(p.id));
  const [error, setError] = useState<string | null>(null);

  return (
    <section
      style={{
        marginTop: 16,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <h3
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'oklch(20% 0.01 85)',
            margin: 0,
            letterSpacing: 0.1,
          }}
        >
          Projects
        </h3>
        <span
          style={{
            fontSize: 11,
            color: 'oklch(50% 0.01 85)',
            letterSpacing: 0.2,
            textTransform: 'uppercase',
          }}
        >
          {attached.length} attached
        </span>
      </header>

      {error && (
        <div
          style={{
            marginBottom: 8,
            padding: '8px 10px',
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

      {attached.length === 0 ? (
        <EmptyAttachedState canEdit={canEdit} candidates={candidates} />
      ) : (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '0 0 8px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {attached.map((p) => (
            <AttachedRow
              key={p.id}
              engagementId={engagementId}
              project={p}
              canEdit={canEdit}
              onError={setError}
            />
          ))}
        </ul>
      )}

      {canEdit && candidates.length > 0 && (
        <AttachControl
          engagementId={engagementId}
          candidates={candidates}
          onError={setError}
        />
      )}

      {canEdit && candidates.length === 0 && available.length > 0 && (
        <div
          style={{
            fontSize: 11,
            color: 'oklch(50% 0.01 85)',
            fontStyle: 'italic',
            marginTop: 4,
          }}
        >
          All available projects are attached. Manage projects in{' '}
          <Link
            href="/projects"
            style={{ color: 'oklch(42% 0.09 150)', textDecoration: 'none' }}
          >
            /projects
          </Link>
          .
        </div>
      )}

      {canEdit && available.length === 0 && attached.length === 0 && (
        <div
          style={{
            fontSize: 11,
            color: 'oklch(50% 0.01 85)',
            marginTop: 4,
          }}
        >
          No active projects yet.{' '}
          <Link
            href="/projects"
            style={{ color: 'oklch(42% 0.09 150)', textDecoration: 'none' }}
          >
            Install templates
          </Link>{' '}
          first.
        </div>
      )}
    </section>
  );
}

function EmptyAttachedState({
  canEdit,
  candidates,
}: {
  canEdit: boolean;
  candidates: AvailableProject[];
}) {
  return (
    <div
      style={{
        padding: '12px 14px',
        background: 'oklch(99% 0.005 85)',
        border: '1px dashed oklch(90% 0.008 85)',
        borderRadius: 8,
        fontSize: 12,
        color: 'oklch(45% 0.01 85)',
        lineHeight: 1.5,
      }}
    >
      {candidates.length > 0
        ? 'No projects attached to this engagement yet.'
        : 'No active projects available to attach.'}
      {canEdit && candidates.length === 0 && (
        <span>
          {' '}
          Install templates in{' '}
          <Link
            href="/projects"
            style={{ color: 'oklch(42% 0.09 150)', textDecoration: 'none' }}
          >
            /projects
          </Link>{' '}
          first.
        </span>
      )}
    </div>
  );
}

function AttachedRow({
  engagementId,
  project,
  canEdit,
  onError,
}: {
  engagementId: string;
  project: AttachedProject;
  canEdit: boolean;
  onError: (e: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const color = colorFor(project.colorHint);

  function handleSetPrimary() {
    onError(null);
    startTransition(async () => {
      const res = await setPrimaryProject(engagementId, project.id);
      if (!res.ok) onError(res.error);
    });
  }

  function handleDetach() {
    onError(null);
    startTransition(async () => {
      const res = await detachEngagementFromProject(engagementId, project.id);
      if (!res.ok) onError(res.error);
    });
  }

  return (
    <li
      style={{
        padding: '8px 10px',
        background: 'oklch(99% 0.005 85)',
        border: '1px solid oklch(93% 0.008 85)',
        borderLeft: project.isPrimary
          ? `3px solid ${color}`
          : '1px solid oklch(93% 0.008 85)',
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <Link
        href={`/projects/${project.id}`}
        style={{
          flex: 1,
          minWidth: 0,
          textDecoration: 'none',
          color: 'inherit',
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'oklch(20% 0.01 85)',
            marginBottom: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {project.name}
          {project.isPrimary && (
            <span
              style={{
                marginLeft: 6,
                fontSize: 9,
                color,
                letterSpacing: 0.2,
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              Primary
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 10,
            color: 'oklch(50% 0.01 85)',
            letterSpacing: 0.1,
          }}
        >
          {project.kind.replace(/_/g, ' ')}
          {project.taxYear && ` · TY ${project.taxYear}`}
        </div>
      </Link>
      {canEdit && (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {!project.isPrimary && (
            <IconButton
              onClick={handleSetPrimary}
              disabled={pending}
              title="Set as primary"
            >
              ★
            </IconButton>
          )}
          <IconButton onClick={handleDetach} disabled={pending} title="Detach">
            ✕
          </IconButton>
        </div>
      )}
    </li>
  );
}

function AttachControl({
  engagementId,
  candidates,
  onError,
}: {
  engagementId: string;
  candidates: AvailableProject[];
  onError: (e: string | null) => void;
}) {
  const [selectedId, setSelectedId] = useState<string>('');
  const [makePrimary, setMakePrimary] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleAttach() {
    if (!selectedId) return;
    onError(null);
    startTransition(async () => {
      const res = await attachEngagementToProject(
        engagementId,
        selectedId,
        makePrimary,
      );
      if (res.ok) {
        setSelectedId('');
        setMakePrimary(false);
      } else {
        onError(res.error);
      }
    });
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        marginTop: 8,
        flexWrap: 'wrap',
      }}
    >
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        disabled={pending}
        style={{
          flex: '1 1 180px',
          padding: '6px 8px',
          fontSize: 12,
          fontFamily: 'inherit',
          border: '1px solid oklch(90% 0.008 85)',
          borderRadius: 6,
          background: 'oklch(99% 0.005 85)',
          color: 'oklch(20% 0.01 85)',
        }}
      >
        <option value="">Attach project…</option>
        {candidates.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.taxYear ? ` (TY ${p.taxYear})` : ''}
          </option>
        ))}
      </select>
      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          color: 'oklch(35% 0.01 85)',
          cursor: pending ? 'not-allowed' : 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={makePrimary}
          onChange={(e) => setMakePrimary(e.target.checked)}
          disabled={pending}
          style={{ width: 12, height: 12 }}
        />
        Primary
      </label>
      <button
        type="button"
        onClick={handleAttach}
        disabled={pending || !selectedId}
        style={{
          padding: '6px 12px',
          background: selectedId
            ? 'oklch(42% 0.09 150)'
            : 'oklch(92% 0.008 85)',
          color: selectedId ? 'oklch(98% 0.01 85)' : 'oklch(60% 0.01 85)',
          border: 'none',
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 500,
          cursor: pending || !selectedId ? 'not-allowed' : 'pointer',
        }}
      >
        {pending ? 'Attaching…' : 'Attach'}
      </button>
    </div>
  );
}

function IconButton({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      style={{
        appearance: 'none',
        width: 20,
        height: 20,
        padding: 0,
        background: 'transparent',
        border: '1px solid transparent',
        borderRadius: 4,
        fontSize: 11,
        cursor: disabled ? 'wait' : 'pointer',
        color: 'oklch(45% 0.01 85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.background =
            'oklch(94% 0.008 85)';
          (e.currentTarget as HTMLButtonElement).style.borderColor =
            'oklch(85% 0.008 85)';
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
      }}
    >
      {children}
    </button>
  );
}
