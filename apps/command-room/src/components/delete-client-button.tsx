'use client';

// Delete-client button + confirmation modal for the per-client
// detail page.
//
// Two-step UX:
//   1. Click the red "Delete client" button → modal opens.
//   2. Modal shows name + warning. User must TYPE the client's full
//      name to enable the destructive action (GitHub-style hard
//      confirmation — protects against muscle-memory clicks on a
//      red button).
//   3. Click "Delete permanently" → calls deleteClient server action.
//      On success, route to /clients (the list refreshes server-side
//      via revalidatePath in the action).

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { buildTheme } from '@docket/ui';
import { deleteClient } from '@/lib/clients/delete';

export function DeleteClientButton({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: '8px 16px',
          background: 'transparent',
          border: `1px solid ${t.rust}`,
          color: t.rustInk,
          borderRadius: 8,
          fontSize: 13,
          fontFamily: t.sans,
          cursor: 'pointer',
        }}
      >
        Delete client…
      </button>

      {open && (
        <ConfirmDeleteModal
          t={t}
          clientId={clientId}
          clientName={clientName}
          onCancel={() => setOpen(false)}
          onConfirmed={() => {
            // The server action revalidates /clients; we navigate
            // away from the now-deleted detail page.
            router.push('/clients');
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function ConfirmDeleteModal({
  t,
  clientId,
  clientName,
  onCancel,
  onConfirmed,
}: {
  t: ReturnType<typeof buildTheme>;
  clientId: string;
  clientName: string;
  onCancel: () => void;
  onConfirmed: () => void;
}) {
  const [typed, setTyped] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Disable the destructive button until the typed text matches
  // (case-insensitive, trimmed). Cheap muscle-memory defense.
  const matches = typed.trim().toLowerCase() === clientName.trim().toLowerCase();

  // Esc to cancel.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, submitting]);

  const onDelete = async () => {
    if (!matches || submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await deleteClient({ clientId, confirmName: clientName });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onConfirmed();
  };

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20, 14, 10, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 20,
        animation: 'docket-fade-in 140ms ease-out',
      }}
    >
      <style>{`
        @keyframes docket-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes docket-modal-pop {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 460,
          background: t.bg,
          borderRadius: 14,
          padding: '26px 28px 24px',
          boxShadow: '0 20px 60px rgba(20, 14, 10, 0.25)',
          fontFamily: t.sans,
          animation: 'docket-modal-pop 200ms cubic-bezier(.2,.8,.2,1)',
        }}
      >
        <div
          style={{
            fontFamily: t.mono,
            fontSize: 10,
            color: t.rustInk,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          Are you sure?
        </div>
        <h2
          style={{
            fontFamily: t.serif,
            fontSize: 22,
            color: t.ink,
            letterSpacing: -0.3,
            margin: 0,
            marginBottom: 12,
          }}
        >
          Delete {clientName}?
        </h2>
        <p
          style={{
            fontSize: 14,
            color: t.inkSoft,
            lineHeight: 1.5,
            margin: 0,
            marginBottom: 8,
          }}
        >
          This permanently removes the client and everything tied to them:
          intake answers, uploaded documents, messages, signatures, and
          open issues.
        </p>
        <p
          style={{
            fontSize: 13,
            color: t.muted,
            lineHeight: 1.5,
            margin: 0,
            marginBottom: 18,
          }}
        >
          The audit log keeps the trail — every action they took stays
          recorded, but no longer points back to a person.{' '}
          <span style={{ fontWeight: 500, color: t.rustInk }}>
            This can&apos;t be undone.
          </span>
        </p>

        <div style={{ marginBottom: 18 }}>
          <label
            style={{
              display: 'block',
              fontFamily: t.mono,
              fontSize: 9.5,
              color: t.muted,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            Type <span style={{ color: t.ink }}>{clientName}</span> to confirm
          </label>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={clientName}
            autoFocus
            disabled={submitting}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: `1px solid ${matches ? t.rust : t.border}`,
              borderRadius: 8,
              fontSize: 14,
              fontFamily: t.sans,
              color: t.ink,
              background: '#fff',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 120ms',
            }}
          />
        </div>

        {error && (
          <div
            style={{
              padding: '10px 12px',
              background: '#fff0eb',
              border: `1px solid ${t.rust}`,
              borderRadius: 8,
              color: '#7a3a26',
              fontSize: 13,
              marginBottom: 14,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onCancel}
            disabled={submitting}
            style={{
              padding: '10px 18px',
              background: 'transparent',
              border: `1px solid ${t.border}`,
              borderRadius: 8,
              color: t.inkSoft,
              fontSize: 13.5,
              fontFamily: t.sans,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onDelete}
            disabled={!matches || submitting}
            style={{
              padding: '10px 22px',
              background: matches ? t.rust : t.borderSoft,
              color: matches ? '#fff' : t.muted,
              border: 'none',
              borderRadius: 8,
              fontSize: 13.5,
              fontFamily: t.sans,
              fontWeight: 500,
              cursor: !matches || submitting ? 'not-allowed' : 'pointer',
              transition: 'background 120ms',
            }}
          >
            {submitting ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}
