'use client';

// Settings → Practice config: default deposit amount form.
//
// firm_owner-only (server action enforces; UI hides the form for
// other roles).

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { setDefaultDepositCents } from '@/lib/firm-profile/set-default-deposit';

interface Props {
  initialDefaultDepositCents: number;
  canEdit: boolean;
}

type State =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'saved' }
  | { kind: 'error'; message: string };

export function DefaultDepositForm({ initialDefaultDepositCents, canEdit }: Props) {
  const router = useRouter();
  const [state, setState] = React.useState<State>({ kind: 'idle' });
  const [editing, setEditing] = React.useState(false);
  const [dollarsRaw, setDollarsRaw] = React.useState(
    (initialDefaultDepositCents / 100).toFixed(2),
  );

  const onSubmit = React.useCallback(
    async (formData: FormData) => {
      setState({ kind: 'submitting' });
      const dollars = Number(String(formData.get('dollars') ?? '50'));
      if (!Number.isFinite(dollars) || dollars < 0) {
        setState({ kind: 'error', message: 'Amount must be a positive number.' });
        return;
      }
      const cents = Math.round(dollars * 100);
      try {
        const result = await setDefaultDepositCents(cents);
        if (result.ok) {
          setState({ kind: 'saved' });
          setEditing(false);
          setDollarsRaw((cents / 100).toFixed(2));
          router.refresh();
          setTimeout(() => {
            setState((s) => (s.kind === 'saved' ? { kind: 'idle' } : s));
          }, 2000);
        } else {
          setState({ kind: 'error', message: result.message });
        }
      } catch {
        setState({
          kind: 'error',
          message: 'Could not reach the server. Try again.',
        });
      }
    },
    [router],
  );

  return (
    <div>
      {!editing ? (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span
            className="settings-num"
            style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums' }}
          >
            ${(initialDefaultDepositCents / 100).toFixed(2)}
          </span>
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                setState({ kind: 'idle' });
              }}
              style={{
                fontSize: 11,
                padding: '3px 10px',
                borderRadius: 999,
                border: '1px solid var(--s-border-strong, #d8c8b0)',
                background: 'transparent',
                color: 'var(--s-ink, #2A2419)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Edit
            </button>
          )}
          {state.kind === 'saved' && (
            <span
              style={{
                fontSize: 11,
                color: '#1f4621',
                fontFamily: 'ui-monospace, SF Mono, Menlo, monospace',
              }}
            >
              ✓ saved
            </span>
          )}
        </div>
      ) : (
        <form
          action={onSubmit}
          style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              border: '1px solid var(--s-border-strong, #d8c8b0)',
              borderRadius: 6,
              padding: '4px 10px',
              background: '#fff',
            }}
          >
            <span style={{ color: 'var(--s-ink-muted, #8a7d68)', fontSize: 13 }}>$</span>
            <input
              name="dollars"
              type="number"
              step="0.01"
              min="0"
              max="10000"
              defaultValue={dollarsRaw}
              required
              autoFocus
              style={{
                fontFamily: 'inherit',
                fontSize: 14,
                width: 80,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontVariantNumeric: 'tabular-nums',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={state.kind === 'submitting'}
            style={{
              fontSize: 11,
              padding: '4px 12px',
              borderRadius: 999,
              border: 'none',
              background: 'var(--s-forest, oklch(42% 0.09 150))',
              color: '#fff',
              cursor: state.kind === 'submitting' ? 'not-allowed' : 'pointer',
              opacity: state.kind === 'submitting' ? 0.6 : 1,
              fontFamily: 'inherit',
            }}
          >
            {state.kind === 'submitting' ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setState({ kind: 'idle' });
              setDollarsRaw((initialDefaultDepositCents / 100).toFixed(2));
            }}
            disabled={state.kind === 'submitting'}
            style={{
              fontSize: 11,
              padding: '4px 12px',
              borderRadius: 999,
              border: '1px solid var(--s-border-strong, #d8c8b0)',
              background: 'transparent',
              color: 'var(--s-ink, #2A2419)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          {state.kind === 'error' && (
            <span
              role="alert"
              style={{
                fontSize: 11,
                color: 'oklch(58% 0.22 25)',
                fontFamily: 'ui-monospace, SF Mono, Menlo, monospace',
                width: '100%',
                marginTop: 4,
              }}
            >
              {state.message}
            </span>
          )}
        </form>
      )}
    </div>
  );
}
