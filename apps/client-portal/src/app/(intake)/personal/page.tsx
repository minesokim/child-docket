'use client';

// Intake step 2/13 — Personal info. 1-to-1 port of ScreenPersonalInfo.

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
import { usePortalNav } from '@/lib/portal-nav';
import { usePortalState } from '@/lib/portal-state';

type PersonalInfo = {
  fullName: string;
  dob: string;
  ssn: string;
  phone: string;
  email: string;
  occupation: string;
  street: string;
  city: string;
  state: string;
  zip: string;
};

const DEFAULT: PersonalInfo = {
  fullName: '',
  dob: '',
  ssn: '',
  phone: '',
  email: '',
  occupation: '',
  street: '',
  city: '',
  state: '',
  zip: '',
};

function formatDob(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)} / ${d.slice(2)}`;
  return `${d.slice(0, 2)} / ${d.slice(2, 4)} / ${d.slice(4)}`;
}

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export default function PersonalPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  const [info, setInfo] = usePortalState<PersonalInfo>('personal', DEFAULT);
  const update = <K extends keyof PersonalInfo>(k: K, v: PersonalInfo[K]) =>
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
        <IntakeHeader t={t} step={2} label="Personal" />

        <div style={{ padding: '22px 24px 0' }}>
          <IntakeBackButton t={t} onClick={() => nav.back('/services-addons')} />
        </div>

        <div style={{ padding: '18px 24px 8px' }}>
          <Stack gap={10}>
            <H1 t={t}>Your basic information</H1>
            <Body t={t} size={15}>
              This goes directly onto your return.
            </Body>
          </Stack>
        </div>

        <Stack gap={18} style={{ padding: '22px 24px 16px', flex: 1 }}>
          <div>
            <FieldLabel t={t}>Full legal name</FieldLabel>
            <TextField
              t={t}
              value={info.fullName}
              onChange={(v) => update('fullName', v)}
              placeholder="First Middle Last"
              autoComplete="name"
            />
          </div>

          <div>
            <FieldLabel t={t}>Date of birth</FieldLabel>
            <TextField
              t={t}
              value={info.dob}
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
            <SSNField t={t} value={info.ssn} onChange={(v) => update('ssn', v)} />
          </div>

          <div>
            <FieldLabel t={t}>Phone number</FieldLabel>
            <TextField
              t={t}
              value={info.phone}
              onChange={(v) => update('phone', formatPhone(v))}
              placeholder="(555) 555-5555"
              mono
              inputMode="tel"
              type="tel"
              autoComplete="tel"
            />
          </div>

          <div>
            <FieldLabel t={t}>Email</FieldLabel>
            <TextField
              t={t}
              value={info.email}
              onChange={(v) => update('email', v)}
              placeholder="you@example.com"
              type="email"
              inputMode="email"
              autoComplete="email"
            />
          </div>

          <div>
            <FieldLabel t={t}>Occupation</FieldLabel>
            <TextField
              t={t}
              value={info.occupation}
              onChange={(v) => update('occupation', v)}
              placeholder="What do you do?"
            />
          </div>

          <div
            style={{
              marginTop: 14,
              padding: '20px 18px 4px',
              background: t.card,
              border: `1px solid ${t.borderSoft}`,
              borderRadius: t.radius,
            }}
          >
            <div
              style={{
                fontFamily: t.serif,
                fontSize: 15,
                color: t.ink,
                letterSpacing: -0.2,
                marginBottom: 4,
              }}
            >
              Home address
            </div>
            <div style={{ fontSize: 12, color: t.muted, marginBottom: 16 }}>
              Where you lived most of the tax year
            </div>

            <div>
              <FieldLabel t={t}>Street address</FieldLabel>
              <TextField
                t={t}
                value={info.street}
                onChange={(v) => update('street', v)}
                placeholder="Street address"
                autoComplete="address-line1"
              />
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <div style={{ flex: 2, minWidth: 0 }}>
                <FieldLabel t={t}>City</FieldLabel>
                <TextField
                  t={t}
                  value={info.city}
                  onChange={(v) => update('city', v)}
                  placeholder="City"
                  autoComplete="address-level2"
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <FieldLabel t={t}>State</FieldLabel>
                <TextField
                  t={t}
                  value={info.state}
                  onChange={(v) => update('state', v.toUpperCase().slice(0, 2))}
                  placeholder="CA"
                  mono
                  style={{ textTransform: 'uppercase', letterSpacing: 1 }}
                  autoComplete="address-level1"
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <FieldLabel t={t}>ZIP</FieldLabel>
                <TextField
                  t={t}
                  value={info.zip}
                  onChange={(v) => update('zip', v.replace(/\D/g, '').slice(0, 5))}
                  placeholder="00000"
                  mono
                  inputMode="numeric"
                  autoComplete="postal-code"
                />
              </div>
            </div>
          </div>

          <div style={{ marginTop: 6 }}>
            <AntonioNote t={t}>
              Your SSN is encrypted the moment you type it. I only see the last 4 digits until I&apos;m
              actively preparing your return.
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
            <Button t={t} onClick={() => nav.next('/state')} style={{ flex: 1 }}>
              Continue
            </Button>
          </Row>
        </div>
      </div>
    </Screen>
  );
}
