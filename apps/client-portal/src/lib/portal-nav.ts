'use client';

// Helpers for direction-aware navigation through the intake flow.
// Pairs with the (intake) layout that reads `docket:portal:nav-direction`
// from sessionStorage and animates the page transition accordingly.

import { useRouter } from 'next/navigation';

const NAV_KEY = 'docket:portal:nav-direction';

function setDirection(direction: 'forward' | 'back' | 'jump') {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(NAV_KEY, direction);
  } catch {
    // sessionStorage unavailable in private browsing — animation stays at default
  }
}

export function usePortalNav() {
  const router = useRouter();
  return {
    next(href: string) {
      setDirection('forward');
      router.push(href);
    },
    back(href: string) {
      setDirection('back');
      router.push(href);
    },
    jump(href: string) {
      setDirection('jump');
      router.push(href);
    },
    replace(href: string) {
      setDirection('jump');
      router.replace(href);
    },
  };
}
