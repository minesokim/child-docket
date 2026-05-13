// SeedProjectsButton — installs canonical 12 templates per tenant.

'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { seedProjectTemplates } from './actions';

type Props = {
  missingCount: number;
};

export function SeedProjectsButton({ missingCount }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const res = await seedProjectTemplates();
      if (res.ok) {
        router.refresh();
      } else {
        alert(`Couldn't seed templates: ${res.error}`);
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
      {pending
        ? 'Seeding…'
        : `Install ${missingCount} template${missingCount === 1 ? '' : 's'}`}
    </button>
  );
}
