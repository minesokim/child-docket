'use client';

// Intake step — Head of Household qualification (§2(b) / §7703(b)).
//
// Reached only when /filing → Head of Household is selected. Captures
// the four gating answers Form 8867 requires Antonio to document on
// every HoH return. Each "no" or "not_sure" surfaces in command-room
// as a §6694 risk; Antonio either confirms supporting docs, downgrades
// the status to Single, or files with appropriate disclosure.
//
// The questions intentionally use plain-English framing (not "did you
// meet §2(b)(1)(A)" — clients can't answer that). The helper text
// under each question summarizes the IRS test in one line so the
// client knows what we're really asking.
//
// L9 compliance: this is NOT framed as "AI checked your status."
// The page reads as a standard intake screen — Antonio asks these
// questions because preparing HoH requires the answers, full stop.

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
import {
  deriveHohVerdict,
  HOH_VERDICT_COPY,
  type HohVerdict,
} from '@docket/shared';
import { usePortalNav } from '@/lib/portal-nav';
import { useIntakeAnswers, useIntakeField, useIntakeStepNumber } from '@/lib/intake-context';
import { getNextStep, getPrevStep } from '@/lib/intake-flow';
import { IntakeContinueButton } from '@/components/intake-continue-button';

type Tri = 'yes' | 'no' | 'not_sure' | '';

export default function HohQualifyPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();

  const [q1, setQ1] = useIntakeField<Tri>(
    'hohQualify.unmarriedOrConsideredUnmarried',
    '',
  );
  const [q2, setQ2] = useIntakeField<Tri>(
    'hohQualify.paidMoreThanHalfHomeCost',
    '',
  );
  const [q3, setQ3] = useIntakeField<Tri>(
    'hohQualify.qualifyingPersonLivedWithYou',
    '',
  );
  // §2(b)(1)(B) parent-exception follow-up. Asked only when q3 === 'no'.
  const [q3Parent, setQ3Parent] = useIntakeField<Tri>(
    'hohQualify.qualifyingPersonIsParent',
    '',
  );
  const [q4, setQ4] = useIntakeField<Tri>(
    'hohQualify.qualifyingPersonIsChildOrRelative',
    '',
  );
  const [relationship, setRelationship] = useIntakeField<string>(
    'hohQualify.qualifyingPersonRelationship',
    '',
  );

  const answers = useIntakeAnswers();
  const verdict: HohVerdict = deriveHohVerdict({
    unmarriedOrConsideredUnmarried: q1 === '' ? undefined : q1,
    paidMoreThanHalfHomeCost: q2 === '' ? undefined : q2,
    qualifyingPersonLivedWithYou: q3 === '' ? undefined : q3,
    qualifyingPersonIsParent: q3Parent === '' ? undefined : q3Parent,
    qualifyingPersonIsChildOrRelative: q4 === '' ? undefined : q4,
  });

  const handleNext = () => {
    const target = getNextStep('/hoh-qualify', answers);
    if (target) nav.next(target);
  };
  const handleBack = () => {
    const target = getPrevStep('/hoh-qualify', answers);
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
        <IntakeHeader t={t} {...useIntakeStepNumber('/hoh-qualify')} label="Head of Household" />

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
            Because you chose Head of Household
          </span>
        </div>

        <div style={{ padding: '14px 24px 8px' }}>
          <Stack gap={16}>
            <Stack gap={10}>
              <H1 t={t}>A few questions about your household</H1>
              <Body t={t} size={15}>
                Head of Household has specific rules. These answers help me
                prepare your return accurately.
              </Body>
            </Stack>
            <AntonioNote t={t}>
              If you&apos;re not sure on any of these, just pick &ldquo;Not
              sure&rdquo; — we&apos;ll talk it through on our call. Better to
              flag it now than catch it during review.
            </AntonioNote>
          </Stack>
        </div>

        <Stack gap={26} style={{ padding: '24px 24px 16px', flex: 1 }}>
          <QuestionBlock
            t={t}
            label="On December 31, 2025, were you unmarried (or considered unmarried)?"
            hint="Single, divorced, legally separated — or lived apart from your spouse the last 6 months of the year and paid more than half the cost of a separate home."
            value={q1}
            onChange={(v) => void setQ1(v)}
          />

          <QuestionBlock
            t={t}
            label="Did you pay more than half the cost of keeping up your home in 2025?"
            hint="Rent or mortgage, property tax, insurance, utilities, food eaten in the home, repairs. Compare what you paid to what everyone else (roommates, partner, family) paid combined."
            value={q2}
            onChange={(v) => void setQ2(v)}
          />

          <QuestionBlock
            t={t}
            label="Did a qualifying person live with you for more than half the year?"
            hint="A qualifying child or qualifying relative. Exception: a parent doesn't have to live with you — but you must have paid more than half the cost of their home."
            value={q3}
            onChange={(v) => void setQ3(v)}
          />

          {q3 === 'no' && (
            <QuestionBlock
              t={t}
              label="Is that person your parent?"
              hint="A parent doesn't have to live with you to qualify — but you must have paid more than half the cost of keeping up their separate home."
              value={q3Parent}
              onChange={(v) => void setQ3Parent(v)}
            />
          )}

          <QuestionBlock
            t={t}
            label="Is that person your child, stepchild, foster child, sibling, parent, or other qualifying relative?"
            hint="The qualifying person must meet the IRS relationship test — biological/adopted/step/foster child, descendant of any, sibling/step-sibling/half-sibling, parent, or other relative in §152."
            value={q4}
            onChange={(v) => void setQ4(v)}
          />

          <div>
            <FieldLabel t={t}>
              What is your relationship to that person? (optional)
            </FieldLabel>
            <TextField
              t={t}
              value={relationship}
              onChange={(v) => void setRelationship(v)}
              placeholder="Daughter, mother, niece, etc."
            />
          </div>

          {verdict !== 'incomplete' && (
            <VerdictPill t={t} verdict={verdict} />
          )}
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
              route="/hoh-qualify"
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

// ─── Three-option question block ────────────────────────────────────
// Three RadioRowCards rendered as a vertical stack for each gating
// question. Spacing mirrors the /state Yes/No radio block + adds a
// "Not sure" affordance so the client can advance without forcing a
// guess on §2(b) qualification rules they don't know cold.
function QuestionBlock({
  t,
  label,
  hint,
  value,
  onChange,
}: {
  t: ReturnType<typeof buildTheme>;
  label: string;
  hint: string;
  value: Tri;
  onChange: (v: Tri) => void;
}) {
  return (
    <div>
      <FieldLabel t={t}>{label}</FieldLabel>
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
        {hint}
      </div>
      <Stack gap={8}>
        <RadioRowCard
          t={t}
          selected={value === 'yes'}
          onClick={() => onChange('yes')}
          label="Yes"
        />
        <RadioRowCard
          t={t}
          selected={value === 'no'}
          onClick={() => onChange('no')}
          label="No"
        />
        <RadioRowCard
          t={t}
          selected={value === 'not_sure'}
          onClick={() => onChange('not_sure')}
          label="Not sure"
          sub="Antonio will help you figure this out on our call"
        />
      </Stack>
    </div>
  );
}

// ─── Verdict pill ───────────────────────────────────────────────────
// Subtle informational pill at the bottom of the question stack
// summarizing the face-value verdict. Per L9: NOT framed as "AI
// checked." Reads as a natural confirmation Antonio would have given
// at this point in the conversation.
function VerdictPill({
  t,
  verdict,
}: {
  t: ReturnType<typeof buildTheme>;
  verdict: HohVerdict;
}) {
  const copy = HOH_VERDICT_COPY[verdict];
  if (!copy) return null;
  const tone =
    verdict === 'passes_at_face'
      ? { bg: t.ease.keylimeWash, fg: t.ease.forestDark }
      : verdict === 'fails_at_face'
        ? { bg: '#fbeed3', fg: '#7a4a16' }
        : { bg: '#efece6', fg: t.muted };
  return (
    <div
      style={{
        padding: '12px 14px',
        background: tone.bg,
        borderRadius: 12,
        fontFamily: t.sans,
        fontSize: 14,
        color: tone.fg,
        lineHeight: 1.4,
      }}
    >
      {copy}
    </div>
  );
}
