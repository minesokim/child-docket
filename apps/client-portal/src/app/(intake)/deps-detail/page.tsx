'use client';

// Intake step 6 (continued) — Dependent details. 1-to-1 port of ScreenDependentDetails.
// Repeating cards, count derived from previous step.

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
  SSNField,
  Stack,
  TextField,
} from '@docket/ui';
import type { Theme } from '@docket/ui';
import { usePortalNav } from '@/lib/portal-nav';
import { usePortalState } from '@/lib/portal-state';

type Dependent = {
  fullName: string;
  dob: string;
  ssn: string;
  relationship: string;
  monthsLivingWith: string;
};

const EMPTY_DEP: Dependent = {
  fullName: '',
  dob: '',
  ssn: '',
  relationship: '',
  monthsLivingWith: '12',
};

function formatDob(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)} / ${d.slice(2)}`;
  return `${d.slice(0, 2)} / ${d.slice(2, 4)} / ${d.slice(4)}`;
}

function DependentCardDetails({
  t,
  index,
  dep,
  onChange,
}: {
  t: Theme;
  index: number;
  dep: Dependent;
  onChange: (next: Dependent) => void;
}) {
  const update = <K extends keyof Dependent>(k: K, v: Dependent[K]) =>
    onChange({ ...dep, [k]: v });
  return (
    <div
      style={{
        padding: '18px 18px 6px',
        background: t.bgElev,
        border: `1px solid ${t.borderSoft}`,
        borderRadius: t.radius,
      }}
    >
      <div
        style={{
          fontFamily: t.mono,
          fontSize: 10,
          color: t.rustInk,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          marginBottom: 14,
        }}
      >
        Dependent {index}
      </div>

      <Stack gap={16}>
        <div>
          <FieldLabel t={t}>Full name</FieldLabel>
          <TextField
            t={t}
            value={dep.fullName}
            onChange={(v) => update('fullName', v)}
            placeholder="First and last name"
          />
        </div>

        <div>
          <FieldLabel t={t}>Date of birth</FieldLabel>
          <TextField
            t={t}
            value={dep.dob}
            onChange={(v) => update('dob', formatDob(v))}
            placeholder="MM / DD / YYYY"
            mono
            inputMode="numeric"
          />
        </div>

        <div>
          <FieldLabel t={t} hint="LAST 4 SHOWN">
            Social Security Number
          </FieldLabel>
          <SSNField t={t} value={dep.ssn} onChange={(v) => update('ssn', v)} />
        </div>

        <div>
          <FieldLabel t={t}>Relationship</FieldLabel>
          <TextField
            t={t}
            value={dep.relationship}
            onChange={(v) => update('relationship', v)}
            placeholder="Son, Daughter, Parent"
          />
        </div>

        <div>
          <FieldLabel t={t}>Months living with you in 2025</FieldLabel>
          <TextField
            t={t}
            value={dep.monthsLivingWith}
            onChange={(v) => update('monthsLivingWith', v.replace(/\D/g, '').slice(0, 2))}
            placeholder="12"
            mono
            inputMode="numeric"
          />
        </div>
      </Stack>
    </div>
  );
}

export default function DepsDetailPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  const [count] = usePortalState<number>('deps-count', 0);
  const target = Math.max(1, count); // at least 1 card if user landed here
  const [deps, setDeps] = usePortalState<Dependent[]>(
    'deps-detail',
    Array.from({ length: target }, () => ({ ...EMPTY_DEP })),
  );

  // Re-size the array if the user changed count on the previous screen
  if (deps.length !== target) {
    const next = Array.from({ length: target }, (_, i) => deps[i] ?? { ...EMPTY_DEP });
    setDeps(next);
  }

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
          <IntakeBackButton t={t} onClick={() => nav.back('/deps')} />
        </div>

        <div style={{ padding: '18px 24px 8px' }}>
          <Stack gap={10}>
            <H1 t={t}>Tell me about your dependents</H1>
            <Body t={t} size={15}>
              Just the basics. I&apos;ll sort out who qualifies.
            </Body>
          </Stack>
        </div>

        <Stack gap={12} style={{ padding: '22px 24px 16px', flex: 1 }}>
          {deps.map((d, i) => (
            <DependentCardDetails
              key={i}
              t={t}
              index={i + 1}
              dep={d}
              onChange={(next) => {
                const arr = [...deps];
                arr[i] = next;
                setDeps(arr);
              }}
            />
          ))}

          <div style={{ marginTop: 10 }}>
            <AntonioNote t={t}>
              If you have a child under 13 and pay for daycare, that&apos;s a big credit we don&apos;t want
              to miss — I&apos;ll ask about that next.
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
              onClick={() => nav.back('/deps')}
              style={{ flex: '0 0 auto' }}
            >
              Back
            </Button>
            <Button t={t} onClick={() => nav.next('/income')} style={{ flex: 1 }}>
              Continue
            </Button>
          </Row>
        </div>
      </div>
    </Screen>
  );
}
