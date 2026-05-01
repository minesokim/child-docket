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
import { getResumeStep, hasIntakeProgress } from '@/lib/intake-flow';

export function WelcomeContent() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  const answers = useIntakeAnswers();

  // Returning vs first-time: based on whether ANY meaningful field is
  // populated (not just whether tutorial finished). This catches users
  // who started typing personal info but never clicked through tutorial.
  const isReturning = hasIntakeProgress(answers);
  const resumeRoute = isReturning ? getResumeStep(answers) : '/quick-start';

  const ctaLabel = isReturning ? 'Continue where you left off' : "Let's get started";
  const ctaTarget = resumeRoute;

  return (
    <Screen t={t}>
      <style>{`
        @keyframes welcome-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        .welcome-fade { opacity: 0; animation: welcome-fade-in 700ms cubic-bezier(.2,.8,.2,1) forwards; }
        .welcome-fade-video { animation-delay: 0ms; }
        .welcome-fade-headline { animation-delay: 200ms; }
        .welcome-fade-subtext { animation-delay: 500ms; }
        .welcome-fade-cta { animation-delay: 800ms; }
      `}</style>

      <div
        style={{
          padding: '24px 24px 28px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100%',
        }}
      >
        <div className="welcome-fade welcome-fade-video">
          <VideoPlaceholder t={t} youtubeId="P8nQkkkWJl4" startSeconds={15} />
        </div>

        <Stack gap={12} style={{ textAlign: 'center', marginTop: 28 }}>
          <div
            className="welcome-fade welcome-fade-headline"
            style={{
              fontFamily: t.serif,
              fontWeight: 400,
              fontSize: 26,
              lineHeight: 1.15,
              letterSpacing: -0.4,
              color: t.ink,
            }}
          >
            {isReturning ? (
              <>
                Welcome back to
                <br />
                <span style={{ fontStyle: 'italic' }}>Vazant Consulting</span>
              </>
            ) : (
              <>
                Welcome to
                <br />
                <span style={{ fontStyle: 'italic' }}>Vazant Consulting</span>
              </>
            )}
          </div>
          <div className="welcome-fade welcome-fade-subtext">
            <Body t={t} size={14.5} style={{ maxWidth: 320, margin: '0 auto' }}>
              {isReturning
                ? 'Picking up where you left off. Your progress is saved.'
                : "I'm Antonio Vazquez, Enrolled Agent. Watch this short intro to see how we'll work together."}
            </Body>
          </div>
        </Stack>

        <div className="welcome-fade welcome-fade-cta" style={{ marginTop: 'auto', paddingTop: 32 }}>
          <Stack gap={10}>
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
            {isReturning ? 'Your data is encrypted at rest' : 'Takes about 10 minutes'}
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
      </div>
    </Screen>
  );
}
