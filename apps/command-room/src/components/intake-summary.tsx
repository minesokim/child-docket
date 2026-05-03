// Intake summary panel for the per-client detail page.
//
// Renders the structured intake_responses.answers tree as a series of
// labeled sections so Antonio can see what the client has filled in
// without having to walk the same 13 screens the client did. Sensitive
// values (SSN/EIN/bank) arrive masked from the server-side
// maskSensitiveFields call — this component never sees plaintext by
// default. Plaintext access goes through the per-session unlock flow:
// each masked surface renders a <MaskedPII> that consumes the
// PIIUnlockProvider context. One unlock click in the page header flips
// every masked value to plaintext for 15 minutes (auto-locks). Role-gated
// (firm_owner | preparer | reviewer), rate-limited (6 unlocks/min/user),
// audit-logged ONE row per unlock.
//
// Each section renders ONLY when there's data to show. A blank intake
// renders just the status pill ("not started"). A half-finished one
// renders the populated sections and skips the rest.

import type { Theme } from '@docket/ui';
import type { IntakeState } from '@docket/shared';
import { MaskedPII } from './masked-pii';

type IntakeBundle = {
  taxYear: number;
  status: string;
  completedSteps: string[];
  answers: IntakeState;
  startedAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

const SERVICE_LABEL: Record<string, string> = {
  personal: 'Personal tax return (1040)',
  self: 'Self-employed return',
  business: 'Business return',
  other: 'Consultation',
};

const FILING_LABEL: Record<string, string> = {
  single: 'Single',
  mfj: 'Married filing jointly',
  mfs: 'Married filing separately',
  hoh: 'Head of household',
  qw: 'Qualifying widow(er)',
};

const INCOME_LABEL: Record<string, string> = {
  w2: 'W-2 wages',
  self: 'Self-employment',
  rental: 'Rental property',
  interest: 'Interest',
  dividends: 'Dividends',
  retirement: 'Retirement / pension',
  socialSecurity: 'Social Security',
  unemployment: 'Unemployment',
};

const TAX_QUESTION_LABEL: Record<string, string> = {
  crypto: 'Digital assets / crypto',
  estimated: 'Estimated tax payments',
  healthAll: 'Health insurance all year',
  retirement: 'IRA / HSA contributions',
  foreign: 'Foreign accounts > $10k',
  overtime: 'Overtime pay',
  tips: 'Tips at work',
};

const DEDUCTION_LABEL: Record<string, string> = {
  mortgage: 'Mortgage interest',
  student: 'Student loans',
  charity: 'Charitable donations',
  childcare: 'Childcare costs',
  medical: 'Medical expenses',
  education: 'Education / tuition',
  educator: 'Educator expenses',
};

const LIFE_EVENT_LABEL: Record<string, string> = {
  marriage: 'Got married or divorced',
  baby: 'Had a baby or adopted',
  home: 'Bought or sold a home',
  business: 'Started a business',
  inherit: 'Received an inheritance',
  retire: 'Retired',
};

export function IntakeSummary({ t, intake }: { t: Theme; intake: IntakeBundle | null }) {
  if (!intake) {
    return (
      <div
        style={{
          background: t.card,
          border: `1px dashed ${t.border}`,
          borderRadius: 10,
          padding: '24px 20px',
          textAlign: 'center',
          fontSize: 13,
          color: t.muted,
        }}
      >
        Intake not started yet
      </div>
    );
  }

  const a = intake.answers;
  const lastUpdated = formatRelative(intake.updatedAt);

  return (
    <div
      style={{
        background: t.card,
        border: `1px solid ${t.border}`,
        borderRadius: 14,
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      {/* Status header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 14,
          paddingBottom: 16,
          borderBottom: `1px solid ${t.borderSoft}`,
        }}
      >
        <div>
          <div style={{ fontFamily: t.serif, fontSize: 19, color: t.ink, letterSpacing: -0.2 }}>
            Tax year {intake.taxYear}
          </div>
          <div
            style={{
              fontFamily: t.mono,
              fontSize: 11,
              color: t.muted,
              marginTop: 4,
              letterSpacing: 0.3,
            }}
          >
            {intake.completedSteps.length} {intake.completedSteps.length === 1 ? 'step' : 'steps'}{' '}
            done · last activity {lastUpdated}
          </div>
        </div>
        <StatusPill t={t} status={intake.status} />
      </div>

      {/* Service path */}
      {a.service?.kind && (
        <Field t={t} label="Service">
          {SERVICE_LABEL[a.service.kind] ?? a.service.kind}
          {a.service.otherSub && ` · ${a.service.otherSub}`}
        </Field>
      )}

      {/* Personal */}
      {(a.personal?.fullName || a.personal?.dateOfBirth || a.personal?.ssn) && (
        <Field t={t} label="Personal">
          <div>{a.personal.fullName ?? '—'}</div>
          {a.personal.dateOfBirth && (
            <div style={{ color: t.muted, fontSize: 12.5, marginTop: 2 }}>
              DOB {formatDate(a.personal.dateOfBirth)}
            </div>
          )}
          {a.personal.ssn && (
            <div
              style={{
                marginTop: 2,
                fontSize: 12,
                color: t.muted,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span
                style={{
                  fontFamily: t.mono,
                  fontSize: 9.5,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                }}
              >
                SSN
              </span>
              <MaskedPII t={t} path="personal.ssn" masked={a.personal.ssn} />
            </div>
          )}
          {a.personal.occupation && (
            <div style={{ color: t.muted, fontSize: 12.5, marginTop: 2 }}>
              {a.personal.occupation}
            </div>
          )}
        </Field>
      )}

      {/* Address */}
      {(a.personal?.street || a.personal?.city) && (
        <Field t={t} label="Address">
          {a.personal.street && <div>{a.personal.street}</div>}
          <div style={{ color: t.muted, fontSize: 12.5, marginTop: 2 }}>
            {[a.personal.city, a.personal.addressState, a.personal.zip].filter(Boolean).join(', ')}
          </div>
        </Field>
      )}

      {/* State + filing context */}
      {(a.state?.primaryState || a.state?.filedLast) && (
        <Field t={t} label="State">
          {a.state.primaryState && <div>{a.state.primaryState}</div>}
          {a.state.additionalState && (
            <div style={{ color: t.muted, fontSize: 12.5, marginTop: 2 }}>
              + {a.state.additionalState}
            </div>
          )}
          {a.state.filedLast && (
            <div style={{ color: t.muted, fontSize: 12.5, marginTop: 2 }}>
              Filed last year: {a.state.filedLast === 'yes' ? 'yes' : 'no'}
              {a.state.preparer && ` · ${a.state.preparer}`}
            </div>
          )}
        </Field>
      )}

      {/* Filing status */}
      {a.filing?.status && (
        <Field t={t} label="Filing status">
          {FILING_LABEL[a.filing.status] ?? a.filing.status}
        </Field>
      )}

      {/* Spouse */}
      {a.spouse?.fullName && (
        <Field t={t} label="Spouse">
          <div>{a.spouse.fullName}</div>
          {a.spouse.dateOfBirth && (
            <div style={{ color: t.muted, fontSize: 12.5, marginTop: 2 }}>
              DOB {formatDate(a.spouse.dateOfBirth)}
            </div>
          )}
          {a.spouse.ssn && (
            <div
              style={{
                marginTop: 2,
                fontSize: 12,
                color: t.muted,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span
                style={{
                  fontFamily: t.mono,
                  fontSize: 9.5,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                }}
              >
                SSN
              </span>
              <MaskedPII t={t} path="spouse.ssn" masked={a.spouse.ssn} />
            </div>
          )}
          {a.spouse.occupation && (
            <div style={{ color: t.muted, fontSize: 12.5, marginTop: 2 }}>{a.spouse.occupation}</div>
          )}
        </Field>
      )}

      {/* Dependents */}
      {(a.dependents?.count ?? 0) > 0 && (
        <Field t={t} label={`Dependents · ${a.dependents?.count}`}>
          {a.dependents?.list && a.dependents.list.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {a.dependents.list.map((d, i) => (
                <div key={i}>
                  <span>{d.fullName ?? 'Unnamed'}</span>
                  {d.relationship && (
                    <span style={{ color: t.muted, marginLeft: 6 }}>· {d.relationship}</span>
                  )}
                  {d.dateOfBirth && (
                    <span
                      style={{
                        color: t.muted,
                        fontFamily: t.mono,
                        fontSize: 11,
                        marginLeft: 6,
                      }}
                    >
                      {formatDate(d.dateOfBirth)}
                    </span>
                  )}
                  {d.ssn && (
                    <span style={{ marginLeft: 6 }}>
                      <MaskedPII t={t} path={`dependents.list.${i}.ssn`} masked={d.ssn} />
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <span style={{ color: t.muted }}>Count provided, details not yet captured</span>
          )}
        </Field>
      )}

      {/* Income */}
      {a.income?.types && a.income.types.length > 0 && (
        <Field t={t} label="Income types">
          {a.income.types.map((type) => INCOME_LABEL[type] ?? type).join(' · ')}
        </Field>
      )}

      {/* Self-employment */}
      {a.selfEmployment?.businessName && (
        <Field t={t} label="Self-employment">
          <div>
            {a.selfEmployment.businessName}
            {a.selfEmployment.entityType && (
              <span style={{ color: t.muted, marginLeft: 6 }}>· {a.selfEmployment.entityType}</span>
            )}
          </div>
          {a.selfEmployment.whatYouDo && (
            <div style={{ color: t.muted, fontSize: 12.5, marginTop: 2 }}>
              {a.selfEmployment.whatYouDo}
            </div>
          )}
          {a.selfEmployment.revenue && (
            <div
              style={{
                color: t.muted,
                fontFamily: t.mono,
                fontSize: 12,
                marginTop: 2,
              }}
            >
              Revenue {a.selfEmployment.revenue}
            </div>
          )}
          {a.selfEmployment.ein && (
            <div
              style={{
                marginTop: 2,
                fontSize: 12,
                color: t.muted,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span
                style={{
                  fontFamily: t.mono,
                  fontSize: 9.5,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                }}
              >
                EIN
              </span>
              <MaskedPII t={t} path="selfEmployment.ein" masked={a.selfEmployment.ein} />
            </div>
          )}
          <div
            style={{
              color: t.muted,
              fontSize: 12.5,
              marginTop: 4,
              display: 'flex',
              gap: 10,
            }}
          >
            {a.selfEmployment.homeOffice && <span>· Home office</span>}
            {a.selfEmployment.vehicle && <span>· Vehicle</span>}
            {a.selfEmployment.cash && <span>· Mostly cash</span>}
          </div>
        </Field>
      )}

      {/* Tax questions (only "yes" answers) */}
      {a.taxQuestions && Object.entries(a.taxQuestions).some(([, v]) => v === true) && (
        <Field t={t} label="Tax questions (yes)">
          {Object.entries(a.taxQuestions)
            .filter(([, v]) => v === true)
            .map(([k]) => TAX_QUESTION_LABEL[k] ?? k)
            .join(' · ')}
        </Field>
      )}

      {/* Deductions */}
      {a.deductions && Object.entries(a.deductions).some(([k, v]) => v === true && k !== 'none') && (
        <Field t={t} label="Deductions">
          {Object.entries(a.deductions)
            .filter(([k, v]) => v === true && k !== 'none' && k !== 'childcareDetails')
            .map(([k]) => DEDUCTION_LABEL[k] ?? k)
            .join(' · ')}
        </Field>
      )}

      {/* Life events */}
      {a.lifeEvents && Object.entries(a.lifeEvents).some(([k, v]) => v === true && k !== 'none') && (
        <Field t={t} label="Life events">
          {Object.entries(a.lifeEvents)
            .filter(([k, v]) => v === true && k !== 'none')
            .map(([k]) => LIFE_EVENT_LABEL[k] ?? k)
            .join(' · ')}
        </Field>
      )}

      {/* Refund preference */}
      {a.refund?.preference && (
        <Field t={t} label="Refund">
          <div>{a.refund.preference}</div>
          {(a.refund.bankName || a.refund.bankAccount || a.refund.bankRouting) && (
            <div
              style={{
                color: t.muted,
                fontSize: 12.5,
                marginTop: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              {a.refund.bankName && (
                <div>
                  {a.refund.bankName}
                  {a.refund.bankAccountType && <span> · {a.refund.bankAccountType}</span>}
                </div>
              )}
              {a.refund.bankRouting && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      fontFamily: t.mono,
                      fontSize: 9.5,
                      letterSpacing: 0.6,
                      textTransform: 'uppercase',
                    }}
                  >
                    Routing
                  </span>
                  <MaskedPII t={t} path="refund.bankRouting" masked={a.refund.bankRouting} />
                </div>
              )}
              {a.refund.bankAccount && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      fontFamily: t.mono,
                      fontSize: 9.5,
                      letterSpacing: 0.6,
                      textTransform: 'uppercase',
                    }}
                  >
                    Account
                  </span>
                  <MaskedPII t={t} path="refund.bankAccount" masked={a.refund.bankAccount} />
                </div>
              )}
            </div>
          )}
        </Field>
      )}

      {/* Appointment */}
      {a.appointment?.format && (
        <Field t={t} label="Appointment">
          {a.appointment.format === 'video' ? 'Video call' : 'In-person'}
        </Field>
      )}
    </div>
  );
}

function Field({
  t,
  label,
  children,
}: {
  t: Theme;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span
        style={{
          fontFamily: t.mono,
          fontSize: 9.5,
          color: t.muted,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <div style={{ fontSize: 14, color: t.ink, lineHeight: 1.4 }}>{children}</div>
    </div>
  );
}

function StatusPill({ t, status }: { t: Theme; status: string }) {
  const palette =
    status === 'complete'
      ? { bg: '#1f4621', fg: '#fff', label: 'Complete' }
      : status === 'abandoned'
      ? { bg: t.borderSoft, fg: t.muted, label: 'Abandoned' }
      : { bg: t.tintAccent, fg: t.rustInk, label: 'In progress' };
  return (
    <span
      style={{
        display: 'inline-flex',
        padding: '5px 11px',
        borderRadius: 999,
        fontFamily: t.mono,
        fontSize: 10,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        background: palette.bg,
        color: palette.fg,
      }}
    >
      {palette.label}
    </span>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

function formatRelative(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffD = Math.floor(diffHr / 24);
  if (diffD < 30) return `${diffD}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
