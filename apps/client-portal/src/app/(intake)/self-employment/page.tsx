'use client';

// Intake step 7 (continued) - Self-employment detail. Conditional after /income
// when 'self' was selected. 1-to-1 port of ScreenSelfEmployment.

import {
  AntonioNote,
  AskAntonioBar,
  Body,
  Button,
  buildTheme,
  EncryptedTextField,
  FieldLabel,
  H1,
  IconCar,
  IconCash,
  IconHome,
  IntakeBackButton,
  IntakeHeader,
  Row,
  Screen,
  SolarBusinessName,
  SolarExpenses,
  SolarOccupation,
  Stack,
  TextField,
  ToggleCard,
} from '@docket/ui';
import { usePortalNav } from '@/lib/portal-nav';
import { useFieldReveal, useIntakeField } from '@/lib/intake-context';
import { formatEin, formatMoney } from '@docket/shared';
import { getNextStep, getPrevStep } from '@/lib/intake-flow';
import type { IncomeType } from '@docket/shared';

export default function SelfEmploymentPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();

  const [businessName, setBusinessName] = useIntakeField<string>(
    'selfEmployment.businessName',
    '',
  );
  const [whatYouDo, setWhatYouDo] = useIntakeField<string>('selfEmployment.whatYouDo', '');
  const [entityType, setEntityType] = useIntakeField<string>('selfEmployment.entityType', '');
  const [ein, setEin] = useIntakeField<string>('selfEmployment.ein', '');
  const revealEin = useFieldReveal('selfEmployment.ein');
  const [revenue, setRevenue] = useIntakeField<string>('selfEmployment.revenue', '');
  const [homeOffice, setHomeOffice] = useIntakeField<boolean>(
    'selfEmployment.homeOffice',
    false,
  );
  const [vehicle, setVehicle] = useIntakeField<boolean>('selfEmployment.vehicle', false);
  const [cash, setCash] = useIntakeField<boolean>('selfEmployment.cash', false);
  const [income] = useIntakeField<IncomeType[]>('income.types', []);

  // Branch: rental in selection → /rental-detail next, else → /tax-questions.
  // Logic in intake-flow.ts. Adding a third detail page (e.g. crypto) means
  // editing one file, not two.
  const stateSnapshot = { income: { types: income } };
  const handleContinue = () => {
    const target = getNextStep('/self-employment', stateSnapshot);
    if (target) nav.next(target);
  };
  const handleBack = () => {
    const target = getPrevStep('/self-employment', stateSnapshot);
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
        <IntakeHeader t={t} step={7} label="Self-employment" />

        <div style={{ padding: '22px 24px 0' }}>
          <IntakeBackButton t={t} onClick={handleBack} />
        </div>

        <div style={{ padding: '18px 24px 0' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 10px',
              background: t.ease.keylimeWash,
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
            Because you&apos;re self-employed
          </span>
        </div>

        <div style={{ padding: '14px 24px 8px' }}>
          <Stack gap={16}>
            <Stack gap={10}>
              <H1 t={t}>Tell me about your self-employment</H1>
              <Body t={t} size={15}>
                This opens up lots of deductions most people miss.
              </Body>
            </Stack>
            <AntonioNote t={t}>
              Self-employment has dozens of deductions most people miss. Home office, mileage, equipment, health insurance, retirement contributions. We&apos;ll go through all of them.
            </AntonioNote>
          </Stack>
        </div>

        <Stack gap={18} style={{ padding: '22px 24px 16px', flex: 1 }}>
          <div>
            <FieldLabel t={t} icon={<SolarBusinessName size={20} />}>
              Business name
            </FieldLabel>
            <TextField
              t={t}
              value={businessName}
              onChange={(v) => void setBusinessName(v)}
              placeholder="e.g., Freelance Design LLC"
            />
          </div>

          <div>
            <FieldLabel t={t} icon={<SolarOccupation size={20} />}>
              What do you do?
            </FieldLabel>
            <TextField
              t={t}
              value={whatYouDo}
              onChange={(v) => void setWhatYouDo(v)}
              placeholder="e.g., Graphic design, consulting"
            />
          </div>

          <div>
            <FieldLabel t={t}>Entity type</FieldLabel>
            <TextField
              t={t}
              value={entityType}
              onChange={(v) => void setEntityType(v)}
              placeholder="Sole Prop, LLC, S-Corp, or N/A"
            />
          </div>

          <div>
            <FieldLabel t={t}>EIN (if any)</FieldLabel>
            <EncryptedTextField
              t={t}
              value={ein}
              onChange={(v) => void setEin(formatEin(v))}
              onReveal={revealEin}
              placeholder="XX-XXXXXXX or N/A"
              mono
              inputMode="numeric"
            />
          </div>

          <div>
            <FieldLabel t={t} icon={<SolarExpenses size={20} />}>
              Approximate 2025 revenue
            </FieldLabel>
            <TextField
              t={t}
              value={revenue}
              onChange={(v) => void setRevenue(formatMoney(v))}
              placeholder="e.g., $50,000"
              mono
              inputMode="numeric"
            />
          </div>

          <div style={{ marginTop: 6 }}>
            <FieldLabel t={t}>Business setup</FieldLabel>
            <Stack gap={10}>
              <ToggleCard
                t={t}
                on={homeOffice}
                onClick={() => void setHomeOffice(!homeOffice)}
                icon={<IconHome size={36} />}
                label="I use a home office"
                sub="Dedicated space used regularly for work"
              />
              <ToggleCard
                t={t}
                on={vehicle}
                onClick={() => void setVehicle(!vehicle)}
                icon={<IconCar size={36} />}
                label="I use a vehicle for business"
                sub="Mileage, parking, tolls for client work"
              />
            </Stack>
          </div>

          <div>
            <FieldLabel t={t} hint={cash ? '+$150 DOCS FEE' : undefined}>
              Documentation
            </FieldLabel>
            <ToggleCard
              t={t}
              on={cash}
              onClick={() => void setCash(!cash)}
              icon={<IconCash size={36} />}
              label="Is most of my revenue in cash?"
              sub="Cash businesses require more documentation"
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
            <Button t={t} onClick={handleContinue} style={{ flex: 1 }}>
              Continue
            </Button>
          </Row>
        </div>
      </div>
    </Screen>
  );
}
