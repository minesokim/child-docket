'use client';

// Client component for the Welcome screen UI.
//
// UX intent: this is a post-login onboarding screen, not a marketing page.
// One flow: watch Antonio's intro → click start. No trust pills (the user
// already trusted us with their phone), no redundant feature copy (the
// video does that work).
//
// Resume behavior: we read the IntakeState from context (loaded by the
// (intake) layout server-side). If the client has any progress, the CTA
// changes to "Continue where you left off" and jumps straight to the
// first incomplete step — bypassing the tutorial they've already seen.

import { Body, Button, buildTheme, Screen, Stack, VideoPlaceholder } from '@docket/ui';
import { usePortalNav } from '@/lib/portal-nav';
import { useIntakeAnswers } from '@/lib/intake-context';
import { getResumeStep } from '@/lib/intake-flow';

export function WelcomeContent() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  const answers = useIntakeAnswers();

  // Determine resume target. First-time users land at /tutorial (the
  // first applicable + incomplete step). Returning users with progress
  // skip past tutorial to whatever they hadn't finished.
  const resumeRoute = getResumeStep(answers);
  const isFirstTime = resumeRoute === '/tutorial';

  const ctaLabel = isFirstTime ? "Let's get started" : 'Continue where you left off';
  const ctaTarget = isFirstTime ? '/tutorial' : resumeRoute;

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
            {isFirstTime ? (
              <>
                Welcome to
                <br />
                <span style={{ fontStyle: 'italic' }}>Vazant Consulting</span>
              </>
            ) : (
              <>
                Welcome back to
                <br />
                <span style={{ fontStyle: 'italic' }}>Vazant Consulting</span>
              </>
            )}
          </div>
          <Body t={t} size={14.5} style={{ maxWidth: 320, margin: '0 auto' }}>
            {isFirstTime
              ? "I'm Antonio Vazquez, Enrolled Agent. Watch this short intro to see how we'll work together."
              : 'Picking up where you left off. Your progress is saved.'}
          </Body>
        </Stack>

        <Stack gap={10} style={{ marginTop: 'auto', paddingTop: 32 }}>
          <Button
            t={t}
            onClick={() => nav.next(ctaTarget)}
            style={{ width: '100%', padding: '15px 22px', fontSize: 15 }}
          >
            {ctaLabel}
          </Button>
          <div
            style={{
              fontSize: 12,
              color: t.muted,
              textAlign: 'center',
              paddingTop: 2,
            }}
          >
            {isFirstTime ? 'Takes about 10 minutes' : 'Your data is encrypted at rest'}
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
