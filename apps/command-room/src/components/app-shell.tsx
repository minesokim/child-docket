// AppShell — sidebar nav + main content area for the Command Room.
// Server Component compatible (renders children, no client hooks).

import { SignOutButton } from '@clerk/nextjs';
import { buildTheme } from '@docket/ui';
import Link from 'next/link';
import type { Theme } from '@docket/ui';

type NavItem = {
  href: string;
  label: string;
  active?: boolean;
};

type AppShellProps = {
  user: { name: string | null; email: string; avatarUrl?: string | null };
  activeHref: string;
  children: React.ReactNode;
};

const NAV: Array<{ href: string; label: string }> = [
  { href: '/clients', label: 'Clients' },
  { href: '/messages', label: 'Messages' },
  { href: '/documents', label: 'Documents' },
  { href: '/settings', label: 'Settings' },
];

export function AppShell({ user, activeHref, children }: AppShellProps) {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const initials = (user.name ?? user.email)
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '240px 1fr',
        minHeight: '100dvh',
        background: t.bg,
        color: t.ink,
        fontFamily: t.sans,
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          background: t.bgElev,
          borderRight: `1px solid ${t.borderSoft}`,
          padding: '20px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          position: 'sticky',
          top: 0,
          height: '100dvh',
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px' }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: `radial-gradient(circle at 30% 30%, ${t.rustSoft}, ${t.card})`,
              border: `1px solid ${t.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: t.serif,
              fontSize: 13,
              color: t.rustInk,
            }}
          >
            P
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span style={{ fontFamily: t.serif, fontSize: 15, color: t.ink, letterSpacing: -0.2 }}>
              Petal
            </span>
            <span
              style={{
                fontFamily: t.mono,
                fontSize: 9,
                color: t.muted,
                letterSpacing: 1,
              }}
            >
              COMMAND ROOM
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map((item) => (
            <NavLink key={item.href} t={t} item={item} active={isActive(activeHref, item.href)} />
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        {/* User chip + sign out */}
        <div
          style={{
            background: t.card,
            border: `1px solid ${t.border}`,
            borderRadius: 12,
            padding: '12px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              overflow: 'hidden',
              border: `1px solid ${t.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              // Clerk profile image when available, otherwise the
              // editorial gradient + initials we always had.
              background: user.avatarUrl
                ? t.bgElev
                : `radial-gradient(circle at 30% 30%, ${t.rustSoft}, ${t.bgElev})`,
              fontFamily: t.serif,
              fontSize: 13,
              color: t.rustInk,
            }}
          >
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name ?? user.email}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            ) : (
              initials
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0, lineHeight: 1.2 }}>
            <div
              style={{
                fontSize: 12.5,
                color: t.ink,
                fontWeight: 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {user.name ?? user.email}
            </div>
            <SignOutButton>
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  fontFamily: t.mono,
                  fontSize: 9.5,
                  color: t.muted,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textDecorationColor: t.borderSoft,
                  textUnderlineOffset: 2,
                }}
              >
                Sign out
              </button>
            </SignOutButton>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ minWidth: 0 }}>{children}</main>
    </div>
  );
}

function NavLink({
  t,
  item,
  active,
}: {
  t: Theme;
  item: NavItem;
  active: boolean;
}) {
  return (
    <Link
      href={item.href}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 10px',
        borderRadius: 8,
        background: active ? t.tintAccent : 'transparent',
        color: active ? t.ink : t.inkSoft,
        fontSize: 14,
        fontWeight: active ? 500 : 400,
        textDecoration: 'none',
        fontFamily: t.sans,
        transition: 'background 120ms',
      }}
    >
      {item.label}
    </Link>
  );
}

function isActive(activeHref: string, itemHref: string): boolean {
  if (itemHref === '/clients') return activeHref.startsWith('/clients');
  return activeHref === itemHref;
}
