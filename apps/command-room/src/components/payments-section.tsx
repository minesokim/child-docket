'use client';

// Payments panel for the per-client detail page.
//
// Surfaces Square Checkout deposit links Antonio has minted for this
// client, with status badges and per-row Refresh + Copy actions. The
// Create flow opens an inline form (default $50 deposit; tax year
// + amount editable) and POSTs to createCheckoutLink. After mint,
// the new row appears with a hosted Square URL the user can copy or
// open. Status flips from pending → paid happen via the per-row
// Refresh button (polls Square's /v2/orders endpoint).
//
// PATTERN
//   Mirrors documents-section.tsx — single client component receiving
//   server-fetched rows + a couple of identity props. No separate
//   actions file.
//
// THEME
//   Editorial-warm `t: Theme` to match the rest of /clients/[id]
//   (Engagement / Documents / Signatures / Issues all use it). The
//   command-room operational-modern lock-in (2026-05-08) applies to
//   shells + new routes; the existing per-client sections remain
//   editorial-warm until a holistic migration. Forest green primary
//   is shared across both languages so the Create button reads the
//   same.
//
// EDGE CASES (covered)
//   - No payments rows yet → "No deposit links yet" + Create CTA
//   - Tenant has no Square credential → CTA disabled with link to
//     /settings/credentials
//   - User role is reviewer → rows render but Create + Refresh hidden
//   - Per-row Refresh failure → inline error within the row; allows retry
//   - Create failure → inline error in the form; allows retry
//   - Copy URL fails (no clipboard API) → fallback select-text panel

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Theme } from '@docket/ui';
import {
  createCheckoutLink,
  type CreateCheckoutLinkResult,
} from '@/lib/square/create-checkout-link';
import {
  refreshPaymentStatus,
  type RefreshPaymentStatusResult,
} from '@/lib/square/refresh-payment-status';

export type PaymentRow = {
  id: string;
  status: 'pending' | 'paid' | 'partial' | 'refunded' | 'cancelled' | 'failed';
  amountCents: number;
  collectedCents: number;
  refundedCents: number;
  currency: string;
  checkoutUrl: string;
  taxYear: number | null;
  paidAt: Date | null;
  refundedAt: Date | null;
  lastPolledAt: Date | null;
  lastSquareStatus: string | null;
  createdAt: Date;
};

export function PaymentsSection({
  t,
  rows,
  clientId,
  defaultTaxYear,
  hasSquareCred,
  canEdit,
}: {
  t: Theme;
  rows: PaymentRow[];
  clientId: string;
  defaultTaxYear: number;
  hasSquareCred: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = React.useState(false);
  const [createState, setCreateState] = React.useState<
    | { kind: 'idle' }
    | { kind: 'submitting' }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  // Antonio-flow gap codex caught: staff can mint parallel active
  // links with different amounts/years for the same client. v1
  // shows a warning when an existing pending/partial link exists
  // so the user thinks twice before creating a second. Hard block
  // is too aggressive — different amounts CAN be legit (re-quoted
  // fee, additional engagement on the same client) — but the
  // warning surfaces the duplicate so it's intentional.
  const activePendingCount = rows.filter(
    (r) => r.status === 'pending' || r.status === 'partial',
  ).length;
  // Per-row refresh + copy state, keyed by row id.
  const [rowState, setRowState] = React.useState<
    Record<string, { kind: 'idle' } | { kind: 'refreshing' } | { kind: 'error'; message: string } | { kind: 'copied' }>
  >({});

  // Reconcile rowState whenever the row set changes (router.refresh()
  // brings in updated rows; copied/error entries shouldn't survive
  // a refresh, and orphan keys for deleted rows shouldn't accumulate).
  // Uses the row IDs as the dependency so it only fires when the set
  // genuinely changes, not on every parent re-render.
  const rowIdsKey = React.useMemo(
    () => rows.map((r) => r.id).sort().join('|'),
    [rows],
  );
  React.useEffect(() => {
    setRowState((prev) => {
      const validIds = new Set(rows.map((r) => r.id));
      const next: typeof prev = {};
      let changed = false;
      for (const id of Object.keys(prev)) {
        if (validIds.has(id) && prev[id]?.kind === 'refreshing') {
          // Preserve in-flight refresh state across re-render.
          next[id] = prev[id]!;
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // rowIdsKey is the stable signal — eslint can't see through useMemo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowIdsKey]);

  const onCreate = React.useCallback(
    async (formData: FormData) => {
      setCreateState({ kind: 'submitting' });
      const amountDollarsRaw = String(formData.get('amount') ?? '50');
      const taxYearRaw = String(formData.get('taxYear') ?? defaultTaxYear);
      const amountDollars = Number(amountDollarsRaw);
      const taxYear = Number(taxYearRaw);
      if (!Number.isFinite(amountDollars) || amountDollars <= 0) {
        setCreateState({ kind: 'error', message: 'Amount must be a positive number.' });
        return;
      }
      if (!Number.isFinite(taxYear) || taxYear < 2020 || taxYear > 2100) {
        setCreateState({ kind: 'error', message: 'Tax year is out of range.' });
        return;
      }
      let result: CreateCheckoutLinkResult;
      try {
        result = await createCheckoutLink({
          clientId,
          taxYear,
          amountCents: Math.round(amountDollars * 100),
        });
      } catch {
        setCreateState({
          kind: 'error',
          message: 'Could not reach the server. Try again.',
        });
        return;
      }
      if (result.ok) {
        setCreateState({ kind: 'idle' });
        setShowForm(false);
        router.refresh();
      } else {
        setCreateState({ kind: 'error', message: result.message });
      }
    },
    [clientId, defaultTaxYear, router],
  );

  const onRefresh = React.useCallback(
    async (paymentId: string) => {
      setRowState((s) => ({ ...s, [paymentId]: { kind: 'refreshing' } }));
      let result: RefreshPaymentStatusResult;
      try {
        result = await refreshPaymentStatus(paymentId);
      } catch {
        setRowState((s) => ({
          ...s,
          [paymentId]: { kind: 'error', message: 'Network error. Try again.' },
        }));
        return;
      }
      if (result.ok) {
        setRowState((s) => ({ ...s, [paymentId]: { kind: 'idle' } }));
        router.refresh();
      } else {
        setRowState((s) => ({
          ...s,
          [paymentId]: { kind: 'error', message: result.message },
        }));
      }
    },
    [router],
  );

  const onCopy = React.useCallback(async (paymentId: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setRowState((s) => ({ ...s, [paymentId]: { kind: 'copied' } }));
      setTimeout(() => {
        setRowState((s) => ({ ...s, [paymentId]: { kind: 'idle' } }));
      }, 2000);
    } catch {
      // Fallback: do nothing. The URL is already shown in the row;
      // the user can manually select + copy. Render a small hint
      // via the error state.
      setRowState((s) => ({
        ...s,
        [paymentId]: {
          kind: 'error',
          message: 'Clipboard blocked — select the URL above to copy.',
        },
      }));
    }
  }, []);

  const createButton = canEdit ? (
    hasSquareCred ? (
      <button
        type="button"
        onClick={() => {
          setCreateState({ kind: 'idle' });
          setShowForm((v) => !v);
        }}
        style={{
          fontFamily: t.sans,
          fontSize: 12,
          fontWeight: 500,
          padding: '6px 12px',
          borderRadius: 999,
          border: 'none',
          background: t.ink,
          color: '#fff',
          cursor: 'pointer',
          letterSpacing: -0.005,
        }}
      >
        {showForm ? 'Cancel' : '+ Create deposit link'}
      </button>
    ) : (
      <Link
        href="/settings/credentials"
        style={{
          fontFamily: t.mono,
          fontSize: 10,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: t.muted,
          textDecoration: 'underline',
          textUnderlineOffset: 3,
        }}
        title="No Square credential configured for this tenant"
      >
        Configure Square →
      </Link>
    )
  ) : null;

  // Empty state.
  if (rows.length === 0 && !showForm) {
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
        <div style={{ marginBottom: canEdit && hasSquareCred ? 12 : 0 }}>
          No deposit links yet
        </div>
        {createButton}
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
      {/* Per-row list */}
      {rows.map((row, idx) => {
        const rs = rowState[row.id] ?? { kind: 'idle' };
        const isRefreshing = rs.kind === 'refreshing';
        const isCopied = rs.kind === 'copied';
        const errorMessage = rs.kind === 'error' ? rs.message : null;

        return (
          <div
            key={row.id}
            style={{
              paddingBottom: idx < rows.length - 1 ? 12 : 0,
              borderBottom: idx < rows.length - 1 ? `1px solid ${t.borderSoft}` : 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
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
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
                <span style={{ fontFamily: t.serif, fontSize: 17, color: t.ink }}>
                  ${(row.amountCents / 100).toFixed(2)}
                </span>
                <span
                  style={{
                    fontFamily: t.mono,
                    fontSize: 10,
                    color: t.muted,
                    letterSpacing: 0.3,
                  }}
                >
                  {row.taxYear ? `TY ${row.taxYear}` : ''} · {row.currency}
                </span>
              </div>
              <PaymentStatusPill t={t} status={row.status} />
            </div>

            {/* Paid / refunded detail row */}
            {row.paidAt && (
              <div
                style={{
                  fontFamily: t.mono,
                  fontSize: 10.5,
                  color: t.muted,
                  letterSpacing: 0.3,
                }}
              >
                Paid {formatDateTime(row.paidAt)}
                {row.collectedCents !== row.amountCents
                  ? ` · collected $${(row.collectedCents / 100).toFixed(2)}`
                  : ''}
                {row.refundedCents > 0
                  ? ` · refunded $${(row.refundedCents / 100).toFixed(2)}${row.refundedAt ? ` ${formatDateTime(row.refundedAt)}` : ''}`
                  : ''}
              </div>
            )}

            {/* Hosted URL — selectable; clipboard button is the convenience copy */}
            <div
              style={{
                fontFamily: t.mono,
                fontSize: 10,
                color: t.inkSoft,
                wordBreak: 'break-all',
                // Theme has no semantic "canvas" key; #fafafa is the
                // editorial-warm subtle off-card surface used for
                // <code>-style fragments. Stays consistent in both
                // tone variants the page might render in.
                background: '#fafafa',
                padding: '4px 8px',
                borderRadius: 4,
                border: `1px solid ${t.borderSoft}`,
                userSelect: 'all',
              }}
            >
              {row.checkoutUrl}
            </div>

            {/* Per-row actions */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => onCopy(row.id, row.checkoutUrl)}
                style={ghostBtnStyle(t, isCopied)}
              >
                {isCopied ? 'Copied' : 'Copy URL'}
              </button>
              {canEdit && row.status !== 'paid' && row.status !== 'refunded' && (
                <button
                  type="button"
                  onClick={() => onRefresh(row.id)}
                  disabled={isRefreshing}
                  aria-busy={isRefreshing}
                  style={ghostBtnStyle(t, false, isRefreshing)}
                >
                  {isRefreshing ? 'Checking…' : 'Refresh status'}
                </button>
              )}
              {row.lastPolledAt && (
                <span
                  style={{
                    fontFamily: t.mono,
                    fontSize: 9.5,
                    color: t.muted,
                    letterSpacing: 0.3,
                  }}
                >
                  last checked {formatRelative(row.lastPolledAt)}
                </span>
              )}
            </div>

            {errorMessage && (
              <div
                role="alert"
                aria-live="polite"
                style={{
                  fontFamily: t.mono,
                  fontSize: 10.5,
                  color: t.rust,
                  marginTop: 2,
                }}
              >
                {errorMessage}
              </div>
            )}
          </div>
        );
      })}

      {/* Inline create form */}
      {canEdit && hasSquareCred && (
        <div style={{ paddingTop: rows.length > 0 ? 12 : 0, borderTop: rows.length > 0 ? `1px solid ${t.borderSoft}` : 'none' }}>
          {!showForm ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{createButton}</div>
          ) : (
            <form
              action={onCreate}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                  <span style={fieldLabelStyle(t)}>Amount (USD)</span>
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    min="1"
                    defaultValue="50.00"
                    required
                    style={inputStyle(t)}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 120 }}>
                  <span style={fieldLabelStyle(t)}>Tax year</span>
                  <input
                    name="taxYear"
                    type="number"
                    min="2020"
                    max="2100"
                    defaultValue={defaultTaxYear}
                    required
                    style={inputStyle(t)}
                  />
                </label>
              </div>
              {activePendingCount > 0 && (
                <div
                  role="status"
                  aria-live="polite"
                  style={{
                    fontFamily: t.mono,
                    fontSize: 10.5,
                    color: '#7a4a08',
                    background: '#fde9c2',
                    padding: '6px 10px',
                    borderRadius: 6,
                    lineHeight: 1.45,
                  }}
                >
                  This client already has {activePendingCount} active deposit
                  link{activePendingCount > 1 ? 's' : ''} (pending or partial).
                  Creating another will give them a second URL — make sure
                  that's intentional.
                </div>
              )}
              {createState.kind === 'error' && (
                <div
                  role="alert"
                  style={{
                    fontFamily: t.mono,
                    fontSize: 11,
                    color: t.rust,
                  }}
                >
                  {createState.message}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setCreateState({ kind: 'idle' });
                  }}
                  disabled={createState.kind === 'submitting'}
                  style={ghostBtnStyle(t)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createState.kind === 'submitting'}
                  style={{
                    fontFamily: t.sans,
                    fontSize: 12,
                    fontWeight: 500,
                    padding: '6px 14px',
                    borderRadius: 999,
                    border: 'none',
                    background: t.ink,
                    color: '#fff',
                    cursor: createState.kind === 'submitting' ? 'not-allowed' : 'pointer',
                    opacity: createState.kind === 'submitting' ? 0.6 : 1,
                  }}
                >
                  {createState.kind === 'submitting' ? 'Creating…' : 'Create deposit link'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Status pill — semantic palette mirrors signatures-section
// ────────────────────────────────────────────────────────────────

function PaymentStatusPill({ t, status }: { t: Theme; status: PaymentRow['status'] }) {
  const palette =
    status === 'paid'
      ? { bg: '#1f4621', fg: '#fff' } // forest = success
      : status === 'pending'
        ? { bg: '#fde9c2', fg: '#7a4a08' } // amber = waiting
        : status === 'partial'
          ? { bg: '#fde9c2', fg: '#7a4a08' }
          : status === 'refunded'
            ? { bg: t.borderSoft, fg: t.muted }
            : { bg: t.rust, fg: '#fff' }; // cancelled | failed = clay
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
        whiteSpace: 'nowrap',
      }}
    >
      {status}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────
// Style helpers — kept inline to match existing /clients/[id] pattern.
// ────────────────────────────────────────────────────────────────

function ghostBtnStyle(t: Theme, copied = false, busy = false): React.CSSProperties {
  return {
    fontFamily: t.sans,
    fontSize: 11,
    fontWeight: 500,
    padding: '4px 10px',
    borderRadius: 999,
    border: `1px solid ${t.border}`,
    background: copied ? '#1f4621' : 'transparent',
    color: copied ? '#fff' : t.ink,
    cursor: busy ? 'not-allowed' : 'pointer',
    opacity: busy ? 0.5 : 1,
    transition: 'background 120ms, color 120ms',
  };
}

function fieldLabelStyle(t: Theme): React.CSSProperties {
  return {
    fontFamily: t.mono,
    fontSize: 9.5,
    color: t.muted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  };
}

function inputStyle(t: Theme): React.CSSProperties {
  return {
    fontFamily: t.sans,
    fontSize: 13,
    padding: '6px 10px',
    borderRadius: 6,
    border: `1px solid ${t.border}`,
    background: '#fff',
    color: t.ink,
  };
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

function formatRelative(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}
