// SeedNotificationsButton — single-click "install canonical 4
// categories" for the tenant. Only firm owner sees it.

'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { seedNotificationDefaults } from './actions';

type Props = {
  missingCount: number;
};

export function SeedNotificationsButton({ missingCount }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const res = await seedNotificationDefaults();
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
      {pending ? 'Seeding…' : `Install ${missingCount} default categor${missingCount === 1 ? 'y' : 'ies'}`}
    </button>
  );
}
