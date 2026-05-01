// Antonio's MVP dashboard. Server Component: reads Clerk session via auth(),
// renders a thin shell. Client list, message threads, and per-client view
// land in subsequent commits — this just confirms the auth path works
// end-to-end (sign-in → middleware protect → real session → tenant lookup).

import { auth, currentUser } from '@clerk/nextjs/server';
import { SignOutButton } from '@clerk/nextjs';
import { buildTheme } from '@docket/ui';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const { userId } = await auth();

  // Defense-in-depth: middleware should have redirected, but if it didn't,
  // bounce to sign-in.
  if (!userId) redirect('/sign-in');

  const user = await currentUser();
  const firstName = user?.firstName || user?.emailAddresses[0]?.emailAddress.split('@')[0] || 'friend';

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
          Welcome, {firstName}.
        </h1>
        <p style={{ fontSize: 16, color: t.inkSoft, lineHeight: 1.5, margin: 0, marginBottom: 32 }}>
          Auth pipeline live. Next: client list + message threads + per-client view.
        </p>

        <div
          style={{
            padding: '20px 24px',
            background: t.card,
            border: `1px solid ${t.border}`,
            borderRadius: t.radius,
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
            Session
          </div>
          <div style={{ fontFamily: t.mono, fontSize: 13, color: t.ink, lineHeight: 1.6 }}>
            <div>userId: {userId}</div>
            <div>email: {user?.emailAddresses[0]?.emailAddress}</div>
          </div>
        </div>
      </div>
    </main>
  );
}
