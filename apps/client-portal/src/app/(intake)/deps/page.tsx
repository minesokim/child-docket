'use client';

// Intake step 6/13 — Dependents count. 1-to-1 port of ScreenDependentsCount.

import {
  AntonioNote,
  AskAntonioBar,
  Body,
  Button,
  buildTheme,
  DependentCountCard,
  H1,
  IntakeBackButton,
  IntakeHeader,
  Row,
  Screen,
  Stack,
} from '@docket/ui';
import { usePortalNav } from '@/lib/portal-nav';
import { usePortalState } from '@/lib/portal-state';

type DepsCount = 'none' | 'one' | 'two' | 'more';

const OPTIONS: Array<{ id: DepsCount; label: string; sub: string; icon: string }> = [
  { id: 'none', label: 'No dependents', sub: 'Just me (and spouse, if applicable)', icon: '0' },
  { id: 'one', label: '1 dependent', sub: 'One child, parent, or other', icon: '1' },
  { id: 'two', label: '2 dependents', sub: 'Two qualifying individuals', icon: '2' },
  { id: 'more', label: '3 or more', sub: "We'll capture the full list next", icon: '3+' },
];

export default function DepsCountPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  const [sel, setSel] = usePortalState<DepsCount | null>('deps-count', null);

  const handleContinue = () => {
    if (!sel) return;
    if (sel === 'none') {
      nav.next('/income');
    } else {
      nav.next('/deps-detail');
    }
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

        <Stack gap={10} style={{ padding: '22px 24px 16px', flex: 1 }}>
          {OPTIONS.map((o) => (
            <DependentCountCard
              key={o.id}
              t={t}
              selected={sel === o.id}
              onClick={() => setSel(o.id)}
              label={o.label}
              sub={o.sub}
              icon={o.icon}
            />
          ))}

          <div style={{ marginTop: 10 }}>
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
            <Button
              t={t}
              onClick={handleContinue}
              disabled={!sel}
              style={{ flex: 1, opacity: sel ? 1 : 0.45 }}
            >
              Continue
            </Button>
          </Row>
        </div>
      </div>
    </Screen>
  );
}
