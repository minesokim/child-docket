'use client';

// Antonio's admin sign-in. Uses Clerk's drop-in <SignIn /> for v0 — quick to
// stand up. Will replace with custom UI built on useSignIn() hooks once we
// finalize the visual design (and to drop the "Secured by Clerk" footer).
//
// Sign-up is closed. Antonio is provisioned via the seed script with his
// Clerk userId pre-mapped in our `users` table.

import { SignIn } from '@clerk/nextjs';
import { buildTheme } from '@docket/ui';

export default function SignInPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: t.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: t.sans,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 24,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: t.mono,
              fontSize: 11,
              color: t.muted,
              letterSpacing: 1.4,
              marginBottom: 10,
            }}
          >
            PETAL · COMMAND ROOM
          </div>
          <h1
            style={{
              fontFamily: t.serif,
              fontSize: 32,
              color: t.ink,
              letterSpacing: -0.6,
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            Sign in to your practice
          </h1>
        </div>
        <SignIn signUpUrl={undefined} />
      </div>
    </main>
  );
}
