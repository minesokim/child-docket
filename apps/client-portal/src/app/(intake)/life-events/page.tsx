'use client';

// Intake step 10/13 — Life events. 6 multi-select toggles + exclusive "None".
// 1-to-1 port of ScreenLifeEvents.

import {
  AntonioNote,
  AskAntonioBar,
  Body,
  Button,
  buildTheme,
  H1,
  IconBeach,
  IconBriefcase,
  IconGift,
  IconKey,
  IconMinus,
  IconRings,
  IconStroller,
  IntakeBackButton,
  IntakeHeader,
  Row,
  Screen,
  Stack,
  ToggleCard,
} from '@docket/ui';
import { usePortalNav } from '@/lib/portal-nav';
import { usePortalState } from '@/lib/portal-state';

type LifeEvents = {
  marriage: boolean;
  baby: boolean;
  home: boolean;
  business: boolean;
  inherit: boolean;
  retire: boolean;
  none: boolean;
};

const DEFAULT: LifeEvents = {
  marriage: false,
  baby: false,
  home: false,
  business: false,
  inherit: false,
  retire: false,
  none: false,
};

type ItemKey = Exclude<keyof LifeEvents, 'none'>;

export default function LifeEventsPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  const [state, setState] = usePortalState<LifeEvents>('life-events', DEFAULT);

  const toggle = (k: keyof LifeEvents) => {
    if (k === 'none') {
      setState(
        state.none
          ? { ...state, none: false }
          : {
              marriage: false,
              baby: false,
              home: false,
              business: false,
              inherit: false,
              retire: false,
              none: true,
            },
      );
    } else {
      setState({ ...state, [k]: !state[k], none: false });
    }
  };

  const items: Array<{ k: ItemKey; icon: React.ReactNode; label: string }> = [
    { k: 'marriage', icon: <IconRings />, label: 'Got married or divorced' },
    { k: 'baby', icon: <IconStroller />, label: 'Had a baby or adopted' },
    { k: 'home', icon: <IconKey />, label: 'Bought or sold a home' },
    { k: 'business', icon: <IconBriefcase />, label: 'Started a business' },
    { k: 'inherit', icon: <IconGift />, label: 'Received an inheritance' },
    { k: 'retire', icon: <IconBeach />, label: 'Retired' },
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
        <IntakeHeader t={t} step={10} label="Life events" />

        <div style={{ padding: '22px 24px 0' }}>
          <IntakeBackButton t={t} onClick={() => nav.back('/deductions')} />
        </div>

        <div style={{ padding: '18px 24px 8px' }}>
          <Stack gap={10}>
            <H1 t={t}>Any major life changes in 2025?</H1>
            <Body t={t} size={15}>
              These can significantly affect your return.
            </Body>
          </Stack>
        </div>

        <Stack gap={10} style={{ padding: '22px 24px 16px', flex: 1 }}>
          {items.map((item) => (
            <ToggleCard
              key={item.k}
              t={t}
              on={state[item.k]}
              onClick={() => toggle(item.k)}
              icon={item.icon}
              label={item.label}
            />
          ))}

          <div style={{ marginTop: 2 }}>
            <ToggleCard
              t={t}
              on={state.none}
              onClick={() => toggle('none')}
              icon={<IconMinus />}
              label="None of these"
              sub="Nothing major happened this year"
            />
          </div>

          <div style={{ marginTop: 10 }}>
            <AntonioNote t={t}>
              Life changes often mean tax changes. Even if you&apos;re not sure it matters, mention
              it and I&apos;ll check.
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
              onClick={() => nav.back('/deductions')}
              style={{ flex: '0 0 auto' }}
            >
              Back
            </Button>
            <Button t={t} onClick={() => nav.next('/refund')} style={{ flex: 1 }}>
              Continue
            </Button>
          </Row>
        </div>
      </div>
    </Screen>
  );
}
