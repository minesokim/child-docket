'use client';

// Intake step 4/13 - Filing status. 1-to-1 port of ScreenFilingStatus.

import {
  AntonioNote,
  AskAntonioBar,
  Body,
  Button,
  buildTheme,
  Card,
  H1,
  IntakeHeader,
  Row,
  Screen,
  Stack,
} from '@docket/ui';
import { usePortalNav } from '@/lib/portal-nav';
import { useIntakeField } from '@/lib/intake-context';
import { getNextStep, getPrevStep } from '@/lib/intake-flow';
import { IntakeContinueButton } from '@/components/intake-continue-button';
import type { FilingStatus } from '@docket/shared';

const OPTIONS: Array<{ id: FilingStatus; label: string; hint: string }> = [
  { id: 'single', label: 'Single', hint: 'Unmarried or legally separated' },
  { id: 'mfj', label: 'Married filing jointly', hint: 'Most common for married couples' },
  { id: 'mfs', label: 'Married filing separately', hint: 'Each spouse files their own return' },
  { id: 'hoh', label: 'Head of household', hint: 'Unmarried, supporting a qualifying dependent' },
  { id: 'qw', label: 'Qualifying widow(er)', hint: 'Spouse passed within the last 2 years' },
];

export default function FilingPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  // Default = 'single' (most common). persistDefault: true writes
  // 'single' on mount when the field is unset, so a user who is
  // single can hit Continue without first toggling to another option
  // and back.
  const [sel, setSel] = useIntakeField<FilingStatus>('filing.status', 'single', {
    persistDefault: true,
  });

  // Next step is computed from the central INTAKE_FLOW (see intake-flow.ts).
  // Filing branches: mfj/mfs → /spouse, else → /deps. Logic lives in one
  // place now - adding a new filing-status branch means editing intake-flow.ts,
  // not this page.
  const next = () => {
    const target = getNextStep('/filing', { filing: { status: sel } });
    if (target) nav.next(target);
  };
  const back = () => {
    const target = getPrevStep('/filing', { filing: { status: sel } });
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
        <IntakeHeader t={t} step={4} label="Filing" />

        <div style={{ padding: '32px 24px 8px' }}>
          <Stack gap={16}>
            <Stack gap={10}>
              <H1 t={t}>What&apos;s your filing status?</H1>
              <Body t={t} size={15}>
                This affects your standard deduction and tax bracket.
              </Body>
            </Stack>
            <AntonioNote t={t}>
              If you&apos;re not sure which applies, pick your best guess - I&apos;ll verify during our call.
            </AntonioNote>
          </Stack>
        </div>

        <Stack gap={10} style={{ padding: '20px 24px 16px', flex: 1 }}>
          {OPTIONS.map((o) => (
            <Card
              key={o.id}
              t={t}
              onClick={() => void setSel(o.id)}
              selected={sel === o.id}
              tinted={sel === o.id}
              style={{ padding: '16px 18px' }}
            >
              <Row gap={12} align="flex-start">
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: sel === o.id ? t.ease.forestMid : t.ease.keylimeWash,
                    flexShrink: 0,
                    marginTop: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {sel === o.id && (
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 400, color: t.ink, letterSpacing: -0.48, marginBottom: 3 }}>
                    {o.label}
                  </div>
                  <div style={{ fontSize: 13, color: t.muted, lineHeight: 1.4, letterSpacing: -0.39 }}>{o.hint}</div>
                </div>
              </Row>
            </Card>
          ))}
        </Stack>

        <div
          style={{
            position: 'sticky',
            bottom: 0,
            background: `linear-gradient(to top, ${t.bg} 75%, transparent)`,
            padding: '20px 24px 28px',
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <AskAntonioBar t={t} />
          </div>
          <Row gap={10}>
            <Button
              t={t}
              variant="ghost"
              onClick={back}
              style={{ flex: '0 0 auto' }}
            >
              Back
            </Button>
            <IntakeContinueButton t={t} route="/filing" onClick={next} style={{ flex: 1 }}>
              Continue
            </IntakeContinueButton>
          </Row>
        </div>
      </div>
    </Screen>
  );
}
