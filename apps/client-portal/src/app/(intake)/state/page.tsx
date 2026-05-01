'use client';

// Intake step 3/13 — State & prior year. 1-to-1 port of ScreenStateAndPriorYear.

import {
  AskAntonioBar,
  Body,
  Button,
  buildTheme,
  FieldLabel,
  H1,
  IntakeBackButton,
  IntakeHeader,
  RadioRowCard,
  Row,
  Screen,
  Stack,
  TextField,
} from '@docket/ui';
import { usePortalNav } from '@/lib/portal-nav';
import { useIntakeField } from '@/lib/intake-context';
import { getNextStep, getPrevStep } from '@/lib/intake-flow';

export default function StatePage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();

  const [primaryState, setPrimaryState] = useIntakeField<string>('state.primaryState', '');
  const [additionalState, setAdditionalState] = useIntakeField<string>(
    'state.additionalState',
    '',
  );
  const [filedLast, setFiledLast] = useIntakeField<'yes' | 'no' | ''>('state.filedLast', '');
  const [preparer, setPreparer] = useIntakeField<string>('state.preparer', '');

  const setFiled = (v: 'yes' | 'no') => void setFiledLast(v);

  const handleNext = () => {
    const target = getNextStep('/state', { state: { primaryState } });
    if (target) nav.next(target);
  };
  const handleBack = () => {
    const target = getPrevStep('/state', { state: { primaryState } });
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
        <IntakeHeader t={t} step={3} label="State & prior year" />

        <div style={{ padding: '22px 24px 0' }}>
          <IntakeBackButton t={t} onClick={handleBack} />
        </div>

        <div style={{ padding: '20px 24px 8px' }}>
          <Stack gap={10}>
            <H1 t={t}>A few more details</H1>
            <Body t={t} size={15}>
              This helps me prepare your return accurately.
            </Body>
          </Stack>
        </div>

        <Stack gap={28} style={{ padding: '28px 24px 16px', flex: 1 }}>
          <div>
            <div
              style={{
                fontFamily: t.serif,
                fontStyle: 'italic',
                fontSize: 14,
                color: t.rustInk,
                marginBottom: 12,
              }}
            >
              States
            </div>
            <Stack gap={14}>
              <div>
                <FieldLabel t={t}>Which state(s) did you live or work in during 2025?</FieldLabel>
                <TextField
                  t={t}
                  value={primaryState}
                  onChange={(v) => void setPrimaryState(v)}
                  placeholder="California"
                />
              </div>
              <div>
                <FieldLabel t={t}>Additional state (if applicable)</FieldLabel>
                <TextField
                  t={t}
                  value={additionalState}
                  onChange={(v) => void setAdditionalState(v)}
                  placeholder="Oregon"
                />
              </div>
            </Stack>
          </div>

          <div>
            <div
              style={{
                fontFamily: t.serif,
                fontStyle: 'italic',
                fontSize: 14,
                color: t.rustInk,
                marginBottom: 12,
              }}
            >
              Prior year
            </div>
            <FieldLabel t={t}>Did you file a tax return last year?</FieldLabel>
            <Stack gap={8}>
              <RadioRowCard
                t={t}
                selected={filedLast === 'yes'}
                onClick={() => setFiled('yes')}
                label="Yes, I filed last year"
                sub="Upload a copy in the documents step"
              />
              <RadioRowCard
                t={t}
                selected={filedLast === 'no'}
                onClick={() => setFiled('no')}
                label="No, I didn't file"
                sub="Antonio will help you figure out the right steps"
              />
            </Stack>

            {filedLast === 'yes' && (
              <div style={{ marginTop: 16 }}>
                <FieldLabel t={t}>Who prepared your return?</FieldLabel>
                <TextField
                  t={t}
                  value={preparer}
                  onChange={(v) => void setPreparer(v)}
                  placeholder="Self, H&R Block, another preparer"
                />
              </div>
            )}
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
            <AskAntonioBar
              t={t}
              tip="If you have a copy of last year's return, upload it in the documents step — it helps me catch things you might have missed."
            />
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
