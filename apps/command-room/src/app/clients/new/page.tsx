// New-client page. Server Component shell that gates by role + reads
// firm + preparer info, then hands off to the client-side form.
//
// Roles: firm_owner / preparer / reviewer / admin can invite clients.
// Assistant role doesn't manage the roster.

import Link from 'next/link';
import { buildTheme } from '@docket/ui';
import { requireRole } from '@/lib/require-role';
import { AppShell } from '@/components/app-shell';
import { NewClientForm } from './new-client-form';

export default async function NewClientPage() {
  const user = await requireRole(['firm_owner', 'preparer', 'reviewer', 'admin']);
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });

  // Where the client portal lives. Set on the command-room Vercel
  // project as NEXT_PUBLIC_CLIENT_PORTAL_URL. Falls back to the
  // public demo URL for local dev convenience — the share link
  // still works, it just points at the wrong tenant if you're not
  // on a real deploy.
  const clientPortalUrl =
    process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL ?? 'https://docket-client-portal.vercel.app';

  return (
    <AppShell
      user={{ name: user.name, email: user.email, avatarUrl: user.avatarUrl }}
      activeHref="/clients"
    >
      <div style={{ padding: '32px 36px 60px', maxWidth: 720 }}>
        <Link
          href="/clients"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: t.sans,
            fontSize: 13,
            color: t.muted,
            textDecoration: 'none',
            marginBottom: 16,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path d="M9 3l-4 4 4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          All clients
        </Link>

        <header style={{ marginBottom: 28 }}>
          <h1
            style={{
              fontFamily: t.serif,
              fontSize: 32,
              color: t.ink,
              letterSpacing: -0.6,
              margin: 0,
              marginBottom: 6,
            }}
          >
            Invite a client
          </h1>
          <p style={{ fontSize: 14.5, color: t.inkSoft, lineHeight: 1.5, margin: 0 }}>
            Add a client by name and phone number. Send them the link
            below. They sign in with that same phone number to start
            their intake.
          </p>
        </header>

        <NewClientForm
          clientPortalUrl={clientPortalUrl}
          firmOwnerFirstName={user.name?.split(/\s+/)[0] ?? 'your preparer'}
        />
      </div>
    </AppShell>
  );
}
