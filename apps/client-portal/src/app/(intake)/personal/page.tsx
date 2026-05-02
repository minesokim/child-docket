'use client';

// Intake step 2 — Personal info. MIGRATED to Postgres-backed state via
// useIntakeField. Each field maps to a path on IntakeState.personal.
//
// Storage notes:
//   - Sensitive: SSN. Encrypted at rest (AES-GCM) before JSONB write.
//   - Date of birth stored as ISO YYYY-MM-DD; UI format is "MM / DD / YYYY".
//   - Phone stored loose (E.164 + display formatting handled here).
//
// Pattern: this page is the template the remaining 25 routes follow.
// Drop-in swap: usePortalState('personal', DEFAULT) → useIntakeField per field.

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
import { formatStateCode, formatZip } from '@docket/shared';

// ────────────────────────────────────────────────────────────────
// Format helpers — display vs storage
// ────────────────────────────────────────────────────────────────

/** "MM / DD / YYYY" → "YYYY-MM-DD". Returns empty when incomplete. */
function dobDisplayToIso(display: string): string {
  const d = display.replace(/\D/g, '');
  if (d.length !== 8) return '';
  return `${d.slice(4, 8)}-${d.slice(0, 2)}-${d.slice(2, 4)}`;
}

/** "YYYY-MM-DD" → "MM / DD / YYYY". Empty input → empty string. */
function dobIsoToDisplay(iso: string): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso; // already in display form or partial
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
// Page
// ────────────────────────────────────────────────────────────────

export default function PersonalPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();

  // Each field is its own server-backed atom. Optimistic locally; sensitive
  // fields (ssn) get encrypted server-side before hitting JSONB.
  // fullName + dateOfBirth + email come pre-filled from /quick-start.
  // Phone is intentionally NOT collected here — Clerk has it from OTP login.
  const [fullName, setFullName] = useIntakeField<string>('personal.fullName', '');
  const [dobIso, setDobIso] = useIntakeField<string>('personal.dateOfBirth', '');
  const [ssn, setSsn] = useIntakeField<string>('personal.ssn', '');
  const revealSsn = useFieldReveal('personal.ssn');
  const [occupation, setOccupation] = useIntakeField<string>('personal.occupation', '');
  const [street, setStreet] = useIntakeField<string>('personal.street', '');
  const [city, setCity] = useIntakeField<string>('personal.city', '');
  const [addressState, setAddressState] = useIntakeField<string>('personal.addressState', '');
  const [zip, setZip] = useIntakeField<string>('personal.zip', '');

  // DOB has separate display state because the user types in MM/DD/YYYY
  // but storage is ISO YYYY-MM-DD. Hydrate display from stored ISO.
  const [dobDisplay, setDobDisplay] = useState(() => dobIsoToDisplay(dobIso));

  const handleDobChange = (raw: string) => {
    const shaped = dobShape(raw);
    setDobDisplay(shaped);
    const iso = dobDisplayToIso(shaped);
    if (iso) {
      // Only persist when complete — server's Zod will reject partial.
      void setDobIso(iso);
    }
  };

  // Branching/back-nav goes through the central flow file.
  const stateSnapshot = { personal: { fullName, dateOfBirth: dobIso, ssn } };
  const handleNext = () => {
    const target = getNextStep('/personal', stateSnapshot);
    if (target) nav.next(target);
  };
  const handleBack = () => {
    const target = getPrevStep('/personal', stateSnapshot);
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
        <IntakeHeader t={t} step={2} label="Personal" />

        <div style={{ padding: '22px 24px 0' }}>
          <IntakeBackButton t={t} onClick={handleBack} />
        </div>

        <div style={{ padding: '18px 24px 8px' }}>
          <Stack gap={16}>
            <Stack gap={10}>
              <H1 t={t}>Your basic information</H1>
              <Body t={t} size={15}>
                This goes directly onto your return.
              </Body>
            </Stack>
            <AntonioNote t={t}>
              Your SSN is encrypted the moment you type it. I only see the last four digits until I&apos;m actively preparing your return.
            </AntonioNote>
          </Stack>
        </div>

        <Stack gap={18} style={{ padding: '22px 24px 16px', flex: 1 }}>
          <div>
            <FieldLabel t={t}>Full legal name</FieldLabel>
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
              placeholder="What do you do?"
            />
          </div>

          <div
            style={{
              marginTop: 14,
              padding: '20px 18px 4px',
              background: t.card,
              border: `1px solid ${t.borderSoft}`,
              borderRadius: t.radius,
            }}
          >
            <div
              style={{
                fontFamily: t.serif,
                fontSize: 15,
                color: t.ink,
                letterSpacing: -0.2,
                marginBottom: 4,
              }}
            >
              Home address
            </div>
            <div style={{ fontSize: 12, color: t.muted, marginBottom: 16 }}>
              Where you lived most of the tax year
            </div>

            <div>
              <FieldLabel t={t}>Street address</FieldLabel>
              <TextField
                t={t}
                value={street}
                onChange={(v) => void setStreet(v)}
                placeholder="Street address"
                autoComplete="address-line1"
              />
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <div style={{ flex: 2, minWidth: 0 }}>
                <FieldLabel t={t}>City</FieldLabel>
                <TextField
                  t={t}
                  value={city}
                  onChange={(v) => void setCity(v)}
                  placeholder="City"
                  autoComplete="address-level2"
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <FieldLabel t={t}>State</FieldLabel>
                <TextField
                  t={t}
                  value={addressState}
                  onChange={(v) => void setAddressState(formatStateCode(v))}
                  placeholder="CA"
                  mono
                  style={{ textTransform: 'uppercase', letterSpacing: 1 }}
                  autoComplete="address-level1"
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <FieldLabel t={t}>ZIP</FieldLabel>
                <TextField
                  t={t}
                  value={zip}
                  onChange={(v) => void setZip(formatZip(v))}
                  placeholder="00000"
                  mono
                  inputMode="numeric"
                  autoComplete="postal-code"
                />
              </div>
            </div>
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
            <Button t={t} onClick={handleNext} style={{ flex: 1 }}>
              Continue
            </Button>
          </Row>
        </div>
      </div>
    </Screen>
  );
}
