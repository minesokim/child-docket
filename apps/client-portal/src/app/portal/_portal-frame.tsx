'use client';

// Inner client wrapper for the /portal layout. Owns the persistent
// 5-tab navigation bar at the bottom. Outer (Server Component) layout
// hydrates the IntakeProvider with Postgres-backed state so every
// portal page can read/write IntakeState via useIntakeField - same
// data model as the (intake) flow.

import { usePathname, useRouter } from 'next/navigation';
import { buildTheme, PortalTabBar, type PortalTabId } from '@docket/ui';

const TAB_TO_PATH: Record<PortalTabId, string> = {
  home: '/portal/home',
  docs: '/portal/docs',
  msgs: '/portal/messages',
  sign: '/portal/signatures',
  profile: '/portal/profile',
};

function pathToTab(pathname: string): PortalTabId {
  if (pathname.startsWith('/portal/docs')) return 'docs';
  if (pathname.startsWith('/portal/messages')) return 'msgs';
  if (pathname.startsWith('/portal/signatures') || pathname.startsWith('/portal/sign-8879'))
    return 'sign';
  if (pathname.startsWith('/portal/profile')) return 'profile';
  return 'home';
}

export function PortalFrame({ children }: { children: React.ReactNode }) {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const pathname = usePathname();
  const router = useRouter();
  const active = pathToTab(pathname);

  return (
    <div
      style={{
        background: t.bg,
        color: t.ink,
        fontFamily: t.sans,
        height: '100dvh',
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitFontSmoothing: 'antialiased',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ flex: 1 }}>{children}</div>
      <PortalTabBar t={t} active={active} onTab={(id) => router.push(TAB_TO_PATH[id])} />
    </div>
  );
}
