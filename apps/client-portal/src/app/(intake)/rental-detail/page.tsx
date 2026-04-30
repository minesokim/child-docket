'use client';

// Intake step 7 (continued) — Rental property detail. Conditional after /income
// when 'rental' was selected. 1-to-1 port of ScreenRentalDetail.

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
import { usePortalState } from '@/lib/portal-state';

type RentalType = 'long' | 'short' | 'commercial' | 'mixed';

type RentalDetail = {
  rentalType: RentalType;
  address: string;
  monthlyRent: string;
  monthlyMortgage: string;
  yearAcquired: string;
  rentalCount: string;
};

const DEFAULT: RentalDetail = {
  rentalType: 'long',
  address: '',
  monthlyRent: '',
  monthlyMortgage: '',
  yearAcquired: '',
  rentalCount: '',
};

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
  const [info, setInfo] = usePortalState<RentalDetail>('rental-detail', DEFAULT);
  const update = <K extends keyof RentalDetail>(k: K, v: RentalDetail[K]) =>
    setInfo({ ...info, [k]: v });

  // Back goes to /self-employment if SE was also selected, else /income
  const [income] = usePortalState<string[]>('income-sources', []);
  const backTarget = income.includes('self') ? '/self-employment' : '/income';

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
          <IntakeBackButton t={t} onClick={() => nav.back(backTarget)} />
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
            You selected rental property
          </span>
        </div>

        <div style={{ padding: '14px 24px 8px' }}>
          <Stack gap={10}>
            <H1 t={t}>Tell me about your rental property</H1>
            <Body t={t} size={15}>
              Rental income has its own deductions and depreciation rules.
            </Body>
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
                  selected={info.rentalType === tp.id}
                  onClick={() => update('rentalType', tp.id)}
                  label={tp.label}
                  sub={tp.sub}
                />
              ))}
            </Stack>
          </div>

          <div
            style={{
              background: t.card,
              border: `1px solid ${t.border}`,
              borderRadius: t.radius,
              padding: '16px 16px 18px',
            }}
          >
            <div
              style={{
                fontFamily: t.serif,
                fontStyle: 'italic',
                fontSize: 14,
                color: t.rustInk,
                marginBottom: 14,
              }}
            >
              Property details
            </div>

            <Stack gap={16}>
              <div>
                <FieldLabel t={t}>Property address</FieldLabel>
                <TextField
                  t={t}
                  value={info.address}
                  onChange={(v) => update('address', v)}
                  placeholder="Street, city, state"
                />
              </div>
              <Row gap={10}>
                <div style={{ flex: 1 }}>
                  <FieldLabel t={t}>Monthly rent</FieldLabel>
                  <TextField
                    t={t}
                    value={info.monthlyRent}
                    onChange={(v) => update('monthlyRent', v)}
                    placeholder="$0"
                    mono
                    inputMode="numeric"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <FieldLabel t={t}>Monthly mortgage</FieldLabel>
                  <TextField
                    t={t}
                    value={info.monthlyMortgage}
                    onChange={(v) => update('monthlyMortgage', v)}
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
                    value={info.yearAcquired}
                    onChange={(v) => update('yearAcquired', v.replace(/\D/g, '').slice(0, 4))}
                    placeholder="2020"
                    mono
                    inputMode="numeric"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <FieldLabel t={t}>How many rentals?</FieldLabel>
                  <TextField
                    t={t}
                    value={info.rentalCount}
                    onChange={(v) => update('rentalCount', v.replace(/\D/g, '').slice(0, 3))}
                    placeholder="1"
                    mono
                    inputMode="numeric"
                  />
                </div>
              </Row>
            </Stack>
          </div>

          <AntonioNote t={t}>
            Rental properties are one of the best tax advantages. Depreciation, repairs, insurance,
            mortgage interest — we&apos;ll capture everything. I&apos;ll also verify your
            depreciation schedule, since IRS Section 167 requires it.
          </AntonioNote>
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
              onClick={() => nav.back(backTarget)}
              style={{ flex: '0 0 auto' }}
            >
              Back
            </Button>
            <Button t={t} onClick={() => nav.next('/tax-questions')} style={{ flex: 1 }}>
              Continue
            </Button>
          </Row>
        </div>
      </div>
    </Screen>
  );
}
