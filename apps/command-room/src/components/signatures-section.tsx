'use client';

// Signatures panel for the per-client detail page.
//
// Engagement letter, §7216 consent, and Form 8879 statuses with their
// provenance (signed_at, signed_by_ip, signed_by_user_agent — captured
// in Day 1 hardening). Antonio uses this to verify legal artifacts
// before filing.
//
// PER-ROW REFRESH BUTTON (added when DocuSign Connect Admin UI was
// blocking webhook setup): Antonio can click "Refresh status" on any
// pending DocuSign row to manually pull the current envelope state
// from DocuSign's API. Same DB updates the webhook would make
// (status flip + KBA gate + signed_at + audit) — just human-driven.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { Theme } from '@docket/ui';
import { refreshSignatureStatus } from '@/lib/docusign/refresh-signature-status';

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
  canRefresh = false,
}: {
  t: Theme;
  signatures: SignatureRow[];
  /**
   * Whether to render the per-row "Refresh status" button. Only true
   * for firm_owner | preparer roles (server action also gates the
   * call, so this is defense-in-depth UI hide).
   */
  canRefresh?: boolean;
}) {
  const router = useRouter();
  const [refreshState, setRefreshState] = React.useState<
    Record<string, { kind: 'idle' } | { kind: 'refreshing' } | { kind: 'error'; message: string }>
  >({});

  const onRefresh = React.useCallback(
    async (signatureRowId: string) => {
      setRefreshState((s) => ({ ...s, [signatureRowId]: { kind: 'refreshing' } }));
      try {
        const result = await refreshSignatureStatus(signatureRowId);
        if (result.ok) {
          setRefreshState((s) => ({ ...s, [signatureRowId]: { kind: 'idle' } }));
          router.refresh();
        } else {
          setRefreshState((s) => ({
            ...s,
            [signatureRowId]: { kind: 'error', message: result.message },
          }));
        }
      } catch {
        setRefreshState((s) => ({
          ...s,
          [signatureRowId]: { kind: 'error', message: 'Network error. Try again.' },
        }));
      }
    },
    [router],
  );

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

          {/* Per-row refresh control. Only fires for DocuSign-backed
              rows (form_8879 with kbaProvider='lexisnexis'); the
              other signature types (engagement_letter, consent_7216)
              are not in the DocuSign envelope universe and can't be
              polled. Hidden once status is signed (no further state
              transitions to fetch). */}
          {canRefresh &&
            sig.type === 'form_8879' &&
            sig.kbaProvider === 'lexisnexis' &&
            sig.status !== 'signed' &&
            sig.status !== 'declined' && (
              <div style={{ marginTop: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
                {(() => {
                  const rs = refreshState[sig.id] ?? { kind: 'idle' as const };
                  const isRefreshing = rs.kind === 'refreshing';
                  const errorMessage = rs.kind === 'error' ? rs.message : null;
                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => onRefresh(sig.id)}
                        disabled={isRefreshing}
                        aria-busy={isRefreshing}
                        style={{
                          fontFamily: t.sans,
                          fontSize: 11,
                          fontWeight: 500,
                          padding: '4px 10px',
                          borderRadius: 999,
                          border: `1px solid ${t.border}`,
                          background: 'transparent',
                          color: t.ink,
                          cursor: isRefreshing ? 'not-allowed' : 'pointer',
                          opacity: isRefreshing ? 0.5 : 1,
                        }}
                      >
                        {isRefreshing ? 'Checking…' : 'Refresh status'}
                      </button>
                      {errorMessage && (
                        <span
                          role="alert"
                          aria-live="polite"
                          style={{
                            fontFamily: t.mono,
                            fontSize: 10,
                            color: t.rust,
                          }}
                        >
                          {errorMessage}
                        </span>
                      )}
                    </>
                  );
                })()}
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
