'use client';

// Intake step 2 alt — Business Info. Conditional path for users who
// selected "Business Tax Return" on Services. Replaces /personal.
// 1-to-1 port of ScreenBusinessInfo.

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
import { usePortalNav } from '@/lib/portal-nav';
import { usePortalState } from '@/lib/portal-state';

type BusinessInfo = {
  legalName: string;
  ein: string;
  entityType: string;
  activity: string;
  employees: string;
  accountingMethod: string;
  fiscalYearEnd: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  accountingSoftware: string;
  payrollProvider: string;
  ownerName: string;
  ownerSsn: string;
  ownerPercent: string;
  ownerTitle: string;
  preparingPersonal: 'yes' | 'no' | null;
};

const DEFAULT: BusinessInfo = {
  legalName: '',
  ein: '',
  entityType: '',
  activity: '',
  employees: '',
  accountingMethod: '',
  fiscalYearEnd: '12/31',
  street: '',
  city: '',
  state: '',
  zip: '',
  accountingSoftware: '',
  payrollProvider: '',
  ownerName: '',
  ownerSsn: '',
  ownerPercent: '',
  ownerTitle: '',
  preparingPersonal: null,
};

export default function BusinessInfoPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();
  const [info, setInfo] = usePortalState<BusinessInfo>('business-info', DEFAULT);
  const update = <K extends keyof BusinessInfo>(k: K, v: BusinessInfo[K]) =>
    setInfo({ ...info, [k]: v });

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
        <IntakeHeader t={t} step={2} label="Business" />

        <div style={{ padding: '22px 24px 0' }}>
          <IntakeBackButton t={t} onClick={() => nav.back('/services-addons')} />
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
            Because you&apos;re filing a business return
          </span>
        </div>

        <div style={{ padding: '14px 24px 8px' }}>
          <Stack gap={10}>
            <H1 t={t}>Tell me about your business</H1>
            <Body t={t} size={15}>
              This helps me prepare the right return type.
            </Body>
          </Stack>
        </div>

        <Stack gap={18} style={{ padding: '22px 24px 16px', flex: 1 }}>
          <div>
            <FieldLabel t={t}>Legal business name</FieldLabel>
            <TextField
              t={t}
              value={info.legalName}
              onChange={(v) => update('legalName', v)}
              placeholder="Full legal entity name"
            />
          </div>

          <div>
            <FieldLabel t={t}>EIN</FieldLabel>
            <TextField
              t={t}
              value={info.ein}
              onChange={(v) => update('ein', v)}
              mono
              inputMode="numeric"
              placeholder="XX-XXXXXXX"
            />
          </div>

          <div>
            <FieldLabel t={t}>Entity type</FieldLabel>
            <TextField
              t={t}
              value={info.entityType}
              onChange={(v) => update('entityType', v)}
              placeholder="S-Corp, LLC, C-Corp, Partnership"
            />
          </div>

          <div>
            <FieldLabel t={t}>Business activity</FieldLabel>
            <TextField
              t={t}
              value={info.activity}
              onChange={(v) => update('activity', v)}
              placeholder="Plumbing, Restaurant, Consulting"
            />
          </div>

          <div>
            <FieldLabel t={t}>Number of employees</FieldLabel>
            <TextField
              t={t}
              value={info.employees}
              onChange={(v) => update('employees', v.replace(/\D/g, ''))}
              mono
              inputMode="numeric"
              placeholder="0"
            />
          </div>

          <div>
            <FieldLabel t={t}>Accounting method</FieldLabel>
            <TextField
              t={t}
              value={info.accountingMethod}
              onChange={(v) => update('accountingMethod', v)}
              placeholder="Cash or Accrual"
            />
          </div>

          <div>
            <FieldLabel t={t}>Fiscal year end</FieldLabel>
            <TextField
              t={t}
              value={info.fiscalYearEnd}
              onChange={(v) => update('fiscalYearEnd', v)}
              mono
              inputMode="numeric"
              placeholder="12/31"
            />
          </div>

          <div
            style={{
              marginTop: 8,
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
              Business address
            </div>
            <div style={{ fontSize: 12, color: t.muted, marginBottom: 16 }}>
              Principal place of business
            </div>

            <div>
              <FieldLabel t={t}>Street address</FieldLabel>
              <TextField
                t={t}
                value={info.street}
                onChange={(v) => update('street', v)}
                placeholder="Street"
                autoComplete="address-line1"
              />
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <div style={{ flex: 2, minWidth: 0 }}>
                <FieldLabel t={t}>City</FieldLabel>
                <TextField
                  t={t}
                  value={info.city}
                  onChange={(v) => update('city', v)}
                  autoComplete="address-level2"
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <FieldLabel t={t}>State</FieldLabel>
                <TextField
                  t={t}
                  value={info.state}
                  onChange={(v) => update('state', v.toUpperCase().slice(0, 2))}
                  mono
                  style={{ textTransform: 'uppercase', letterSpacing: 1 }}
                  autoComplete="address-level1"
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <FieldLabel t={t}>ZIP</FieldLabel>
                <TextField
                  t={t}
                  value={info.zip}
                  onChange={(v) => update('zip', v.replace(/\D/g, '').slice(0, 5))}
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
              value={info.accountingSoftware}
              onChange={(v) => update('accountingSoftware', v)}
              placeholder="QuickBooks, Xero, Wave, None"
            />
          </div>

          <div>
            <FieldLabel t={t}>Payroll provider</FieldLabel>
            <TextField
              t={t}
              value={info.payrollProvider}
              onChange={(v) => update('payrollProvider', v)}
              placeholder="ADP, Gusto, In-house, None"
            />
          </div>

          <div
            style={{
              marginTop: 4,
              padding: '18px 18px 6px',
              background: t.bgElev,
              border: `1px solid ${t.borderSoft}`,
              borderRadius: t.radius,
            }}
          >
            <div
              style={{
                fontFamily: t.mono,
                fontSize: 10,
                color: t.rustInk,
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
                  value={info.ownerName}
                  onChange={(v) => update('ownerName', v)}
                  placeholder="Full legal name"
                />
              </div>
              <div>
                <FieldLabel t={t} hint="LAST 4 SHOWN">
                  SSN
                </FieldLabel>
                <SSNField t={t} value={info.ownerSsn} onChange={(v) => update('ownerSsn', v)} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <FieldLabel t={t}>Ownership %</FieldLabel>
                  <TextField
                    t={t}
                    value={info.ownerPercent}
                    onChange={(v) => update('ownerPercent', v.replace(/\D/g, '').slice(0, 3))}
                    mono
                    inputMode="decimal"
                    placeholder="100"
                  />
                </div>
                <div style={{ flex: 2, minWidth: 0 }}>
                  <FieldLabel t={t}>Title</FieldLabel>
                  <TextField
                    t={t}
                    value={info.ownerTitle}
                    onChange={(v) => update('ownerTitle', v)}
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
                const on = info.preparingPersonal === o.id;
                return (
                  <button
                    key={o.id}
                    onClick={() => update('preparingPersonal', o.id)}
                    style={{
                      flex: 1,
                      padding: '14px 16px',
                      background: on ? t.tintAccent : t.card,
                      border: `1px solid ${on ? t.rust : t.border}`,
                      borderRadius: t.radius,
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
                        border: `1.5px solid ${on ? t.rust : t.border}`,
                        background: '#fff',
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
                            background: t.rust,
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

          <AntonioNote t={t}>
            If you&apos;re not sure about entity type or accounting method, don&apos;t worry. I&apos;ll
            verify everything.
          </AntonioNote>
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
              onClick={() => nav.back('/services-addons')}
              style={{ flex: '0 0 auto' }}
            >
              Back
            </Button>
            <Button t={t} onClick={() => nav.next('/income')} style={{ flex: 1 }}>
              Continue
            </Button>
          </Row>
        </div>
      </div>
    </Screen>
  );
}
