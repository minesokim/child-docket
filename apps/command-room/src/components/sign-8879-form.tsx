'use client';

// Form for Antonio to request a Form 8879 e-signature.
//
// Antonio's workflow:
//   1. Finishes return prep in OLT
//   2. Exports the 8879 PDF from OLT (his existing manual step)
//   3. On /clients/[id], clicks "Request 8879 signature"
//   4. Uploads PDF + confirms tax year + clicks Submit
//   5. UI returns the embedded signing URL — Antonio copies and
//      texts/emails it to the client
//   6. Client opens link → KBA wall → signs → DocuSign webhook
//      flips signatures.status='signed' → Antonio sees the signed
//      state on /clients/[id] Signatures section
//
// PDF SOURCE
//   v0: Antonio uploads manually after exporting from OLT.
//   M2+: OLT browser automation pulls the PDF directly into the
//       request action, bypassing the manual upload step.
//
// EDGE CASES (handled inline)
//   - PDF too small / wrong type / oversized → server-side validators
//     surface as reason='invalid-pdf'
//   - Already-pending or already-signed → server returns
//     reason='already-pending'/'already-signed' with existing row id
//   - Network failure mid-upload → fixed-copy fallback message

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { Theme } from '@docket/ui';
import {
  requestSign8879,
  type RequestSign8879Result,
} from '@/lib/docusign/request-sign-8879';

interface Props {
  t: Theme;
  clientId: string;
  defaultTaxYear: number;
  /** Public portal URL — used to construct the signing link for copy-to-client. */
  portalBaseUrl: string;
  /** firm_owner | preparer can request; reviewers see read-only state. */
  canRequest: boolean;
  /** Whether tenant has DocuSign credentials configured. */
  hasDocuSignCred: boolean;
}

// Notification status surfaced from the server action — same shape
// as Send8879NotificationResult but narrowed for client-side display.
// Session 15 (2026-05-16) added this to show Antonio whether the SMS
// fired automatically or whether he needs to use the copy-link
// fallback.
type NotificationStatus =
  | { ok: true; channel: 'sms'; toMasked: string }
  | { ok: false; reason: string; message: string };

type State =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'submitting' }
  | {
      kind: 'success';
      signatureRowId: string;
      portalLink: string;
      notification: NotificationStatus;
    }
  | { kind: 'error'; message: string; existingRowId?: string }
  | { kind: 'copied'; notification: NotificationStatus };

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB DocuSign cap
const PDF_MIN_BYTES = 1024;

export function Sign8879Form({
  t,
  clientId,
  defaultTaxYear,
  portalBaseUrl,
  canRequest,
  hasDocuSignCred,
}: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = React.useState(false);
  const [state, setState] = React.useState<State>({ kind: 'idle' });
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const onCopyLink = React.useCallback(
    async (url: string) => {
      try {
        await navigator.clipboard.writeText(url);
        setState((s) =>
          s.kind === 'success'
            ? { kind: 'copied' as const, notification: s.notification }
            : s,
        );
        setTimeout(() => {
          setState((s) =>
            s.kind === 'copied'
              ? { kind: 'idle' }
              : s,
          );
        }, 2000);
      } catch {
        // Fallback: do nothing. The link is selectable in the UI.
      }
    },
    [],
  );

  const onSubmit = React.useCallback(
    async (formData: FormData) => {
      const file = formData.get('pdf');
      const taxYearRaw = String(formData.get('taxYear') ?? defaultTaxYear);
      const taxYear = Number(taxYearRaw);

      if (!(file instanceof File) || file.size === 0) {
        setState({ kind: 'error', message: 'Please choose a PDF file to upload.' });
        return;
      }
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        setState({ kind: 'error', message: 'File must be a PDF.' });
        return;
      }
      if (file.size < PDF_MIN_BYTES) {
        setState({ kind: 'error', message: 'PDF appears empty or too small.' });
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setState({
          kind: 'error',
          message: `PDF exceeds 25MB DocuSign limit (${Math.round(file.size / 1024 / 1024)}MB).`,
        });
        return;
      }
      if (!Number.isFinite(taxYear) || taxYear < 2020 || taxYear > 2100) {
        setState({ kind: 'error', message: 'Tax year is out of range.' });
        return;
      }

      setState({ kind: 'reading' });
      let pdfBase64: string;
      try {
        const buffer = await file.arrayBuffer();
        // Convert ArrayBuffer → base64 in chunks to avoid stack overflow
        // on large files. Browser btoa() can't handle binary directly.
        pdfBase64 = arrayBufferToBase64(buffer);
      } catch (err) {
        setState({
          kind: 'error',
          message:
            err instanceof Error ? `File read failed: ${err.message}` : 'Could not read file.',
        });
        return;
      }

      setState({ kind: 'submitting' });
      let result: RequestSign8879Result;
      try {
        result = await requestSign8879({
          clientId,
          taxYear,
          pdfBase64,
          pdfFilename: file.name,
        });
      } catch {
        setState({
          kind: 'error',
          message: 'Could not reach the server. Try again.',
        });
        return;
      }

      if (result.ok) {
        const notification: NotificationStatus = result.notification.ok
          ? {
              ok: true,
              channel: result.notification.channel,
              toMasked: result.notification.toMasked,
            }
          : {
              ok: false,
              reason: result.notification.reason,
              message: result.notification.message,
            };
        setState({
          kind: 'success',
          signatureRowId: result.signatureRowId,
          portalLink: `${portalBaseUrl}/portal/sign-8879/${result.signatureRowId}`,
          notification,
        });
        // Trigger a re-render of the parent /clients/[id] so the
        // Signatures section picks up the new pending row.
        router.refresh();
      } else if (result.reason === 'already-pending' || result.reason === 'already-signed') {
        setState({
          kind: 'error',
          message: result.message,
          existingRowId: result.existingSignatureRowId,
        });
      } else {
        setState({ kind: 'error', message: result.message });
      }
    },
    [clientId, defaultTaxYear, portalBaseUrl, router],
  );

  if (!canRequest) {
    return (
      <div
        style={{
          fontSize: 12,
          color: t.muted,
          fontStyle: 'italic',
          padding: '8px 0',
        }}
      >
        Only firm_owner and preparer roles can request 8879 signatures.
      </div>
    );
  }

  if (!hasDocuSignCred) {
    return (
      <div
        style={{
          fontSize: 13,
          color: t.muted,
          padding: '12px 0',
        }}
      >
        DocuSign isn't configured for this tenant.{' '}
        <a
          href="/settings/credentials"
          style={{ color: t.ink, textDecoration: 'underline', textUnderlineOffset: 2 }}
        >
          Configure DocuSign →
        </a>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 8 }}>
      {!showForm ? (
        <button
          type="button"
          onClick={() => {
            setShowForm(true);
            setState({ kind: 'idle' });
          }}
          style={primaryBtnStyle(t)}
        >
          + Request 8879 signature
        </button>
      ) : null}

      {showForm && state.kind !== 'success' && state.kind !== 'copied' ? (
        <form
          action={onSubmit}
          style={{
            background: t.card,
            border: `1px solid ${t.border}`,
            borderRadius: 12,
            padding: '16px 18px',
            marginTop: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div>
            <label style={fieldLabelStyle(t)} htmlFor="pdf">
              8879 PDF (export from OLT, max 25MB)
            </label>
            <input
              ref={fileInputRef}
              id="pdf"
              name="pdf"
              type="file"
              accept="application/pdf,.pdf"
              required
              style={{
                fontFamily: t.sans,
                fontSize: 12,
                marginTop: 6,
                width: '100%',
              }}
            />
          </div>
          <div>
            <label style={fieldLabelStyle(t)} htmlFor="taxYear">
              Tax year
            </label>
            <input
              id="taxYear"
              name="taxYear"
              type="number"
              min="2020"
              max="2100"
              defaultValue={defaultTaxYear}
              required
              style={{
                fontFamily: t.sans,
                fontSize: 13,
                padding: '6px 10px',
                borderRadius: 6,
                border: `1px solid ${t.border}`,
                background: '#fff',
                color: t.ink,
                marginTop: 6,
                width: 120,
              }}
            />
          </div>
          {state.kind === 'error' ? (
            <div
              role="alert"
              style={{
                fontSize: 12,
                color: t.rust,
                fontFamily: t.mono,
                lineHeight: 1.5,
              }}
            >
              {state.message}
              {state.existingRowId ? (
                <div style={{ marginTop: 4 }}>
                  Existing record:{' '}
                  <span style={{ fontFamily: t.mono }}>{state.existingRowId.slice(0, 12)}…</span>
                </div>
              ) : null}
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setState({ kind: 'idle' });
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              disabled={state.kind === 'reading' || state.kind === 'submitting'}
              style={ghostBtnStyle(t)}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={state.kind === 'reading' || state.kind === 'submitting'}
              style={primaryBtnStyle(t, state.kind === 'reading' || state.kind === 'submitting')}
            >
              {state.kind === 'reading'
                ? 'Reading PDF…'
                : state.kind === 'submitting'
                  ? 'Creating envelope…'
                  : 'Send for signature'}
            </button>
          </div>
        </form>
      ) : null}

      {state.kind === 'success' || state.kind === 'copied' ? (
        <div
          style={{
            background: '#e1f4df',
            border: '1px solid #1f4621',
            borderRadius: 12,
            padding: '14px 16px',
            marginTop: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 500, color: '#1f4621' }}>
            ✓ 8879 envelope created.
          </div>
          {/*
            Notification status — Session 15 (2026-05-16). The server
            action fires send8879Notification automatically; this
            row tells Antonio whether the SMS landed (so the copy-
            link below is informational) or whether it failed (so
            he uses the copy-link as the manual fallback).
          */}
          {state.notification.ok ? (
            <div
              style={{
                fontSize: 12,
                color: '#1f4621',
                background: '#fff',
                border: '1px solid #1f4621',
                borderRadius: 4,
                padding: '6px 10px',
              }}
            >
              Texted to {state.notification.toMasked}. Antonio's link is below if
              you want to also paste it into email or portal chat.
            </div>
          ) : (
            <div
              style={{
                fontSize: 12,
                color: '#8a3a2a',
                background: '#fff7f4',
                border: '1px solid #c98a78',
                borderRadius: 4,
                padding: '6px 10px',
              }}
            >
              Auto-text failed: {state.notification.message} Send the link
              manually via your preferred channel:
            </div>
          )}
          <div
            style={{
              fontFamily: t.mono,
              fontSize: 11,
              wordBreak: 'break-all',
              background: '#fff',
              padding: '6px 10px',
              borderRadius: 4,
              border: `1px solid #1f4621`,
              userSelect: 'all',
            }}
          >
            {state.kind === 'success' ? state.portalLink : ''}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setState({ kind: 'idle' });
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              style={ghostBtnStyle(t)}
            >
              Done
            </button>
            <button
              type="button"
              onClick={() => {
                if (state.kind === 'success') {
                  void onCopyLink(state.portalLink);
                }
              }}
              style={primaryBtnStyle(t)}
            >
              {state.kind === 'copied' ? 'Copied' : 'Copy link'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Style helpers — match the editorial-warm pattern from
// payments-section.tsx (and the rest of /clients/[id]).
// ────────────────────────────────────────────────────────────────

function primaryBtnStyle(t: Theme, busy = false): React.CSSProperties {
  return {
    fontFamily: t.sans,
    fontSize: 12,
    fontWeight: 500,
    padding: '6px 14px',
    borderRadius: 999,
    border: 'none',
    background: t.ink,
    color: '#fff',
    cursor: busy ? 'not-allowed' : 'pointer',
    opacity: busy ? 0.6 : 1,
    letterSpacing: -0.005,
  };
}

function ghostBtnStyle(t: Theme): React.CSSProperties {
  return {
    fontFamily: t.sans,
    fontSize: 11,
    fontWeight: 500,
    padding: '4px 12px',
    borderRadius: 999,
    border: `1px solid ${t.border}`,
    background: 'transparent',
    color: t.ink,
    cursor: 'pointer',
  };
}

function fieldLabelStyle(t: Theme): React.CSSProperties {
  return {
    fontFamily: t.mono,
    fontSize: 9.5,
    color: t.muted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    display: 'block',
  };
}

// ArrayBuffer → base64. Chunked to avoid the call-stack overflow
// that String.fromCharCode hits on large buffers.
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}
