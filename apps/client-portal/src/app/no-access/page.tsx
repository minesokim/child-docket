// No-access page. Reached when a Clerk-authenticated phone doesn't
// match any pre-seeded client row.
//
// This is the security boundary added in Day 2 of the May 2026
// post-audit hardening: clients are pre-seeded by their preparer
// (Antonio knows his clients beforehand), and only matching phones
// can bind. Unknown phones complete OTP successfully but land here
// instead of getting auto-provisioned into Vazant — closing the
// "anyone with phone OTP can claim a client row" hole that Codex
// flagged RED.

import { buildTheme, Body, Button, H1, Screen, Stack } from '@docket/ui';
import { SignOutButton } from '@clerk/nextjs';

export default function NoAccessPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });

  return (
    <Screen t={t}>
      <div
        style={{
          padding: '48px 24px 32px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100%',
        }}
      >
        <Stack gap={20} style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: t.mono,
              fontSize: 11,
              color: t.muted,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            Portal access
          </div>
          <H1 t={t}>We don&apos;t have you on the list yet</H1>
          <Body t={t} size={15}>
            Your phone number isn&apos;t connected to a client account. If your
            preparer invited you, double-check that you signed in with the
            same number they used to set up your portal.
          </Body>
          <Body t={t} size={14}>
            Otherwise, message your preparer and ask them to add you. Once
            they do, sign in here again with the matching phone number and
            you&apos;ll land straight on your portal home.
          </Body>
        </Stack>

        <SignOutButton redirectUrl="/login">
          <Button t={t} variant="ghost" style={{ width: '100%' }}>
            Sign out
          </Button>
        </SignOutButton>
      </div>
    </Screen>
  );
}
