'use client';

// Intake step 6 (continued) — Dependent details. MIGRATED to Postgres-backed
// state via useIntakeAnswers + useSetIntakeField. Each card writes to
// `dependents.list[i].{fullName,dateOfBirth,ssn,relationship,monthsLivedWithYou}`.
//
// SSN encrypted at rest (matched by SENSITIVE_INTAKE_PATHS glob
// `dependents.list.*.ssn` → AES-GCM before JSONB write).
//
// DOB display vs storage:
//   - UI: "MM / DD / YYYY"
//   - Storage: ISO YYYY-MM-DD (only persisted when complete; partial entries
//     stay in display state until the user finishes typing).

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
  Row,
  Screen,
  SSNField,
  Stack,
  TextField,
} from '@docket/ui';
import type { Theme } from '@docket/ui';
import * as React from 'react';
import { usePortalNav } from '@/lib/portal-nav';
import {
  useFieldReveal,
  useIntakeAnswers,
  useSetIntakeField,
} from '@/lib/intake-context';
import { getNextStep, getPrevStep } from '@/lib/intake-flow';
import { formatDigits } from '@docket/shared';
import type { IntakeDependent } from '@docket/shared';

// ────────────────────────────────────────────────────────────────
// DOB format helpers — display ↔ ISO storage (mirror /personal)
// ────────────────────────────────────────────────────────────────

/** "MM / DD / YYYY" → "YYYY-MM-DD". Returns empty when incomplete. */
function dobDisplayToIso(display: string): string {
  const d = display.replace(/\D/g, '');
  if (d.length !== 8) return '';
  return `${d.slice(4, 8)}-${d.slice(0, 2)}-${d.slice(2, 4)}`;
}

/** "YYYY-MM-DD" → "MM / DD / YYYY". Empty input → empty string. */
function dobIsoToDisplay(iso: string | undefined): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[2]} / ${m[3]} / ${m[1]}`;
}

/** Display formatter while typing — adds slashes/spaces as digits arrive. */
function dobShape(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)} / ${d.slice(2)}`;
  return `${d.slice(0, 2)} / ${d.slice(2, 4)} / ${d.slice(4)}`;
}

// ────────────────────────────────────────────────────────────────
// Single dependent card — drives writes through callbacks
// ────────────────────────────────────────────────────────────────

function DependentCardDetails({
  t,
  index,
  dep,
  onField,
}: {
  t: Theme;
  index: number;
  dep: IntakeDependent;
  onField: (field: keyof IntakeDependent, value: string) => void;
}) {
  // Per-card SSN reveal — each dependent's path includes its array index,
  // so each card calls useFieldReveal with its own path. Hooks rules hold:
  // each card invokes it exactly once per render.
  const revealSsn = useFieldReveal(`dependents.list.${index - 1}.ssn`);

  // DOB has its own display state (MM / DD / YYYY) since storage is ISO.
  // Hydrate on mount + whenever the stored ISO changes externally.
  const [dobDisplay, setDobDisplay] = React.useState(() => dobIsoToDisplay(dep.dateOfBirth));
  React.useEffect(() => {
    setDobDisplay(dobIsoToDisplay(dep.dateOfBirth));
  }, [dep.dateOfBirth]);

  const handleDobChange = (raw: string) => {
    const shaped = dobShape(raw);
    setDobDisplay(shaped);
    const iso = dobDisplayToIso(shaped);
    if (iso) {
      // Only persist when complete — server's Zod will reject partial.
      onField('dateOfBirth', iso);
    }
  };

  return (
    <div
      style={{
        padding: '18px 18px 6px',
        // Neutral container — same warm off-white as the resting input
        // state. Inputs INSIDE this card flip to mintWhisper as the user
        // fills them, so the card itself doesn't need to carry color.
        background: t.ease.softNeutral,
        borderRadius: t.radius,
      }}
    >
      <div
        style={{
          fontFamily: t.mono,
          fontSize: 10,
          color: t.muted,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          marginBottom: 14,
        }}
      >
        Dependent {index}
      </div>

      <Stack gap={16}>
        <div>
          <FieldLabel t={t}>Full name</FieldLabel>
          <TextField
            t={t}
            value={dep.fullName ?? ''}
            onChange={(v) => onField('fullName', v)}
            placeholder="First and last name"
          />
        </div>

        <div>
          <FieldLabel t={t}>Date of birth</FieldLabel>
          <TextField
            t={t}
            value={dobDisplay}
            onChange={handleDobChange}
            placeholder="MM / DD / YYYY"
            mono
            inputMode="numeric"
          />
        </div>

        <div>
          <FieldLabel t={t} hint="LAST 4 SHOWN">
            Social Security Number
          </FieldLabel>
          <SSNField
            t={t}
            value={dep.ssn ?? ''}
            onChange={(v) => onField('ssn', v)}
            onReveal={revealSsn}
          />
        </div>

        <div>
          <FieldLabel t={t}>Relationship</FieldLabel>
          <TextField
            t={t}
            value={dep.relationship ?? ''}
            onChange={(v) => onField('relationship', v)}
            placeholder="Son, Daughter, Parent"
          />
        </div>

        <div>
          <FieldLabel t={t}>Months living with you in 2025</FieldLabel>
          <TextField
            t={t}
            value={dep.monthsLivedWithYou ?? ''}
            onChange={(v) => onField('monthsLivedWithYou', formatDigits(v, 2))}
            placeholder="12"
            mono
            inputMode="numeric"
          />
        </div>
      </Stack>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────

export default function DepsDetailPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  const answers = useIntakeAnswers();
  const setField = useSetIntakeField();

  const count = answers.dependents?.count ?? 0;
  const target = Math.max(1, count); // at least 1 card if user landed here
  const list: IntakeDependent[] = answers.dependents?.list ?? [];

  // Pad/truncate the displayed cards to match `count` without writing on
  // every render. Writes only when the user actually edits a field.
  const cards: IntakeDependent[] = React.useMemo(() => {
    const out: IntakeDependent[] = [];
    for (let i = 0; i < target; i++) out.push(list[i] ?? {});
    return out;
  }, [list, target]);

  const updateField = (i: number, field: keyof IntakeDependent, value: string) => {
    void setField(`dependents.list.${i}.${field}`, value);
  };

  // Pass the live answers snapshot to flow helpers — empty state would
  // make /deps-detail itself "non-applicable" (it requires count > 0),
  // so getPrevStep would return null and the back button would silently
  // no-op. With the real snapshot the route resolves and back works.
  const handleNext = () => {
    const target = getNextStep('/deps-detail', answers);
    if (target) nav.next(target);
  };
  const handleBack = () => {
    const target = getPrevStep('/deps-detail', answers);
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
        <IntakeHeader t={t} step={6} label="Dependents" />

        <div style={{ padding: '22px 24px 0' }}>
          <IntakeBackButton t={t} onClick={handleBack} />
        </div>

        <div style={{ padding: '18px 24px 8px' }}>
          <Stack gap={16}>
            <Stack gap={10}>
              <H1 t={t}>Tell me about your dependents</H1>
              <Body t={t} size={15}>
                Just the basics. I&apos;ll sort out who qualifies.
              </Body>
            </Stack>
            <AntonioNote t={t}>
              If you have a child under 13 and pay for daycare, that&apos;s a big credit we don&apos;t want to miss — I&apos;ll ask about that next.
            </AntonioNote>
          </Stack>
        </div>

        <Stack gap={12} style={{ padding: '22px 24px 16px', flex: 1 }}>
          {cards.map((d, i) => (
            <DependentCardDetails
              key={i}
              t={t}
              index={i + 1}
              dep={d}
              onField={(field, value) => updateField(i, field, value)}
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
            <Button
              t={t}
              variant="ghost"
              onClick={handleBack}
              style={{ flex: '0 0 auto' }}
            >
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
