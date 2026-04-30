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
  IconCrypto,
  IconGlobe,
  IconHeart,
  IconPiggy,
  IconReceipt,
  IconTip,
  IntakeBackButton,
  IntakeHeader,
  Row,
  Screen,
  Stack,
  ToggleCard,
} from '@docket/ui';
import { usePortalNav } from '@/lib/portal-nav';
import { usePortalState } from '@/lib/portal-state';

type TaxQuestions = {
  crypto: boolean;
  estimated: boolean;
  healthAll: boolean;
  retirement: boolean;
  foreign: boolean;
  overtime: boolean;
  tips: boolean;
};

const DEFAULT: TaxQuestions = {
  crypto: false,
  estimated: false,
  healthAll: false,
  retirement: false,
  foreign: false,
  overtime: false,
  tips: false,
};

export default function TaxQuestionsPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  const [state, setState] = usePortalState<TaxQuestions>('tax-questions', DEFAULT);
  const [income] = usePortalState<string[]>('income-sources', []);
  const toggle = (k: keyof TaxQuestions) => setState({ ...state, [k]: !state[k] });

  // Back: rental → SE → income (whichever exists)
  const backTarget = income.includes('rental')
    ? '/rental-detail'
    : income.includes('self')
      ? '/self-employment'
      : '/income';

  const questions: Array<{
    k: keyof TaxQuestions;
    icon: React.ReactNode;
    label: string;
    sub: string;
    emphasis?: boolean;
  }> = [
    {
      k: 'crypto',
      icon: <IconCrypto />,
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
      icon: <IconHeart />,
      label: 'Did you have health insurance all year?',
      sub: 'Through employer, marketplace, or Medicare',
    },
    {
      k: 'retirement',
      icon: <IconPiggy />,
      label: 'Did you contribute to an IRA or HSA?',
      sub: 'Traditional IRA, Roth IRA, or Health Savings Account',
    },
    {
      k: 'foreign',
      icon: <IconGlobe />,
      label: 'Do you have foreign bank accounts or assets over $10,000?',
      sub: 'At any point in 2025 — triggers FBAR reporting',
      emphasis: true,
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
          <IntakeBackButton t={t} onClick={() => nav.back(backTarget)} />
        </div>

        <div style={{ padding: '18px 24px 8px' }}>
          <Stack gap={10}>
            <H1 t={t}>A few quick tax questions</H1>
            <Body t={t} size={15}>
              These help me plan your return before we even meet.
            </Body>
          </Stack>
        </div>

        <Stack gap={10} style={{ padding: '22px 24px 16px', flex: 1 }}>
          {questions.map((q) => (
            <ToggleCard
              key={q.k}
              t={t}
              on={state[q.k]}
              onClick={() => toggle(q.k)}
              icon={q.icon}
              label={q.label}
              sub={q.sub}
              emphasis={q.emphasis}
            />
          ))}

          <div style={{ marginTop: 10 }}>
            <AntonioNote t={t}>
              The digital assets question is on the front page of the 1040 now. The IRS is watching
              this closely. Foreign accounts and crypto are audit magnets — better to disclose than
              hide.
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
              onClick={() => nav.back(backTarget)}
              style={{ flex: '0 0 auto' }}
            >
              Back
            </Button>
            <Button t={t} onClick={() => nav.next('/deductions')} style={{ flex: 1 }}>
              Continue
            </Button>
          </Row>
        </div>
      </div>
    </Screen>
  );
}
