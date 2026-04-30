'use client';

// Intake step 3/13 — State & prior year. 1-to-1 port of ScreenStateAndPriorYear.

import {
  AntonioNote,
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
import { usePortalState } from '@/lib/portal-state';

type StateInfo = {
  primaryState: string;
  additionalState: string;
  filedLast: 'yes' | 'no' | null;
  preparer: string;
};

const DEFAULT: StateInfo = {
  primaryState: '',
  additionalState: '',
  filedLast: null,
  preparer: '',
};

export default function StatePage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  const [info, setInfo] = usePortalState<StateInfo>('state-prior', DEFAULT);

  const setFiled = (v: 'yes' | 'no') => setInfo({ ...info, filedLast: v });

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
          <IntakeBackButton t={t} onClick={() => nav.back('/personal')} />
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
                  value={info.primaryState}
                  onChange={(v) => setInfo({ ...info, primaryState: v })}
                  placeholder="California"
                />
              </div>
              <div>
                <FieldLabel t={t}>Additional state (if applicable)</FieldLabel>
                <TextField
                  t={t}
                  value={info.additionalState}
                  onChange={(v) => setInfo({ ...info, additionalState: v })}
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
                selected={info.filedLast === 'yes'}
                onClick={() => setFiled('yes')}
                label="Yes, I filed last year"
                sub="Upload a copy in the documents step"
              />
              <RadioRowCard
                t={t}
                selected={info.filedLast === 'no'}
                onClick={() => setFiled('no')}
                label="No, I didn't file"
                sub="Antonio will help you figure out the right steps"
              />
            </Stack>

            {info.filedLast === 'yes' && (
              <div style={{ marginTop: 16 }}>
                <FieldLabel t={t}>Who prepared your return?</FieldLabel>
                <TextField
                  t={t}
                  value={info.preparer}
                  onChange={(v) => setInfo({ ...info, preparer: v })}
                  placeholder="Self, H&R Block, another preparer"
                />
              </div>
            )}
          </div>

          {info.filedLast === 'yes' && (
            <AntonioNote t={t}>
              If you have a copy of last year&apos;s return, upload it in the documents step — it
              helps me catch things you might have missed. Unless I see it, you lose the expense.
            </AntonioNote>
          )}
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
              onClick={() => nav.back('/personal')}
              style={{ flex: '0 0 auto' }}
            >
              Back
            </Button>
            <Button t={t} onClick={() => nav.next('/filing')} style={{ flex: 1 }}>
              Continue
            </Button>
          </Row>
        </div>
      </div>
    </Screen>
  );
}
