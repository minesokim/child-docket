'use client';

// Intake step 10/13 - Life events. 6 multi-select toggles + exclusive "None".
// 1-to-1 port of ScreenLifeEvents.

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
  SolarBusinessStarted,
  SolarHomePurchase,
  SolarInheritance,
  SolarMarriage,
  SolarNewChild,
  SolarNoneOfThese,
  SolarRetired,
  Stack,
  ToggleCard,
} from '@docket/ui';
import { usePortalNav } from '@/lib/portal-nav';
import { useIntakeAnswers, useSetIntakeField } from '@/lib/intake-context';
import { getNextStep, getPrevStep } from '@/lib/intake-flow';

type ItemKey = 'marriage' | 'baby' | 'home' | 'business' | 'inherit' | 'retire';

export default function LifeEventsPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  const answers = useIntakeAnswers();
  const setField = useSetIntakeField();

  const state = answers.lifeEvents ?? {};

  const toggle = (k: ItemKey | 'none') => {
    if (k === 'none') {
      if (state.none) {
        setField('lifeEvents.none', false);
      } else {
        // Clear all other selections + set none
        (['marriage', 'baby', 'home', 'business', 'inherit', 'retire'] as const).forEach((key) =>
          setField(`lifeEvents.${key}`, false),
        );
        setField('lifeEvents.none', true);
      }
    } else {
      setField(`lifeEvents.${k}`, !state[k]);
      if (state.none) setField('lifeEvents.none', false);
    }
  };

  const stateSnapshot = { lifeEvents: state };
  const handleNext = () => {
    const target = getNextStep('/life-events', stateSnapshot);
    if (target) nav.next(target);
  };
  const handleBack = () => {
    const target = getPrevStep('/life-events', stateSnapshot);
    if (target) nav.back(target);
  };

  const items: Array<{ k: ItemKey; icon: React.ReactNode; label: string }> = [
    { k: 'marriage', icon: <SolarMarriage size={44} />, label: 'Got married or divorced' },
    { k: 'baby', icon: <SolarNewChild size={44} />, label: 'Had a baby or adopted' },
    { k: 'home', icon: <SolarHomePurchase size={44} />, label: 'Bought or sold a home' },
    { k: 'business', icon: <SolarBusinessStarted size={44} />, label: 'Started a business' },
    { k: 'inherit', icon: <SolarInheritance size={44} />, label: 'Received an inheritance' },
    { k: 'retire', icon: <SolarRetired size={44} />, label: 'Retired' },
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
          <IntakeBackButton t={t} onClick={handleBack} />
        </div>

        <div style={{ padding: '18px 24px 8px' }}>
          <Stack gap={16}>
            <Stack gap={10}>
              <H1 t={t}>Any major life changes in 2025?</H1>
              <Body t={t} size={15}>
                These can significantly affect your return.
              </Body>
            </Stack>
            <AntonioNote t={t}>
              Life changes often mean tax changes. Even if you&apos;re not sure it matters, mention it and I&apos;ll check.
            </AntonioNote>
          </Stack>
        </div>

        <Stack gap={10} style={{ padding: '22px 24px 16px', flex: 1 }}>
          {items.map((item) => (
            <ToggleCard
              key={item.k}
              t={t}
              on={!!state[item.k]}
              onClick={() => toggle(item.k)}
              icon={item.icon}
              label={item.label}
            />
          ))}

          <div style={{ marginTop: 2 }}>
            <ToggleCard
              t={t}
              on={!!state.none}
              onClick={() => toggle('none')}
              icon={<SolarNoneOfThese size={44} />}
              label="None of these"
              sub="Nothing major happened this year"
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
