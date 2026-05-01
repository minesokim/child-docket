'use client';

// Intake step 6/13 — Dependents count.
// Replaces the four-card discrete picker with a tasteful +/− counter.

import {
  AntonioNote,
  AskAntonioBar,
  Body,
  Button,
  buildTheme,
  H1,
  IntakeBackButton,
  IntakeHeader,
  Row,
  Screen,
  Stack,
} from '@docket/ui';
import type { Theme } from '@docket/ui';
import { usePortalNav } from '@/lib/portal-nav';
import { usePortalState } from '@/lib/portal-state';

const MAX_DEPS = 10;

function StepperButton({
  t,
  symbol,
  onClick,
  disabled,
  ariaLabel,
}: {
  t: Theme;
  symbol: '−' | '+';
  onClick: () => void;
  disabled: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        width: 52,
        height: 52,
        borderRadius: '50%',
        background: disabled ? 'transparent' : t.bgElev,
        border: `1px solid ${disabled ? t.borderSoft : t.border}`,
        color: disabled ? t.borderSoft : t.ink,
        fontFamily: t.serif,
        fontSize: 26,
        fontWeight: 400,
        lineHeight: 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s ease',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        padding: 0,
      }}
      onMouseDown={(e) => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = t.tintAccent;
      }}
      onMouseUp={(e) => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = t.bgElev;
      }}
      onTouchStart={(e) => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = t.tintAccent;
      }}
      onTouchEnd={(e) => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = t.bgElev;
      }}
    >
      {symbol}
    </button>
  );
}

export default function DepsCountPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  const [count, setCount] = usePortalState<number>('deps-count', 0);

  const dec = () => setCount(Math.max(0, count - 1));
  const inc = () => setCount(Math.min(MAX_DEPS, count + 1));

  const handleContinue = () => {
    if (count === 0) nav.next('/income');
    else nav.next('/deps-detail');
  };

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
        <IntakeHeader t={t} step={6} label="Dependents" />

        <div style={{ padding: '22px 24px 0' }}>
          <IntakeBackButton t={t} onClick={() => nav.back('/filing')} />
        </div>

        <div style={{ padding: '18px 24px 8px' }}>
          <Stack gap={10}>
            <H1 t={t}>Do you have any dependents?</H1>
            <Body t={t} size={15}>
              Children, elderly parents, or anyone who depends on you financially.
            </Body>
          </Stack>
        </div>

        <Stack gap={20} style={{ padding: '32px 24px 16px', flex: 1 }}>
          <div
            style={{
              background: t.card,
              border: `1px solid ${t.border}`,
              borderRadius: t.radius,
              padding: '36px 24px 30px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <Row gap={32} align="center" justify="center">
              <StepperButton
                t={t}
                symbol="−"
                onClick={dec}
                disabled={count <= 0}
                ariaLabel="Decrease dependent count"
              />
              <div
                style={{
                  fontFamily: t.serif,
                  fontSize: 72,
                  fontWeight: 400,
                  color: t.ink,
                  letterSpacing: -2.5,
                  lineHeight: 1,
                  minWidth: 60,
                  textAlign: 'center',
                  fontFeatureSettings: '"tnum" 1, "lnum" 1',
                }}
              >
                {count}
              </div>
              <StepperButton
                t={t}
                symbol="+"
                onClick={inc}
                disabled={count >= MAX_DEPS}
                ariaLabel="Increase dependent count"
              />
            </Row>
            <div
              style={{
                fontFamily: t.serif,
                fontStyle: 'italic',
                fontSize: 14,
                color: t.muted,
                letterSpacing: 0.1,
              }}
            >
              {count === 1 ? 'dependent' : 'dependents'}
            </div>
          </div>

          <div style={{ marginTop: 4 }}>
            <AntonioNote t={t}>
              Dependents unlock credits like the Child Tax Credit ($2,000+ per child). Even if
              you&apos;re not sure someone qualifies, mention them.
            </AntonioNote>
          </div>
        </Stack>

        <div
          style={{
            position: 'sticky',
            bottom: 0,
            background: `linear-gradient(to top, ${t.bg} 75%, transparent)`,
            padding: '20px 24px 28px',
            marginTop: 12,
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <AskAntonioBar t={t} />
          </div>
          <Row gap={10}>
            <Button
              t={t}
              variant="ghost"
              onClick={() => nav.back('/filing')}
              style={{ flex: '0 0 auto' }}
            >
              Back
            </Button>
            <Button t={t} onClick={handleContinue} style={{ flex: 1 }}>
              Continue
            </Button>
          </Row>
        </div>
      </div>
    </Screen>
  );
}
