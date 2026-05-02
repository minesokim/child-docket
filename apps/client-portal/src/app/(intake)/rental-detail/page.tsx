'use client';

// Intake step 7 (continued) - Rental property detail. MIGRATED to
// Postgres-backed state via useIntakeAnswers + useSetIntakeField.
// First property only at v0; v1+ supports multiple.

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
  RadioRowCard,
  Row,
  Screen,
  Stack,
  TextField,
} from '@docket/ui';
import { usePortalNav } from '@/lib/portal-nav';
import { useIntakeAnswers, useSetIntakeField } from '@/lib/intake-context';
import { getNextStep, getPrevStep } from '@/lib/intake-flow';
import { IntakeContinueButton } from '@/components/intake-continue-button';
import { formatDigits, formatMoney, formatYear } from '@docket/shared';
import type { IntakeRentalProperty } from '@docket/shared';

type RentalType = NonNullable<IntakeRentalProperty['rentalType']>;

const TYPES: Array<{ id: RentalType; label: string; sub: string }> = [
  { id: 'long', label: 'Long-term rental', sub: 'Lease over 1 month · Standard tenant, Schedule E' },
  {
    id: 'short',
    label: 'Short-term rental',
    sub: 'Airbnb, Vrbo, avg stay under 7 days · Schedule C, self-employment tax applies',
  },
  {
    id: 'commercial',
    label: 'Commercial property',
    sub: 'Apartment complex, retail, office · Different depreciation rules',
  },
  { id: 'mixed', label: 'Mixed-use', sub: 'Partly personal, partly rented · Requires allocation' },
];

export default function RentalDetailPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  const answers = useIntakeAnswers();
  const setField = useSetIntakeField();

  // First property only at v0. The properties array can hold many; the UI
  // collects one. Default to a long-term rental so the radio is pre-picked
  // (the user almost always picks long-term for residential).
  const property = answers.rental?.properties?.[0] ?? {};
  const rentalType: RentalType = property.rentalType ?? 'long';

  const update = <K extends keyof IntakeRentalProperty>(
    field: K,
    value: IntakeRentalProperty[K],
  ) => {
    void setField(`rental.properties.0.${field}`, value);
  };

  const stateSnapshot = { income: { types: answers.income?.types ?? [] } };
  const handleNext = () => {
    const target = getNextStep('/rental-detail', stateSnapshot);
    if (target) nav.next(target);
  };
  const handleBack = () => {
    const target = getPrevStep('/rental-detail', stateSnapshot);
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
        <IntakeHeader t={t} step={7} label="Rental" />

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
            You selected rental property
          </span>
        </div>

        <div style={{ padding: '14px 24px 8px' }}>
          <Stack gap={16}>
            <Stack gap={10}>
              <H1 t={t}>Tell me about your rental property</H1>
              <Body t={t} size={15}>
                Rental income has its own deductions and depreciation rules.
              </Body>
            </Stack>
            <AntonioNote t={t}>
              Rental properties are one of the best tax advantages. Depreciation, repairs, insurance, mortgage interest - we&apos;ll capture everything. I&apos;ll also verify your depreciation schedule, since IRS Section 167 requires it.
            </AntonioNote>
          </Stack>
        </div>

        <Stack gap={22} style={{ padding: '22px 24px 16px', flex: 1 }}>
          <div>
            <FieldLabel t={t}>What kind of rental is this?</FieldLabel>
            <Stack gap={8}>
              {TYPES.map((tp) => (
                <RadioRowCard
                  key={tp.id}
                  t={t}
                  selected={rentalType === tp.id}
                  onClick={() => update('rentalType', tp.id)}
                  label={tp.label}
                  sub={tp.sub}
                />
              ))}
            </Stack>
          </div>

          <div
            style={{
              background: '#fffefc',
              boxShadow: '0 2px 10px rgba(15, 62, 23, 0.06)',
              borderRadius: t.radius,
              padding: '16px 16px 18px',
            }}
          >
            <div
              style={{
                fontFamily: t.serif,
                fontSize: 16,
                color: t.ease.forestDark,
                letterSpacing: -0.48,
                marginBottom: 14,
              }}
            >
              Property Details
            </div>

            <Stack gap={16}>
              <div>
                <FieldLabel t={t}>Property address</FieldLabel>
                <TextField
                  t={t}
                  value={property.address ?? ''}
                  onChange={(v) => update('address', v)}
                  placeholder="Street, city, state"
                />
              </div>
              <Row gap={10}>
                <div style={{ flex: 1 }}>
                  <FieldLabel t={t}>Monthly rent</FieldLabel>
                  <TextField
                    t={t}
                    value={property.monthlyRent ?? ''}
                    onChange={(v) => update('monthlyRent', formatMoney(v))}
                    placeholder="$0"
                    mono
                    inputMode="numeric"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <FieldLabel t={t}>Monthly mortgage</FieldLabel>
                  <TextField
                    t={t}
                    value={property.monthlyMortgage ?? ''}
                    onChange={(v) => update('monthlyMortgage', formatMoney(v))}
                    placeholder="$0"
                    mono
                    inputMode="numeric"
                  />
                </div>
              </Row>
              <Row gap={10}>
                <div style={{ flex: 1 }}>
                  <FieldLabel t={t}>Year acquired</FieldLabel>
                  <TextField
                    t={t}
                    value={property.yearAcquired ?? ''}
                    onChange={(v) => update('yearAcquired', formatYear(v))}
                    placeholder="2020"
                    mono
                    inputMode="numeric"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <FieldLabel t={t}>How many rentals?</FieldLabel>
                  <TextField
                    t={t}
                    value={property.rentalCount ?? ''}
                    onChange={(v) => update('rentalCount', formatDigits(v, 3))}
                    placeholder="1"
                    mono
                    inputMode="numeric"
                  />
                </div>
              </Row>
            </Stack>
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
            <IntakeContinueButton t={t} route="/rental-detail" onClick={handleNext} style={{ flex: 1 }}>
              Continue
            </IntakeContinueButton>
          </Row>
        </div>
      </div>
    </Screen>
  );
}
