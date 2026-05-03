'use client';

// Focused per-doc upload page — the editorial single-task page that
// the docs overview drills into.
//
// LAYOUT (top to bottom)
//   - Back chevron → /docs
//   - Doc title (Fraunces) + 1-line subtitle
//   - Hero card (illustration / current state)
//   - Antonio note (italic serif) — warm, doc-specific
//   - Where to find (regular body) — practical hint
//   - Action buttons:
//       Empty       → [ Take a photo ] + [ Upload a file ]
//       Uploading   → progress bar
//       Reading     → scanning animation
//       Parsed      → verification UI (filename + extracted fields + Retake / Looks right)
//       Final       → ✓ + filename + Replace link
//       Failed      → error message + Try again button
//
// On accept of a parsed doc, navigate back to /docs. The overview
// will pick up the new state on its server-side render.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AntonioNote,
  AskAntonioBar,
  Body,
  Button,
  buildTheme,
  H1,
  IntakeBackButton,
  IntakeHeader,
  Row,
  Screen,
  Stack,
} from '@docket/ui';
import type { Theme } from '@docket/ui';
import {
  type ExpectedDoc,
  friendlyDescriptionFor,
} from '@docket/shared';
import {
  requestUploadUrl,
  confirmUpload,
  acceptDocClassification,
} from '@/lib/docs/upload';
import type { DocumentRow } from '@/lib/docs/list';
import { useDocPoll, type DocPhase } from '../use-doc-poll';

type Phase = DocPhase | 'uploading' | 'idle';

type LocalState = {
  documentId: string | null;
  filename: string;
  phase: Phase;
  uploadProgress: number;
  classification: DocumentRow['classification'] | null;
  finalFilename: string | null;
  errorMessage: string | null;
};

function fromInitialDoc(doc: DocumentRow | null): LocalState {
  if (!doc) {
    return {
      documentId: null,
      filename: '',
      phase: 'idle',
      uploadProgress: 0,
      classification: null,
      finalFilename: null,
      errorMessage: null,
    };
  }
  return {
    documentId: doc.documentId,
    filename: doc.originalFilename,
    phase: doc.parsePhase as Phase,
    uploadProgress: 100,
    classification: doc.classification,
    finalFilename: doc.finalFilename,
    errorMessage: doc.errorMessage,
  };
}

export function DocSlotClient({
  slot,
  initialDoc,
}: {
  slot: ExpectedDoc;
  initialDoc: DocumentRow | null;
}) {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const router = useRouter();
  const [state, setState] = React.useState<LocalState>(() => fromInitialDoc(initialDoc));
  const [filenameEdit, setFilenameEdit] = React.useState<string>('');

  // Initialize filename edit when classification arrives.
  React.useEffect(() => {
    if (state.phase === 'parsed' && state.classification?.suggestedFilename) {
      setFilenameEdit(state.classification.suggestedFilename);
    }
  }, [state.phase, state.classification?.suggestedFilename]);

  // Poll while non-terminal.
  const targets = React.useMemo(() => {
    if (
      state.documentId &&
      ['uploaded', 'classifying', 'accepted', 'finalizing'].includes(state.phase)
    ) {
      return [{ documentId: state.documentId, phase: state.phase as DocPhase }];
    }
    return [];
  }, [state.documentId, state.phase]);

  useDocPoll(
    targets,
    (event) => {
      setState((prev) => {
        if (event.documentId !== prev.documentId) return prev;
        if (event.phase === 'uploaded' || event.phase === 'classifying') {
          return { ...prev, phase: event.phase };
        }
        if (event.phase === 'parsed') {
          return {
            ...prev,
            phase: 'parsed',
            classification: event.classification,
          };
        }
        if (event.phase === 'accepted' || event.phase === 'finalizing') {
          return { ...prev, phase: event.phase };
        }
        if (event.phase === 'final') {
          return {
            ...prev,
            phase: 'final',
            finalFilename: event.finalFilename,
          };
        }
        if (event.phase === 'failed') {
          return {
            ...prev,
            phase: 'failed',
            errorMessage: event.errorMessage,
          };
        }
        return prev;
      });
    },
    (documentId) => {
      setState((prev) =>
        prev.documentId === documentId
          ? {
              ...prev,
              phase: 'failed',
              errorMessage: 'Took too long to process. Try uploading again.',
            }
          : prev,
      );
    },
  );

  // ─── Upload flow ───
  // Each server action is try/catch'd so a 504 / network drop surfaces
  // a real failure state instead of leaving the UI spinning. The
  // browser-PUT step has its own xhr.timeout in putWithProgress.
  const onFileChosen = async (file: File) => {
    setState((prev) => ({
      ...prev,
      documentId: null,
      filename: file.name,
      phase: 'uploading',
      uploadProgress: 0,
      classification: null,
      finalFilename: null,
      errorMessage: null,
    }));

    let preflight;
    try {
      preflight = await requestUploadUrl({
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
      });
    } catch (err) {
      console.error('[onFileChosen] requestUploadUrl threw:', err);
      setState((prev) => ({
        ...prev,
        phase: 'failed',
        errorMessage:
          'Could not start the upload. Check your connection and try again.',
      }));
      return;
    }
    if (!preflight.ok) {
      setState((prev) => ({ ...prev, phase: 'failed', errorMessage: preflight.error }));
      return;
    }

    const putOk = await putWithProgress(
      preflight.uploadUrl,
      preflight.headers,
      file,
      (pct) => setState((prev) => ({ ...prev, uploadProgress: pct })),
    );
    if (!putOk.ok) {
      setState((prev) => ({ ...prev, phase: 'failed', errorMessage: putOk.error }));
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
      console.error('[onFileChosen] confirmUpload threw:', err);
      setState((prev) => ({
        ...prev,
        phase: 'failed',
        errorMessage:
          'Upload finished but we could not register it. Try again in a moment.',
      }));
      return;
    }
    if (!confirmed.ok) {
      setState((prev) => ({ ...prev, phase: 'failed', errorMessage: confirmed.error }));
      return;
    }

    setState((prev) => ({
      ...prev,
      documentId: confirmed.documentId,
      phase: 'uploaded',
    }));
  };

  // ─── Accept verification ───
  const onAccept = async () => {
    if (!state.documentId) return;
    setState((prev) => ({ ...prev, phase: 'accepted' }));
    const result = await acceptDocClassification({
      documentId: state.documentId,
      filenameOverride: filenameEdit.trim() || undefined,
    });
    if (!result.ok) {
      setState((prev) => ({ ...prev, phase: 'parsed', errorMessage: result.error }));
      return;
    }
    // Navigate back to overview. The slot will show finalizing/final
    // state from the server-side fetch on /docs.
    router.push('/docs');
    router.refresh();
  };

  const onRetake = () => {
    setState({
      documentId: null,
      filename: '',
      phase: 'idle',
      uploadProgress: 0,
      classification: null,
      finalFilename: null,
      errorMessage: null,
    });
  };

  const onBack = () => router.push('/docs');

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
        <IntakeHeader t={t} step={12} label="Documents" />

        <div style={{ padding: '22px 24px 0' }}>
          <IntakeBackButton t={t} onClick={onBack} />
        </div>

        <div style={{ padding: '20px 24px 8px' }}>
          <Stack gap={8}>
            <H1 t={t}>{slot.title}</H1>
            <Body t={t} size={14}>
              {slot.subtitle}
            </Body>
          </Stack>
        </div>

        <div style={{ padding: '14px 24px 0', flex: 1 }}>
          <PhaseBlock
            t={t}
            slot={slot}
            state={state}
            filenameEdit={filenameEdit}
            setFilenameEdit={setFilenameEdit}
            onFileChosen={onFileChosen}
            onAccept={onAccept}
            onRetake={onRetake}
          />
        </div>

        <div
          style={{
            position: 'sticky',
            bottom: 0,
            background: `linear-gradient(to top, ${t.bg} 75%, transparent)`,
            padding: '20px 24px 28px',
            marginTop: 24,
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <AskAntonioBar t={t} />
          </div>
          <Button t={t} variant="ghost" onClick={onBack} style={{ width: '100%' }}>
            Back to documents
          </Button>
          {!slot.required && state.phase === 'idle' && (
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button
                type="button"
                onClick={onBack}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontFamily: t.serif,
                  fontStyle: 'italic',
                  fontSize: 13,
                  color: t.muted,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                I don&apos;t have this — skip
              </button>
            </div>
          )}
        </div>
      </div>
    </Screen>
  );
}

// ────────────────────────────────────────────────────────────────
// Phase-aware central block.
// ────────────────────────────────────────────────────────────────

function PhaseBlock({
  t,
  slot,
  state,
  filenameEdit,
  setFilenameEdit,
  onFileChosen,
  onAccept,
  onRetake,
}: {
  t: Theme;
  slot: ExpectedDoc;
  state: LocalState;
  filenameEdit: string;
  setFilenameEdit: (s: string) => void;
  onFileChosen: (file: File) => void;
  onAccept: () => void;
  onRetake: () => void;
}) {
  // ─── Empty / idle ───
  if (state.phase === 'idle') {
    return (
      <Stack gap={20}>
        <DocHero t={t} />
        {slot.antonioNote && <AntonioNote t={t}>{slot.antonioNote}</AntonioNote>}
        {slot.whereToFind && (
          <div
            style={{
              padding: '14px 16px',
              background: t.tintAccent,
              borderRadius: 10,
            }}
          >
            <div
              style={{
                fontFamily: t.mono,
                fontSize: 9.5,
                color: t.rustInk,
                letterSpacing: 1,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Where to find it
            </div>
            <div style={{ fontSize: 13.5, color: t.ink, lineHeight: 1.5 }}>
              {slot.whereToFind}
            </div>
          </div>
        )}
        <Stack gap={10}>
          <FilePickerButton t={t} primary onPick={onFileChosen} mode="camera">
            Take a photo
          </FilePickerButton>
          <FilePickerButton t={t} primary={false} onPick={onFileChosen} mode="file">
            Upload a file
          </FilePickerButton>
        </Stack>
      </Stack>
    );
  }

  // ─── Uploading ───
  if (state.phase === 'uploading') {
    return (
      <Stack gap={20}>
        <DocHero t={t} caption="Uploading…" />
        <ProgressBar t={t} percent={state.uploadProgress} />
      </Stack>
    );
  }

  // ─── Reading (uploaded / classifying) ───
  if (state.phase === 'uploaded' || state.phase === 'classifying') {
    return (
      <Stack gap={20}>
        <DocHero t={t} caption="Reading…" pulse />
        <div
          style={{
            textAlign: 'center',
            fontFamily: t.serif,
            fontStyle: 'italic',
            fontSize: 14,
            color: t.muted,
          }}
        >
          Identifying the document and pulling out the values…
        </div>
      </Stack>
    );
  }

  // ─── Parsed: verification UI ───
  if (state.phase === 'parsed' && state.classification) {
    const fields = state.classification.extractedFields ?? {};
    const fieldEntries = Object.entries(fields).slice(0, 6);
    const friendly = friendlyDescriptionFor(
      state.classification.docKind,
      state.classification.extractedFields,
    );
    return (
      <Stack gap={16}>
        <div
          style={{
            padding: '20px 18px',
            background: t.ease.keylimeWash,
            borderRadius: 12,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontFamily: t.mono,
              fontSize: 9.5,
              color: t.rustInk,
              letterSpacing: 1,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Read successfully
          </div>
          <div
            style={{
              fontFamily: t.serif,
              fontSize: 18,
              color: t.ink,
              letterSpacing: -0.3,
            }}
          >
            {friendly ?? state.classification.suggestedFilename}
          </div>
        </div>

        <div>
          <div
            style={{
              fontFamily: t.mono,
              fontSize: 9.5,
              color: t.muted,
              letterSpacing: 1,
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            Filename
          </div>
          <input
            type="text"
            value={filenameEdit}
            onChange={(e) => setFilenameEdit(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: `1px solid ${t.border}`,
              borderRadius: 8,
              fontSize: 13.5,
              fontFamily: t.mono,
              color: t.ink,
              outline: 'none',
              boxSizing: 'border-box',
              background: '#fff',
            }}
          />
        </div>

        {fieldEntries.length > 0 && (
          <div
            style={{
              background: t.bgElev,
              border: `1px solid ${t.borderSoft}`,
              borderRadius: 10,
              padding: '14px 16px',
            }}
          >
            <div
              style={{
                fontFamily: t.mono,
                fontSize: 9.5,
                color: t.rustInk,
                letterSpacing: 1,
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              Detected
            </div>
            <Stack gap={8}>
              {fieldEntries.map(([k, v]) => (
                <Row key={k} justify="space-between" align="center">
                  <span
                    style={{
                      fontFamily: t.mono,
                      fontSize: 10.5,
                      color: t.muted,
                      letterSpacing: 0.4,
                    }}
                  >
                    {humanizeKey(k).toUpperCase()}
                  </span>
                  <span
                    style={{
                      fontFamily: t.serif,
                      fontSize: 13.5,
                      color: t.ink,
                      textAlign: 'right',
                      marginLeft: 12,
                    }}
                  >
                    {formatFieldValue(k, v)}
                  </span>
                </Row>
              ))}
            </Stack>
          </div>
        )}

        {state.classification.legibility < 0.5 && state.classification.retakeHint && (
          <div
            style={{
              padding: '12px 14px',
              background: '#FDF1EA',
              borderRadius: 10,
              fontSize: 13,
              color: '#6E2B0C',
              lineHeight: 1.5,
            }}
          >
            {state.classification.retakeHint}
          </div>
        )}

        <Row gap={10}>
          <Button t={t} variant="ghost" onClick={onRetake} style={{ flex: 1 }}>
            Retake
          </Button>
          <Button t={t} onClick={onAccept} style={{ flex: 1 }}>
            Looks right
          </Button>
        </Row>
      </Stack>
    );
  }

  // ─── Accepted / finalizing — same visual ───
  if (state.phase === 'accepted' || state.phase === 'finalizing') {
    return (
      <Stack gap={20}>
        <DocHero t={t} caption="Saving…" pulse />
      </Stack>
    );
  }

  // ─── Final (already done) ───
  if (state.phase === 'final') {
    return (
      <Stack gap={20}>
        <div
          style={{
            padding: '24px 18px',
            background: t.ease.keylimeWash,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: '#1f4621',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M5 9l3 3 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: t.serif,
                fontSize: 17,
                color: t.rustInk,
                letterSpacing: -0.2,
              }}
            >
              Saved
            </div>
            <div
              style={{
                fontSize: 12,
                color: t.muted,
                marginTop: 2,
                wordBreak: 'break-all',
              }}
            >
              {state.finalFilename ?? state.filename}
            </div>
          </div>
        </div>
        <Button t={t} variant="ghost" onClick={onRetake} style={{ width: '100%' }}>
          Replace this document
        </Button>
      </Stack>
    );
  }

  // ─── Failed ───
  if (state.phase === 'failed') {
    return (
      <Stack gap={20}>
        <div
          style={{
            padding: '20px 18px',
            background: '#FDF1EA',
            borderRadius: 12,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontFamily: t.serif,
              fontSize: 16,
              color: '#6E2B0C',
              marginBottom: 6,
            }}
          >
            Something went wrong
          </div>
          <div style={{ fontSize: 13, color: '#6E2B0C', lineHeight: 1.5 }}>
            {state.errorMessage ?? 'Try uploading again.'}
          </div>
        </div>
        <Stack gap={10}>
          <FilePickerButton t={t} primary onPick={onFileChosen} mode="camera">
            Try again — take a photo
          </FilePickerButton>
          <FilePickerButton t={t} primary={false} onPick={onFileChosen} mode="file">
            Try again — upload a file
          </FilePickerButton>
        </Stack>
      </Stack>
    );
  }

  return null;
}

// ────────────────────────────────────────────────────────────────
// Hero card — minimal editorial illustration of "a document."
// Doesn't try to be doc-specific; the page title + Antonio note
// carry the specificity. Pulse animates during reading/saving.
// ────────────────────────────────────────────────────────────────
function DocHero({
  t,
  caption,
  pulse,
}: {
  t: Theme;
  caption?: string;
  pulse?: boolean;
}) {
  return (
    <div
      style={{
        position: 'relative',
        aspectRatio: '4 / 3',
        borderRadius: 14,
        background: t.ease.keylimeWash,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '70%',
          aspectRatio: '0.8',
          background: '#fdfcf7',
          borderRadius: 4,
          boxShadow: '0 4px 16px rgba(15, 62, 23, 0.08)',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          animation: pulse ? 'doc-hero-pulse 2.4s ease-in-out infinite' : undefined,
        }}
      >
        <div
          style={{
            height: 4,
            width: '40%',
            background: t.rust,
            opacity: 0.6,
            borderRadius: 1,
          }}
        />
        <div style={{ height: 1, background: t.borderSoft, marginTop: 4 }} />
        {[80, 65, 72, 55, 78, 60].map((w, i) => (
          <div
            key={i}
            style={{
              height: 5,
              width: `${w}%`,
              background: t.borderSoft,
              borderRadius: 1,
            }}
          />
        ))}
      </div>
      {caption && (
        <div
          style={{
            position: 'absolute',
            bottom: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '4px 10px',
            background: t.ink,
            color: '#fff',
            fontFamily: t.mono,
            fontSize: 9.5,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            borderRadius: 4,
          }}
        >
          {caption}
        </div>
      )}
      <style>{`
        @keyframes doc-hero-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}

function ProgressBar({ t, percent }: { t: Theme; percent: number }) {
  return (
    <div>
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

function FilePickerButton({
  t,
  onPick,
  primary,
  mode,
  children,
}: {
  t: Theme;
  onPick: (file: File) => void;
  primary: boolean;
  mode: 'camera' | 'file';
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
        // For the "Take a photo" button on mobile, capture="environment"
        // launches the rear camera directly. For "Upload a file" we
        // omit capture so the native file picker shows photo library +
        // files. Desktop ignores capture entirely.
        {...(mode === 'camera' ? { capture: 'environment' as const } : {})}
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = '';
        }}
      />
      <Button
        t={t}
        variant={primary ? 'primary' : 'ghost'}
        onClick={() => ref.current?.click()}
        style={{ width: '100%' }}
      >
        {children}
      </Button>
    </>
  );
}

// ────────────────────────────────────────────────────────────────
// Helpers.
// ────────────────────────────────────────────────────────────────

// Hard cutoff for the browser PUT to R2. Without this, a hung network
// connection (R2 endpoint unreachable, CORS preflight stalled, ISP
// problem) leaves the upload spinning forever — there's no XHR-level
// default timeout. 90s is generous enough for a 25MB file on a slow
// mobile connection (~280 KB/s), tight enough that real failures
// surface within a couple minutes instead of indefinitely.
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
        // Surface the response body when present — R2 error responses
        // often include a useful XML message ("AccessDenied", "NoSuchBucket",
        // etc.) that points at the misconfiguration immediately.
        console.error('[putWithProgress] PUT failed status=', xhr.status, 'body=', xhr.responseText);
        resolve({
          ok: false,
          error: `Upload failed (${xhr.status}). Tap to retry. If this keeps happening, the storage isn't set up — let your preparer know.`,
        });
      }
    };
    xhr.onerror = () => {
      console.error('[putWithProgress] PUT network error — likely CORS, DNS, or offline.');
      resolve({
        ok: false,
        error:
          'Upload failed — network error. This usually means the storage CORS isn\'t configured. Let your preparer know.',
      });
    };
    xhr.ontimeout = () => {
      console.error('[putWithProgress] PUT timed out after', PUT_TIMEOUT_MS, 'ms');
      resolve({
        ok: false,
        error:
          'Upload timed out. Check your connection and try again.',
      });
    };
    xhr.send(file);
  });
}

function humanizeKey(k: string): string {
  return k
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim();
}

function formatFieldValue(k: string, v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'number') {
    const lower = k.toLowerCase();
    if (
      lower.includes('amount') ||
      lower.includes('income') ||
      lower.includes('wage') ||
      lower.includes('tax') ||
      lower.includes('balance') ||
      lower.includes('value') ||
      lower.includes('premium') ||
      lower.includes('payment') ||
      lower.includes('paid') ||
      lower.includes('comp') ||
      lower.includes('div') ||
      lower.includes('int') ||
      lower.includes('rent')
    ) {
      const dollars = v / 100;
      return `$${dollars.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }
    return String(v);
  }
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}
