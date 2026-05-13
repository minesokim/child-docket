// ClientMemoriesSection — Memories surface on the client detail page.
//
// Per CLAUDE.md §4 Memories tab + §8 Memories section. Slant.app
// validated this primitive in financial advice; we apply to tax.
//
// CONTRACT
//   Server component receives the memories list (loaded by parent),
//   client component handles the inline editing + add affordance.
//   Each row has: text + source label + relative time + actions
//   (pin / edit / dismiss).
//
// VOICE
//   Operational-modern (Inter + soft borders). NOT editorial-warm.
//   Memories are scanned quickly, not read like prose.
//   Pinned memories surface at the top, separated by a subtle divider.
//   Empty state explains what Memories are + how they populate.

'use client';

import { useState, useTransition } from 'react';
import {
  createMemory,
  updateMemoryText,
  togglePinMemory,
  dismissMemory,
  restoreMemory,
} from '@/app/clients/[id]/memories/actions';

export type ClientMemory = {
  id: string;
  text: string;
  pinned: boolean;
  dismissed: boolean;
  sourceKind:
    | 'manual'
    | 'message'
    | 'meeting_transcript'
    | 'intake_response'
    | 'document_parse'
    | 'inferred';
  extractedByAgent: string | null;
  confidence: number;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  clientId: string;
  clientName: string;
  memories: ClientMemory[];
  /** Whether the current user can edit memories (firm_owner/preparer/reviewer). */
  canEdit: boolean;
};

const SOURCE_LABELS: Record<ClientMemory['sourceKind'], string> = {
  manual: 'Manual',
  message: 'From message',
  meeting_transcript: 'From meeting',
  intake_response: 'From intake',
  document_parse: 'From document',
  inferred: 'AI inferred',
};

export function ClientMemoriesSection({
  clientId,
  clientName,
  memories,
  canEdit,
}: Props) {
  const [showDismissed, setShowDismissed] = useState(false);
  const [addingNew, setAddingNew] = useState(false);

  const active = memories.filter((m) => !m.dismissed);
  const dismissed = memories.filter((m) => m.dismissed);
  const pinned = active.filter((m) => m.pinned);
  const unpinned = active.filter((m) => !m.pinned);

  return (
    <section
      style={{
        marginTop: 32,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: 'oklch(20% 0.01 85)',
              margin: 0,
              letterSpacing: -0.2,
            }}
          >
            Memories
          </h2>
          <p
            style={{
              fontSize: 12,
              color: 'oklch(50% 0.01 85)',
              margin: '2px 0 0 0',
            }}
          >
            What we know about {clientName}. Surfaced before meetings + during chat.
          </p>
        </div>
        {canEdit && !addingNew && (
          <button
            type="button"
            onClick={() => setAddingNew(true)}
            style={{
              padding: '6px 12px',
              background: 'oklch(42% 0.09 150)',
              color: 'oklch(98% 0.01 85)',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            + Add memory
          </button>
        )}
      </header>

      {addingNew && (
        <AddMemoryRow
          clientId={clientId}
          onCancel={() => setAddingNew(false)}
          onSaved={() => setAddingNew(false)}
        />
      )}

      {active.length === 0 && !addingNew && (
        <EmptyState canEdit={canEdit} />
      )}

      {pinned.length > 0 && (
        <>
          <SectionLabel>Pinned</SectionLabel>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '0 0 16px 0',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {pinned.map((m) => (
              <MemoryRow key={m.id} memory={m} canEdit={canEdit} />
            ))}
          </ul>
        </>
      )}

      {unpinned.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {unpinned.map((m) => (
            <MemoryRow key={m.id} memory={m} canEdit={canEdit} />
          ))}
        </ul>
      )}

      {dismissed.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <button
            type="button"
            onClick={() => setShowDismissed((v) => !v)}
            style={{
              appearance: 'none',
              background: 'transparent',
              border: 'none',
              padding: '4px 0',
              fontSize: 11,
              color: 'oklch(50% 0.01 85)',
              cursor: 'pointer',
              letterSpacing: 0.2,
              textTransform: 'uppercase',
            }}
          >
            {showDismissed ? 'Hide' : 'Show'} {dismissed.length} dismissed
          </button>
          {showDismissed && (
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: '8px 0 0 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                opacity: 0.55,
              }}
            >
              {dismissed.map((m) => (
                <MemoryRow key={m.id} memory={m} canEdit={canEdit} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
        color: 'oklch(50% 0.01 85)',
        margin: '0 0 6px 0',
      }}
    >
      {children}
    </div>
  );
}

function EmptyState({ canEdit }: { canEdit: boolean }) {
  return (
    <div
      style={{
        padding: '24px 18px',
        background: 'oklch(99% 0.005 85)',
        border: '1px dashed oklch(90% 0.008 85)',
        borderRadius: 10,
        textAlign: 'center',
        fontSize: 13,
        color: 'oklch(45% 0.01 85)',
        lineHeight: 1.5,
      }}
    >
      <div style={{ fontWeight: 500, color: 'oklch(30% 0.01 85)', marginBottom: 4 }}>
        No memories yet
      </div>
      Memories populate automatically from messages, meetings, intake answers, and
      documents.
      {canEdit && (
        <span style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
          Or add one manually with the + Add memory button.
        </span>
      )}
    </div>
  );
}

function AddMemoryRow({
  clientId,
  onCancel,
  onSaved,
}: {
  clientId: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim().length === 0) {
      setError('Cannot save an empty memory.');
      return;
    }
    startTransition(async () => {
      const res = await createMemory(clientId, text);
      if (res.ok) {
        setText('');
        setError(null);
        onSaved();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        padding: 12,
        background: 'oklch(96% 0.02 150)',
        border: '1px solid oklch(42% 0.09 150)',
        borderRadius: 10,
        marginBottom: 14,
      }}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 2000))}
        placeholder="e.g., Daughter Lily starts UC Davis Aug 2026 (AOTC + 529 windowing)"
        rows={2}
        autoFocus
        disabled={pending}
        style={{
          width: '100%',
          padding: '8px 10px',
          fontFamily: 'inherit',
          fontSize: 13,
          lineHeight: 1.5,
          border: '1px solid oklch(92% 0.008 85)',
          borderRadius: 8,
          resize: 'vertical',
          background: 'oklch(99% 0.005 85)',
          color: 'oklch(20% 0.01 85)',
          boxSizing: 'border-box',
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 8,
          fontSize: 11,
        }}
      >
        <span style={{ color: 'oklch(50% 0.01 85)' }}>
          {text.length} / 2000
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            style={{
              padding: '6px 12px',
              background: 'transparent',
              color: 'oklch(35% 0.01 85)',
              border: '1px solid oklch(90% 0.008 85)',
              borderRadius: 6,
              fontSize: 12,
              cursor: pending ? 'wait' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending || text.trim().length === 0}
            style={{
              padding: '6px 12px',
              background: 'oklch(42% 0.09 150)',
              color: 'oklch(98% 0.01 85)',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              cursor: pending ? 'wait' : 'pointer',
              opacity: text.trim().length === 0 ? 0.5 : 1,
            }}
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      {error && (
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            color: 'oklch(52% 0.18 28)',
          }}
        >
          {error}
        </div>
      )}
    </form>
  );
}

function MemoryRow({ memory, canEdit }: { memory: ClientMemory; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(memory.text);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    if (text.trim().length === 0) {
      setError('Cannot save an empty memory.');
      return;
    }
    if (text.trim() === memory.text) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const res = await updateMemoryText(memory.id, text);
      if (res.ok) {
        setEditing(false);
        setError(null);
      } else {
        setError(res.error);
      }
    });
  }

  function handlePin() {
    startTransition(async () => {
      await togglePinMemory(memory.id);
    });
  }

  function handleDismiss() {
    startTransition(async () => {
      await dismissMemory(memory.id);
    });
  }

  function handleRestore() {
    startTransition(async () => {
      await restoreMemory(memory.id);
    });
  }

  return (
    <li
      style={{
        padding: '10px 12px',
        background: memory.pinned ? 'oklch(98% 0.015 150)' : 'oklch(99% 0.005 85)',
        border: '1px solid oklch(93% 0.008 85)',
        borderLeft: memory.pinned ? '3px solid oklch(42% 0.09 150)' : '1px solid oklch(93% 0.008 85)',
        borderRadius: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1 }}>
          {editing ? (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 2000))}
              rows={2}
              disabled={pending}
              autoFocus
              style={{
                width: '100%',
                padding: '6px 8px',
                fontFamily: 'inherit',
                fontSize: 13,
                lineHeight: 1.5,
                border: '1px solid oklch(85% 0.008 85)',
                borderRadius: 6,
                resize: 'vertical',
                background: 'oklch(99% 0.005 85)',
                color: 'oklch(20% 0.01 85)',
                boxSizing: 'border-box',
              }}
            />
          ) : (
            <div
              style={{
                fontSize: 13,
                lineHeight: 1.5,
                color: 'oklch(20% 0.01 85)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {memory.text}
            </div>
          )}
          <div
            style={{
              marginTop: 4,
              fontSize: 10,
              color: 'oklch(55% 0.01 85)',
              letterSpacing: 0.1,
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <span>{SOURCE_LABELS[memory.sourceKind]}</span>
            <span>·</span>
            <span>{formatRelativeTime(memory.createdAt)}</span>
            {memory.extractedByAgent && (
              <>
                <span>·</span>
                <span>
                  {memory.extractedByAgent}{' '}
                  <span style={{ color: 'oklch(60% 0.01 85)' }}>
                    ({Math.round(memory.confidence * 100)}%)
                  </span>
                </span>
              </>
            )}
          </div>
          {error && (
            <div
              style={{
                marginTop: 4,
                fontSize: 11,
                color: 'oklch(52% 0.18 28)',
              }}
            >
              {error}
            </div>
          )}
        </div>
        {canEdit && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
            {editing ? (
              <>
                <IconButton onClick={handleSave} disabled={pending} title="Save">
                  ✓
                </IconButton>
                <IconButton
                  onClick={() => {
                    setEditing(false);
                    setText(memory.text);
                    setError(null);
                  }}
                  disabled={pending}
                  title="Cancel"
                >
                  ×
                </IconButton>
              </>
            ) : memory.dismissed ? (
              <IconButton onClick={handleRestore} disabled={pending} title="Restore">
                ↺
              </IconButton>
            ) : (
              <>
                <IconButton
                  onClick={handlePin}
                  disabled={pending}
                  title={memory.pinned ? 'Unpin' : 'Pin'}
                >
                  {memory.pinned ? '📌' : '📍'}
                </IconButton>
                <IconButton onClick={() => setEditing(true)} disabled={pending} title="Edit">
                  ✎
                </IconButton>
                <IconButton onClick={handleDismiss} disabled={pending} title="Dismiss">
                  ✕
                </IconButton>
              </>
            )}
          </div>
        )}
      </div>
    </li>
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
        width: 22,
        height: 22,
        padding: 0,
        background: 'transparent',
        border: '1px solid transparent',
        borderRadius: 4,
        fontSize: 12,
        cursor: disabled ? 'wait' : 'pointer',
        color: 'oklch(45% 0.01 85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.background = 'oklch(94% 0.008 85)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'oklch(85% 0.008 85)';
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

function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.floor((now - t) / 60_000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 14) return `${diffDay}d ago`;
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
