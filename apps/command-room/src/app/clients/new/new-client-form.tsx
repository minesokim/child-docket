'use client';

// Client-side form for creating a new client + sharing the invite link.
// Two stages:
//   1. Form: name + phone (+ optional email/state).
//   2. Success card: shareable link, prefilled SMS body, copy buttons,
//      native Share API on mobile.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { buildTheme } from '@docket/ui';
import { createClient } from '@/lib/clients/create';
import { sendInviteSms } from '@/lib/clients/send-invite-sms';

const COUNTRIES: Array<{ code: string; name: string; dial: string; flag: string }> = [
  { code: 'US', name: 'United States', dial: '+1', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦' },
  { code: 'MX', name: 'Mexico', dial: '+52', flag: '🇲🇽' },
  { code: 'KR', name: 'South Korea', dial: '+82', flag: '🇰🇷' },
  { code: 'CN', name: 'China', dial: '+86', flag: '🇨🇳' },
  { code: 'IN', name: 'India', dial: '+91', flag: '🇮🇳' },
  { code: 'PH', name: 'Philippines', dial: '+63', flag: '🇵🇭' },
  { code: 'VN', name: 'Vietnam', dial: '+84', flag: '🇻🇳' },
  { code: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧' },
  { code: 'BR', name: 'Brazil', dial: '+55', flag: '🇧🇷' },
];

const US_STATE_OPTIONS = [
  '', 'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID',
  'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO',
  'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA',
  'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
];

type FormState = {
  fullName: string;
  countryCode: string;
  phoneDigits: string;
  email: string;
  state: string;
};

type SuccessState = {
  clientId: string;
  fullName: string;
  phone: string;
};

export function NewClientForm({
  clientPortalUrl,
  firmOwnerFirstName,
}: {
  clientPortalUrl: string;
  firmOwnerFirstName: string;
}) {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const router = useRouter();

  const [form, setForm] = React.useState<FormState>({
    fullName: '',
    countryCode: 'US',
    phoneDigits: '',
    email: '',
    state: '',
  });
  const [error, setError] = React.useState<string | null>(null);
  const [errorField, setErrorField] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState<SuccessState | null>(null);

  const country = COUNTRIES.find((c) => c.code === form.countryCode) ?? COUNTRIES[0]!;
  const phoneE164 = `${country.dial}${form.phoneDigits.replace(/\D/g, '')}`;

  // Format US/CA phone display as the user types: (555) 555-5555.
  const displayPhone = React.useMemo(() => {
    const digits = form.phoneDigits.replace(/\D/g, '');
    if (form.countryCode === 'US' || form.countryCode === 'CA') {
      if (digits.length < 4) return digits;
      if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
    return digits;
  }, [form.phoneDigits, form.countryCode]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setErrorField(null);

    const result = await createClient({
      fullName: form.fullName,
      phone: phoneE164,
      email: form.email || undefined,
      state: form.state || undefined,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      setErrorField(result.field ?? null);
      return;
    }

    setSuccess({
      clientId: result.clientId,
      fullName: result.fullName,
      phone: result.phone,
    });
  };

  if (success) {
    return (
      <SuccessCard
        t={t}
        success={success}
        clientPortalUrl={clientPortalUrl}
        countryCode={form.countryCode}
        firmOwnerFirstName={firmOwnerFirstName}
        onDone={() => router.push(`/clients/${success.clientId}`)}
        onAddAnother={() => {
          setSuccess(null);
          setForm({
            fullName: '',
            countryCode: 'US',
            phoneDigits: '',
            email: '',
            state: '',
          });
        }}
      />
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <div
        style={{
          background: t.card,
          border: `1px solid ${t.border}`,
          borderRadius: 14,
          padding: '22px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        {/* Full name */}
        <Field t={t} label="Full name" required error={errorField === 'fullName' ? error : null}>
          <input
            type="text"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            placeholder="e.g. Jane Doe"
            autoFocus
            style={inputStyle(t)}
          />
        </Field>

        {/* Phone */}
        <Field t={t} label="Phone number" required error={errorField === 'phone' ? error : null}>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={form.countryCode}
              onChange={(e) => setForm({ ...form, countryCode: e.target.value })}
              style={{
                ...inputStyle(t),
                width: 80,
                fontFamily: t.sans,
                cursor: 'pointer',
              }}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.dial}
                </option>
              ))}
            </select>
            <input
              type="tel"
              value={displayPhone}
              onChange={(e) =>
                setForm({ ...form, phoneDigits: e.target.value.replace(/\D/g, '').slice(0, 15) })
              }
              placeholder="(555) 555-5555"
              style={{ ...inputStyle(t), flex: 1, fontFamily: t.mono }}
            />
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
            Stored as {phoneE164}
          </div>
        </Field>

        {/* Email (optional) */}
        <Field t={t} label="Email (optional)" error={errorField === 'email' ? error : null}>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="jane@example.com"
            style={inputStyle(t)}
          />
        </Field>

        {/* State (optional) */}
        <Field t={t} label="State (optional)">
          <select
            value={form.state}
            onChange={(e) => setForm({ ...form, state: e.target.value })}
            style={{ ...inputStyle(t), cursor: 'pointer' }}
          >
            {US_STATE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s || '—'}
              </option>
            ))}
          </select>
        </Field>

        {error && !errorField && (
          <div
            style={{
              padding: '10px 12px',
              background: '#fff0eb',
              border: `1px solid ${t.rust}`,
              borderRadius: 8,
              color: '#7a3a26',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
        <button
          type="button"
          onClick={() => router.push('/clients')}
          style={{
            padding: '10px 20px',
            background: 'transparent',
            border: `1px solid ${t.border}`,
            borderRadius: 8,
            color: t.inkSoft,
            fontSize: 13.5,
            fontFamily: t.sans,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !form.fullName.trim() || !form.phoneDigits.trim()}
          style={{
            padding: '10px 22px',
            background: t.ink,
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 13.5,
            fontFamily: t.sans,
            fontWeight: 500,
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity:
              submitting || !form.fullName.trim() || !form.phoneDigits.trim() ? 0.5 : 1,
            transition: 'opacity 120ms',
          }}
        >
          {submitting ? 'Adding…' : 'Add client'}
        </button>
      </div>
    </form>
  );
}

function SuccessCard({
  t,
  success,
  clientPortalUrl,
  countryCode,
  firmOwnerFirstName,
  onDone,
  onAddAnother,
}: {
  t: ReturnType<typeof buildTheme>;
  success: SuccessState;
  clientPortalUrl: string;
  countryCode: string;
  firmOwnerFirstName: string;
  onDone: () => void;
  onAddAnother: () => void;
}) {
  const url = `${clientPortalUrl}/login?phone=${encodeURIComponent(success.phone)}&country=${countryCode}`;
  const firstName = success.fullName.split(/\s+/)[0] ?? success.fullName;
  const defaultMessage = `Hi ${firstName}, this is ${firmOwnerFirstName}. Your tax intake portal is ready. Sign in with this phone number (${success.phone}): ${url}`;

  // Editable message body. Defaults to the templated invite; preparer
  // can rewrite it freely (warm-up text, language switch, removing
  // the URL for a follow-up reminder, etc.). The textarea value is
  // what gets copied AND what gets sent — both paths use the same
  // string so the preview matches the actual delivery.
  const [customMessage, setCustomMessage] = React.useState(defaultMessage);
  // SMS segment math (rough — Twilio's exact segmentation depends on
  // GSM-7 vs UCS-2; this is a 160-char-per-segment approximation that
  // matches the common case of plain Latin text).
  const charCount = customMessage.length;
  const segmentCount = Math.max(1, Math.ceil(charCount / 160));
  const hasUrl = customMessage.includes(url);

  const [linkCopied, setLinkCopied] = React.useState(false);
  const [messageCopied, setMessageCopied] = React.useState(false);

  const copy = async (text: string, kind: 'link' | 'message') => {
    try {
      await navigator.clipboard.writeText(text);
      if (kind === 'link') {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 1800);
      } else {
        setMessageCopied(true);
        setTimeout(() => setMessageCopied(false), 1800);
      }
    } catch {
      // navigator.clipboard fails on http: or older browsers — fall
      // back to a manual selection prompt. Rare on Vercel HTTPS.
      window.prompt('Copy this:', text);
    }
  };

  // Send via SMS (Twilio) — wired against the per-tenant credential
  // vault. Server action authenticates, loads the firm's Twilio
  // creds (encrypted with tenant DEK), POSTs to Twilio Messages
  // API, audit-logs the send. Per-firm sender number means each
  // firm's clients see SMS from that firm's verified number, not a
  // shared Docket number.
  type SmsState =
    | { kind: 'idle' }
    | { kind: 'sending' }
    | { kind: 'sent'; sid: string; toMasked: string }
    | { kind: 'error'; message: string };
  const [smsState, setSmsState] = React.useState<SmsState>({ kind: 'idle' });

  const onSendSms = async () => {
    if (smsState.kind === 'sending' || smsState.kind === 'sent') return;
    setSmsState({ kind: 'sending' });
    const result = await sendInviteSms(success.clientId, customMessage);
    if (!result.ok) {
      setSmsState({ kind: 'error', message: result.error });
      // Auto-clear error after a beat so the user can retry.
      setTimeout(() => {
        setSmsState((s) => (s.kind === 'error' ? { kind: 'idle' } : s));
      }, 6_000);
      return;
    }
    setSmsState({ kind: 'sent', sid: result.sid, toMasked: result.toMasked });
  };

  const sendDisabled = smsState.kind === 'sending' || smsState.kind === 'sent';
  const sendLabel =
    smsState.kind === 'sending'
      ? 'Sending…'
      : smsState.kind === 'sent'
        ? 'Sent ✓'
        : 'Send via SMS';

  return (
    <div
      style={{
        background: t.card,
        border: `1px solid ${t.border}`,
        borderRadius: 14,
        padding: '24px 26px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      <div>
        <div
          style={{
            display: 'inline-flex',
            padding: '4px 10px',
            background: '#1f4621',
            color: '#fff',
            borderRadius: 999,
            fontFamily: t.mono,
            fontSize: 10,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          Client added
        </div>
        <h2
          style={{
            fontFamily: t.serif,
            fontSize: 22,
            color: t.ink,
            letterSpacing: -0.4,
            margin: 0,
            marginBottom: 4,
          }}
        >
          {success.fullName}
        </h2>
        <div style={{ fontFamily: t.mono, fontSize: 12, color: t.muted, letterSpacing: 0.3 }}>
          {success.phone}
        </div>
      </div>

      <div style={{ height: 1, background: t.borderSoft }} />

      {/* Share link block */}
      <div>
        <div
          style={{
            fontFamily: t.mono,
            fontSize: 9.5,
            color: t.muted,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Sign-in link
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: t.bgElev,
            border: `1px solid ${t.borderSoft}`,
            borderRadius: 8,
            padding: '10px 12px',
          }}
        >
          <code
            style={{
              flex: 1,
              fontFamily: t.mono,
              fontSize: 12,
              color: t.ink,
              wordBreak: 'break-all',
              minWidth: 0,
            }}
          >
            {url}
          </code>
          <button
            onClick={() => copy(url, 'link')}
            style={{
              padding: '6px 12px',
              background: t.ink,
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
              fontFamily: t.sans,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {linkCopied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* SMS message block — editable. Whatever the preparer types here
          is what gets copied AND what gets sent via Twilio. */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 8,
          }}
        >
          <div
            style={{
              fontFamily: t.mono,
              fontSize: 9.5,
              color: t.muted,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
            }}
          >
            SMS / email message
          </div>
          {customMessage !== defaultMessage && (
            <button
              type="button"
              onClick={() => setCustomMessage(defaultMessage)}
              style={{
                fontFamily: t.mono,
                fontSize: 10,
                color: t.muted,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                letterSpacing: 0.3,
              }}
            >
              Reset to default
            </button>
          )}
        </div>
        <textarea
          value={customMessage}
          onChange={(e) => {
            setCustomMessage(e.target.value);
            // If the user edits after a successful send, drop the
            // sent state so they can send the new version.
            if (smsState.kind === 'sent' || smsState.kind === 'error') {
              setSmsState({ kind: 'idle' });
            }
          }}
          rows={5}
          style={{
            width: '100%',
            background: t.bgElev,
            border: `1px solid ${t.borderSoft}`,
            borderRadius: 8,
            padding: '12px 14px',
            fontSize: 13.5,
            fontFamily: t.sans,
            color: t.ink,
            lineHeight: 1.5,
            resize: 'vertical',
            outline: 'none',
            boxSizing: 'border-box',
            minHeight: 100,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = t.ink;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = t.borderSoft;
          }}
        />
        <div
          style={{
            marginTop: 6,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontFamily: t.mono,
            fontSize: 10,
            color: t.muted,
            letterSpacing: 0.3,
          }}
        >
          <span>
            {charCount} chars · {segmentCount} {segmentCount === 1 ? 'segment' : 'segments'}
          </span>
          {!hasUrl && (
            <span style={{ color: t.rust }} title="The sign-in link is missing — recipient won't be able to access the portal.">
              ⚠ Sign-in link missing
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
          <button
            onClick={() => copy(customMessage, 'message')}
            style={{
              padding: '8px 16px',
              background: t.ink,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontFamily: t.sans,
              cursor: 'pointer',
            }}
          >
            {messageCopied ? 'Copied' : 'Copy message'}
          </button>
          <button
            type="button"
            onClick={onSendSms}
            disabled={sendDisabled}
            title={
              smsState.kind === 'sent'
                ? `Twilio SID: ${smsState.sid}`
                : 'Send the invite SMS via Twilio'
            }
            style={{
              padding: '8px 16px',
              background: smsState.kind === 'sent' ? '#1f4621' : 'transparent',
              border: `1px solid ${smsState.kind === 'sent' ? '#1f4621' : t.border}`,
              borderRadius: 8,
              fontSize: 13,
              color: smsState.kind === 'sent' ? '#fff' : t.ink,
              fontFamily: t.sans,
              cursor: sendDisabled ? 'not-allowed' : 'pointer',
              opacity: smsState.kind === 'sending' ? 0.7 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              transition: 'background 120ms, color 120ms',
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M2 4.5C2 3.67 2.67 3 3.5 3h7c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5H6l-3 2v-2H3.5c-.83 0-1.5-.67-1.5-1.5v-5z" />
            </svg>
            {sendLabel}
          </button>
          {smsState.kind === 'sent' && (
            <span
              style={{
                fontFamily: t.mono,
                fontSize: 10.5,
                color: t.muted,
                letterSpacing: 0.3,
                marginLeft: 2,
              }}
              title={`Twilio SID: ${smsState.sid}`}
            >
              {smsState.toMasked}
            </span>
          )}
          {smsState.kind === 'error' && (
            <span
              style={{
                fontFamily: t.sans,
                fontSize: 12,
                color: t.rust,
                marginLeft: 2,
                maxWidth: 320,
                lineHeight: 1.4,
              }}
            >
              {smsState.message}
            </span>
          )}
        </div>
      </div>

      <div style={{ height: 1, background: t.borderSoft, marginTop: 4 }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <button
          onClick={onAddAnother}
          style={{
            padding: '10px 18px',
            background: 'transparent',
            border: `1px solid ${t.border}`,
            borderRadius: 8,
            fontSize: 13,
            color: t.inkSoft,
            fontFamily: t.sans,
            cursor: 'pointer',
          }}
        >
          Add another client
        </button>
        <button
          onClick={onDone}
          style={{
            padding: '10px 18px',
            background: t.ink,
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 13,
            fontFamily: t.sans,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Open client page
        </button>
      </div>
    </div>
  );
}

function Field({
  t,
  label,
  required,
  error,
  children,
}: {
  t: ReturnType<typeof buildTheme>;
  label: string;
  required?: boolean;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontFamily: t.mono,
          fontSize: 9.5,
          color: t.muted,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        {label}
        {required && <span style={{ color: t.rust, marginLeft: 4 }}>*</span>}
      </label>
      {children}
      {error && (
        <div
          style={{
            fontSize: 12,
            color: '#a13d2c',
            marginTop: 4,
            fontFamily: t.sans,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

function inputStyle(t: ReturnType<typeof buildTheme>): React.CSSProperties {
  return {
    width: '100%',
    padding: '10px 12px',
    border: `1px solid ${t.border}`,
    borderRadius: 8,
    fontSize: 14,
    fontFamily: t.sans,
    color: t.ink,
    background: '#fff',
    outline: 'none',
    boxSizing: 'border-box',
  };
}
