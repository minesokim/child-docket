'use client';

// Intake step 8/13 — Tax questions. 7 multi-select yes/no toggles.
// 1-to-1 port of ScreenTaxQuestions.

import {
  AntonioNote,
  AskAntonioBar,
  Body,
  Button,
  buildTheme,
  H1,
  IconClock,
  IconReceipt,
  IconTip,
  IntakeBackButton,
  IntakeHeader,
  Row,
  Screen,
  SolarCrypto,
  SolarForeignAccounts,
  SolarHealthInsurance,
  SolarRetirement,
  Stack,
  ToggleCard,
} from '@docket/ui';
import { usePortalNav } from '@/lib/portal-nav';
import { useIntakeAnswers, useSetIntakeField } from '@/lib/intake-context';
import { getNextStep, getPrevStep } from '@/lib/intake-flow';
import type { IncomeType } from '@docket/shared';

type TaxQuestionKey =
  | 'crypto'
  | 'estimated'
  | 'healthAll'
  | 'retirement'
  | 'foreign'
  | 'overtime'
  | 'tips';

export default function TaxQuestionsPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  const answers = useIntakeAnswers();
  const setField = useSetIntakeField();

  const tq = answers.taxQuestions ?? {};
  const incomeTypes = (answers.income?.types ?? []) as IncomeType[];

  const toggle = (k: TaxQuestionKey) => {
    void setField(`taxQuestions.${k}`, !tq[k]);
  };

  const stateSnapshot = { income: { types: incomeTypes }, taxQuestions: tq };
  const handleNext = () => {
    const target = getNextStep('/tax-questions', stateSnapshot);
    if (target) nav.next(target);
  };
  const handleBack = () => {
    const target = getPrevStep('/tax-questions', stateSnapshot);
    if (target) nav.back(target);
  };

  const questions: Array<{
    k: TaxQuestionKey;
    icon: React.ReactNode;
    label: string;
    sub: string;
  }> = [
    {
      k: 'crypto',
      icon: <SolarCrypto size={28} />,
      label: 'Did you transact in digital assets?',
      sub: 'Crypto, NFTs, stablecoins — even small airdrops count',
    },
    {
      k: 'estimated',
      icon: <IconReceipt />,
      label: 'Did you make estimated tax payments?',
      sub: 'Quarterly payments to the IRS',
    },
    {
      k: 'healthAll',
      icon: <SolarHealthInsurance size={28} />,
      label: 'Did you have health insurance all year?',
      sub: 'Through employer, marketplace, or Medicare',
    },
    {
      k: 'retirement',
      icon: <SolarRetirement size={28} />,
      label: 'Did you contribute to an IRA or HSA?',
      sub: 'Traditional IRA, Roth IRA, or Health Savings Account',
    },
    {
      k: 'foreign',
      icon: <SolarForeignAccounts size={28} />,
      label: 'Do you have foreign bank accounts or assets over $10,000?',
      sub: 'At any point in 2025 — triggers FBAR reporting',
    },
    {
      k: 'overtime',
      icon: <IconClock />,
      label: 'Did you earn overtime pay?',
      sub: 'New 2025 deduction — triggers paystub request',
    },
    {
      k: 'tips',
      icon: <IconTip />,
      label: 'Did you earn tips at work?',
      sub: 'New 2025 deduction — triggers tip summary request',
    },
  ];

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
        <IntakeHeader t={t} step={8} label="Tax questions" />

        <div style={{ padding: '22px 24px 0' }}>
          <IntakeBackButton t={t} onClick={handleBack} />
        </div>

        <div style={{ padding: '18px 24px 8px' }}>
          <Stack gap={16}>
            <Stack gap={10}>
              <H1 t={t}>A few quick tax questions</H1>
              <Body t={t} size={15}>
                These help me plan your return before we even meet.
              </Body>
            </Stack>
            <AntonioNote t={t}>
              The digital assets question is on the front page of the 1040 now. The IRS is watching this closely. Foreign accounts and crypto are audit magnets — better to disclose than hide.
            </AntonioNote>
          </Stack>
        </div>

        <Stack gap={10} style={{ padding: '22px 24px 16px', flex: 1 }}>
          {questions.map((q) => (
            <ToggleCard
              key={q.k}
              t={t}
              on={!!tq[q.k]}
              onClick={() => toggle(q.k)}
              icon={q.icon}
              label={q.label}
              sub={q.sub}
            />
          ))}

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
            <Button t={t} variant="ghost" onClick={handleBack} style={{ flex: '0 0 auto' }}>
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
