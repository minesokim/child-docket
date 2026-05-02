'use client';

// Intake step 5 - Spouse info (conditional, MFJ/MFS only).
// Migrated to Postgres-backed state. Spouse SSN is encrypted at rest
// (same path as personal.ssn - see SENSITIVE_INTAKE_PATHS in @docket/shared).

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
import { useState } from 'react';
import { usePortalNav } from '@/lib/portal-nav';
import { useFieldReveal, useIntakeField } from '@/lib/intake-context';
import { getNextStep, getPrevStep } from '@/lib/intake-flow';
import { IntakeContinueButton } from '@/components/intake-continue-button';
import type { FilingStatus } from '@docket/shared';

// DOB format helpers - shared with /personal. UI uses "MM / DD / YYYY",
// storage uses ISO YYYY-MM-DD.
function dobShape(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)} / ${d.slice(2)}`;
  return `${d.slice(0, 2)} / ${d.slice(2, 4)} / ${d.slice(4)}`;
}
function dobDisplayToIso(display: string): string {
  const d = display.replace(/\D/g, '');
  if (d.length !== 8) return '';
  return `${d.slice(4, 8)}-${d.slice(0, 2)}-${d.slice(2, 4)}`;
}
function dobIsoToDisplay(iso: string): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[2]} / ${m[3]} / ${m[1]}`;
}

export default function SpousePage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();

  const [fullName, setFullName] = useIntakeField<string>('spouse.fullName', '');
  const [dobIso, setDobIso] = useIntakeField<string>('spouse.dateOfBirth', '');
  const [ssn, setSsn] = useIntakeField<string>('spouse.ssn', '');
  const revealSsn = useFieldReveal('spouse.ssn');
  const [occupation, setOccupation] = useIntakeField<string>('spouse.occupation', '');
  const [filingStatus] = useIntakeField<FilingStatus>('filing.status', 'single');

  const [dobDisplay, setDobDisplay] = useState(() => dobIsoToDisplay(dobIso));

  const handleDobChange = (raw: string) => {
    const shaped = dobShape(raw);
    setDobDisplay(shaped);
    const iso = dobDisplayToIso(shaped);
    if (iso) void setDobIso(iso);
  };

  const stateSnapshot = { filing: { status: filingStatus }, spouse: { fullName, dateOfBirth: dobIso, ssn } };
  const handleNext = () => {
    const target = getNextStep('/spouse', stateSnapshot);
    if (target) nav.next(target);
  };
  const handleBack = () => {
    const target = getPrevStep('/spouse', stateSnapshot);
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
        <IntakeHeader t={t} step={5} label="Spouse" />

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
            Because you&apos;re filing jointly
          </span>
        </div>

        <div style={{ padding: '14px 24px 8px' }}>
          <Stack gap={16}>
            <Stack gap={10}>
              <H1 t={t}>Tell me about your spouse.</H1>
              <Body t={t} size={15}>
                Basic info for the joint return.
              </Body>
            </Stack>
            <AntonioNote t={t}>
              Your spouse&apos;s SSN is encrypted the moment you type it. I only see the last four digits until I&apos;m actively preparing your return.
            </AntonioNote>
          </Stack>
        </div>

        <Stack gap={20} style={{ padding: '22px 24px 16px', flex: 1 }}>
          <div>
            <FieldLabel t={t}>Spouse&apos;s full legal name</FieldLabel>
            <TextField
              t={t}
              value={fullName}
              onChange={(v) => void setFullName(v)}
              placeholder="First Middle Last"
              autoComplete="name"
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
              value={ssn}
              onChange={(v) => void setSsn(v)}
              onReveal={revealSsn}
            />
          </div>

          <div>
            <FieldLabel t={t}>Occupation</FieldLabel>
            <TextField
              t={t}
              value={occupation}
              onChange={(v) => void setOccupation(v)}
              placeholder="What do they do?"
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
            <Button t={t} variant="ghost" onClick={handleBack} style={{ flex: '0 0 auto' }}>
              Back
            </Button>
            <IntakeContinueButton t={t} route="/spouse" onClick={handleNext} style={{ flex: 1 }}>
              Continue
            </IntakeContinueButton>
          </Row>
        </div>
      </div>
    </Screen>
  );
}
