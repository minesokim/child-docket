// SeedDefaultsButton — single-click "install canonical 5 rules" for
// the tenant. Only the firm owner sees it (parent gates).
//
// Idempotent: the underlying INSERT uses ON CONFLICT DO NOTHING, so
// repeat clicks just no-op on rules already present.

'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { seedDefaults } from './actions';

type Props = {
  missingCount: number;
};

export function SeedDefaultsButton({ missingCount }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const res = await seedDefaults();
      if (res.ok) {
        router.refresh();
      } else {
        alert(`Couldn't seed defaults: ${res.error}`);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      style={{
        padding: '6px 12px',
        background: 'oklch(42% 0.09 150)',
        color: 'oklch(98% 0.01 85)',
        border: 'none',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 500,
        cursor: pending ? 'wait' : 'pointer',
      }}
    >
      {pending ? 'Seeding…' : `Install ${missingCount} default rule${missingCount === 1 ? '' : 's'}`}
    </button>
  );
}
