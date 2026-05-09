// CommandShell — operational-modern app shell for command-room routes.
//
// Sibling to apps/command-room/src/components/app-shell.tsx (the
// editorial-warm shell used by /clients). The two coexist while we
// migrate the rest of the command-room app to the operational-modern
// language locked 2026-05-08.
//
// Per .claude/skills/craft/SKILL.md + docs/visual-reference/dashboard-
// 2026-05-08/README.md:
//   - Inter sans for both display + body
//   - Dark warm-gray sidebar (oklch(18% 0.01 85)), NOT pure black
//   - Faint warm-gray content canvas
//   - Inline SVG line glyphs (no Lucide-react dep yet)
//   - Workspace tile at top, section-labeled nav, user pill at bottom
//   - Forest green accent for active nav item
//
// Used by: /dashboard/cost (and future operational-modern routes).
// Not yet used by: /clients, /sign-in (those keep AppShell or no shell).

import { SignOutButton } from '@clerk/nextjs';
import Link from 'next/link';
import './command-shell.css';

type NavSection = {
  label: string;
  items: { href: string; label: string; icon: React.ReactNode; disabled?: boolean }[];
};

type CommandShellProps = {
  user: { name: string | null; email: string; avatarUrl?: string | null };
  tenantName: string;
  activeHref: string;
  children: React.ReactNode;
};

function IconHome() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IconMessages() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function IconDocs() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
function IconWallet() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
    </svg>
  );
}
function IconSettings() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09A1.65 1.65 0 0 0 9 4.6V4.5a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

const NAV: NavSection[] = [
  {
    label: 'Practice',
    items: [
      { href: '/clients', label: 'Clients', icon: <IconUsers /> },
      { href: '/messages', label: 'Messages', icon: <IconMessages /> },
      { href: '/documents', label: 'Documents', icon: <IconDocs /> },
    ],
  },
  {
    label: 'Operations',
    items: [{ href: '/dashboard/cost', label: 'Cost', icon: <IconWallet /> }],
  },
  {
    label: 'Settings',
    items: [{ href: '/settings', label: 'Settings', icon: <IconSettings />, disabled: true }],
  },
];

export function CommandShell({ user, tenantName, activeHref, children }: CommandShellProps) {
  const initials = (user.name ?? user.email)
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');
  const tenantInitial = tenantName.charAt(0).toUpperCase();

  return (
    <div className="cmd-shell">
      <aside className="cmd-sidebar" aria-label="Primary navigation">
        <div className="cmd-workspace">
          <div className="cmd-workspace-tile" aria-hidden="true">
            {tenantInitial}
          </div>
          <div className="cmd-workspace-meta">
            <span className="cmd-workspace-name">{tenantName}</span>
            <span className="cmd-workspace-tag">Command room</span>
          </div>
        </div>

        {NAV.map((section) => (
          <div className="cmd-nav-section" key={section.label}>
            <div className="cmd-nav-label">{section.label}</div>
            {section.items.map((item) => {
              const isActive = activeHref === item.href || activeHref.startsWith(item.href + '/');
              if (item.disabled) {
                return (
                  <span
                    key={item.href}
                    className="cmd-nav-item cmd-nav-disabled"
                    aria-disabled="true"
                    title="Not yet wired"
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </span>
                );
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`cmd-nav-item ${isActive ? 'cmd-nav-active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}

        <div className="cmd-user">
          <div className="cmd-user-avatar" aria-hidden="true">
            {user.avatarUrl ? (
              // Server component — plain img, not next/image. avatarUrl
              // is from Clerk and lives on a stable CDN; the latency hit
              // from next/image's loader proxy isn't worth it here.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" />
            ) : (
              initials
            )}
          </div>
          <div className="cmd-user-meta">
            <span className="cmd-user-name">{user.name ?? user.email}</span>
            <SignOutButton>
              <button type="button" className="cmd-user-signout">
                Sign out
              </button>
            </SignOutButton>
          </div>
        </div>
      </aside>

      <main className="cmd-main">{children}</main>
    </div>
  );
}
