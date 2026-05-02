'use client';

// Intake step 12/13 — Documents upload. 4 visual phases driven by local state.
// Phases: empty → scanning → (parsed | retake) → uploaded.
// 5/15 v0: phases mocked on a timer so the demo flow is identical to live.
// Real Haiku 4.5 vision call swaps in via docs/DOCS-CAPTURE-PIPELINE.md.

import {
  AskAntonioBar,
  Body,
  Button,
  buildTheme,
  Card,
  H1,
  IntakeBackButton,
  IntakeHeader,
  Row,
  Screen,
  Stack,
} from '@docket/ui';
import type { Theme } from '@docket/ui';
import * as React from 'react';
import { usePortalNav } from '@/lib/portal-nav';

type Phase = 'empty' | 'scanning' | 'retake' | 'parsed' | 'uploaded';

const TOTAL = 12;
const CURRENT = 2; // zero-indexed; demo shows doc 3 of 12

// ─── Inline SVG icons ─────────────────────────────────────────────

function DocIcon({ kind }: { kind: 'camera' | 'attach' | 'check' | 'arrow' | 'warn' }) {
  const s = { width: 18, height: 18, stroke: 'currentColor', strokeWidth: 1.5, fill: 'none' };
  switch (kind) {
    case 'camera':
      return (
        <svg {...s} viewBox="0 0 20 20">
          <path d="M4 7h3l1.5-2h3L13 7h3v9H4z" strokeLinejoin="round" />
          <circle cx="10" cy="11" r="3" />
        </svg>
      );
    case 'attach':
      return (
        <svg {...s} viewBox="0 0 20 20">
          <path
            d="M14 9l-5 5a3 3 0 01-4-4l6-6a2 2 0 013 3l-6 6a1 1 0 01-1-1l5-5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'check':
      return (
        <svg {...s} viewBox="0 0 20 20" strokeWidth="1.8">
          <path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'arrow':
      return (
        <svg {...s} viewBox="0 0 20 20">
          <path d="M5 10h10M11 6l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'warn':
      return (
        <svg {...s} viewBox="0 0 20 20">
          <path d="M10 3l8 14H2L10 3z" strokeLinejoin="round" />
          <path d="M10 8v4M10 14v.6" strokeLinecap="round" />
        </svg>
      );
  }
}

// ─── Progress dots ─────────────────────────────────────────────────

function DocProgressDots({
  t,
  total,
  current,
  completed,
}: {
  t: Theme;
  total: number;
  current: number;
  completed: number;
}) {
  return (
    <Row gap={6} align="center" style={{ flexWrap: 'nowrap' }}>
      {Array.from({ length: total }).map((_, i) => {
        const isCurrent = i === current;
        const isDone = i < completed;
        return (
          <div
            key={i}
            style={{
              height: 6,
              width: isCurrent ? 18 : 6,
              borderRadius: 999,
              background: isDone ? t.rust : isCurrent ? t.rust : t.borderSoft,
              opacity: isDone && !isCurrent ? 0.55 : 1,
              transition: 'all 0.25s',
            }}
          />
        );
      })}
    </Row>
  );
}

// ─── Card shell shared by all phases ──────────────────────────────

function DocCardShell({
  t,
  abbr,
  title,
  sub,
  required,
  children,
}: {
  t: Theme;
  abbr: string;
  title: string;
  sub: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  const tintBg = required ? t.tintAccentStrong : t.tintAccent;
  // note: tintBorder removed in zero-stroke pass (was outline color)
  return (
    <Card t={t} style={{ padding: '22px 22px 20px' }}>
      <Row gap={16} align="flex-start" style={{ marginBottom: 4 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: t.tone === 'magazine' ? 4 : 12,
            background: tintBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontFamily: t.mono,
            fontSize: 14,
            fontWeight: 600,
            color: t.rustInk,
            letterSpacing: 0.5,
          }}
        >
          {abbr}
        </div>
        <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
          <Row gap={8} align="center" style={{ marginBottom: 4 }}>
            <div
              style={{
                fontFamily: t.serif,
                fontSize: 22,
                color: t.ink,
                letterSpacing: -0.4,
                lineHeight: 1.1,
              }}
            >
              {title}
            </div>
            {required && (
              <span
                style={{
                  fontFamily: t.serif,
                  fontStyle: 'italic',
                  fontSize: 12.5,
                  color: t.rustInk,
                }}
              >
                Required
              </span>
            )}
          </Row>
          <div style={{ fontSize: 13, color: t.muted, lineHeight: 1.4 }}>{sub}</div>
        </div>
      </Row>
      <div style={{ marginTop: 18 }}>{children}</div>
    </Card>
  );
}

// ─── Mock document preview (fake W-2) ─────────────────────────────

function FakeW2({ t, blurry = false }: { t: Theme; blurry?: boolean }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 10,
        background: '#fdfcf7',
        boxShadow: '0 2px 10px rgba(15, 62, 23, 0.06)',
        borderRadius: 4,
        padding: '12px 14px',
        transform: blurry ? 'rotate(-2.8deg) translate(4px, 2px)' : 'rotate(0)',
        filter: blurry ? 'blur(3px) brightness(0.82)' : 'blur(0)',
        transition: 'all 0.4s',
      }}
    >
      <div style={{ fontFamily: t.mono, fontSize: 9, color: t.muted, letterSpacing: 1 }}>FORM W-2</div>
      <div style={{ fontFamily: t.serif, fontSize: 13, color: t.ink, marginTop: 4 }}>
        Wage and Tax Statement
      </div>
      <div style={{ height: 1, background: t.borderSoft, margin: '10px 0 8px' }} />
      <Stack gap={4}>
        <div style={{ height: 5, width: '80%', background: t.borderSoft, borderRadius: 1 }} />
        <div style={{ height: 5, width: '65%', background: t.borderSoft, borderRadius: 1 }} />
        <div style={{ height: 5, width: '72%', background: t.borderSoft, borderRadius: 1 }} />
        <div style={{ height: 5, width: '55%', background: t.borderSoft, borderRadius: 1 }} />
      </Stack>
      <div style={{ height: 1, background: t.borderSoft, margin: '8px 0' }} />
      <Row gap={6}>
        <div style={{ flex: 1, height: 18, background: t.borderSoft, borderRadius: 2 }} />
        <div style={{ flex: 1, height: 18, background: t.borderSoft, borderRadius: 2 }} />
      </Row>
    </div>
  );
}

// ─── Phase: empty ─────────────────────────────────────────────────

function DocCardEmpty({ t, onCapture }: { t: Theme; onCapture: () => void }) {
  return (
    <DocCardShell t={t} abbr="W2" title="W-2" sub="From your employer(s)" required>
      <Stack gap={10}>
        <Button t={t} onClick={onCapture} style={{ width: '100%', padding: '14px' }}>
          <Row gap={8} justify="center" align="center">
            <span style={{ color: '#fff', display: 'inline-flex' }}>
              <DocIcon kind="camera" />
            </span>
            <span>Take a photo</span>
          </Row>
        </Button>
        <Button t={t} variant="ghost" onClick={onCapture} style={{ width: '100%', padding: '13px' }}>
          <Row gap={8} justify="center" align="center">
            <span style={{ color: t.ink, display: 'inline-flex' }}>
              <DocIcon kind="attach" />
            </span>
            <span>Attach a file</span>
          </Row>
        </Button>
      </Stack>
    </DocCardShell>
  );
}

// ─── Phase: scanning ──────────────────────────────────────────────

function DocCardScanning({ t }: { t: Theme }) {
  return (
    <DocCardShell t={t} abbr="W2" title="W-2" sub="From your employer(s)" required>
      <div
        style={{
          aspectRatio: '4 / 3',
          background: t.ease.keylimeWash,
          borderRadius: t.radius,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <FakeW2 t={t} />

        {/* Scan line sweep */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(to bottom, transparent 0%, ${t.rust}33 48%, ${t.rust} 50%, ${t.rust}33 52%, transparent 100%)`,
            height: '100%',
            animation: 'doc-scan 1.8s ease-in-out infinite',
            pointerEvents: 'none',
            mixBlendMode: 'multiply',
          }}
        />

        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            padding: '4px 8px',
            background: t.ink,
            color: '#fff',
            fontFamily: t.mono,
            fontSize: 9,
            letterSpacing: 0.8,
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: t.rust,
              animation: 'doc-pulse 1s ease-in-out infinite',
            }}
          />
          AI READING
        </div>

        <style>{`
          @keyframes doc-scan {
            0% { transform: translateY(-100%); }
            100% { transform: translateY(100%); }
          }
          @keyframes doc-pulse {
            0%, 100% { opacity: 1 }
            50% { opacity: 0.3 }
          }
        `}</style>
      </div>

      <div
        style={{
          marginTop: 14,
          textAlign: 'center',
          fontSize: 12.5,
          color: t.muted,
          fontStyle: 'italic',
          fontFamily: t.serif,
        }}
      >
        Extracting employer, wages, and withholding…
      </div>
    </DocCardShell>
  );
}

// ─── Phase: parsed ────────────────────────────────────────────────

function DocCardParsed({
  t,
  onConfirm,
  onRetake,
}: {
  t: Theme;
  onConfirm: () => void;
  onRetake: () => void;
}) {
  const fields = [
    { label: 'EMPLOYER', value: 'Riverside Unified' },
    { label: 'WAGES (BOX 1)', value: '$68,420.00' },
    { label: 'FED. TAX WITHHELD (BOX 2)', value: '$9,186.00' },
  ];
  return (
    <DocCardShell t={t} abbr="W2" title="W-2" sub="From your employer(s)" required>
      <div
        style={{
          aspectRatio: '4 / 3',
          background: t.ease.keylimeWash,
          borderRadius: t.radius,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <FakeW2 t={t} />
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            padding: '4px 8px',
            background: '#2e6b42',
            color: '#fff',
            fontFamily: t.mono,
            fontSize: 9,
            letterSpacing: 0.8,
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path
              d="M1.5 4l1.5 1.5L6.5 2"
              stroke="#fff"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          READ SUCCESSFULLY
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          background: t.ease.keylimeWash,
          borderRadius: t.radius,
          padding: '12px 14px',
        }}
      >
        <div
          style={{
            fontFamily: t.mono,
            fontSize: 9.5,
            color: t.rustInk,
            letterSpacing: 1,
            marginBottom: 10,
          }}
        >
          AI DETECTED
        </div>
        <Stack gap={8}>
          {fields.map((f, i) => (
            <Row key={i} justify="space-between" align="center">
              <span
                style={{
                  fontFamily: t.mono,
                  fontSize: 10,
                  color: t.muted,
                  letterSpacing: 0.4,
                }}
              >
                {f.label}
              </span>
              <Row gap={6} align="center">
                <span style={{ fontFamily: t.serif, fontSize: 13, color: t.ink }}>{f.value}</span>
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ flexShrink: 0 }}>
                  <circle cx="5.5" cy="5.5" r="5" fill="#2e6b42" />
                  <path
                    d="M3 5.5l1.8 1.8L8 4"
                    stroke="#fff"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Row>
            </Row>
          ))}
        </Stack>
      </div>

      <div style={{ marginTop: 14, marginBottom: 12, textAlign: 'center' }}>
        <div style={{ fontFamily: t.serif, fontSize: 17, color: t.ink, fontStyle: 'italic' }}>
          Looks right?
        </div>
        <div style={{ fontSize: 12, color: t.muted, marginTop: 3 }}>
          You can edit any value if needed.
        </div>
      </div>
      <Row gap={10}>
        <Button t={t} variant="ghost" onClick={onRetake} style={{ flex: 1, padding: '12px' }}>
          Retake
        </Button>
        <Button t={t} onClick={onConfirm} style={{ flex: 1, padding: '12px' }}>
          Looks right
        </Button>
      </Row>
    </DocCardShell>
  );
}

// ─── Phase: retake ────────────────────────────────────────────────

function DocCardRetake({ t, onRetry }: { t: Theme; onRetry: () => void }) {
  return (
    <DocCardShell t={t} abbr="W2" title="W-2" sub="From your employer(s)" required>
      <div
        style={{
          aspectRatio: '4 / 3',
          background: t.ease.keylimeWash,
          borderRadius: t.radius,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <FakeW2 t={t} blurry />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(40, 24, 12, 0.38)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: '50%',
              background: '#B9471C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
            }}
          >
            <DocIcon kind="warn" />
          </div>
          <div
            style={{
              fontFamily: t.mono,
              fontSize: 10,
              color: '#fff',
              letterSpacing: 1,
              background: 'rgba(0,0,0,0.42)',
              padding: '3px 8px',
              borderRadius: 3,
            }}
          >
            CAN&apos;T READ CLEARLY
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          background: '#FDF1EA',
          borderRadius: t.radius,
          padding: '12px 14px',
        }}
      >
        <div
          style={{
            fontFamily: t.serif,
            fontSize: 14,
            color: '#6E2B0C',
            marginBottom: 6,
          }}
        >
          The photo is too blurry to read.
        </div>
        <Stack gap={5}>
          <Row gap={8} align="flex-start">
            <div
              style={{
                width: 3,
                height: 3,
                borderRadius: '50%',
                background: '#9A4E22',
                marginTop: 7,
                flexShrink: 0,
              }}
            />
            <div style={{ fontSize: 12.5, color: '#6E2B0C', lineHeight: 1.45 }}>
              Hold the camera steady and make sure all four corners are visible
            </div>
          </Row>
          <Row gap={8} align="flex-start">
            <div
              style={{
                width: 3,
                height: 3,
                borderRadius: '50%',
                background: '#9A4E22',
                marginTop: 7,
                flexShrink: 0,
              }}
            />
            <div style={{ fontSize: 12.5, color: '#6E2B0C', lineHeight: 1.45 }}>
              Bright, even lighting — avoid glare or shadows across the page
            </div>
          </Row>
        </Stack>
      </div>

      <div style={{ marginTop: 14 }}>
        <Button t={t} onClick={onRetry} style={{ width: '100%', padding: '14px' }}>
          <Row gap={8} justify="center" align="center">
            <span style={{ color: '#fff', display: 'inline-flex' }}>
              <DocIcon kind="camera" />
            </span>
            <span>Retake photo</span>
          </Row>
        </Button>
      </div>
    </DocCardShell>
  );
}

// ─── Phase: uploaded ──────────────────────────────────────────────

function DocCardUploaded({ t }: { t: Theme }) {
  return (
    <DocCardShell t={t} abbr="W2" title="W-2" sub="From your employer(s)" required>
      <div
        style={{
          padding: '18px 16px',
          background: t.ease.keylimeWash,
          borderRadius: t.radius,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: t.rust,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            flexShrink: 0,
          }}
        >
          <DocIcon kind="check" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: t.serif, fontSize: 16, color: t.rustInk, letterSpacing: -0.2 }}>
            Saved
          </div>
          <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>
            2025_W-2_RiversideUnified.pdf · 3 fields extracted
          </div>
        </div>
        <button
          style={{
            background: 'none',
            border: 'none',
            padding: 6,
            fontSize: 11,
            color: t.muted,
            cursor: 'pointer',
            fontFamily: t.mono,
            letterSpacing: 0.6,
          }}
        >
          REPLACE
        </button>
      </div>
    </DocCardShell>
  );
}

// ─── Main page ────────────────────────────────────────────────────

export default function DocsPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  const [phase, setPhase] = React.useState<Phase>('empty');

  // Mocked phase progression. Real pipeline (Haiku 4.5 vision) replaces this
  // per docs/DOCS-CAPTURE-PIPELINE.md.
  const startCapture = () => {
    setPhase('scanning');
    // 1.5s scan animation, then parsed (happy path)
    setTimeout(() => setPhase('parsed'), 1500);
  };

  const confirmParsed = () => setPhase('uploaded');
  const retakeFromParsed = () => setPhase('retake');
  const retryFromRetake = () => {
    setPhase('scanning');
    setTimeout(() => setPhase('parsed'), 1500);
  };

  const uploadedCount = phase === 'uploaded' ? 3 : 2;
  const completedForDots = phase === 'uploaded' ? 3 : 2;
  const canAdvance = phase === 'uploaded';

  let card: React.ReactNode;
  if (phase === 'empty') card = <DocCardEmpty t={t} onCapture={startCapture} />;
  else if (phase === 'scanning') card = <DocCardScanning t={t} />;
  else if (phase === 'retake') card = <DocCardRetake t={t} onRetry={retryFromRetake} />;
  else if (phase === 'parsed')
    card = <DocCardParsed t={t} onConfirm={confirmParsed} onRetake={retakeFromParsed} />;
  else card = <DocCardUploaded t={t} />;

  return (
    <Screen t={t}>
      <div
        style={{
          padding: '24px 0 0',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100%',
        }}
      >
        <IntakeHeader t={t} step={12} label="Documents" />

        <div style={{ padding: '22px 24px 0' }}>
          <IntakeBackButton t={t} onClick={() => nav.back('/refund')} />
        </div>

        <div style={{ padding: '18px 24px 14px' }}>
          <Stack gap={10}>
            <H1 t={t}>Upload your documents</H1>
            <Body t={t} size={14}>
              Document{' '}
              <span style={{ color: t.rustInk, fontFamily: t.mono }}>{CURRENT + 1}</span> of{' '}
              <span style={{ color: t.rustInk, fontFamily: t.mono }}>{TOTAL}</span>
            </Body>
          </Stack>
        </div>

        <div style={{ padding: '0 24px 20px' }}>
          <DocProgressDots t={t} total={TOTAL} current={CURRENT} completed={completedForDots} />
        </div>

        <div style={{ padding: '0 24px', flex: 1 }}>
          {card}

          <div
            style={{
              textAlign: 'center',
              marginTop: 18,
              fontFamily: t.mono,
              fontSize: 10,
              letterSpacing: 1.2,
              color: t.rustInk,
            }}
          >
            {uploadedCount} OF {TOTAL} UPLOADED
          </div>

        </div>

        <div
          style={{
            position: 'sticky',
            bottom: 0,
            background: `linear-gradient(to top, ${t.bg} 75%, transparent)`,
            padding: '20px 24px 28px',
            marginTop: 20,
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <AskAntonioBar t={t} />
          </div>
          <Row gap={10}>
            <Button
              t={t}
              variant="ghost"
              onClick={() => nav.next('/contact-info')}
              style={{ flex: 1 }}
            >
              Skip for now
            </Button>
            <Button
              t={t}
              onClick={() => nav.next('/contact-info')}
              disabled={!canAdvance}
              style={{ flex: 1, opacity: canAdvance ? 1 : 0.45 }}
            >
              <Row gap={6} justify="center" align="center">
                <span>Next document</span>
                {canAdvance && (
                  <span style={{ color: '#fff', display: 'inline-flex' }}>
                    <DocIcon kind="arrow" />
                  </span>
                )}
              </Row>
            </Button>
          </Row>
        </div>
      </div>
    </Screen>
  );
}
