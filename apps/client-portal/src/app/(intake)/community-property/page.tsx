'use client';

// Intake step — MFS in community property state (Form 8958 surface).
//
// Fires only when filing.status === 'mfs' AND state.primaryState is
// one of the nine mandatory community property states (AZ CA ID LA
// NV NM TX WA WI). IRS Pub 555 / §66 require Form 8958 to allocate
// community income between separately-filing spouses.
//
// Antonio's call (5/14) on this: California is his #1 community
// property surface. Clients file MFS thinking it's a simple "we file
// separately because we're separated" — and miss the §66 allocation
// requirement entirely. The intake catches it.
//
// SCOPE
//   The actual Form 8958 line-item allocation (wages, interest,
//   dividends, SE income, deductions, withholding) happens in
//   command-room when Antonio walks the client through the prep
//   call. This page just captures three signals he needs to start:
//   - Acknowledgment that 8958 will be needed (so they're not
//     surprised at filing)
//   - Finance shape (drives §66(c) spousal-relief conversation)
//   - Lived-apart-all-year (drives community-vs-separate income
//     classification for the year + §66(c) applicability)
//
// L9 compliance: no AI-attribution language. Reads as a thoughtful
// preparer-led question pass, not a system check.

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
import { taxYearForDate } from '@docket/shared';
import { usePortalNav } from '@/lib/portal-nav';
import { useIntakeAnswers, useIntakeField } from '@/lib/intake-context';
import { getNextStep, getPrevStep } from '@/lib/intake-flow';
import { IntakeContinueButton } from '@/components/intake-continue-button';

type FinanceShape =
  | 'fully_separate'
  | 'mostly_separate'
  | 'mostly_joint'
  | 'fully_joint'
  | '';

type Tri = 'yes' | 'no' | 'not_sure' | '';

const FINANCE_OPTIONS: Array<{ id: FinanceShape; label: string; sub: string }> = [
  {
    id: 'fully_separate',
    label: 'Fully separate',
    sub: 'Separate bank accounts, separate paychecks, no shared finances',
  },
  {
    id: 'mostly_separate',
    label: 'Mostly separate',
    sub: 'Separate primary accounts; occasional shared expenses or transfers',
  },
  {
    id: 'mostly_joint',
    label: 'Mostly joint',
    sub: 'Joint accounts and shared income, but filing separately this year',
  },
  {
    id: 'fully_joint',
    label: 'Fully joint',
    sub: 'Everything is joint; filing separately by election only',
  },
];

export default function CommunityPropertyPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  // The active tax year for the intake — derived, never hardcoded.
  // taxYearForDate honors Pacific timezone + the Jan-Oct-prior-year
  // rule (so a May 2026 intake captures 2025 returns). Codex caught
  // a hardcoded "2025" in copy 2026-05-14.
  const taxYear = taxYearForDate(new Date());

  const [acknowledged, setAcknowledged] = useIntakeField<boolean>(
    'mfsCommunityProperty.acknowledged',
    false,
  );
  const [financeShape, setFinanceShape] = useIntakeField<FinanceShape>(
    'mfsCommunityProperty.financeShape',
    '',
  );
  const [livedApart, setLivedApart] = useIntakeField<Tri>(
    'mfsCommunityProperty.livedApartAllYear',
    '',
  );
  const [notes, setNotes] = useIntakeField<string>(
    'mfsCommunityProperty.notes',
    '',
  );

  const answers = useIntakeAnswers();
  const handleNext = () => {
    const target = getNextStep('/community-property', answers);
    if (target) nav.next(target);
  };
  const handleBack = () => {
    const target = getPrevStep('/community-property', answers);
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
        <IntakeHeader t={t} step={6} label="Community property" />

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
            <svg
              width="9"
              height="9"
              viewBox="0 0 9 9"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
            >
              <path
                d="M2 5l2 2 3-4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Because you&apos;re filing separately in a community property state
          </span>
        </div>

        <div style={{ padding: '14px 24px 8px' }}>
          <Stack gap={16}>
            <Stack gap={10}>
              <H1 t={t}>One more thing about your filing.</H1>
              <Body t={t} size={15}>
                In community property states like yours, married couples filing
                separately have to allocate shared income between each other.
                The IRS calls this a Form 8958 allocation.
              </Body>
            </Stack>
            <AntonioNote t={t}>
              I&apos;ll walk you through the actual allocation on our call — I just
              need a few things from you now to set it up right. If anything
              here doesn&apos;t fit your situation cleanly, leave a note in the
              bottom field and we&apos;ll talk through it.
            </AntonioNote>
          </Stack>
        </div>

        <Stack gap={26} style={{ padding: '24px 24px 16px', flex: 1 }}>
          <div>
            <FieldLabel t={t}>
              How do you and your spouse handle finances?
            </FieldLabel>
            <Stack gap={8}>
              {FINANCE_OPTIONS.map((o) => (
                <RadioRowCard
                  key={o.id}
                  t={t}
                  selected={financeShape === o.id}
                  onClick={() => void setFinanceShape(o.id)}
                  label={o.label}
                  sub={o.sub}
                />
              ))}
            </Stack>
          </div>

          <div>
            <FieldLabel t={t}>
              Did you and your spouse live apart for all of {taxYear}?
            </FieldLabel>
            <div
              style={{
                fontSize: 13,
                color: t.muted,
                lineHeight: 1.45,
                letterSpacing: -0.2,
                marginTop: -4,
                marginBottom: 12,
              }}
            >
              Living apart all year (with no transfers between you) affects
              which income counts as community vs separate property.
            </div>
            <Stack gap={8}>
              <RadioRowCard
                t={t}
                selected={livedApart === 'yes'}
                onClick={() => void setLivedApart('yes')}
                label="Yes"
              />
              <RadioRowCard
                t={t}
                selected={livedApart === 'no'}
                onClick={() => void setLivedApart('no')}
                label="No"
              />
              <RadioRowCard
                t={t}
                selected={livedApart === 'not_sure'}
                onClick={() => void setLivedApart('not_sure')}
                label="Not sure"
                sub="We'll figure it out on our call"
              />
            </Stack>
          </div>

          <div>
            <FieldLabel t={t}>
              Anything I should know? (optional)
            </FieldLabel>
            <div
              style={{
                fontSize: 13,
                color: t.muted,
                lineHeight: 1.45,
                letterSpacing: -0.2,
                marginTop: -4,
                marginBottom: 12,
              }}
            >
              Prenup, post-nup, separation agreement, transmutation
              agreement, or anything else that changes how community
              property rules apply to you.
            </div>
            <TextField
              t={t}
              value={notes}
              onChange={(v) => void setNotes(v)}
              placeholder="A note for Antonio"
            />
          </div>

          <div>
            <FieldLabel t={t}>One last thing</FieldLabel>
            <RadioRowCard
              t={t}
              selected={!!acknowledged}
              onClick={() => void setAcknowledged(!acknowledged)}
              label="I understand my return will include a Form 8958 allocation"
              sub="Antonio handles the line-by-line work. This just confirms you saw it."
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
            <IntakeContinueButton
              t={t}
              route="/community-property"
              onClick={handleNext}
              style={{ flex: 1 }}
            >
              Continue
            </IntakeContinueButton>
          </Row>
        </div>
      </div>
    </Screen>
  );
}
