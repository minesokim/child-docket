'use client';

// Intake step 9/13 — Deductions. 7 multi-select toggles + exclusive "None"
// + inline Form 2441 expansion when "Childcare" is on.
// 1-to-1 port of ScreenDeductions.

import {
  AntonioNote,
  AskAntonioBar,
  Body,
  Button,
  buildTheme,
  FieldLabel,
  H1,
  IconMinus,
  IntakeBackButton,
  IntakeHeader,
  Row,
  Screen,
  SolarCharity,
  SolarChildcare,
  SolarEducation,
  SolarEducator,
  SolarMedical,
  SolarMortgageInterest,
  SolarStudentLoan,
  Stack,
  TextField,
  ToggleCard,
} from '@docket/ui';
import * as React from 'react';
import { usePortalNav } from '@/lib/portal-nav';
import { useIntakeAnswers, useSetIntakeField } from '@/lib/intake-context';
import { getNextStep, getPrevStep } from '@/lib/intake-flow';
import { formatEin, formatMoney } from '@docket/shared';

type ItemKey =
  | 'mortgage'
  | 'student'
  | 'charity'
  | 'childcare'
  | 'medical'
  | 'education'
  | 'educator';

const ALL_ITEMS: readonly ItemKey[] = [
  'mortgage',
  'student',
  'charity',
  'childcare',
  'medical',
  'education',
  'educator',
];

export default function DeductionsPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  const answers = useIntakeAnswers();
  const setField = useSetIntakeField();

  const state = answers.deductions ?? {};
  const childcare = state.childcareDetails ?? {};

  const toggle = (k: ItemKey | 'none') => {
    if (k === 'none') {
      if (state.none) {
        setField('deductions.none', false);
      } else {
        // Clear all + set none
        ALL_ITEMS.forEach((item) => setField(`deductions.${item}`, false));
        setField('deductions.none', true);
      }
    } else {
      setField(`deductions.${k}`, !state[k]);
      if (state.none) setField('deductions.none', false);
    }
  };

  const updateChildcare = (
    k: 'providerName' | 'providerAddress' | 'providerEin' | 'amountPaid',
    v: string,
  ) => {
    setField(`deductions.childcareDetails.${k}`, v);
  };

  const handleNext = () => {
    const target = getNextStep('/deductions', {});
    if (target) nav.next(target);
  };
  const handleBack = () => {
    const target = getPrevStep('/deductions', {});
    if (target) nav.back(target);
  };

  const items: Array<{ k: ItemKey; icon: React.ReactNode; label: string; sub?: string }> = [
    { k: 'mortgage', icon: <SolarMortgageInterest size={28} />, label: 'Home mortgage' },
    { k: 'student', icon: <SolarStudentLoan size={28} />, label: 'Student loans' },
    { k: 'charity', icon: <SolarCharity size={28} />, label: 'Charitable donations' },
    { k: 'childcare', icon: <SolarChildcare size={28} />, label: 'Childcare costs' },
    { k: 'medical', icon: <SolarMedical size={28} />, label: 'Medical expenses' },
    { k: 'education', icon: <SolarEducation size={28} />, label: 'Education / tuition' },
    {
      k: 'educator',
      icon: <SolarEducator size={28} />,
      label: 'Educator expenses',
      sub: 'K–12 teacher supplies, up to $300',
    },
  ];

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
        <IntakeHeader t={t} step={9} label="Deductions" />

        <div style={{ padding: '22px 24px 0' }}>
          <IntakeBackButton t={t} onClick={handleBack} />
        </div>

        <div style={{ padding: '18px 24px 8px' }}>
          <Stack gap={16}>
            <Stack gap={10}>
              <H1 t={t}>Quick check on deductions</H1>
              <Body t={t} size={15}>
                Select anything that might apply. When in doubt, select it.
              </Body>
            </Stack>
            <AntonioNote t={t}>
              Pick everything that maybe applies — childcare under 13 alone is worth $3k–$6k. I verify what actually qualifies during prep.
            </AntonioNote>
          </Stack>
        </div>

        <Stack gap={10} style={{ padding: '22px 24px 16px', flex: 1 }}>
          {items.map((item) => (
            <React.Fragment key={item.k}>
              <ToggleCard
                t={t}
                on={!!state[item.k]}
                onClick={() => toggle(item.k)}
                icon={item.icon}
                label={item.label}
                sub={item.sub}
              />

              {item.k === 'childcare' && !!state.childcare && (
                <div
                  style={{
                    marginTop: -2,
                    marginLeft: 18,
                    padding: '16px 16px 8px 18px',
                    background: t.ease.keylimeWash,
                    borderRadius: 8,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 14,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: t.mono,
                        fontSize: 9.5,
                        color: t.rustInk,
                        letterSpacing: 1,
                        textTransform: 'uppercase',
                      }}
                    >
                      Form 2441 · Provider info
                    </span>
                  </div>

                  <Stack gap={14}>
                    <div>
                      <FieldLabel t={t}>Provider name</FieldLabel>
                      <TextField
                        t={t}
                        value={childcare.providerName ?? ''}
                        onChange={(v) => updateChildcare('providerName', v)}
                        placeholder="Daycare or individual's name"
                      />
                    </div>
                    <div>
                      <FieldLabel t={t}>Provider address</FieldLabel>
                      <TextField
                        t={t}
                        value={childcare.providerAddress ?? ''}
                        onChange={(v) => updateChildcare('providerAddress', v)}
                        placeholder="Street, city, state, ZIP"
                      />
                    </div>
                    <div>
                      <FieldLabel t={t}>Provider EIN</FieldLabel>
                      <TextField
                        t={t}
                        value={childcare.providerEin ?? ''}
                        onChange={(v) => updateChildcare('providerEin', formatEin(v))}
                        placeholder="XX-XXXXXXX"
                        mono
                        inputMode="numeric"
                      />
                    </div>
                    <div>
                      <FieldLabel t={t}>Amount paid in 2025</FieldLabel>
                      <TextField
                        t={t}
                        value={childcare.amountPaid ?? ''}
                        onChange={(v) => updateChildcare('amountPaid', formatMoney(v))}
                        placeholder="$0"
                        mono
                        inputMode="numeric"
                      />
                    </div>
                  </Stack>
                </div>
              )}
            </React.Fragment>
          ))}

          <div style={{ marginTop: 2 }}>
            <ToggleCard
              t={t}
              on={!!state.none}
              onClick={() => toggle('none')}
              icon={<IconMinus />}
              label="None of these"
              sub="Skip straight to the next step"
            />
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
            <Button t={t} onClick={handleNext} style={{ flex: 1 }}>
              Continue
            </Button>
          </Row>
        </div>
      </div>
    </Screen>
  );
}
