'use client';

// Returning portal - Docs tab. Document tracker grouped by category with
// progress bar + upload zone. Simplified port: drops the deep preview/info
// modal flow from the JSX prototype (defer until docs pipeline is wired).
//
// UPLOAD PIPELINE
//   The dropzone + "Take a photo" button feed straight into the same
//   server actions the intake docs flow uses (requestUploadUrl →
//   browser PUT to R2 → confirmUpload). No slot binding — these come
//   in as uncategorized uploads and surface to the preparer in
//   command-room (Q1b: hidden from this client-side checklist by
//   design, the mock list above is decorative until the pipeline lands
//   real data). The two controls share one onPick handler; the only
//   difference is whether the camera capture hint is set.

import {
  Body,
  Button,
  buildTheme,
  Card,
  H1,
  ProgressBar,
  Row,
  Stack,
  Wordmark,
} from '@docket/ui';
import type { Theme } from '@docket/ui';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { confirmUpload, requestUploadUrl } from '@/lib/docs/upload';

type Doc = {
  name: string;
  date: string;
  status: 'uploaded' | 'pending';
  extracted?: boolean;
  group: string;
};

const DOCS: Doc[] = [
  { name: 'W-2 (Acme Inc)', date: 'FEB 3, 2026', status: 'uploaded', extracted: true, group: 'Income' },
  { name: '1099-NEC (Freelance)', date: 'FEB 3, 2026', status: 'uploaded', extracted: true, group: 'Income' },
  { name: '1099-K (Stripe)', date: 'FEB 10, 2026', status: 'uploaded', group: 'Income' },
  { name: '1099-INT (Chase)', date: 'NOT YET UPLOADED', status: 'pending', group: 'Income' },
  { name: 'Revenue summary 2025', date: 'FEB 5, 2026', status: 'uploaded', extracted: true, group: 'Business' },
  { name: 'Expense receipts', date: 'NOT YET UPLOADED', status: 'pending', group: 'Business' },
  { name: "Driver's license", date: 'JAN 14, 2026', status: 'uploaded', group: 'Identity' },
  { name: 'Engagement letter', date: 'JAN 14, 2026', status: 'uploaded', group: 'Agreements' },
  { name: '§7216 consent', date: 'AWAITING SIGNATURE', status: 'pending', group: 'Agreements' },
];

function abbrev(name: string): string {
  // Best-effort 2–3 char tag for the icon well.
  const lower = name.toLowerCase();
  if (lower.startsWith('w-2')) return 'W2';
  if (lower.startsWith('1099-nec')) return 'NEC';
  if (lower.startsWith('1099-k')) return '1099K';
  if (lower.startsWith('1099-int')) return 'INT';
  if (lower.startsWith('1099-div')) return 'DIV';
  if (lower.startsWith('revenue')) return 'REV';
  if (lower.startsWith('expense')) return 'EXP';
  if (lower.startsWith("driver")) return 'ID';
  if (lower.startsWith('engagement')) return 'ENG';
  if (lower.startsWith('§7216') || lower.startsWith('7216')) return '7216';
  return name.slice(0, 3).toUpperCase();
}

function DocRow({ t, doc }: { t: Theme; doc: Doc }) {
  const isUploaded = doc.status === 'uploaded';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 0',
        opacity: isUploaded ? 1 : 0.85,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          background: isUploaded ? t.tintAccent : t.bgElev,
          border: `1px solid ${isUploaded ? t.rustSoft : t.borderSoft}`,
          color: isUploaded ? t.rustInk : t.muted,
          fontFamily: t.mono,
          fontSize: 9.5,
          fontWeight: 600,
          letterSpacing: 0.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {abbrev(doc.name)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            color: t.ink,
            fontWeight: 500,
            letterSpacing: -0.1,
          }}
        >
          {doc.name}
        </div>
        <div
          style={{
            fontFamily: t.mono,
            fontSize: 11,
            color: t.muted,
            letterSpacing: 0.3,
            marginTop: 2,
          }}
        >
          {isUploaded ? `Uploaded ${doc.date}` : doc.date}
          {doc.extracted && (
            <span style={{ color: t.green, marginLeft: 8 }}>● AI READ</span>
          )}
        </div>
      </div>
      {isUploaded ? (
        <button
          style={{
            background: 'none',
            border: 'none',
            color: t.rustInk,
            fontSize: 12,
            fontFamily: t.sans,
            cursor: 'pointer',
            padding: 6,
            marginRight: -6,
          }}
        >
          View
        </button>
      ) : (
        <span
          style={{
            fontFamily: t.mono,
            fontSize: 10,
            color: t.muted,
            letterSpacing: 0.6,
          }}
        >
          -
        </span>
      )}
    </div>
  );
}

function DocGroup({
  t,
  label,
  docs,
}: {
  t: Theme;
  label: string;
  docs: Doc[];
}) {
  const uploaded = docs.filter((d) => d.status === 'uploaded').length;
  return (
    <div style={{ marginBottom: 22 }}>
      <Row justify="space-between" align="baseline" style={{ marginBottom: 8 }}>
        <span
          style={{
            fontFamily: t.sans,
            fontSize: 12.5,
            color: t.muted,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: t.mono,
            fontSize: 11,
            color: t.muted,
            letterSpacing: 0.3,
          }}
        >
          {uploaded}/{docs.length}
        </span>
      </Row>
      <Card t={t} style={{ padding: '4px 18px' }}>
        {docs.map((d, i) => (
          <React.Fragment key={d.name}>
            <DocRow t={t} doc={d} />
            {i < docs.length - 1 && <div style={{ height: 1, background: t.borderSoft }} />}
          </React.Fragment>
        ))}
      </Card>
    </div>
  );
}

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
        // Refresh server data so the docs list (once wired) picks up the
        // new row. Today the list is hardcoded mock data so the user
        // won't see their upload here yet — the "Sent" message is the
        // signal. Antonio sees it in command-room either way.
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

  const groups: Record<string, Doc[]> = {};
  for (const d of DOCS) {
    (groups[d.group] = groups[d.group] || []).push(d);
  }

  const uploadedCount = DOCS.filter((d) => d.status === 'uploaded').length;
  const totalCount = DOCS.length;
  const pct = Math.round((uploadedCount / totalCount) * 100);

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
            <Row justify="space-between" align="flex-end">
              <Body t={t} size={14} muted>
                {uploadedCount} of {totalCount} uploaded
              </Body>
              <div style={{ fontSize: 13, color: t.rustInk, fontWeight: 500 }}>{pct}%</div>
            </Row>
            <ProgressBar t={t} value={uploadedCount} total={totalCount} />
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

          <div>
            {['Income', 'Business', 'Identity', 'Agreements'].map((label) =>
              groups[label] ? (
                <DocGroup key={label} t={t} label={label} docs={groups[label]!} />
              ) : null,
            )}
          </div>

          <Button t={t} variant="ghost" style={{ width: '100%' }}>
            Download all as ZIP
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
