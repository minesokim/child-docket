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
// first incomplete step - bypassing the tutorial they've already seen.
//
// Visual: ease.health aesthetic - display-size headline at light weight
// (300) per the ease type scale, firm name in italic for editorial
// presence, status pill below CTA replaces the stacked muted footnotes
// for cleaner hierarchy.

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
  // Resume target: prefer the EXACT page they were last on. Falls back
  // to first-incomplete-step if we don't have a saved cursor (older
  // intake rows from before this feature shipped).
  const lastVisited = answers._meta?.lastVisitedRoute;
  const resumeRoute = isReturning
    ? lastVisited ?? getResumeStep(answers)
    : '/quick-start';

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

        <Stack gap={14} style={{ textAlign: 'center', marginTop: 32 }}>
          {/* Display-size headline. ease type scale: 40px @ weight 300,
              letter-spacing -0.4. Firm name in italic for editorial pop. */}
          <div
            className="welcome-fade welcome-fade-headline"
            style={{
              fontFamily: t.serif,
              fontWeight: 300,
              fontSize: 38,
              lineHeight: 1.1,
              letterSpacing: -1.2,
              color: t.ease.forestDark,
            }}
          >
            {isReturning ? (
              <>
                Welcome back to
                <br />
                Vazant Consulting
              </>
            ) : (
              <>
                Welcome to
                <br />
                Vazant Consulting
              </>
            )}
          </div>
          <div className="welcome-fade welcome-fade-subtext">
            <Body t={t} size={15} style={{ maxWidth: 340, margin: '0 auto' }}>
              {isReturning
                ? 'Picking up where you left off. Your progress is saved.'
                : "I'm Antonio Vazquez, Enrolled Agent. Watch this short intro to see how we'll work together."}
            </Body>
          </div>
        </Stack>

        <div className="welcome-fade welcome-fade-cta" style={{ marginTop: 'auto', paddingTop: 32 }}>
          <Stack gap={14}>
            <Button
              t={t}
              onClick={() => nav.next(ctaTarget)}
              style={{ width: '100%', padding: '15px 22px', fontSize: 15 }}
            >
              {ctaLabel}
            </Button>
            {/* Single-row signature replaces the previous two stacked
                footnotes. Very-light mint pill, forestDark text -
                quiet, calm, signature-feel. */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '5px 12px',
                  background: t.ease.keylimeWash,
                  color: t.ease.forestDark,
                  borderRadius: 999,
                  fontFamily: t.sans,
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: -0.36,
                  lineHeight: 1.5,
                  whiteSpace: 'nowrap',
                }}
              >
                {isReturning ? 'AES-256 encrypted at rest' : '~10 minutes · never shared'}
              </span>
            </div>
          </Stack>
        </div>
      </div>
    </Screen>
  );
}
