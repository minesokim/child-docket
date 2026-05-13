// NudgeRuleToggle — per-rule enable/disable switch on /settings/nudges.

'use client';

import { useState, useTransition } from 'react';
import { toggleNudgeRule } from './actions';

type Props = {
  ruleId: string;
  enabled: boolean;
  disabled?: boolean;
};

export function NudgeRuleToggle({ ruleId, enabled, disabled }: Props) {
  const [optimistic, setOptimistic] = useState(enabled);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (disabled || pending) return;
    const next = !optimistic;
    setOptimistic(next);
    startTransition(async () => {
      const res = await toggleNudgeRule(ruleId);
      if (!res.ok) {
        // Roll back optimistic state on failure.
        setOptimistic(!next);
        alert(`Couldn't toggle: ${res.error}`);
      }
    });
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={optimistic}
      aria-label={optimistic ? 'Disable rule' : 'Enable rule'}
      onClick={handleClick}
      disabled={disabled || pending}
      style={{
        appearance: 'none',
        width: 36,
        height: 20,
        padding: 0,
        borderRadius: 999,
        background: optimistic
          ? 'oklch(42% 0.09 150)'
          : 'oklch(85% 0.008 85)',
        border: 'none',
        cursor: disabled ? 'not-allowed' : pending ? 'wait' : 'pointer',
        position: 'relative',
        transition: 'background 120ms ease',
        flexShrink: 0,
        marginTop: 2,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 2,
          left: optimistic ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: 'oklch(99% 0.005 85)',
          transition: 'left 120ms ease',
        }}
      />
    </button>
  );
}
