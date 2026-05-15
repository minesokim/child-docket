'use client';

// Intake step 2 alt - Business Info. MIGRATED to Postgres-backed state.
// Conditional path for users who selected "Business Tax Return" on Services.
// Replaces /personal for that branch.
//
// Sensitive fields (business.ein, business.ownerSsn) match SENSITIVE_INTAKE_PATHS
// in @docket/shared and get encrypted at rest before JSONB write.

import { useEffect, useRef, useState } from 'react';
import {
  AntonioNote,
  AskAntonioBar,
  Body,
  Button,
  buildTheme,
  EncryptedTextField,
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
import { usePortalNav } from '@/lib/portal-nav';
import {
  useFieldReveal,
  useIntakeAnswers,
  useIntakeField,
  useIntakeStepNumber,
} from '@/lib/intake-context';
import {
  bucketCaSoSStatus,
  CA_SOS_STATUS_COPY,
  type CaSoSLookupResult,
  type CaSoSStatusBucket,
  formatDigits,
  formatEin,
  formatStateCode,
  formatZip,
  normalizeCaSoSQuery,
} from '@docket/shared';
import { getNextStep, getPrevStep } from '@/lib/intake-flow';
import { IntakeContinueButton } from '@/components/intake-continue-button';

export default function BusinessInfoPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();

  // Identity
  const [legalName, setLegalName] = useIntakeField<string>('business.legalName', '');
  const [ein, setEin] = useIntakeField<string>('business.ein', '');
  const revealEin = useFieldReveal('business.ein');
  const [entityType, setEntityType] = useIntakeField<string>('business.entityType', '');
  const [activity, setActivity] = useIntakeField<string>('business.activity', '');
  const [employees, setEmployees] = useIntakeField<string>('business.employees', '');
  const [accountingMethod, setAccountingMethod] = useIntakeField<string>(
    'business.accountingMethod',
    '',
  );
  const [fiscalYearEnd, setFiscalYearEnd] = useIntakeField<string>(
    'business.fiscalYearEnd',
    '12/31',
  );

  // Address
  const [street, setStreet] = useIntakeField<string>('business.street', '');
  const [city, setCity] = useIntakeField<string>('business.city', '');
  const [addressState, setAddressState] = useIntakeField<string>('business.addressState', '');
  const [zip, setZip] = useIntakeField<string>('business.zip', '');

  // Software
  const [accountingSoftware, setAccountingSoftware] = useIntakeField<string>(
    'business.accountingSoftware',
    '',
  );
  const [payrollProvider, setPayrollProvider] = useIntakeField<string>(
    'business.payrollProvider',
    '',
  );

  // Owner (v0 single-owner; v1+ → owners[])
  const [ownerName, setOwnerName] = useIntakeField<string>('business.ownerName', '');
  const [ownerSsn, setOwnerSsn] = useIntakeField<string>('business.ownerSsn', '');
  const revealOwnerSsn = useFieldReveal('business.ownerSsn');
  const [ownerPercent, setOwnerPercent] = useIntakeField<string>('business.ownerPercent', '');
  const [ownerTitle, setOwnerTitle] = useIntakeField<string>('business.ownerTitle', '');
  const [preparingPersonal, setPreparingPersonal] = useIntakeField<'yes' | 'no' | ''>(
    'business.preparingPersonal',
    '',
  );

  // CA SoS BE Public Search snapshot — persisted so Antonio sees it
  // in command-room post-intake. The pill UI consumes the bucketed
  // status; we persist the raw + entity number + matched name for the
  // audit chain.
  const [caSoSStatus, setCaSoSStatus] = useIntakeField<string>('business.caSoSStatus', '');
  const [, setCaSoSEntityNumber] = useIntakeField<string>('business.caSoSEntityNumber', '');
  const [, setCaSoSMatchedName] = useIntakeField<string>('business.caSoSMatchedName', '');
  const [, setCaSoSCheckedAt] = useIntakeField<string>('business.caSoSCheckedAt', '');

  // Debounced CA SoS lookup. Fires 600ms after the user stops typing
  // when addressState === 'CA' AND legalName length >= 2. Aborts any
  // in-flight request on re-typing. Failure is silent: the pill is
  // only rendered when we have a positive { ok: true } result.
  const isCa = addressState.trim().toUpperCase() === 'CA';
  const [pillBucket, setPillBucket] = useState<CaSoSStatusBucket | null>(() => {
    return caSoSStatus ? bucketCaSoSStatus(caSoSStatus) : null;
  });
  const abortRef = useRef<AbortController | null>(null);
  const lastQueriedRef = useRef<string>('');

  useEffect(() => {
    if (!isCa) {
      setPillBucket(null);
      // Reset so a later CA-re-entry re-fires the lookup for the same
      // name. Without this, toggling state away from CA + back would
      // suppress the next lookup. Codex caught this 2026-05-14.
      lastQueriedRef.current = '';
      return;
    }
    const query = normalizeCaSoSQuery(legalName);
    if (query.length < 2) {
      setPillBucket(null);
      lastQueriedRef.current = '';
      return;
    }
    // Avoid re-firing on debounce-driven re-renders for the same input.
    if (query === lastQueriedRef.current) return;

    const timer = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;
      lastQueriedRef.current = query;

      void fetch('/api/ca-sos/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ legalName: query }),
        signal: controller.signal,
      })
        .then((res) => res.json() as Promise<CaSoSLookupResult>)
        .then((result) => {
          if (controller.signal.aborted) return;
          if (!result.ok) {
            // Silent no-op on every failure mode — the pill stays
            // hidden, intake proceeds normally.
            return;
          }
          setPillBucket(result.status);
          // Persist whether we matched or not_found — Antonio cares
          // about both. ('not_found' surfaces as a soft "double-check
          // spelling" hint; the snapshot itself is still useful.)
          void setCaSoSStatus(result.rawStatus ?? 'not_found');
          void setCaSoSEntityNumber(result.entityNumber ?? '');
          void setCaSoSMatchedName(result.matchedName ?? '');
          void setCaSoSCheckedAt(new Date().toISOString());
        })
        .catch(() => {
          // AbortError or network — silent.
        });
    }, 600);

    return () => clearTimeout(timer);
  }, [
    legalName,
    isCa,
    setCaSoSStatus,
    setCaSoSEntityNumber,
    setCaSoSMatchedName,
    setCaSoSCheckedAt,
  ]);

  // Pass full answers so /income gating fires (entity-only biz filings
  // skip /income and walk straight to /tax-questions). With an empty
  // snapshot the gate would silently fail and Continue would route to
  // /income for every biz client — which is the bug we're trying to fix.
  const answers = useIntakeAnswers();
  const handleNext = () => {
    const target = getNextStep('/business-info', answers);
    if (target) nav.next(target);
  };
  const handleBack = () => {
    const target = getPrevStep('/business-info', answers);
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
        <IntakeHeader t={t} {...useIntakeStepNumber('/business-info')} label="Business" />

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
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M2 5l2 2 3-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Because you&apos;re filing a business return
          </span>
        </div>

        <div style={{ padding: '14px 24px 8px' }}>
          <Stack gap={16}>
            <Stack gap={10}>
              <H1 t={t}>Tell me about your business</H1>
              <Body t={t} size={15}>
                This helps me prepare the right return type.
              </Body>
            </Stack>
            <AntonioNote t={t}>
              If you&apos;re not sure about entity type or accounting method, don&apos;t worry. I&apos;ll verify everything.
            </AntonioNote>
          </Stack>
        </div>

        <Stack gap={18} style={{ padding: '22px 24px 16px', flex: 1 }}>
          <div>
            <FieldLabel t={t}>Legal business name</FieldLabel>
            <TextField
              t={t}
              value={legalName}
              onChange={(v) => void setLegalName(v)}
              placeholder="Full legal entity name"
            />
            {pillBucket && <CaSoSPill bucket={pillBucket} t={t} />}
          </div>

          <div>
            <FieldLabel t={t}>EIN</FieldLabel>
            <EncryptedTextField
              t={t}
              value={ein}
              onChange={(v) => void setEin(formatEin(v))}
              onReveal={revealEin}
              placeholder="XX-XXXXXXX"
              mono
              inputMode="numeric"
            />
          </div>

          <div>
            <FieldLabel t={t}>Entity type</FieldLabel>
            <TextField
              t={t}
              value={entityType}
              onChange={(v) => void setEntityType(v)}
              placeholder="S-Corp, LLC, C-Corp, Partnership"
            />
          </div>

          <div>
            <FieldLabel t={t}>Business activity</FieldLabel>
            <TextField
              t={t}
              value={activity}
              onChange={(v) => void setActivity(v)}
              placeholder="Plumbing, Restaurant, Consulting"
            />
          </div>

          <div>
            <FieldLabel t={t}>Number of employees</FieldLabel>
            <TextField
              t={t}
              value={employees}
              onChange={(v) => void setEmployees(formatDigits(v, 6))}
              mono
              inputMode="numeric"
              placeholder="0"
            />
          </div>

          <div>
            <FieldLabel t={t}>Accounting method</FieldLabel>
            <TextField
              t={t}
              value={accountingMethod}
              onChange={(v) => void setAccountingMethod(v)}
              placeholder="Cash or Accrual"
            />
          </div>

          <div>
            <FieldLabel t={t}>Fiscal year end</FieldLabel>
            <TextField
              t={t}
              value={fiscalYearEnd}
              onChange={(v) => void setFiscalYearEnd(v)}
              mono
              inputMode="numeric"
              placeholder="12/31"
            />
          </div>

          <div
            style={{
              marginTop: 8,
              padding: '20px 18px 4px',
              background: '#fffefc',
              boxShadow: '0 2px 10px rgba(15, 62, 23, 0.06)',
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
              Business address
            </div>
            <div style={{ fontSize: 12, color: t.muted, marginBottom: 16 }}>
              Principal place of business
            </div>

            <div>
              <FieldLabel t={t}>Street address</FieldLabel>
              <TextField
                t={t}
                value={street}
                onChange={(v) => void setStreet(v)}
                placeholder="Street"
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
                  autoComplete="address-level2"
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <FieldLabel t={t}>State</FieldLabel>
                <TextField
                  t={t}
                  value={addressState}
                  onChange={(v) => void setAddressState(formatStateCode(v))}
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
                  mono
                  inputMode="numeric"
                  autoComplete="postal-code"
                />
              </div>
            </div>
          </div>

          <div>
            <FieldLabel t={t}>Accounting software</FieldLabel>
            <TextField
              t={t}
              value={accountingSoftware}
              onChange={(v) => void setAccountingSoftware(v)}
              placeholder="QuickBooks, Xero, Wave, None"
            />
          </div>

          <div>
            <FieldLabel t={t}>Payroll provider</FieldLabel>
            <TextField
              t={t}
              value={payrollProvider}
              onChange={(v) => void setPayrollProvider(v)}
              placeholder="ADP, Gusto, In-house, None"
            />
          </div>

          <div
            style={{
              marginTop: 4,
              padding: '18px 18px 6px',
              background: t.ease.keylimeWash,
              borderRadius: t.radius,
            }}
          >
            <div
              style={{
                fontFamily: t.mono,
                fontSize: 10,
                color: t.ease.forestDark,
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                marginBottom: 14,
              }}
            >
              Ownership
            </div>

            <Stack gap={16}>
              <div>
                <FieldLabel t={t}>Owner 1 name</FieldLabel>
                <TextField
                  t={t}
                  value={ownerName}
                  onChange={(v) => void setOwnerName(v)}
                  placeholder="Full legal name"
                />
              </div>
              <div>
                <FieldLabel t={t} hint="LAST 4 SHOWN">
                  SSN
                </FieldLabel>
                <SSNField
                  t={t}
                  value={ownerSsn}
                  onChange={(v) => void setOwnerSsn(v)}
                  onReveal={revealOwnerSsn}
                />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <FieldLabel t={t}>Ownership %</FieldLabel>
                  <TextField
                    t={t}
                    value={ownerPercent}
                    onChange={(v) => void setOwnerPercent(formatDigits(v, 3))}
                    mono
                    inputMode="numeric"
                    placeholder="100"
                  />
                </div>
                <div style={{ flex: 2, minWidth: 0 }}>
                  <FieldLabel t={t}>Title</FieldLabel>
                  <TextField
                    t={t}
                    value={ownerTitle}
                    onChange={(v) => void setOwnerTitle(v)}
                    placeholder="Managing Member, President"
                  />
                </div>
              </div>
            </Stack>
          </div>

          <div>
            <FieldLabel t={t}>Are we also preparing personal returns for any owners?</FieldLabel>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { id: 'yes' as const, l: 'Yes' },
                { id: 'no' as const, l: 'No' },
              ].map((o) => {
                const on = preparingPersonal === o.id;
                return (
                  <button
                    key={o.id}
                    onClick={() => void setPreparingPersonal(o.id)}
                    style={{
                      flex: 1,
                      padding: '14px 16px',
                      background: on ? t.ease.mintGlaze : '#fffefc',
                      borderRadius: t.radius,
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: t.sans,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: on ? t.ease.forestDark : t.ease.keylimeWash,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {on && (
                        <div
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: '50%',
                            background: '#fff',
                          }}
                        />
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: 15,
                        color: t.ink,
                        fontWeight: on ? 500 : 400,
                      }}
                    >
                      {o.l}
                    </span>
                  </button>
                );
              })}
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
            <Button
              t={t}
              variant="ghost"
              onClick={handleBack}
              style={{ flex: '0 0 auto' }}
            >
              Back
            </Button>
            <IntakeContinueButton t={t} route="/business-info" onClick={handleNext} style={{ flex: 1 }}>
              Continue
            </IntakeContinueButton>
          </Row>
        </div>
      </div>
    </Screen>
  );
}

// ─── CA SoS status pill ─────────────────────────────────────────────
// Subtle inline pill rendered below the Legal business name when the
// CA SoS lookup returns a result. Per L9 (AI invisibility) the copy
// reads as informational, NOT as "AI verified" or "we checked" —
// nothing in the surface signals that an external API ran. The pill
// just states the entity's standing the way OLT or any thoughtful
// preparer-facing tool would.
//
// Color buckets:
//   active     — keylimeWash bg, forestDark text (calm green)
//   suspended  — soft amber (warmth without alarm)
//   forfeited  — rust (red but not a system error)
//   dissolved  — muted gray
//   not_found  — muted gray (same as dissolved — "check spelling")
//   unknown    — muted gray (defensive fallback)
function CaSoSPill({
  bucket,
  t,
}: {
  bucket: CaSoSStatusBucket;
  t: ReturnType<typeof buildTheme>;
}) {
  const tone =
    bucket === 'active'
      ? { bg: t.ease.keylimeWash, fg: t.ease.forestDark }
      : bucket === 'suspended'
        ? { bg: '#fbeed3', fg: '#7a4a16' }
        : bucket === 'forfeited'
          ? { bg: '#f2dad3', fg: t.rustInk }
          : { bg: '#efece6', fg: t.muted };
  return (
    <div
      style={{
        marginTop: 8,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px',
        background: tone.bg,
        borderRadius: 999,
        fontFamily: t.sans,
        fontSize: 12,
        color: tone.fg,
        letterSpacing: 0.1,
      }}
    >
      {CA_SOS_STATUS_COPY[bucket]}
    </div>
  );
}
