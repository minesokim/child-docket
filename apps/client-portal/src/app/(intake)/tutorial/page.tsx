'use client';

// Intake step 1.5 — Tutorial overlay shown after Welcome's "Let's get started",
// before the first intake question. 3 sequential cards over a blurred mock
// filing screen. 1-to-1 port of ScreenTutorial / TutorialOverlay.

import {
  AvatarSlot,
  Button,
  buildTheme,
  Row,
  Screen,
  Stack,
} from '@docket/ui';
import type { Theme } from '@docket/ui';
import * as React from 'react';
import { usePortalNav } from '@/lib/portal-nav';
import { useIntakeField } from '@/lib/intake-context';

// ─── Step 1 demo: tap-to-select cards ───────────────────────────

function TutorialDemoCards({ t }: { t: Theme }) {
  const [sel, setSel] = React.useState<string | null>(null);
  const options = [
    { id: 'w2', code: 'W2', label: 'W-2 Employee' },
    { id: '1099', code: '1099', label: 'Self-Employed' },
  ];
  return (
    <div
      style={{
        marginTop: 14,
        padding: '14px 14px 16px',
        background: t.bgElev,
        border: `1px solid ${t.borderSoft}`,
        borderRadius: t.radius,
      }}
    >
      <div
        style={{
          fontFamily: t.mono,
          fontSize: 9.5,
          color: t.muted,
          letterSpacing: 1.2,
          marginBottom: 10,
        }}
      >
        TRY IT — TAP ONE
      </div>
      <Stack gap={8}>
        {options.map((o) => {
          const on = sel === o.id;
          return (
            <div
              key={o.id}
              onClick={() => setSel(on ? null : o.id)}
              style={{
                padding: '10px 12px',
                background: on ? t.tintAccent : t.card,
                border: `1px solid ${on ? t.rust : t.border}`,
                borderRadius: t.radius - 2,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                transition: 'all 0.15s',
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  border: `1.5px solid ${on ? t.rust : t.border}`,
                  background: on ? t.rust : 'transparent',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {on && (
                  <svg width="10" height="8" viewBox="0 0 10 8">
                    <path
                      d="M1 4l2.5 2.5L9 1"
                      stroke="#fff"
                      strokeWidth="1.8"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              <span
                style={{
                  fontFamily: t.mono,
                  fontSize: 10,
                  color: t.muted,
                  letterSpacing: 0.6,
                  minWidth: 34,
                }}
              >
                {o.code}
              </span>
              <span style={{ fontSize: 13.5, color: t.ink, flex: 1 }}>{o.label}</span>
            </div>
          );
        })}
      </Stack>
      <div
        style={{
          marginTop: 10,
          minHeight: 18,
          fontFamily: t.serif,
          fontStyle: 'italic',
          fontSize: 13,
          color: sel ? t.rust : 'transparent',
          transition: 'color 0.2s',
        }}
      >
        Nice! That&apos;s all there is to it.
      </div>
    </div>
  );
}

// ─── Step 2 demo: Ask Antonio bar mock ──────────────────────────

function TutorialAntonioDemo({ t }: { t: Theme }) {
  const [asked, setAsked] = React.useState(false);
  return (
    <div style={{ marginTop: 14 }}>
      <div
        style={{
          padding: '10px 12px',
          background: t.card,
          border: `1px solid ${t.border}`,
          borderRadius: t.radius,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <AvatarSlot t={t} size={34} />
          <div
            style={{
              position: 'absolute',
              bottom: -1,
              right: -1,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#4a8f5f',
              border: `2px solid ${t.card}`,
            }}
          />
        </div>
        <span style={{ flex: 1, fontSize: 13, color: t.inkSoft }}>Not sure? Ask Antonio</span>
        <button
          onClick={() => setAsked(true)}
          style={{
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 500,
            background: t.rust,
            color: '#fff',
            border: 'none',
            borderRadius: 999,
            cursor: 'pointer',
            fontFamily: t.sans,
          }}
        >
          Message
        </button>
      </div>

      <div
        style={{
          marginTop: 10,
          padding: '10px 12px',
          background: t.tintAccent,
          border: `1px solid ${t.rustSoft}`,
          borderRadius: t.radius,
          display: 'flex',
          gap: 10,
          opacity: asked ? 1 : 0,
          transform: asked ? 'translateY(0)' : 'translateY(-4px)',
          transition: 'all 0.25s',
          pointerEvents: asked ? 'auto' : 'none',
        }}
      >
        <div style={{ flexShrink: 0, marginTop: 1 }}>
          <AvatarSlot t={t} size={22} />
        </div>
        <div
          style={{
            flex: 1,
            fontFamily: t.serif,
            fontStyle: 'italic',
            fontSize: 13,
            lineHeight: 1.5,
            color: t.inkSoft,
          }}
        >
          &ldquo;No worries! Just type your question and I&apos;ll get back to you personally.
          Nothing is a dumb question.&rdquo;
        </div>
      </div>
    </div>
  );
}

// ─── Tutorial card ──────────────────────────────────────────────

function TutorialCard({
  t,
  step,
  total,
  onNext,
  onSkip,
}: {
  t: Theme;
  step: number;
  total: number;
  onNext: () => void;
  onSkip: () => void;
}) {
  const isLast = step === total;
  const badge = (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        background: t.rust,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: t.serif,
        fontSize: 20,
        color: '#fff',
        boxShadow: `0 4px 12px ${t.tintAccentStrong}`,
      }}
    >
      {step}
    </div>
  );

  let headline: string;
  let sub: string;
  let body: React.ReactNode;
  if (step === 1) {
    headline = "Here's how this works";
    sub = 'Simple questions. Most are just tap to select. Try it!';
    body = <TutorialDemoCards t={t} />;
  } else if (step === 2) {
    headline = "Don't know the answer?";
    sub = "If you're stuck on any question, tap below to message Antonio.";
    body = <TutorialAntonioDemo t={t} />;
  } else {
    headline = "You're ready.";
    sub = "Answer what you can, skip what you can't, message me for anything.";
    body = (
      <Stack gap={14} style={{ marginTop: 18 }}>
        {[
          'Tap to select answers',
          'Message me if unsure',
          'Upload docs now or later',
          'Progress saves automatically',
        ].map((line, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: t.tintAccent,
                border: `1px solid ${t.rustSoft}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: t.sans,
                fontSize: 13,
                fontWeight: 600,
                color: t.rustInk,
                flexShrink: 0,
              }}
            >
              {i + 1}
            </div>
            <span
              style={{
                fontSize: 14,
                color: t.ink,
                flex: 1,
                lineHeight: 1.4,
                letterSpacing: -0.05,
              }}
            >
              {line}
            </span>
          </div>
        ))}
      </Stack>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 340,
        background: t.card,
        borderRadius: t.radiusLg,
        padding: '22px 22px 20px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)',
        animation: 'tutFade 0.28s ease-out',
      }}
    >
      <Stack gap={14}>
        {badge}
        <Stack gap={6}>
          <div
            style={{
              fontFamily: t.serif,
              fontSize: 22,
              color: t.ink,
              letterSpacing: -0.4,
              lineHeight: 1.2,
            }}
          >
            {headline}
          </div>
          <div style={{ fontSize: 14, color: t.inkSoft, lineHeight: 1.5 }}>{sub}</div>
        </Stack>
        {body}
      </Stack>

      <div style={{ marginTop: 22 }}>
        <Row justify="center" gap={6} style={{ marginBottom: 14 }}>
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              style={{
                width: n === step ? 18 : 6,
                height: 6,
                borderRadius: 999,
                background: n === step ? t.rust : t.border,
                transition: 'all 0.25s',
              }}
            />
          ))}
        </Row>
        <Button t={t} onClick={onNext} style={{ width: '100%' }}>
          {isLast ? "Let's Go" : 'Next'}
        </Button>
        {!isLast && (
          <button
            onClick={onSkip}
            style={{
              background: 'none',
              border: 'none',
              width: '100%',
              padding: '12px 0 0',
              fontSize: 13,
              color: t.muted,
              cursor: 'pointer',
              fontFamily: t.sans,
            }}
          >
            Skip tutorial
          </button>
        )}
      </div>

      <style>{`
        @keyframes tutFade {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────

export default function TutorialPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  const [step, setStep] = React.useState(1);
  const [, setTutorialCompleted] = useIntakeField<boolean>('tutorial.completed', false);

  const finish = () => {
    // Mark tutorial complete so the welcome page knows to show
    // "Continue where you left off" on next visit.
    void setTutorialCompleted(true);
    nav.next('/services');
  };

  return (
    <Screen t={t}>
      <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '100vh' }}>
        {/* Blurred mock intake screen behind */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            filter: 'blur(8px)',
            transform: 'scale(1.03)',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              padding: '32px 24px',
              background: t.bg,
              height: '100%',
            }}
          >
            <div
              style={{
                fontFamily: t.mono,
                fontSize: 10,
                color: t.muted,
                letterSpacing: 1,
              }}
            >
              01 of 13 · FILING
            </div>
            <div
              style={{
                height: 3,
                background: t.borderSoft,
                marginTop: 10,
                borderRadius: 99,
              }}
            >
              <div
                style={{
                  width: '10%',
                  height: '100%',
                  background: t.rust,
                  borderRadius: 99,
                }}
              />
            </div>
            <div
              style={{
                marginTop: 28,
                fontFamily: t.serif,
                fontSize: 32,
                color: t.ink,
              }}
            >
              What&apos;s your filing status?
            </div>
          </div>
        </div>

        {/* Dim layer */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(26, 22, 18, 0.28)',
          }}
        />

        {/* Modal */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 20px',
          }}
        >
          <TutorialCard
            t={t}
            step={step}
            total={3}
            onNext={() => (step < 3 ? setStep(step + 1) : finish())}
            onSkip={finish}
          />
        </div>
      </div>
    </Screen>
  );
}
