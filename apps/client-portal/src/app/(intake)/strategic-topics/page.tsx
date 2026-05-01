'use client';

// Intake step 2 alt — Strategic Topics. Multi-select consultation topics.
// Conditional path for "Strategic tax & business consultation" service.
// 1-to-1 port of ScreenStrategicTopics.

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
import { usePortalState } from '@/lib/portal-state';

type TopicId = 'planning' | 'entity' | 'estimated' | 'retirement' | 'realestate' | 'irs' | 'other';

const TOPICS: Array<{ id: TopicId; label: string; sub?: string }> = [
  { id: 'planning', label: 'Tax planning & projections' },
  { id: 'entity', label: 'Entity restructuring', sub: 'LLC to S-Corp, etc.' },
  { id: 'estimated', label: 'Estimated tax payments' },
  { id: 'retirement', label: 'Retirement planning' },
  { id: 'realestate', label: 'Real estate strategy' },
  { id: 'irs', label: 'IRS notice or audit', sub: 'I received something from the IRS' },
  { id: 'other', label: 'Other' },
];

function TopicCard({
  t,
  selected,
  onClick,
  label,
  sub,
}: {
  t: Theme;
  selected: boolean;
  onClick: () => void;
  label: string;
  sub?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '14px 14px',
        background: selected ? t.tintAccent : t.card,
        border: `1px solid ${selected ? t.rust : t.border}`,
        borderRadius: t.radius,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: t.sans,
        transition: 'border-color 120ms, background 120ms',
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: 4,
          border: `1.5px solid ${selected ? t.rust : t.border}`,
          background: selected ? t.rust : '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {selected && (
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="#fff" strokeWidth="2">
            <path d="M2.5 5.5l2 2 4-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: t.ink, letterSpacing: -0.1 }}>
          {label}
        </div>
        {sub && (
          <div style={{ fontSize: 12.5, color: t.muted, marginTop: 3, lineHeight: 1.4 }}>{sub}</div>
        )}
      </div>
    </button>
  );
}

export default function StrategicTopicsPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  const [picked, setPicked] = usePortalState<TopicId[]>('strategic-topics', []);

  const toggle = (id: TopicId) => {
    setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);
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
        <IntakeHeader t={t} step={2} label="Consultation" />

        <div style={{ padding: '22px 24px 0' }}>
          <IntakeBackButton t={t} onClick={() => nav.back('/services-addons')} />
        </div>

        <div style={{ padding: '18px 24px 0' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 10px',
              background: t.tintAccent,
              border: `1px solid ${t.rustSoft}`,
              borderRadius: 999,
              fontFamily: t.mono,
              fontSize: 9.5,
              color: t.rustInk,
              letterSpacing: 0.9,
              textTransform: 'uppercase',
            }}
          >
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M2 5l2 2 3-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Strategic consultation
          </span>
        </div>

        <div style={{ padding: '14px 24px 8px' }}>
          <Stack gap={10}>
            <H1 t={t}>What do you want to discuss?</H1>
            <Body t={t} size={15}>
              Select all that apply so I can prepare.
            </Body>
          </Stack>
        </div>

        <Stack gap={8} style={{ padding: '22px 24px 16px', flex: 1 }}>
          {TOPICS.map((tp) => (
            <TopicCard
              key={tp.id}
              t={t}
              selected={picked.includes(tp.id)}
              onClick={() => toggle(tp.id)}
              label={tp.label}
              sub={tp.sub}
            />
          ))}

          <div style={{ marginTop: 10 }}>
            <AntonioNote t={t}>
              Come with specific questions. The more prepared you are, the more value we get out of
              the hour.
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
              onClick={() => nav.back('/services-addons')}
              style={{ flex: '0 0 auto' }}
            >
              Back
            </Button>
            <Button t={t} onClick={() => nav.next('/contact-info')} style={{ flex: 1 }}>
              Continue
            </Button>
          </Row>
        </div>
      </div>
    </Screen>
  );
}
