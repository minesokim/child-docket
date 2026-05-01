'use client';

// Intake terminal — Contact Info. Shared by non-tax service paths
// (intro consult, bookkeeping, formation, strategic). Precedes /appt.
// 1-to-1 port of ScreenContactInfo.

import {
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
import { usePortalNav } from '@/lib/portal-nav';
import { useIntakeField } from '@/lib/intake-context';
import { getNextStep, getPrevStep } from '@/lib/intake-flow';

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export default function ContactInfoPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();

  // All three already collected earlier (quick-start + Clerk OTP). This
  // page is the final confirmation/edit step before scheduling.
  const [fullName, setFullName] = useIntakeField<string>('personal.fullName', '');
  const [email, setEmail] = useIntakeField<string>('personal.email', '');
  const [phone, setPhone] = useIntakeField<string>('personal.phone', '');

  const handleNext = () => {
    const target = getNextStep('/contact-info', {});
    if (target) nav.next(target);
  };
  const handleBack = () => {
    const target = getPrevStep('/contact-info', {});
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
        <IntakeHeader t={t} step={3} label="Contact" />

        <div style={{ padding: '22px 24px 0' }}>
          <IntakeBackButton t={t} onClick={handleBack} />
        </div>

        <div style={{ padding: '20px 24px 8px' }}>
          <Stack gap={10}>
            <H1 t={t}>Your contact information</H1>
            <Body t={t} size={15}>
              So Antonio can reach you.
            </Body>
          </Stack>
        </div>

        <Stack gap={20} style={{ padding: '28px 24px 16px', flex: 1 }}>
          <div>
            <FieldLabel t={t}>Full name</FieldLabel>
            <TextField
              t={t}
              value={fullName}
              onChange={(v) => setFullName(v)}
              placeholder="First Middle Last"
              autoComplete="name"
            />
          </div>

          <div>
            <FieldLabel t={t}>Email</FieldLabel>
            <TextField
              t={t}
              value={email}
              onChange={(v) => setEmail(v)}
              placeholder="you@example.com"
              type="email"
              inputMode="email"
              autoComplete="email"
            />
          </div>

          <div>
            <FieldLabel t={t}>Phone</FieldLabel>
            <TextField
              t={t}
              value={phone}
              onChange={(v) => setPhone(formatPhone(v))}
              mono
              placeholder="(415) 555-0134"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
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
