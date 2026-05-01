'use client';

// Intake step 2 alt — Business Formation. Conditional path for users who
// selected "Business formation" sub-option on Services. Short intake.
// 1-to-1 port of ScreenBusinessFormation.

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
  Row,
  Screen,
  Stack,
  TextField,
} from '@docket/ui';
import type { Theme } from '@docket/ui';
import { usePortalNav } from '@/lib/portal-nav';
import { usePortalState } from '@/lib/portal-state';

type EntityId = 'llc' | 'scorp' | 'ccorp' | 'unsure';

type FormationInfo = {
  businessName: string;
  description: string;
  entity: EntityId;
  state: string;
  ownerCount: string;
};

const DEFAULT: FormationInfo = {
  businessName: '',
  description: '',
  entity: 'llc',
  state: '',
  ownerCount: '',
};

const ENTITIES: Array<{ id: EntityId; acronym: string; sub: string }> = [
  { id: 'llc', acronym: 'LLC', sub: 'Pass-through, flexible' },
  { id: 'scorp', acronym: 'S-Corp', sub: 'Payroll + distributions' },
  { id: 'ccorp', acronym: 'C-Corp', sub: 'Separate taxable entity' },
  { id: 'unsure', acronym: 'Not sure', sub: 'Need guidance from Antonio' },
];

function EntityCard({
  t,
  selected,
  onClick,
  acronym,
  sub,
}: {
  t: Theme;
  selected: boolean;
  onClick: () => void;
  acronym: string;
  sub: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 4,
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
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontFamily: t.serif,
            fontSize: 19,
            fontWeight: 500,
            color: t.ink,
            letterSpacing: -0.3,
          }}
        >
          {acronym}
        </span>
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            border: `1.5px solid ${selected ? t.rust : t.border}`,
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {selected && (
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: t.rust }} />
          )}
        </div>
      </div>
      <div style={{ fontSize: 12, color: t.muted, lineHeight: 1.35 }}>{sub}</div>
    </button>
  );
}

export default function BusinessFormationPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  const [info, setInfo] = usePortalState<FormationInfo>('business-formation', DEFAULT);
  const update = <K extends keyof FormationInfo>(k: K, v: FormationInfo[K]) =>
    setInfo({ ...info, [k]: v });

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
        <IntakeHeader t={t} step={2} label="Formation" />

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
            Because you&apos;re forming a business
          </span>
        </div>

        <div style={{ padding: '14px 24px 8px' }}>
          <Stack gap={10}>
            <H1 t={t}>Let&apos;s set up your business</H1>
            <Body t={t} size={15}>
              Tell me what you want to start.
            </Body>
          </Stack>
        </div>

        <Stack gap={20} style={{ padding: '22px 24px 16px', flex: 1 }}>
          <div>
            <FieldLabel t={t}>Desired business name</FieldLabel>
            <TextField
              t={t}
              value={info.businessName}
              onChange={(v) => update('businessName', v)}
              placeholder="Park Cleaners LLC"
            />
          </div>

          <div>
            <FieldLabel t={t}>What will the business do?</FieldLabel>
            <TextField
              t={t}
              value={info.description}
              onChange={(v) => update('description', v)}
              placeholder="A short description"
            />
          </div>

          <div>
            <FieldLabel t={t}>Entity type</FieldLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {ENTITIES.map((e) => (
                <EntityCard
                  key={e.id}
                  t={t}
                  selected={info.entity === e.id}
                  onClick={() => update('entity', e.id)}
                  acronym={e.acronym}
                  sub={e.sub}
                />
              ))}
            </div>
          </div>

          <div>
            <FieldLabel t={t}>State of incorporation</FieldLabel>
            <TextField
              t={t}
              value={info.state}
              onChange={(v) => update('state', v)}
              placeholder="California"
            />
          </div>

          <div>
            <FieldLabel t={t}>Number of owners</FieldLabel>
            <TextField
              t={t}
              value={info.ownerCount}
              onChange={(v) => update('ownerCount', v.replace(/\D/g, '').slice(0, 3))}
              mono
              inputMode="numeric"
              placeholder="1"
            />
          </div>

          <div style={{ marginTop: 6 }}>
            <AntonioNote t={t}>
              If you&apos;re not sure which entity type, that&apos;s exactly what we&apos;ll figure
              out in our consultation. Most of my clients end up with an LLC, then elect S-Corp
              status once their income justifies it.
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
