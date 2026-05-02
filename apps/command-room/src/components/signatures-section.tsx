// Signatures panel for the per-client detail page.
//
// Engagement letter, §7216 consent, and Form 8879 statuses with their
// provenance (signed_at, signed_by_ip, signed_by_user_agent — captured
// in Day 1 hardening). Antonio uses this to verify legal artifacts
// before filing.
//
// Day 5 wiring: render only. The 8879 KBA flow will write rows into
// this same table on Day 13 — UI doesn't change, just rows get richer.

import type { Theme } from '@docket/ui';

type SignatureRow = {
  id: string;
  type: string;
  status: string;
  signedAt: Date | null;
  signedByIp: string | null;
  signedByUserAgent: string | null;
  kbaRequired: boolean;
  kbaPassedAt: Date | null;
  kbaProvider: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  engagement_letter: 'Engagement letter',
  consent_7216: '§7216 consent',
  form_8879: 'Form 8879 (e-file authorization)',
  form_2848: 'Form 2848 (POA)',
  form_8821: 'Form 8821 (tax info auth)',
};

export function SignaturesSection({
  t,
  signatures,
}: {
  t: Theme;
  signatures: SignatureRow[];
}) {
  if (signatures.length === 0) {
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
        No signatures yet
      </div>
    );
  }

  return (
    <div
      style={{
        background: t.card,
        border: `1px solid ${t.border}`,
        borderRadius: 14,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {signatures.map((sig) => (
        <div
          key={sig.id}
          style={{
            paddingBottom: 10,
            borderBottom: `1px solid ${t.borderSoft}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 14, color: t.ink, fontWeight: 500 }}>
              {TYPE_LABEL[sig.type] ?? sig.type}
            </span>
            <StatusPill t={t} status={sig.status} />
          </div>

          {sig.signedAt && (
            <div
              style={{
                fontFamily: t.mono,
                fontSize: 10.5,
                color: t.muted,
                letterSpacing: 0.3,
              }}
            >
              Signed {formatDateTime(sig.signedAt)}
              {sig.signedByIp && <span> · {sig.signedByIp}</span>}
            </div>
          )}

          {sig.signedByUserAgent && (
            <div
              style={{
                fontFamily: t.mono,
                fontSize: 10,
                color: t.muted,
                opacity: 0.7,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {sig.signedByUserAgent}
            </div>
          )}

          {sig.kbaRequired && (
            <div
              style={{
                fontFamily: t.mono,
                fontSize: 10,
                color: sig.kbaPassedAt ? t.rustInk : t.muted,
                marginTop: 2,
              }}
            >
              KBA{' '}
              {sig.kbaPassedAt
                ? `passed ${formatDateTime(sig.kbaPassedAt)}${sig.kbaProvider ? ` · ${sig.kbaProvider}` : ''}`
                : 'required · not yet completed'}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function StatusPill({ t, status }: { t: Theme; status: string }) {
  const palette =
    status === 'signed'
      ? { bg: '#1f4621', fg: '#fff' }
      : status === 'pending' || status === 'sent'
      ? { bg: '#fde9c2', fg: '#7a4a08' }
      : status === 'declined' || status === 'expired'
      ? { bg: t.rust, fg: '#fff' }
      : { bg: t.borderSoft, fg: t.muted };
  return (
    <span
      style={{
        display: 'inline-flex',
        padding: '3px 9px',
        borderRadius: 999,
        fontFamily: t.mono,
        fontSize: 9.5,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        background: palette.bg,
        color: palette.fg,
      }}
    >
      {status}
    </span>
  );
}

function formatDateTime(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
