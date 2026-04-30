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
  IconApple,
  IconBook,
  IconCap,
  IconChild,
  IconHeart,
  IconHome,
  IconMed,
  IconMinus,
  IntakeBackButton,
  IntakeHeader,
  Row,
  Screen,
  Stack,
  TextField,
  ToggleCard,
} from '@docket/ui';
import * as React from 'react';
import { usePortalNav } from '@/lib/portal-nav';
import { usePortalState } from '@/lib/portal-state';

type DeductionsState = {
  mortgage: boolean;
  student: boolean;
  charity: boolean;
  childcare: boolean;
  medical: boolean;
  education: boolean;
  educator: boolean;
  none: boolean;
};

type ChildcareInfo = {
  providerName: string;
  providerAddress: string;
  providerEin: string;
  amountPaid: string;
};

const DEFAULT: DeductionsState = {
  mortgage: false,
  student: false,
  charity: false,
  childcare: false,
  medical: false,
  education: false,
  educator: false,
  none: false,
};

const CHILDCARE_DEFAULT: ChildcareInfo = {
  providerName: '',
  providerAddress: '',
  providerEin: '',
  amountPaid: '',
};

type ItemKey = Exclude<keyof DeductionsState, 'none'>;

export default function DeductionsPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  const [state, setState] = usePortalState<DeductionsState>('deductions', DEFAULT);
  const [childcare, setChildcare] = usePortalState<ChildcareInfo>(
    'deductions-childcare',
    CHILDCARE_DEFAULT,
  );

  const toggle = (k: keyof DeductionsState) => {
    if (k === 'none') {
      setState(
        state.none
          ? { ...state, none: false }
          : {
              mortgage: false,
              student: false,
              charity: false,
              childcare: false,
              medical: false,
              education: false,
              educator: false,
              none: true,
            },
      );
    } else {
      setState({ ...state, [k]: !state[k], none: false });
    }
  };

  const updateChildcare = <K extends keyof ChildcareInfo>(k: K, v: ChildcareInfo[K]) =>
    setChildcare({ ...childcare, [k]: v });

  const items: Array<{ k: ItemKey; icon: React.ReactNode; label: string; sub?: string }> = [
    { k: 'mortgage', icon: <IconHome />, label: 'Home mortgage' },
    { k: 'student', icon: <IconCap />, label: 'Student loans' },
    { k: 'charity', icon: <IconHeart />, label: 'Charitable donations' },
    { k: 'childcare', icon: <IconChild />, label: 'Childcare costs' },
    { k: 'medical', icon: <IconMed />, label: 'Medical expenses' },
    { k: 'education', icon: <IconBook />, label: 'Education / tuition' },
    {
      k: 'educator',
      icon: <IconApple />,
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
          <IntakeBackButton t={t} onClick={() => nav.back('/tax-questions')} />
        </div>

        <div style={{ padding: '18px 24px 8px' }}>
          <Stack gap={10}>
            <H1 t={t}>Quick check on deductions</H1>
            <Body t={t} size={15}>
              Select anything that might apply. When in doubt, select it.
            </Body>
          </Stack>
        </div>

        <Stack gap={10} style={{ padding: '22px 24px 16px', flex: 1 }}>
          {items.map((item) => (
            <React.Fragment key={item.k}>
              <ToggleCard
                t={t}
                on={state[item.k]}
                onClick={() => toggle(item.k)}
                icon={item.icon}
                label={item.label}
                sub={item.sub}
              />

              {item.k === 'childcare' && state.childcare && (
                <div
                  style={{
                    marginTop: -2,
                    marginLeft: 18,
                    padding: '16px 16px 8px 18px',
                    borderLeft: `2px solid ${t.rust}`,
                    background: t.bgElev,
                    borderTopRightRadius: 8,
                    borderBottomRightRadius: 8,
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
                        value={childcare.providerName}
                        onChange={(v) => updateChildcare('providerName', v)}
                        placeholder="Daycare or individual's name"
                      />
                    </div>
                    <div>
                      <FieldLabel t={t}>Provider address</FieldLabel>
                      <TextField
                        t={t}
                        value={childcare.providerAddress}
                        onChange={(v) => updateChildcare('providerAddress', v)}
                        placeholder="Street, city, state, ZIP"
                      />
                    </div>
                    <div>
                      <FieldLabel t={t}>Provider EIN</FieldLabel>
                      <TextField
                        t={t}
                        value={childcare.providerEin}
                        onChange={(v) => updateChildcare('providerEin', v)}
                        placeholder="XX-XXXXXXX"
                        mono
                        inputMode="numeric"
                      />
                    </div>
                    <div>
                      <FieldLabel t={t}>Amount paid in 2025</FieldLabel>
                      <TextField
                        t={t}
                        value={childcare.amountPaid}
                        onChange={(v) => updateChildcare('amountPaid', v)}
                        placeholder="$0"
                        mono
                        inputMode="decimal"
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
              on={state.none}
              onClick={() => toggle('none')}
              icon={<IconMinus />}
              label="None of these"
              sub="Skip straight to the next step"
            />
          </div>

          <div style={{ marginTop: 10 }}>
            <AntonioNote t={t}>
              Even if you&apos;re not sure something counts, select it. I&apos;d rather check than
              miss a deduction worth hundreds.
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
              onClick={() => nav.back('/tax-questions')}
              style={{ flex: '0 0 auto' }}
            >
              Back
            </Button>
            <Button t={t} onClick={() => nav.next('/life-events')} style={{ flex: 1 }}>
              Continue
            </Button>
          </Row>
        </div>
      </div>
    </Screen>
  );
}
