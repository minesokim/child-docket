'use client';

// Intake step 7 (continued) — Self-employment detail. Conditional after /income
// when 'self' was selected. 1-to-1 port of ScreenSelfEmployment.

import {
  AntonioNote,
  AskAntonioBar,
  Body,
  Button,
  buildTheme,
  FieldLabel,
  H1,
  IconCar,
  IconCash,
  IconHome,
  IntakeBackButton,
  IntakeHeader,
  Row,
  Screen,
  Stack,
  TextField,
  ToggleCard,
} from '@docket/ui';
import { usePortalNav } from '@/lib/portal-nav';
import { usePortalState } from '@/lib/portal-state';

type SelfEmployment = {
  businessName: string;
  whatYouDo: string;
  entityType: string;
  ein: string;
  revenue: string;
  homeOffice: boolean;
  vehicle: boolean;
  cash: boolean;
};

const DEFAULT: SelfEmployment = {
  businessName: '',
  whatYouDo: '',
  entityType: '',
  ein: '',
  revenue: '',
  homeOffice: false,
  vehicle: false,
  cash: false,
};

export default function SelfEmploymentPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  const [info, setInfo] = usePortalState<SelfEmployment>('self-employment', DEFAULT);
  const [income] = usePortalState<string[]>('income-sources', []);

  const update = <K extends keyof SelfEmployment>(k: K, v: SelfEmployment[K]) =>
    setInfo({ ...info, [k]: v });

  const handleContinue = () => {
    if (income.includes('rental')) nav.next('/rental-detail');
    else nav.next('/tax-questions');
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
          <IntakeBackButton t={t} onClick={() => nav.back('/income')} />
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
            Because you&apos;re self-employed
          </span>
        </div>

        <div style={{ padding: '14px 24px 8px' }}>
          <Stack gap={10}>
            <H1 t={t}>Tell me about your self-employment</H1>
            <Body t={t} size={15}>
              This opens up lots of deductions most people miss.
            </Body>
          </Stack>
        </div>

        <Stack gap={18} style={{ padding: '22px 24px 16px', flex: 1 }}>
          <div>
            <FieldLabel t={t}>Business name</FieldLabel>
            <TextField
              t={t}
              value={info.businessName}
              onChange={(v) => update('businessName', v)}
              placeholder="e.g., Freelance Design LLC"
            />
          </div>

          <div>
            <FieldLabel t={t}>What do you do?</FieldLabel>
            <TextField
              t={t}
              value={info.whatYouDo}
              onChange={(v) => update('whatYouDo', v)}
              placeholder="e.g., Graphic design, consulting"
            />
          </div>

          <div>
            <FieldLabel t={t}>Entity type</FieldLabel>
            <TextField
              t={t}
              value={info.entityType}
              onChange={(v) => update('entityType', v)}
              placeholder="Sole Prop, LLC, S-Corp, or N/A"
            />
          </div>

          <div>
            <FieldLabel t={t}>EIN (if any)</FieldLabel>
            <TextField
              t={t}
              value={info.ein}
              onChange={(v) => update('ein', v)}
              placeholder="XX-XXXXXXX or N/A"
              mono
              inputMode="numeric"
            />
          </div>

          <div>
            <FieldLabel t={t}>Approximate 2025 revenue</FieldLabel>
            <TextField
              t={t}
              value={info.revenue}
              onChange={(v) => update('revenue', v)}
              placeholder="e.g., $50,000"
              mono
              inputMode="decimal"
            />
          </div>

          <div style={{ marginTop: 6 }}>
            <FieldLabel t={t}>Business setup</FieldLabel>
            <Stack gap={10}>
              <ToggleCard
                t={t}
                on={info.homeOffice}
                onClick={() => update('homeOffice', !info.homeOffice)}
                icon={<IconHome />}
                label="I use a home office"
                sub="Dedicated space used regularly for work"
              />
              <ToggleCard
                t={t}
                on={info.vehicle}
                onClick={() => update('vehicle', !info.vehicle)}
                icon={<IconCar />}
                label="I use a vehicle for business"
                sub="Mileage, parking, tolls for client work"
              />
            </Stack>
          </div>

          <div>
            <FieldLabel t={t} hint={info.cash ? '+$150 DOCS FEE' : undefined}>
              Documentation
            </FieldLabel>
            <ToggleCard
              t={t}
              on={info.cash}
              onClick={() => update('cash', !info.cash)}
              icon={<IconCash />}
              label="Is most of my revenue in cash?"
              sub="Cash businesses require more documentation"
              emphasis
            />
          </div>

          <div style={{ marginTop: 6 }}>
            <AntonioNote t={t}>
              Self-employment has dozens of deductions most people miss. Home office, mileage,
              equipment, health insurance, retirement contributions. We&apos;ll go through all of
              them.
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
              onClick={() => nav.back('/income')}
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
