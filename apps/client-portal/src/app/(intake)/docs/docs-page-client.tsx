'use client';

// Intake docs page — client orchestrator.
//
// Owns: upload state machine, polling loop, slot matching, verification UX.
// Reads the server-derived expected list + initial doc rows; mutates state
// as users upload + accept docs.
//
// FLOW
//   Initial render: hydrate from server (existing docs already classified
//   land in their matching slots; in-progress phases continue polling
//   from where they were).
//
//   User taps "Add" on a slot OR "Add another" at the bottom:
//     1. <input type="file"> opens (with capture="environment" for camera-
//        first behavior on mobile).
//     2. File chosen → call requestUploadUrl → receive presigned PUT URL.
//     3. Browser PUTs bytes directly to R2 with progress events.
//     4. PUT done → call confirmUpload → receive documentId.
//     5. New DocItem appended (phase = uploaded).
//     6. Start polling loop (every 1500 ms).
//     7. As phase advances (classifying → parsed), update the DocItem.
//     8. On phase = parsed: show inline verification card.
//        User edits filename / overrides classification if needed → clicks
//        "Looks right" → acceptDocClassification → polling resumes
//        (will see finalizing → final).
//     9. On phase = final: doc shows as saved with final filename.
//
//   Slot match (post-classification):
//     When a doc enters phase = parsed, run matchUploadToSlot against
//     the expected list. If matched, the slot's UI fills with that doc.
//     If not, the doc lives in the Other section.

import * as React from 'react';
import {
  AskAntonioBar,
  Body,
  Button,
  buildTheme,
  Card,
  H1,
  IntakeBackButton,
  IntakeHeader,
  Row,
  Screen,
  Stack,
} from '@docket/ui';
import type { Theme } from '@docket/ui';
import { usePortalNav } from '@/lib/portal-nav';
import {
  type ExpectedDoc,
  type ExpectedDocKind,
  matchUploadToSlot,
} from '@docket/shared';
import {
  requestUploadUrl,
  confirmUpload,
  getDocumentStatus,
  acceptDocClassification,
} from '@/lib/docs/upload';
import type { DocumentRow } from '@/lib/docs/list';

const POLL_MS = 1500;
const POLL_SLOW_MS = 3000;
const POLL_SLOW_AFTER_MS = 30_000;
// Hard cutoff. If a doc is still uploaded / classifying / accepted /
// finalizing after this, something is wrong (Inngest worker not
// running, R2 misconfigured, Haiku timing out, etc.). Surface a clear
// error rather than spinning forever.
const POLL_GIVE_UP_AFTER_MS = 90_000;

type DocItemPhase =
  | 'uploading'
  | 'uploaded'
  | 'classifying'
  | 'parsed'
  | 'accepted'
  | 'finalizing'
  | 'final'
  | 'failed';

type DocItem = {
  /** Local key — for new uploads before documentId is known. */
  key: string;
  /** Real DB id — null while uploading, set after confirmUpload. */
  documentId: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  phase: DocItemPhase;
  uploadProgress?: number;
  /** Set once classified. */
  classification?: {
    docKind: string;
    confidence: number;
    legibility: number;
    extractedFields: Record<string, unknown>;
    suggestedFilename: string;
    retakeHint: string | null;
  };
  /** Set once finalized — the renamed PDF that preparers see. */
  finalFilename?: string;
  binarized?: boolean;
  /** Slot id this doc fills, or null for Other. */
  slotId: string | null;
  /** When polling started — used for backoff. */
  pollStart?: number;
  errorMessage?: string;
};

export function DocsPageClient({
  expected,
  initialDocuments,
}: {
  expected: ExpectedDoc[];
  initialDocuments: DocumentRow[];
}) {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();

  // ─── State ───
  const [docs, setDocs] = React.useState<DocItem[]>(() =>
    hydrateInitial(initialDocuments, expected),
  );
  const [verifyingDocKey, setVerifyingDocKey] = React.useState<string | null>(null);
  const [pageError, setPageError] = React.useState<string | null>(null);

  // Polling registry — { documentId: cleanupFn }.
  const pollingRef = React.useRef<Map<string, () => void>>(new Map());

  // ─── Polling lifecycle ───

  const startPolling = React.useCallback(
    (documentId: string, key: string) => {
      // Already polling? leave it.
      if (pollingRef.current.has(documentId)) return;

      const startTime = Date.now();
      let cancelled = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const poll = async () => {
        if (cancelled) return;

        // Hard timeout — if we've been waiting too long, the worker
        // probably isn't picking up the event. Mark this doc as failed
        // so the user sees an actionable error instead of a perpetual
        // spinner.
        const elapsed = Date.now() - startTime;
        if (elapsed > POLL_GIVE_UP_AFTER_MS) {
          console.error(
            '[poll] timeout — doc stuck after',
            Math.round(elapsed / 1000),
            's. Likely cause: Inngest worker not running or R2 / Haiku misconfigured.',
          );
          setDocs((prev) =>
            prev.map((d) =>
              d.key === key
                ? {
                    ...d,
                    phase: 'failed',
                    errorMessage:
                      'Upload took too long. Check your connection and try again, or contact your preparer.',
                  }
                : d,
            ),
          );
          return cleanup();
        }

        try {
          const status = await getDocumentStatus(documentId);
          if (cancelled) return;
          if ('ok' in status && status.ok === false) {
            // server-side error in the action itself — surface it
            console.error('[poll] action error:', status.error);
            return scheduleNext();
          }
          // Normal phase responses.
          applyStatus(key, status as Awaited<ReturnType<typeof getDocumentStatus>>);
          // Stop polling on terminal phases.
          if (
            'phase' in status &&
            (status.phase === 'parsed' ||
              status.phase === 'accepted' ||
              status.phase === 'final' ||
              status.phase === 'failed' ||
              status.phase === 'not_found')
          ) {
            return cleanup();
          }
        } catch (err) {
          console.error('[poll] threw:', err);
        }
        scheduleNext();
      };

      const scheduleNext = () => {
        if (cancelled) return;
        const elapsed = Date.now() - startTime;
        const interval = elapsed > POLL_SLOW_AFTER_MS ? POLL_SLOW_MS : POLL_MS;
        timeoutId = setTimeout(poll, interval);
      };

      const cleanup = () => {
        cancelled = true;
        if (timeoutId) clearTimeout(timeoutId);
        pollingRef.current.delete(documentId);
      };

      pollingRef.current.set(documentId, cleanup);
      // Kick off first poll on next tick so React's commit completes.
      timeoutId = setTimeout(poll, POLL_MS);
    },
    // applyStatus is stable via setter callback — safe to omit
    [],
  );

  // Stop all polling on unmount.
  React.useEffect(() => {
    return () => {
      for (const cleanup of pollingRef.current.values()) cleanup();
      pollingRef.current.clear();
    };
  }, []);

  // Resume polling for any pre-existing docs that are still mid-pipeline.
  React.useEffect(() => {
    for (const d of docs) {
      if (
        d.documentId &&
        (d.phase === 'uploaded' ||
          d.phase === 'classifying' ||
          d.phase === 'accepted' ||
          d.phase === 'finalizing')
      ) {
        startPolling(d.documentId, d.key);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── State mutators ───

  function applyStatus(
    key: string,
    status: Awaited<ReturnType<typeof getDocumentStatus>>,
  ) {
    if ('ok' in status && status.ok === false) return;
    setDocs((prev) =>
      prev.map((d) => {
        if (d.key !== key) return d;
        const s = status as Exclude<typeof status, { ok: false }>;
        if (!('phase' in s)) return d;
        switch (s.phase) {
          case 'uploaded':
            return { ...d, phase: 'uploaded' };
          case 'classifying':
            return { ...d, phase: 'classifying' };
          case 'parsed': {
            const slotId = matchUploadToSlot({
              uploadKind: s.classification.docKind as ExpectedDocKind,
              expected,
              filledSlotIds: filledSlots(prev),
            });
            return {
              ...d,
              phase: 'parsed',
              classification: s.classification,
              slotId,
            };
          }
          case 'accepted':
            return { ...d, phase: 'accepted' };
          case 'finalizing':
            return { ...d, phase: 'finalizing' };
          case 'final':
            return {
              ...d,
              phase: 'final',
              finalFilename: s.finalFilename,
              binarized: s.binarized,
            };
          case 'failed':
            return { ...d, phase: 'failed', errorMessage: s.errorMessage };
          case 'not_found':
            return { ...d, phase: 'failed', errorMessage: 'Document not found' };
        }
      }),
    );
  }

  // ─── Upload flow ───

  const onFileChosen = React.useCallback(
    async (file: File, slotId: string | null) => {
      const key = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      // Optimistic insert.
      setDocs((prev) => [
        {
          key,
          documentId: null,
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          phase: 'uploading',
          uploadProgress: 0,
          slotId,
        },
        ...prev,
      ]);

      // 1. Preflight.
      const preflight = await requestUploadUrl({
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
      });
      if (!preflight.ok) {
        setDocs((prev) =>
          prev.map((d) =>
            d.key === key ? { ...d, phase: 'failed', errorMessage: preflight.error } : d,
          ),
        );
        return;
      }

      // 2. PUT to R2 with progress.
      const putOk = await putWithProgress(
        preflight.uploadUrl,
        preflight.headers,
        file,
        (pct) => {
          setDocs((prev) =>
            prev.map((d) => (d.key === key ? { ...d, uploadProgress: pct } : d)),
          );
        },
      );

      if (!putOk.ok) {
        setDocs((prev) =>
          prev.map((d) =>
            d.key === key ? { ...d, phase: 'failed', errorMessage: putOk.error } : d,
          ),
        );
        return;
      }

      // 3. Confirm.
      const confirmed = await confirmUpload({
        storageKey: preflight.storageKey,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
      });
      if (!confirmed.ok) {
        setDocs((prev) =>
          prev.map((d) =>
            d.key === key ? { ...d, phase: 'failed', errorMessage: confirmed.error } : d,
          ),
        );
        return;
      }

      // 4. Update with documentId + start polling.
      setDocs((prev) =>
        prev.map((d) =>
          d.key === key
            ? { ...d, documentId: confirmed.documentId, phase: 'uploaded' }
            : d,
        ),
      );
      startPolling(confirmed.documentId, key);
    },
    [expected, startPolling],
  );

  const onAccept = React.useCallback(
    async (key: string, override?: { filename?: string; docKind?: string }) => {
      const target = docs.find((d) => d.key === key);
      if (!target?.documentId) return;
      setDocs((prev) =>
        prev.map((d) => (d.key === key ? { ...d, phase: 'accepted' } : d)),
      );
      const result = await acceptDocClassification({
        documentId: target.documentId,
        filenameOverride: override?.filename,
        docKindOverride: override?.docKind,
      });
      if (!result.ok) {
        setDocs((prev) =>
          prev.map((d) =>
            d.key === key ? { ...d, phase: 'parsed', errorMessage: result.error } : d,
          ),
        );
        return;
      }
      setVerifyingDocKey(null);
      // Resume polling — server already advanced to accepted, finalize
      // will follow.
      startPolling(target.documentId, key);
    },
    [docs, startPolling],
  );

  // ─── Render ───

  // Group docs: matched-to-slot vs Other.
  const slotMap = React.useMemo(() => {
    const m = new Map<string, DocItem>();
    for (const d of docs) {
      if (d.slotId) m.set(d.slotId, d);
    }
    return m;
  }, [docs]);

  const otherDocs = docs.filter((d) => d.slotId == null);

  const requiredCount = expected.filter((e) => e.required).length;
  const filledRequiredCount = expected.filter(
    (e) => e.required && slotMap.has(e.id),
  ).length;

  const verifyingDoc = verifyingDocKey
    ? docs.find((d) => d.key === verifyingDocKey)
    : null;

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
          <IntakeBackButton t={t} onClick={() => nav.back('/refund')} />
        </div>

        <div style={{ padding: '18px 24px 14px' }}>
          <Stack gap={10}>
            <H1 t={t}>Upload your documents</H1>
            <Body t={t} size={14}>
              Anything tax-related — we&apos;ll figure out what&apos;s what.{' '}
              <span style={{ color: t.rustInk, fontFamily: t.mono }}>
                {filledRequiredCount}
              </span>{' '}
              of{' '}
              <span style={{ color: t.rustInk, fontFamily: t.mono }}>
                {requiredCount}
              </span>{' '}
              required uploaded.
            </Body>
          </Stack>
        </div>

        <div style={{ padding: '0 24px', flex: 1 }}>
          {/* Required + recommended slots */}
          <Stack gap={8}>
            {expected.map((slot) => (
              <SlotRow
                key={slot.id}
                t={t}
                slot={slot}
                doc={slotMap.get(slot.id) ?? null}
                onPickFile={(file) => onFileChosen(file, slot.id)}
                onVerify={(key) => setVerifyingDocKey(key)}
              />
            ))}
          </Stack>

          {/* Other section — unmatched uploads */}
          {otherDocs.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div
                style={{
                  fontFamily: t.mono,
                  fontSize: 10,
                  color: t.muted,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                Other ({otherDocs.length})
              </div>
              <Stack gap={8}>
                {otherDocs.map((d) => (
                  <OtherDocRow
                    key={d.key}
                    t={t}
                    doc={d}
                    onVerify={(key) => setVerifyingDocKey(key)}
                  />
                ))}
              </Stack>
            </div>
          )}

          {/* Add another */}
          <div style={{ marginTop: 24 }}>
            <AddDocumentButton
              t={t}
              label="Add another document"
              hint="Photo or file — anything we missed"
              onPick={(file) => onFileChosen(file, null)}
            />
          </div>

          {pageError && (
            <div
              style={{
                marginTop: 16,
                padding: '10px 12px',
                background: '#fff0eb',
                border: `1px solid ${t.rust}`,
                borderRadius: 8,
                color: '#7a3a26',
                fontSize: 13,
              }}
            >
              {pageError}
            </div>
          )}
        </div>

        <div
          style={{
            position: 'sticky',
            bottom: 0,
            background: `linear-gradient(to top, ${t.bg} 75%, transparent)`,
            padding: '20px 24px 28px',
            marginTop: 20,
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <AskAntonioBar t={t} />
          </div>
          <Row gap={10}>
            <Button
              t={t}
              variant="ghost"
              onClick={() => nav.next('/engagement')}
              style={{ flex: 1 }}
            >
              Skip for now
            </Button>
            <Button t={t} onClick={() => nav.next('/engagement')} style={{ flex: 1 }}>
              Continue
            </Button>
          </Row>
        </div>
      </div>

      {/* Inline verification overlay */}
      {verifyingDoc && verifyingDoc.classification && (
        <VerificationOverlay
          t={t}
          doc={verifyingDoc}
          onAccept={(override) => onAccept(verifyingDoc.key, override)}
          onCancel={() => setVerifyingDocKey(null)}
        />
      )}
    </Screen>
  );
}

// ────────────────────────────────────────────────────────────────
// Subcomponents.
// ────────────────────────────────────────────────────────────────

function SlotRow({
  t,
  slot,
  doc,
  onPickFile,
  onVerify,
}: {
  t: Theme;
  slot: ExpectedDoc;
  doc: DocItem | null;
  onPickFile: (file: File) => void;
  onVerify: (key: string) => void;
}) {
  const filled = !!doc;
  const phase = doc?.phase;

  return (
    <Card t={t} style={{ padding: '14px 16px' }}>
      <Row gap={12} align="center">
        <SlotIcon t={t} kind={slot.kind} filled={filled} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Row gap={6} align="center">
            <span
              style={{
                fontFamily: t.serif,
                fontSize: 15,
                color: t.ink,
                letterSpacing: -0.2,
              }}
            >
              {slot.title}
            </span>
            {slot.required && !filled && (
              <span
                style={{
                  fontFamily: t.mono,
                  fontSize: 9,
                  color: t.rust,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                }}
              >
                Required
              </span>
            )}
          </Row>
          <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>
            {filled ? <DocSubtitle doc={doc} /> : slot.subtitle}
          </div>
        </div>
        <SlotAction
          t={t}
          phase={phase}
          docKey={doc?.key ?? null}
          onPickFile={onPickFile}
          onVerify={onVerify}
        />
      </Row>
    </Card>
  );
}

function OtherDocRow({
  t,
  doc,
  onVerify,
}: {
  t: Theme;
  doc: DocItem;
  onVerify: (key: string) => void;
}) {
  return (
    <Card t={t} style={{ padding: '14px 16px' }}>
      <Row gap={12} align="center">
        <SlotIcon t={t} kind={(doc.classification?.docKind ?? 'other') as ExpectedDocKind} filled />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: t.serif,
              fontSize: 15,
              color: t.ink,
              letterSpacing: -0.2,
              wordBreak: 'break-all',
            }}
          >
            {doc.finalFilename ?? doc.classification?.suggestedFilename ?? doc.filename}
          </div>
          <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>
            <DocSubtitle doc={doc} />
          </div>
        </div>
        <SlotAction
          t={t}
          phase={doc.phase}
          docKey={doc.key}
          onPickFile={() => {/* not applicable for Other rows */}}
          onVerify={onVerify}
          hideAddCta
        />
      </Row>
    </Card>
  );
}

function DocSubtitle({ doc }: { doc: DocItem }) {
  switch (doc.phase) {
    case 'uploading':
      return <>Uploading… {doc.uploadProgress ?? 0}%</>;
    case 'uploaded':
    case 'classifying':
      return <>Reading…</>;
    case 'parsed':
      if (doc.classification && doc.classification.legibility < 0.5) {
        return (
          <span style={{ color: '#a13d2c' }}>
            Looks blurry. {doc.classification.retakeHint ?? 'Try a clearer photo.'}
          </span>
        );
      }
      return <>Looks right? Verify →</>;
    case 'accepted':
    case 'finalizing':
      return <>Saving…</>;
    case 'final':
      return <>{doc.finalFilename}</>;
    case 'failed':
      return <span style={{ color: '#a13d2c' }}>{doc.errorMessage ?? 'Something went wrong'}</span>;
  }
}

function SlotAction({
  t,
  phase,
  docKey,
  onPickFile,
  onVerify,
  hideAddCta = false,
}: {
  t: Theme;
  phase: DocItemPhase | undefined;
  docKey: string | null;
  onPickFile: (file: File) => void;
  onVerify: (key: string) => void;
  hideAddCta?: boolean;
}) {
  if (phase == null) {
    if (hideAddCta) return null;
    return <FilePickerButton t={t} onPick={onPickFile} compact />;
  }

  switch (phase) {
    case 'uploading':
    case 'uploaded':
    case 'classifying':
    case 'accepted':
    case 'finalizing':
      return (
        <span
          style={{
            display: 'inline-flex',
            width: 18,
            height: 18,
            borderRadius: '50%',
            border: `2px solid ${t.borderSoft}`,
            borderTopColor: t.rust,
            animation: 'spin 800ms linear infinite',
          }}
        >
          <style>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to   { transform: rotate(360deg); }
            }
          `}</style>
        </span>
      );
    case 'parsed':
      return (
        <button
          type="button"
          onClick={() => docKey && onVerify(docKey)}
          style={{
            padding: '6px 12px',
            background: t.ink,
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 12,
            fontFamily: t.sans,
            cursor: 'pointer',
          }}
        >
          Verify
        </button>
      );
    case 'final':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: '#1f4621',
            color: '#fff',
          }}
          aria-label="Saved"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M3 6l2 2 4-4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      );
    case 'failed':
      return (
        <button
          type="button"
          onClick={() => {
            // No retry impl in v1 — user picks a new file from the slot.
          }}
          style={{
            padding: '6px 12px',
            background: 'transparent',
            border: `1px solid ${t.rust}`,
            borderRadius: 6,
            fontSize: 12,
            fontFamily: t.sans,
            color: t.rust,
            cursor: 'not-allowed',
          }}
          disabled
        >
          Failed
        </button>
      );
  }
}

function SlotIcon({
  t,
  kind,
  filled,
}: {
  t: Theme;
  kind: ExpectedDocKind | string;
  filled: boolean;
}) {
  const abbr = abbreviationFor(kind as ExpectedDocKind);
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: 6,
        background: filled ? t.tintAccentStrong : t.tintAccent,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: t.mono,
        fontSize: 10,
        color: t.rustInk,
        letterSpacing: 0.5,
        flexShrink: 0,
      }}
    >
      {abbr}
    </div>
  );
}

function FilePickerButton({
  t,
  onPick,
  compact = false,
}: {
  t: Theme;
  onPick: (file: File) => void;
  compact?: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
        // No `capture` attr — iOS Safari + Android Chrome show a native
        // sheet ("Take Photo / Photo Library / Files") so the user
        // chooses how to source the file. With capture="environment"
        // they get camera-only, which traps users with a PDF on disk.
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          // Reset so picking the same filename twice in a row still fires.
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        style={{
          padding: compact ? '6px 12px' : '10px 16px',
          background: 'transparent',
          border: `1px solid ${t.border}`,
          borderRadius: compact ? 6 : 8,
          fontSize: compact ? 12 : 13,
          fontFamily: t.sans,
          color: t.ink,
          cursor: 'pointer',
        }}
      >
        Add
      </button>
    </>
  );
}

function AddDocumentButton({
  t,
  label,
  hint,
  onPick,
}: {
  t: Theme;
  label: string;
  hint: string;
  onPick: (file: File) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        style={{
          width: '100%',
          padding: '18px 20px',
          background: t.tintAccent,
          border: `1px dashed ${t.border}`,
          borderRadius: 12,
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <span style={{ fontFamily: t.serif, fontSize: 16, color: t.ink }}>{label}</span>
        <span style={{ fontSize: 12, color: t.muted }}>{hint}</span>
      </button>
    </>
  );
}

function VerificationOverlay({
  t,
  doc,
  onAccept,
  onCancel,
}: {
  t: Theme;
  doc: DocItem;
  onAccept: (override?: { filename?: string; docKind?: string }) => void;
  onCancel: () => void;
}) {
  const [filename, setFilename] = React.useState(
    doc.classification?.suggestedFilename ?? doc.filename,
  );
  const fields = doc.classification?.extractedFields ?? {};
  const fieldEntries = Object.entries(fields).slice(0, 6); // cap at 6 fields shown

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20,16,10,0.45)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          background: t.card,
          borderRadius: '16px 16px 0 0',
          padding: 24,
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Stack gap={14}>
          <div>
            <div
              style={{
                fontFamily: t.mono,
                fontSize: 9.5,
                color: t.muted,
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              {labelForKind(doc.classification?.docKind ?? 'other')} · AI detected
            </div>
            <div
              style={{
                fontFamily: t.serif,
                fontSize: 22,
                color: t.ink,
                letterSpacing: -0.4,
                marginTop: 4,
              }}
            >
              Looks right?
            </div>
            <div style={{ fontSize: 13, color: t.muted, marginTop: 4 }}>
              We&apos;ll save it as the filename below. Edit anything that&apos;s off.
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
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
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
              }}
            />
          </div>

          {fieldEntries.length > 0 && (
            <div
              style={{
                background: t.bgElev,
                border: `1px solid ${t.borderSoft}`,
                borderRadius: 8,
                padding: '12px 14px',
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
                Detected
              </div>
              <Stack gap={6}>
                {fieldEntries.map(([k, v]) => (
                  <Row key={k} justify="space-between" align="center">
                    <span
                      style={{
                        fontFamily: t.mono,
                        fontSize: 10,
                        color: t.muted,
                        letterSpacing: 0.4,
                      }}
                    >
                      {humanizeKey(k).toUpperCase()}
                    </span>
                    <span
                      style={{
                        fontFamily: t.serif,
                        fontSize: 13,
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

          <Row gap={10}>
            <Button
              t={t}
              variant="ghost"
              onClick={onCancel}
              style={{ flex: 1, padding: '12px' }}
            >
              Retake
            </Button>
            <Button
              t={t}
              onClick={() => onAccept({ filename })}
              style={{ flex: 1, padding: '12px' }}
            >
              Looks right
            </Button>
          </Row>
        </Stack>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Helpers.
// ────────────────────────────────────────────────────────────────

function hydrateInitial(rows: DocumentRow[], expected: ExpectedDoc[]): DocItem[] {
  const items: DocItem[] = [];
  const filledSlotIds = new Set<string>();
  for (const r of rows) {
    const phase = (r.parsePhase as DocItemPhase) ?? 'uploaded';
    let slotId: string | null = null;
    if (r.classification) {
      slotId = matchUploadToSlot({
        uploadKind: r.classification.docKind as ExpectedDocKind,
        expected,
        filledSlotIds,
      });
      if (slotId) filledSlotIds.add(slotId);
    }
    items.push({
      key: `db-${r.documentId}`,
      documentId: r.documentId,
      filename: r.originalFilename,
      mimeType: r.mimeType,
      sizeBytes: r.sizeBytes,
      phase,
      classification: r.classification ?? undefined,
      finalFilename: r.finalFilename ?? undefined,
      binarized: r.binarized,
      slotId,
      errorMessage: r.errorMessage ?? undefined,
    });
  }
  return items;
}

function filledSlots(docs: DocItem[]): Set<string> {
  const s = new Set<string>();
  for (const d of docs) {
    if (d.slotId) s.add(d.slotId);
  }
  return s;
}

async function putWithProgress(
  url: string,
  headers: Record<string, string>,
  file: File,
  onProgress: (pct: number) => void,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    for (const [k, v] of Object.entries(headers)) {
      xhr.setRequestHeader(k, v);
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve({ ok: true });
      } else {
        resolve({
          ok: false,
          error: `Upload failed (${xhr.status}). Tap to retry.`,
        });
      }
    };
    xhr.onerror = () =>
      resolve({ ok: false, error: 'Upload failed — network error.' });
    xhr.ontimeout = () => resolve({ ok: false, error: 'Upload timed out.' });
    xhr.send(file);
  });
}

function abbreviationFor(kind: ExpectedDocKind): string {
  switch (kind) {
    case 'w2':
      return 'W2';
    case '1099_nec':
      return '1099';
    case '1099_misc':
      return 'MISC';
    case '1099_int':
      return 'INT';
    case '1099_div':
      return 'DIV';
    case '1099_r':
      return '1099R';
    case '1098_mortgage':
      return '1098';
    case '1098_t':
      return '1098T';
    case '1095_a':
      return '1095';
    case 'k1_1065':
      return 'K1';
    case 'k1_1120s':
      return 'K1S';
    case 'bank_statement':
      return 'BANK';
    case 'brokerage_statement':
      return 'BRK';
    case 'drivers_license':
      return 'DL';
    case 'ssn_card':
      return 'SSN';
    case 'prior_return':
      return 'YR';
    case 'irs_notice':
      return 'IRS';
    default:
      return 'DOC';
  }
}

function labelForKind(kind: string): string {
  const k = kind.toLowerCase();
  if (k === 'w2') return 'W-2';
  if (k.startsWith('1099_')) return '1099-' + k.slice(5).toUpperCase();
  if (k.startsWith('1098_')) return '1098-' + k.slice(5);
  if (k === '1095_a') return '1095-A';
  if (k === 'k1_1065') return 'K-1 (Partnership)';
  if (k === 'k1_1120s') return 'K-1 (S-corp)';
  if (k === 'drivers_license') return "Driver's License";
  if (k === 'ssn_card') return 'SSN Card';
  if (k === 'irs_notice') return 'IRS Notice';
  if (k === 'prior_return') return 'Prior return';
  return k.replace(/_/g, ' ');
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
    // Heuristic: if the key implies money (cents), format as $X,XXX.XX.
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
