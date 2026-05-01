// Antonio's MVP dashboard. Server Component: resolves Clerk session to a
// Postgres user via getCurrentDocketUser() (which auto-claims a pre-seeded
// row on first matching email sign-in). Renders the shell + auth proof.
//
// Real Command Room UI (client list, message threads, per-client view) lands
// in subsequent commits.

import { SignOutButton } from '@clerk/nextjs';
import { buildTheme } from '@docket/ui';
import { redirect } from 'next/navigation';
import { getCurrentDocketUser } from '@/lib/current-user';

export default async function DashboardPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const user = await getCurrentDocketUser();

  if (!user) {
    return <NotProvisioned />;
  }

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: t.bg,
        color: t.ink,
        fontFamily: t.sans,
      }}
    >
      <header
        style={{
          padding: '18px 32px',
          borderBottom: `1px solid ${t.borderSoft}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
            D
          </div>
          <span
            style={{
              fontFamily: t.serif,
              fontSize: 16,
              letterSpacing: -0.2,
              color: t.ink,
            }}
          >
            Docket
          </span>
          <span
            style={{
              fontFamily: t.mono,
              fontSize: 10,
              color: t.muted,
              letterSpacing: 1,
              marginLeft: 8,
            }}
          >
            COMMAND ROOM
          </span>
        </div>
        <SignOutButton>
          <button
            style={{
              background: 'none',
              border: `1px solid ${t.border}`,
              borderRadius: 999,
              padding: '6px 14px',
              fontSize: 13,
              color: t.inkSoft,
              cursor: 'pointer',
              fontFamily: t.sans,
            }}
          >
            Sign out
          </button>
        </SignOutButton>
      </header>

      <div style={{ padding: '40px 32px', maxWidth: 1100, margin: '0 auto' }}>
        <div
          style={{
            display: 'inline-flex',
            gap: 8,
            alignItems: 'center',
            padding: '4px 12px',
            background: t.tintAccent,
            border: `1px solid ${t.rustSoft}`,
            borderRadius: 999,
            fontFamily: t.mono,
            fontSize: 10,
            color: t.rustInk,
            letterSpacing: 0.8,
            marginBottom: 16,
          }}
        >
          ● PRODUCTION · DAY 1 OF 14
        </div>
        <h1
          style={{
            fontFamily: t.serif,
            fontSize: 40,
            color: t.ink,
            letterSpacing: -1,
            margin: 0,
            marginBottom: 8,
          }}
        >
          Welcome, {user.name?.split(' ')[0] ?? 'friend'}.
        </h1>
        <p style={{ fontSize: 16, color: t.inkSoft, lineHeight: 1.5, margin: 0, marginBottom: 32 }}>
          Auth + Postgres pipeline live. Next: client list + per-client view + message threads.
        </p>

        <div
          style={{
            padding: '20px 24px',
            background: t.card,
            border: `1px solid ${t.border}`,
            borderRadius: 14,
          }}
        >
          <div
            style={{
              fontFamily: t.mono,
              fontSize: 11,
              color: t.muted,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Bound user
          </div>
          <div style={{ fontFamily: t.mono, fontSize: 13, color: t.ink, lineHeight: 1.7 }}>
            <div>name: {user.name ?? '—'}</div>
            <div>role: {user.role}</div>
            <div>email: {user.email}</div>
            <div>tenantId: {user.tenantId}</div>
            <div>userId: {user.id}</div>
            <div>clerkUserId: {user.clerkUserId}</div>
          </div>
        </div>
      </div>
    </main>
  );
}

function NotProvisioned() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  return (
    <main
      style={{
        minHeight: '100dvh',
        background: t.bg,
        color: t.ink,
        fontFamily: t.sans,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
      }}
    >
      <div
        style={{
          maxWidth: 520,
          background: t.card,
          border: `1px solid ${t.border}`,
          borderRadius: 14,
          padding: '32px 28px',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontFamily: t.serif,
            fontSize: 28,
            color: t.ink,
            margin: 0,
            marginBottom: 12,
            letterSpacing: -0.5,
          }}
        >
          No account provisioned for this email
        </h1>
        <p style={{ fontSize: 15, color: t.inkSoft, lineHeight: 1.5, margin: '0 0 20px' }}>
          Your Clerk identity signed in successfully but there&apos;s no matching Postgres user
          record. Antonio&apos;s account is provisioned through the seed script — make sure the
          email you&apos;re signing in with matches <code style={{ fontFamily: t.mono, color: t.rustInk }}>SEED_ADMIN_EMAIL</code>.
        </p>
        <SignOutButton>
          <button
            style={{
              background: t.rust,
              color: '#fff',
              border: 'none',
              borderRadius: 999,
              padding: '10px 20px',
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: t.sans,
            }}
          >
            Sign out
          </button>
        </SignOutButton>
      </div>
    </main>
  );
}
