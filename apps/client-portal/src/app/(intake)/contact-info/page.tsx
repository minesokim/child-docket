'use client';

// Intake step 2 - Contact info. Sits at the TOP of the flow, right
// after /tutorial. Captures name + email up front so Antonio has
// reachable identity from the very first step.
//
// Phone is intentionally NOT collected here - Clerk already has it
// from the OTP login. DOB is collected later in /personal alongside
// SSN and address.

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
import { useIntakeAnswers, useIntakeField, useIntakeStepNumber } from '@/lib/intake-context';
import { getNextStep } from '@/lib/intake-flow';
import { IntakeContinueButton } from '@/components/intake-continue-button';

export default function ContactInfoPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  const answers = useIntakeAnswers();

  const [fullName, setFullName] = useIntakeField<string>('personal.fullName', '');
  const [email, setEmail] = useIntakeField<string>('personal.email', '');

  const handleNext = () => {
    const target = getNextStep('/contact-info', answers);
    if (target) nav.next(target);
  };
  // Back from contact-info ALWAYS returns to /tutorial since this is
  // now the second step in the flow (welcome → tutorial → contact-info).
  const handleBack = () => {
    nav.back('/tutorial');
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
        <IntakeHeader t={t} {...useIntakeStepNumber('/contact-info')} label="Contact" />

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
            <FieldLabel t={t}>Full legal name</FieldLabel>
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
            <IntakeContinueButton t={t} route="/contact-info" onClick={handleNext} style={{ flex: 1 }}>
              Continue
            </IntakeContinueButton>
          </Row>
        </div>
      </div>
    </Screen>
  );
}
