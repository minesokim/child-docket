'use client';

// Display a sensitive intake value (SSN/EIN/bank) that switches between
// masked and plaintext based on the PIIUnlockProvider state.
//
// Locked  → renders the masked value passed in (e.g. "···-··-6789").
// Unlocked + has plaintext → renders plaintext from the unlock map.
// Unlocked but path missing from map → renders masked (defensive).
//
// Pure-display: no buttons, no own state. The PIIUnlockButton in the
// header drives the unlock; every MaskedPII on the page flips together.

import type { Theme } from '@docket/ui';
import { usePIIUnlock } from './pii-unlock-provider';

export function MaskedPII({
  t,
  path,
  masked,
  mono = true,
}: {
  t: Theme;
  path: string;
  masked: string | null | undefined;
  mono?: boolean;
}) {
  const { plaintext } = usePIIUnlock();
  if (!masked) return null;

  const value = plaintext?.get(path) ?? masked;
  const isUnlocked = plaintext?.has(path) === true;

  return (
    <span
      style={{
        fontFamily: mono ? t.mono : t.sans,
        fontSize: mono ? 12 : 13.5,
        letterSpacing: mono ? 0.3 : 0,
        color: isUnlocked ? t.ink : t.muted,
        fontWeight: isUnlocked ? 500 : 400,
      }}
    >
      {value}
    </span>
  );
}
