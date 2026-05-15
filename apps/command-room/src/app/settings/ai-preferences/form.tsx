// /settings/ai-preferences client form.
//
// Renders the AI Preferences form + saves via the server action.
// Disabled state when canEdit=false (non-owners can view but not edit).

'use client';

import { useState, useTransition } from 'react';
import { saveAiPreferences } from './actions';

export type AiPreferencesValues = {
  tone: 'professional' | 'warm' | 'direct';
  discovery_insights: boolean;
  compliance_flags: boolean;
  risk_tier_classification: boolean;
  deadline_alerts: boolean;
  pricing_inconsistency_alerts: boolean;
  churn_risk_alerts: boolean;
  capacity_warnings: boolean;
  personality: string;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
};

type Props = {
  initialValues: AiPreferencesValues;
  canEdit: boolean;
};

const TONE_DESCRIPTIONS = {
  professional: 'Crisp, structured, business-formal. Defaults for B2B firms.',
  warm: 'Friendly + direct, "Antonio voice." Default for solo + small firms.',
  direct: 'Spare, no filler. For preparers who hate fluff.',
};

const INSIGHT_TOGGLES: Array<{
  key: Exclude<
    keyof AiPreferencesValues,
    'tone' | 'personality' | 'quiet_hours_enabled' | 'quiet_hours_start' | 'quiet_hours_end'
  >;
  label: string;
  description: string;
}> = [
  {
    key: 'discovery_insights',
    label: 'Discovery insights',
    description:
      'Continuous deduction surfacing across the book. The Discovery agent runs in the background and surfaces missed deductions with cited authority.',
  },
  {
    key: 'compliance_flags',
    label: 'Compliance flags',
    description:
      'Surface Tier 3 + 4 positions for preparer review. Disabling hides borderline-aggressive items from the dashboard (they still log to the audit chain).',
  },
  {
    key: 'risk_tier_classification',
    label: 'Risk tier pills',
    description:
      'Green / amber / red pill per client on every list view, summarizing compliance posture + payment + friction + scope-creep.',
  },
  {
    key: 'deadline_alerts',
    label: 'Deadline alerts',
    description:
      'Morning Brief surfaces deadline-risk clients with N days remaining.',
  },
  {
    key: 'pricing_inconsistency_alerts',
    label: 'Pricing inconsistency alerts',
    description:
      'Flag when similar-effort engagements were quoted at different fees. Useful for scope-creep + margin-leakage; disable if this feels intrusive.',
  },
  {
    key: 'churn_risk_alerts',
    label: 'Churn risk alerts',
    description:
      'Surface clients with delayed response patterns + payment friction as potential churn signals.',
  },
  {
    key: 'capacity_warnings',
    label: 'Capacity warnings',
    description:
      'Manager mission-control surface (V1.5). Warns when per-staff load exceeds threshold or when tax-season throughput slips behind projection.',
  },
];

export function AiPreferencesForm({ initialValues, canEdit }: Props) {
  const [values, setValues] = useState<AiPreferencesValues>(initialValues);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<
    { tone: 'ok' | 'error'; text: string } | null
  >(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canEdit) return;
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await saveAiPreferences(formData);
      if (res.ok) {
        setMessage({ tone: 'ok', text: 'Saved.' });
      } else {
        setMessage({ tone: 'error', text: res.error });
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: 28 }}
    >
      <FormSection title="Voice" description="How the AI sounds in client-facing drafts.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(['warm', 'professional', 'direct'] as const).map((tone) => (
            <label
              key={tone}
              style={{
                display: 'flex',
                gap: 12,
                padding: '12px 14px',
                border: '1px solid oklch(92% 0.008 85)',
                background:
                  values.tone === tone
                    ? 'oklch(96% 0.02 150)'
                    : 'oklch(99% 0.005 85)',
                borderColor:
                  values.tone === tone
                    ? 'oklch(42% 0.09 150)'
                    : 'oklch(92% 0.008 85)',
                borderRadius: 10,
                cursor: canEdit ? 'pointer' : 'not-allowed',
                opacity: canEdit ? 1 : 0.7,
              }}
            >
              <input
                type="radio"
                name="tone"
                value={tone}
                checked={values.tone === tone}
                onChange={() => setValues({ ...values, tone })}
                disabled={!canEdit}
                style={{ marginTop: 2 }}
              />
              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: 'oklch(20% 0.01 85)',
                    textTransform: 'capitalize',
                  }}
                >
                  {tone}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'oklch(45% 0.01 85)',
                    marginTop: 2,
                    lineHeight: 1.5,
                  }}
                >
                  {TONE_DESCRIPTIONS[tone]}
                </div>
              </div>
            </label>
          ))}
        </div>
      </FormSection>

      <FormSection
        title="Insight surfaces"
        description="What the AI is allowed to surface on the dashboard."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {INSIGHT_TOGGLES.map(({ key, label, description }) => (
            <ToggleRow
              key={key}
              name={key}
              label={label}
              description={description}
              checked={values[key]}
              onChange={(v) => setValues({ ...values, [key]: v })}
              disabled={!canEdit}
            />
          ))}
        </div>
      </FormSection>

      <FormSection
        title="Petal Personality"
        description="Optional firm-specific tone tweak appended to every agent's system prompt. ≤500 characters."
      >
        <textarea
          name="personality"
          value={values.personality}
          onChange={(e) =>
            setValues({ ...values, personality: e.target.value.slice(0, 500) })
          }
          disabled={!canEdit}
          rows={4}
          placeholder='e.g., "Always close emails with &quot;Stay well —&quot; instead of &quot;Best,&quot;. Avoid the phrase &quot;please find attached.&quot;"'
          style={{
            width: '100%',
            padding: '10px 12px',
            fontFamily: 'inherit',
            fontSize: 13,
            border: '1px solid oklch(92% 0.008 85)',
            borderRadius: 10,
            resize: 'vertical',
            background: canEdit ? 'oklch(99% 0.005 85)' : 'oklch(96% 0.005 85)',
            color: 'oklch(20% 0.01 85)',
          }}
        />
        <div
          style={{
            marginTop: 4,
            fontSize: 11,
            color: 'oklch(55% 0.01 85)',
            textAlign: 'right',
          }}
        >
          {values.personality.length} / 500
        </div>
      </FormSection>

      <FormSection
        title="Quiet Hours"
        description="Outbound agent comms hold during this window. Drafts still queue; nothing sends. Inherited by Reminders + Notifications."
      >
        <ToggleRow
          name="quiet_hours_enabled"
          label="Enable Quiet Hours"
          description="When off, the AI can send any time of day. Default on."
          checked={values.quiet_hours_enabled}
          onChange={(v) => setValues({ ...values, quiet_hours_enabled: v })}
          disabled={!canEdit}
        />
        <div
          style={{
            display: 'flex',
            gap: 16,
            marginTop: 12,
            opacity: values.quiet_hours_enabled ? 1 : 0.4,
          }}
        >
          <TimeField
            label="Start (firm-local)"
            name="quiet_hours_start"
            value={values.quiet_hours_start}
            onChange={(v) => setValues({ ...values, quiet_hours_start: v })}
            disabled={!canEdit || !values.quiet_hours_enabled}
          />
          <TimeField
            label="End (firm-local)"
            name="quiet_hours_end"
            value={values.quiet_hours_end}
            onChange={(v) => setValues({ ...values, quiet_hours_end: v })}
            disabled={!canEdit || !values.quiet_hours_enabled}
          />
        </div>
      </FormSection>

      {canEdit && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            paddingTop: 12,
            borderTop: '1px solid oklch(92% 0.008 85)',
          }}
        >
          <button
            type="submit"
            disabled={pending}
            style={{
              padding: '10px 18px',
              background: 'oklch(42% 0.09 150)',
              color: 'oklch(98% 0.01 85)',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              cursor: pending ? 'wait' : 'pointer',
              letterSpacing: 0.1,
            }}
          >
            {pending ? 'Saving…' : 'Save preferences'}
          </button>
          {message && (
            <span
              style={{
                fontSize: 13,
                color:
                  message.tone === 'ok'
                    ? 'oklch(42% 0.09 150)'
                    : 'oklch(52% 0.18 28)',
              }}
            >
              {message.text}
            </span>
          )}
        </div>
      )}
    </form>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: 'oklch(20% 0.01 85)',
          margin: '0 0 4px 0',
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontSize: 13,
          color: 'oklch(45% 0.01 85)',
          margin: '0 0 14px 0',
          lineHeight: 1.55,
        }}
      >
        {description}
      </p>
      {children}
    </section>
  );
}

function ToggleRow({
  name,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  name: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <label
      style={{
        display: 'flex',
        gap: 14,
        padding: '12px 14px',
        background: 'oklch(99% 0.005 85)',
        border: '1px solid oklch(92% 0.008 85)',
        borderRadius: 10,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.7 : 1,
      }}
    >
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        style={{ marginTop: 3, width: 16, height: 16 }}
      />
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'oklch(20% 0.01 85)',
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'oklch(45% 0.01 85)',
            marginTop: 2,
            lineHeight: 1.5,
          }}
        >
          {description}
        </div>
      </div>
    </label>
  );
}

function TimeField({
  label,
  name,
  value,
  onChange,
  disabled,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: 12,
          color: 'oklch(45% 0.01 85)',
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      <input
        type="time"
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          padding: '8px 12px',
          fontSize: 13,
          fontFamily: 'inherit',
          border: '1px solid oklch(92% 0.008 85)',
          borderRadius: 8,
          background: disabled ? 'oklch(96% 0.005 85)' : 'oklch(99% 0.005 85)',
          color: 'oklch(20% 0.01 85)',
        }}
      />
    </div>
  );
}
