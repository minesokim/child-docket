'use client';

// Returning portal — Docs tab.
//
// Audit (2026-05-15) caught this page rendering 9 hardcoded mock
// documents (W-2 Acme Inc / 1099-NEC Freelance / 1099-K Stripe /
// 1099-INT Chase / Revenue summary 2025 / Expense receipts / Driver's
// license / Engagement letter / §7216 consent) on EVERY load + real
// uploads silently disappeared from view after the "Sent" toast.
// Mock data leaking to live users + a UX black hole on the actual
// upload flow.
//
// Mock removed in this commit:
//   - DOCS array (9 hardcoded entries with fake dates + statuses)
//   - DocRow / DocGroup / abbrev helpers (consumed only DOCS)
//   - The progress-bar percent + "X of Y uploaded" line driven off
//     the mock counts
//   - The grouped Income/Business/Identity/Agreements rendering
//   - The "Download all as ZIP" button (mock-only; no zip endpoint
//     exists today)
//
// Preserved (real, working code):
//   - Upload pipeline: requestUploadUrl + browser PUT to R2 +
//     confirmUpload, with phase-aware UI (idle / uploading / sent /
//     failed). This was already wired to real R2 buckets via the
//     /api/intake/upload-presigned + /api/intake/upload-confirm
//     server actions that intake also uses.
//   - The four panel components (UploadDropzone / UploadingPanel /
//     SentPanel / FailedPanel) and the putWithProgress XHR helper.
//
// Phase 2 lands a `documents` query that pulls this client's actual
// uploaded + classified docs from the DB and renders them under the
// upload zone. Until then, the empty state below the upload zone
// tells the user where the upload actually goes.

import {
  Body,
  Button,
  buildTheme,
  H1,
  Row,
  Stack,
  Wordmark,
} from '@docket/ui';
import type { Theme } from '@docket/ui';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { confirmUpload, requestUploadUrl } from '@/lib/docs/upload';

type UploadPhase =
  | { kind: 'idle' }
  | { kind: 'uploading'; percent: number; filename: string }
  | { kind: 'sent'; filename: string }
  | { kind: 'failed'; error: string };

export default function PortalDocsPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const [phase, setPhase] = React.useState<UploadPhase>({ kind: 'idle' });
  // Synchronous in-flight flag. setPhase is async + batched, so a
  // second onChange fired before React re-renders would otherwise
  // sail past a state-only guard and create a duplicate documents
  // row (codex caught this on review). The ref is the source of
  // truth for "is an upload in flight?"; phase is for rendering.
  const uploadingRef = React.useRef(false);

  const onFileChosen = React.useCallback(
    async (file: File) => {
      // Hard early-exit if anything is already in flight. The controls
      // also visually swap away from the dropzone in 'uploading' phase,
      // so this is mostly a belt-and-suspenders against a rapid
      // double-pick race (both inputs fire onChange within one tick).
      if (uploadingRef.current) return;
      uploadingRef.current = true;
      setPhase({ kind: 'uploading', percent: 0, filename: file.name });

      try {
        let preflight;
        try {
          preflight = await requestUploadUrl({
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
          });
        } catch (err) {
          console.error('[portal/docs] requestUploadUrl threw:', err);
          setPhase({
            kind: 'failed',
            error: 'Could not start the upload. Check your connection and try again.',
          });
          return;
        }
        if (!preflight.ok) {
          setPhase({ kind: 'failed', error: preflight.error });
          return;
        }

        const putOk = await putWithProgress(
          preflight.uploadUrl,
          preflight.headers,
          file,
          (pct) =>
            setPhase((prev) =>
              prev.kind === 'uploading' ? { ...prev, percent: pct } : prev,
            ),
        );
        if (!putOk.ok) {
          setPhase({ kind: 'failed', error: putOk.error });
          return;
        }

        let confirmed;
        try {
          confirmed = await confirmUpload({
            storageKey: preflight.storageKey,
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
          });
        } catch (err) {
          console.error('[portal/docs] confirmUpload threw:', err);
          setPhase({
            kind: 'failed',
            error: 'Upload finished but we could not register it. Try again in a moment.',
          });
          return;
        }
        if (!confirmed.ok) {
          setPhase({ kind: 'failed', error: confirmed.error });
          return;
        }

        setPhase({ kind: 'sent', filename: file.name });
        // Refresh server data so a future docs-list query (Phase 2)
        // picks up the new row. The SentPanel below explicitly tells
        // the user the file landed with their preparer — no need for
        // the user to see it in their own portal list to know it's in.
        router.refresh();
      } finally {
        // Always clear the in-flight flag so a retry / send-another
        // can run. Defense-in-depth against an unexpected throw inside
        // putWithProgress (it returns ok:false rather than throwing
        // today, but a future change there should not be able to
        // permanently wedge the guard).
        uploadingRef.current = false;
      }
    },
    [router],
  );

  const openFilePicker = (mode: 'camera' | 'file') => {
    if (phase.kind === 'uploading') return;
    const ref = mode === 'camera' ? cameraInputRef : fileInputRef;
    ref.current?.click();
  };

  return (
    <>
      <div
        style={{
          padding: '16px 20px 8px',
          borderBottom: `1px solid ${t.borderSoft}`,
        }}
      >
        <Row justify="space-between">
          <Wordmark t={t} />
          <div
            style={{
              fontFamily: t.mono,
              fontSize: 10,
              color: t.muted,
              letterSpacing: 1,
            }}
          >
            CLIENT PORTAL
          </div>
        </Row>
      </div>

      <div style={{ padding: '24px 20px 20px' }}>
        <Stack gap={20}>
          <Stack gap={10}>
            <H1 t={t}>Documents</H1>
            <Body t={t} size={14} muted>
              Upload tax documents here. Anything you send goes straight
              to your preparer&apos;s queue — they&apos;ll classify it
              and add it to your return.
            </Body>
          </Stack>

          {/* Hidden file inputs — one general, one camera. The visible
              dropzone and the "Take a photo" pill programmatically click
              the matching ref. value reset on every change so picking
              the same filename twice still fires onChange. */}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp,image/gif"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFileChosen(f);
              e.target.value = '';
            }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            capture="environment"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFileChosen(f);
              e.target.value = '';
            }}
          />

          {phase.kind === 'idle' && (
            <UploadDropzone
              t={t}
              onTapDropzone={() => openFilePicker('file')}
              onTapCamera={() => openFilePicker('camera')}
            />
          )}
          {phase.kind === 'uploading' && (
            <UploadingPanel t={t} percent={phase.percent} filename={phase.filename} />
          )}
          {phase.kind === 'sent' && (
            <SentPanel
              t={t}
              filename={phase.filename}
              onSendAnother={() => setPhase({ kind: 'idle' })}
            />
          )}
          {phase.kind === 'failed' && (
            <FailedPanel
              t={t}
              error={phase.error}
              onRetry={() => setPhase({ kind: 'idle' })}
            />
          )}

          {/* Empty-state placeholder for the per-client docs list. The
              real query lands in Phase 2; until then the upload flow
              is the only interactive surface here, and the empty state
              tells the user what to expect rather than rendering fake
              entries. */}
          <div
            style={{
              padding: '24px 20px',
              border: `1px dashed ${t.borderSoft}`,
              borderRadius: t.radius,
              background: t.bgElev,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontFamily: t.serif,
                fontSize: 15,
                color: t.ink,
                marginBottom: 6,
              }}
            >
              Your document list lives with your preparer
            </div>
            <div
              style={{
                fontSize: 13,
                color: t.inkSoft,
                lineHeight: 1.5,
                marginBottom: 10,
                maxWidth: 320,
                margin: '0 auto 10px',
              }}
            >
              Once you upload, your preparer tags it (W-2, 1099-NEC,
              etc.) and tracks it against your checklist. You won&apos;t
              need to keep a list yourself.
            </div>
            <div
              style={{
                fontFamily: t.mono,
                fontSize: 10,
                color: t.muted,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
              }}
            >
              Per-client document tracker is wired up in Phase 2
            </div>
          </div>

          <Button
            t={t}
            variant="ghost"
            disabled
            style={{ width: '100%', opacity: 0.55, cursor: 'not-allowed' }}
          >
            Download all as ZIP — available when your return is filed
          </Button>
        </Stack>
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────────
// Upload panels — phase-aware replacements for the dropzone slot.
// ────────────────────────────────────────────────────────────────

function UploadDropzone({
  t,
  onTapDropzone,
  onTapCamera,
}: {
  t: Theme;
  onTapDropzone: () => void;
  onTapCamera: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTapDropzone}
      style={{
        all: 'unset',
        display: 'block',
        width: '100%',
        boxSizing: 'border-box',
        border: `1.5px dashed ${t.border}`,
        borderRadius: t.radius,
        padding: '22px 18px',
        background: t.bgElev,
        textAlign: 'center',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}
      aria-label="Upload a document"
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: t.card,
          border: `1px solid ${t.border}`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 10,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path
            d="M9 13V3M4 8l5-5 5 5M3 16h12"
            stroke={t.rustInk}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div style={{ fontSize: 14, color: t.ink, fontWeight: 500, marginBottom: 4 }}>
        Tap to upload or drag files here
      </div>
      <div style={{ fontSize: 12, color: t.muted, marginBottom: 12 }}>
        PDF, JPG, PNG · Up to 25MB
      </div>
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          // Stop the outer dropzone button from also firing — otherwise
          // tapping the inner pill would open BOTH the camera and the
          // generic file picker (whichever responded first wins; the
          // other dialog flashes confusingly on some browsers).
          e.stopPropagation();
          onTapCamera();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onTapCamera();
          }
        }}
        style={{
          background: t.card,
          border: `1px solid ${t.border}`,
          borderRadius: 999,
          padding: '8px 16px',
          fontSize: 13,
          color: t.ink,
          cursor: 'pointer',
          fontFamily: t.sans,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1.5" y="3.5" width="11" height="8" rx="1.5" stroke={t.ink} strokeWidth="1.2" />
          <circle cx="7" cy="7.5" r="2" stroke={t.ink} strokeWidth="1.2" />
        </svg>
        Take a photo
      </span>
    </button>
  );
}

function UploadingPanel({
  t,
  percent,
  filename,
}: {
  t: Theme;
  percent: number;
  filename: string;
}) {
  return (
    <div
      style={{
        border: `1.5px dashed ${t.border}`,
        borderRadius: t.radius,
        padding: '22px 18px',
        background: t.bgElev,
      }}
    >
      <div
        style={{
          fontFamily: t.serif,
          fontSize: 15,
          color: t.ink,
          marginBottom: 10,
          textAlign: 'center',
          wordBreak: 'break-all',
        }}
      >
        Uploading {filename}…
      </div>
      <div
        style={{
          height: 4,
          background: t.borderSoft,
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${percent}%`,
            background: t.rust,
            borderRadius: 999,
            transition: 'width 200ms linear',
          }}
        />
      </div>
      <div
        style={{
          textAlign: 'center',
          marginTop: 8,
          fontFamily: t.mono,
          fontSize: 11,
          color: t.muted,
          letterSpacing: 0.4,
        }}
      >
        {percent}%
      </div>
    </div>
  );
}

function SentPanel({
  t,
  filename,
  onSendAnother,
}: {
  t: Theme;
  filename: string;
  onSendAnother: () => void;
}) {
  return (
    <div
      style={{
        border: `1.5px solid ${t.borderSoft}`,
        borderRadius: t.radius,
        padding: '18px 18px',
        background: t.bgElev,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: '#e7efde',
          color: '#5b7a4f',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
        aria-hidden="true"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M3.5 7l2.5 2.5 5-5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: t.ink, fontWeight: 500 }}>
          Sent — your preparer will see it shortly
        </div>
        <div
          style={{
            fontSize: 11,
            color: t.muted,
            marginTop: 2,
            wordBreak: 'break-all',
            fontFamily: t.mono,
            letterSpacing: 0.2,
          }}
        >
          {filename}
        </div>
      </div>
      <button
        type="button"
        onClick={onSendAnother}
        style={{
          background: 'none',
          border: 'none',
          color: t.rustInk,
          fontSize: 12,
          fontFamily: t.sans,
          cursor: 'pointer',
          padding: 6,
          marginRight: -6,
          flexShrink: 0,
        }}
      >
        Send another
      </button>
    </div>
  );
}

function FailedPanel({
  t,
  error,
  onRetry,
}: {
  t: Theme;
  error: string;
  onRetry: () => void;
}) {
  return (
    <div
      style={{
        border: `1.5px solid #f3c8b6`,
        borderRadius: t.radius,
        padding: '16px 18px',
        background: '#FDF1EA',
      }}
    >
      <div
        style={{
          fontFamily: t.serif,
          fontSize: 15,
          color: '#6E2B0C',
          marginBottom: 6,
        }}
      >
        Couldn&apos;t send it
      </div>
      <div
        style={{
          fontSize: 13,
          color: '#6E2B0C',
          lineHeight: 1.5,
          marginBottom: 12,
        }}
      >
        {error}
      </div>
      <button
        type="button"
        onClick={onRetry}
        style={{
          background: t.card,
          border: `1px solid #f3c8b6`,
          borderRadius: 999,
          padding: '8px 16px',
          fontSize: 13,
          color: '#6E2B0C',
          cursor: 'pointer',
          fontFamily: t.sans,
        }}
      >
        Try again
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Browser PUT helper — mirrors the shape used by intake/[slotId] and
// intake/docs/add. Third caller now; the existing TODO over there
// authorizes extracting this if a fourth shows up. Kept inline for
// the bug-fix-minimal change here.
// ────────────────────────────────────────────────────────────────

const PUT_TIMEOUT_MS = 90_000;

async function putWithProgress(
  url: string,
  headers: Record<string, string>,
  file: File,
  onProgress: (pct: number) => void,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.timeout = PUT_TIMEOUT_MS;
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve({ ok: true });
      } else {
        console.error(
          '[portal/docs putWithProgress] PUT failed status=',
          xhr.status,
          'body=',
          xhr.responseText,
        );
        resolve({
          ok: false,
          error: `Upload failed (${xhr.status}). Try again, or let your preparer know if it keeps happening.`,
        });
      }
    };
    xhr.onerror = () => {
      console.error('[portal/docs putWithProgress] PUT network error.');
      resolve({
        ok: false,
        error: 'Upload failed — network error. Check your connection and try again.',
      });
    };
    xhr.ontimeout = () => {
      console.error('[portal/docs putWithProgress] PUT timed out after', PUT_TIMEOUT_MS, 'ms');
      resolve({ ok: false, error: 'Upload timed out. Check your connection and try again.' });
    };
    xhr.send(file);
  });
}
