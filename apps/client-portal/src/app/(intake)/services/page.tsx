'use client';

import { useRouter } from 'next/navigation';
import {
  Body,
  BottomBar,
  Button,
  buildTheme,
  Card,
  Eyebrow,
  Footer,
  H1,
  IntakeHeader,
  Row,
  Screen,
  Stack,
} from '@docket/ui';
import { usePortalState } from '@/lib/portal-state';

type ServicePath = 'individual' | 'business' | 'representation' | null;

const PATH_OPTIONS: Array<{
  value: Exclude<ServicePath, null>;
  title: string;
  blurb: string;
  startingPrice: string;
}> = [
  {
    value: 'individual',
    title: 'Individual return',
    blurb: 'W-2, 1099, side income, dependents — the classic 1040.',
    startingPrice: 'starting at $300',
  },
  {
    value: 'business',
    title: 'Business + owner',
    blurb: 'S-corp, LLC, sole-prop, partnership — entity + your personal return.',
    startingPrice: 'starting at $850',
  },
  {
    value: 'representation',
    title: 'IRS notice or audit',
    blurb: 'CP2000, audit defense, back taxes, installment plans.',
    startingPrice: 'starting at $500',
  },
];

export default function ServicesPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const router = useRouter();
  const [path, setPath] = usePortalState<ServicePath>('service-path', null);

  return (
    <Screen t={t}>
      <IntakeHeader t={t} step={1} subStep="A" label="What do you need?" />

      <div style={{ padding: '24px 24px 0', display: 'flex', flexDirection: 'column', minHeight: 'calc(100% - 60px)' }}>
        <Stack gap={28} style={{ flex: 1 }}>
          <Stack gap={10}>
            <H1 t={t}>Pick your starting point.</H1>
            <Body t={t} size={15}>
              You can always add things later. We&apos;ll make sure you only pay for what you actually need.
            </Body>
          </Stack>

          <Stack gap={12}>
            {PATH_OPTIONS.map((opt) => {
              const selected = path === opt.value;
              return (
                <Card
                  key={opt.value}
                  t={t}
                  onClick={() => setPath(opt.value)}
                  selected={selected}
                  style={{ padding: 18 }}
                >
                  <Row justify="space-between" gap={12} align="flex-start">
                    <Stack gap={6} style={{ flex: 1 }}>
                      <div
                        style={{
                          fontFamily: t.serif,
                          fontSize: 18,
                          color: t.ink,
                          letterSpacing: -0.2,
                          fontWeight: 400,
                        }}
                      >
                        {opt.title}
                      </div>
                      <Body t={t} size={14} style={{ color: t.muted }}>
                        {opt.blurb}
                      </Body>
                    </Stack>
                    <Eyebrow t={t} style={{ marginTop: 4, whiteSpace: 'nowrap', fontSize: 9.5 }}>
                      {opt.startingPrice}
                    </Eyebrow>
                  </Row>
                </Card>
              );
            })}
          </Stack>

          <Body t={t} size={13} muted style={{ textAlign: 'center' }}>
            Not sure? Pick the closest one — Antonio will adjust during your call.
          </Body>
        </Stack>

        <BottomBar t={t}>
          <Button
            t={t}
            variant="ghost"
            onClick={() => router.push('/welcome')}
            style={{ flex: 1, padding: '16px 22px', fontSize: 16 }}
          >
            Back
          </Button>
          <Button
            t={t}
            onClick={() => router.push('/personal')}
            disabled={!path}
            style={{ flex: 2, padding: '16px 22px', fontSize: 16 }}
          >
            Continue
          </Button>
        </BottomBar>

        <Footer t={t} />
      </div>
    </Screen>
  );
}
