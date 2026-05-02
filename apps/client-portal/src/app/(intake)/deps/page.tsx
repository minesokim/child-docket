'use client';

// Intake step 6/13 - Dependents count.
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
import { useIntakeField } from '@/lib/intake-context';
import { getNextStep, getPrevStep } from '@/lib/intake-flow';
import { IntakeContinueButton } from '@/components/intake-continue-button';
import type { FilingStatus } from '@docket/shared';

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
        width: 48,
        height: 48,
        borderRadius: '50%',
        border: 'none',
        background: disabled ? 'transparent' : '#fffefc',
        color: disabled ? t.borderSoft : t.ease.forestDark,
        fontFamily: t.serif,
        fontSize: 24,
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
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = t.ease.keylimeWash;
      }}
      onMouseUp={(e) => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = '#fffefc';
      }}
      onTouchStart={(e) => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = t.ease.keylimeWash;
      }}
      onTouchEnd={(e) => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = '#fffefc';
      }}
    >
      {symbol}
    </button>
  );
}

export default function DepsCountPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  const [count, setCount] = useIntakeField<number>('dependents.count', 0);
  // Filing status drives back-nav: /spouse when MFJ/MFS, else /filing.
  const [filingStatus] = useIntakeField<FilingStatus>('filing.status', 'single');

  const dec = () => void setCount(Math.max(0, count - 1));
  const inc = () => void setCount(Math.min(MAX_DEPS, count + 1));

  // Branching logic (count===0 → /income, count>0 → /deps-detail) lives in
  // intake-flow.ts. Adding new criteria (e.g. age check) means editing that
  // file, not this page.
  const stateSnapshot = { filing: { status: filingStatus }, dependents: { count } };
  const handleContinue = () => {
    const target = getNextStep('/deps', stateSnapshot);
    if (target) nav.next(target);
  };
  const handleBack = () => {
    const target = getPrevStep('/deps', stateSnapshot);
    if (target) nav.back(target);
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
          <IntakeBackButton t={t} onClick={handleBack} />
        </div>

        <div style={{ padding: '18px 24px 8px' }}>
          <Stack gap={16}>
            <Stack gap={10}>
              <H1 t={t}>Do you have any dependents?</H1>
              <Body t={t} size={15}>
                Children, elderly parents, or anyone who depends on you financially.
              </Body>
            </Stack>
            <AntonioNote t={t}>
              Dependents unlock credits like the Child Tax Credit ($2,000+ per child). If you&apos;re unsure someone qualifies, mention them - I&apos;ll check.
            </AntonioNote>
          </Stack>
        </div>

        {/* Stepper card. At count=0 the surface is neutral (no
            commitment yet). When count>0 it shifts to mintWhisper
            (super-subtle green, matches the filled-input pattern).
            Tightened dimensions: max-width caps the box so it doesn't
            stretch full-bleed on a phone. Smaller buttons + tighter
            gap reduce the empty space inside. */}
        <Stack gap={20} style={{ padding: '24px 24px 16px', flex: 1 }}>
          <div
            style={{
              background: count > 0 ? t.ease.mintWhisper : t.ease.softNeutral,
              borderRadius: t.radius,
              padding: '28px 20px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              maxWidth: 280,
              marginInline: 'auto',
              width: '100%',
              transition: 'background 200ms cubic-bezier(.2,.8,.2,1)',
            }}
          >
            <Row gap={20} align="center" justify="center">
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
                  fontSize: 64,
                  fontWeight: 300,
                  color: t.ink,
                  letterSpacing: -2,
                  lineHeight: 1,
                  minWidth: 48,
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
                fontFamily: t.sans,
                fontSize: 13,
                color: t.muted,
                letterSpacing: -0.39,
              }}
            >
              {count === 1 ? 'dependent' : 'dependents'}
            </div>
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
              onClick={handleBack}
              style={{ flex: '0 0 auto' }}
            >
              Back
            </Button>
            <IntakeContinueButton t={t} route="/deps" onClick={handleContinue} style={{ flex: 1 }}>
              Continue
            </IntakeContinueButton>
          </Row>
        </div>
      </div>
    </Screen>
  );
}
