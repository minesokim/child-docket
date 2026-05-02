'use client';

// Intake step 7/13 - Income sources. Multi-select. Conditional routing:
// "self" → /self-employment, else "rental" → /rental-detail, else /tax-questions.
// 1-to-1 port of ScreenIncomeSources.

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
  SolarW2Wages,
  SolarSelfEmploymentIncome,
  SolarRentalProperty,
  SolarDividends,
  SolarRetirement,
  Stack,
} from '@docket/ui';
import { usePortalNav } from '@/lib/portal-nav';
import { useIntakeField } from '@/lib/intake-context';
import { getNextStep, getPrevStep } from '@/lib/intake-flow';
import type { IncomeType } from '@docket/shared';

type IncomeId = IncomeType;

type Option = {
  id: IncomeId;
  name: string;
  sub: string;
  Icon: React.ComponentType<{ size?: number }>;
};

const OPTIONS: Option[] = [
  { id: 'w2', name: 'W-2 Employee', sub: 'Regular paycheck from an employer', Icon: SolarW2Wages },
  { id: 'self', name: 'Self-Employed / 1099', sub: 'Freelance, gig work, contracting', Icon: SolarSelfEmploymentIncome },
  { id: 'rental', name: 'Rental Property', sub: 'Income from property you own', Icon: SolarRentalProperty },
  { id: 'invest', name: 'Investments / Crypto', sub: 'Stocks, crypto, capital gains', Icon: SolarDividends },
  { id: 'retire', name: 'Retirement / Social Security', sub: 'Pension, IRA distributions, SSA', Icon: SolarRetirement },
];

export default function IncomePage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  const [sel, setSel] = useIntakeField<IncomeId[]>('income.types', []);
  // For back-nav, we need to know if dependents.count > 0 (deps-detail
  // applies) so getPrevStep can decide where to bounce back to.
  const [depsCount] = useIntakeField<number>('dependents.count', 0);

  const toggle = (id: IncomeId) => {
    void setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  };

  const canContinue = sel.length > 0;

  // Branching (self → /self-employment, rental → /rental-detail, else →
  // /tax-questions) lives in intake-flow.ts. Adding a new income type that
  // requires its own detail page = edit one file, not three.
  const stateSnapshot = { income: { types: sel }, dependents: { count: depsCount } };
  const handleContinue = () => {
    const target = getNextStep('/income', stateSnapshot);
    if (target) nav.next(target);
  };
  const handleBack = () => {
    const target = getPrevStep('/income', stateSnapshot);
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
        <IntakeHeader t={t} step={7} label="Income" />

        <div style={{ padding: '32px 24px 8px' }}>
          <Row gap={10} align="center" style={{ marginBottom: 18 }}>
            <IntakeBackButton t={t} onClick={handleBack} />
          </Row>
          <Stack gap={16}>
            <Stack gap={10}>
              <H1 t={t}>How do you earn income?</H1>
              <Body t={t} size={15}>
                Select all that apply.
              </Body>
            </Stack>
            <AntonioNote t={t}>
              Don&apos;t overthink this. If you got paid for it, select it. I&apos;ll sort out the forms.
            </AntonioNote>
          </Stack>
        </div>

        <Stack gap={10} style={{ padding: '20px 24px 16px', flex: 1 }}>
          {OPTIONS.map((o) => {
            const on = sel.includes(o.id);
            const Icon = o.Icon;
            return (
              <div
                key={o.id}
                onClick={() => toggle(o.id)}
                style={{
                  background: on ? t.ease.mintKiss : '#fffefc',
                  borderRadius: t.radius,
                  padding: '14px 16px',
                  cursor: 'pointer',
                  boxShadow: on
                    ? '0 4px 16px rgba(15, 62, 23, 0.08)'
                    : '0 1px 4px rgba(15, 62, 23, 0.04)',
                  transition: 'background 720ms cubic-bezier(.19, 1, .22, 1), box-shadow 540ms cubic-bezier(.19, 1, .22, 1)',
                }}
              >
                <Row gap={16} align="center">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={48} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: t.ink, marginBottom: 2, letterSpacing: -0.1 }}>
                      {o.name}
                    </div>
                    <div style={{ fontSize: 12, color: t.muted, lineHeight: 1.4 }}>{o.sub}</div>
                  </div>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 5,
                      background: on ? t.ease.forestMid : t.ease.softNeutral,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 140ms',
                    }}
                  >
                    {on && (
                      <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                        <path
                          d="M1 4.5l2.8 2.8L10 1"
                          stroke="#fff"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                </Row>
              </div>
            );
          })}

        </Stack>

        <div
          style={{
            position: 'sticky',
            bottom: 0,
            background: `linear-gradient(to top, ${t.bg} 75%, transparent)`,
            padding: '18px 24px 28px',
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
            <Button
              t={t}
              onClick={handleContinue}
              disabled={!canContinue}
              style={{ flex: 1, opacity: canContinue ? 1 : 0.45 }}
            >
              Continue
            </Button>
          </Row>
        </div>
      </div>
    </Screen>
  );
}
