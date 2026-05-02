'use client';

// Shared "glidey" navigation hook for the auth + welcome flow.
//
// Patterns most modern SaaS apps use for high-stakes button taps:
//   1. Tap → instant local feedback (button press scale-down)
//   2. Page exits with a smooth fade + lift
//   3. Next page fades + drops in from above
//   4. Total perceived transition ~700-900ms
//
// Used by:
//   - / (landing) → /login
//   - /login      → /otp
//   - /otp        → /welcome
//
// Each page reads `exiting` and applies the `glidey-fade-out` animation
// when true. Call `glide(href)` to trigger exit + navigate.

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

const DEFAULT_EXIT_MS = 360;

export function useGlideyNav() {
  const router = useRouter();
  const [exiting, setExiting] = useState(false);

  const glide = useCallback(
    (href: string, delayMs: number = DEFAULT_EXIT_MS) => {
      if (exiting) return; // ignore double-taps
      setExiting(true);
      window.setTimeout(() => router.push(href), delayMs);
    },
    [router, exiting],
  );

  const glideReplace = useCallback(
    (href: string, delayMs: number = DEFAULT_EXIT_MS) => {
      if (exiting) return;
      setExiting(true);
      window.setTimeout(() => router.replace(href), delayMs);
    },
    [router, exiting],
  );

  return { exiting, glide, glideReplace };
}

// CSS keyframes shared across pages - inject this <style> block once
// per page that uses glidey nav. Animation name: `glidey-fade-out`.
//
// The receiving page should use a complementary fade-in (handled by
// the (auth) layout for /login and /otp, and by the (intake) layout
// for /welcome).
export const GLIDEY_KEYFRAMES = `
  @keyframes glidey-fade-out {
    from { opacity: 1; transform: translateY(0)    scale(1);    }
    to   { opacity: 0; transform: translateY(-12px) scale(0.985); }
  }
`;
