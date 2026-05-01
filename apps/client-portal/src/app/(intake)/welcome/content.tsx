'use client';

// Client component for the Welcome screen UI. Split out from page.tsx so the
// page can be a Server Component that pre-runs getOrCreateCurrentClient().
//
// UX intent: this is a post-login onboarding screen, not a marketing page.
// One flow: watch Antonio's intro → click start. No trust pills (the user
// already trusted us with their phone), no redundant feature copy (the
// video does that work).

import {
  Body,
  Button,
  buildTheme,
  Screen,
  Stack,
  VideoPlaceholder,
} from '@docket/ui';
import { usePortalNav } from '@/lib/portal-nav';

export function WelcomeContent() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();

  return (
    <Screen t={t}>
      <div
        style={{
          padding: '24px 24px 28px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100%',
        }}
      >
        <VideoPlaceholder t={t} youtubeId="P8nQkkkWJl4" startSeconds={15} />

        {/* Welcome copy sits tight under the video so the two read as a
            single hero unit instead of disconnected zones. */}
        <Stack gap={12} style={{ textAlign: 'center', marginTop: 28 }}>
          <div
            style={{
              fontFamily: t.serif,
              fontWeight: 400,
              fontSize: 26,
              lineHeight: 1.15,
              letterSpacing: -0.4,
              color: t.ink,
            }}
          >
            Welcome to
            <br />
            <span style={{ fontStyle: 'italic' }}>Vazant Consulting</span>
          </div>
          <Body t={t} size={14.5} style={{ maxWidth: 320, margin: '0 auto' }}>
            I&apos;m Antonio Vazquez, Enrolled Agent. Watch this short intro
            to see how we&apos;ll work together.
          </Body>
        </Stack>

        {/* CTA pinned to the bottom — single primary action, time
            expectation as microcopy, privacy footer. No competing anchors. */}
        <Stack gap={10} style={{ marginTop: 'auto', paddingTop: 32 }}>
          <Button
            t={t}
            onClick={() => nav.next('/tutorial')}
            style={{ width: '100%', padding: '15px 22px', fontSize: 15 }}
          >
            Let&apos;s get started
          </Button>
          <div
            style={{
              fontSize: 12,
              color: t.muted,
              textAlign: 'center',
              paddingTop: 2,
            }}
          >
            Takes about 10 minutes
          </div>
          <div
            style={{
              fontSize: 10,
              color: t.muted,
              letterSpacing: 0.4,
              textAlign: 'center',
              fontFamily: t.mono,
              textTransform: 'uppercase',
              paddingTop: 6,
            }}
          >
            Your information is never shared or sold
          </div>
        </Stack>
      </div>
    </Screen>
  );
}
