'use client';

// Per-engagement "Waive deposit" toggle for /clients/[id].
//
// Antonio clicks to flip engagement.deposit_waived. The intake
// /deposit page reads this on every render and short-circuits when
// true — client skips the deposit gate.
//
// AUDIT
//   Every flip writes an audit row via the setDepositWaived action.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { Theme } from '@docket/ui';
import { setDepositWaived } from '@/lib/engagements/set-deposit-waived';

interface Props {
  t: Theme;
  engagementId: string;
  initialWaived: boolean;
  canEdit: boolean;
}

type State =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string };

export function DepositWaiverToggle({ t, engagementId, initialWaived, canEdit }: Props) {
  const router = useRouter();
  const [waived, setWaived] = React.useState(initialWaived);
  const [state, setState] = React.useState<State>({ kind: 'idle' });

  const onToggle = React.useCallback(async () => {
    if (!canEdit) return;
    const newValue = !waived;
    setWaived(newValue); // optimistic
    setState({ kind: 'submitting' });
    try {
      const result = await setDepositWaived(engagementId, newValue);
      if (result.ok) {
        setState({ kind: 'idle' });
        router.refresh();
      } else {
        setWaived(!newValue); // revert
        setState({ kind: 'error', message: result.message });
      }
    } catch {
      setWaived(!newValue); // revert
      setState({ kind: 'error', message: 'Network error. Try again.' });
    }
  }, [canEdit, engagementId, router, waived]);

  return (
    <div
      style={{
        marginTop: 14,
        paddingTop: 14,
        borderTop: `1px solid ${t.borderSoft}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          cursor: canEdit ? 'pointer' : 'not-allowed',
          fontSize: 13,
          color: t.inkSoft,
          opacity: canEdit ? 1 : 0.6,
        }}
      >
        <input
          type="checkbox"
          checked={waived}
          onChange={onToggle}
          disabled={!canEdit || state.kind === 'submitting'}
          style={{
            cursor: canEdit ? 'pointer' : 'not-allowed',
            accentColor: '#1f4621',
          }}
        />
        <span>
          <strong style={{ fontWeight: 500, color: t.ink }}>Waive deposit</strong> for this engagement
        </span>
      </label>
      {waived && (
        <span
          style={{
            fontFamily: t.mono,
            fontSize: 10,
            color: '#1f4621',
            background: '#e1f4df',
            padding: '2px 8px',
            borderRadius: 999,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
          }}
        >
          Waived
        </span>
      )}
      {state.kind === 'submitting' && (
        <span style={{ fontSize: 11, color: t.muted }}>Saving…</span>
      )}
      {state.kind === 'error' && (
        <span
          role="alert"
          style={{
            fontSize: 11,
            color: t.rust,
            fontFamily: t.mono,
          }}
        >
          {state.message}
        </span>
      )}
    </div>
  );
}
