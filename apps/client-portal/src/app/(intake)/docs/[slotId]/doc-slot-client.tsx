'use client';

// Focused per-doc upload page — the editorial single-task page that
// the docs overview drills into.
//
// LAYOUT (top to bottom)
//   - Back chevron → /docs
//   - Doc title (Fraunces) + subtitle (Front side / Back side / For Person)
//   - PHASE-AWARE BLOCK:
//       Empty       → hero illustration + Antonio note + where-to-find +
//                       [Take a photo] + [Upload a file]
//       Uploading   → progress bar
//       Reading     → scanning animation, "Reading your driver's license…"
//       Parsed      → VERIFICATION CARD (Stripe Identity / TurboTax shape):
//                     - actual photo of the upload (signed R2 GET)
//                     - one-line friendly description (Fraunces italic)
//                     - 4-6 humanized field rows with formatted values
//                     - single primary "Yes, this looks right" CTA
//                     - subtle "Retake photo" text link below
//                     NO filename input — server fully owns the name.
//       Final       → ✓ + Saved + tiny final filename (audit reassurance) +
//                     "Replace this document" ghost
//       Failed      → warm recovery + try-again actions
//
// On accept, navigate to /docs. The overview re-renders with the new
// state from the server-side fetch.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AntonioNote,
  AskAntonioBar,
  Body,
  Button,
  buildTheme,
  DriversLicenseBackSkeleton,
  DriversLicenseFrontSkeleton,
  H1,
  IntakeBackButton,
  IntakeHeader,
  Row,
  Screen,
  SkeletonGroup,
  SkeletonHeading,
  SkeletonLine,
  SocialSecurityCardSkeleton,
  Stack,
  TaxFormSkeleton,
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
  getDocumentViewUrl,
} from '@/lib/docs/upload';
import type { DocumentRow } from '@/lib/docs/list';
import { useDocPoll, type DocPhase } from '../use-doc-poll';

type Phase = DocPhase | 'uploading' | 'idle';

// Driver's-license sequential-flow context. The per-slot page handles
// front then back inside a single URL; the server picks which side is
// active and passes effectiveSlotId so confirmUpload writes a
// side-specific slot_id on the documents row.
type DlContext = {
  step: 'front' | 'back' | 'done';
  effectiveSlotId: string;
  frontFilename: string | null;
  backFilename: string | null;
};

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
  dl,
}: {
  slot: ExpectedDoc;
  initialDoc: DocumentRow | null;
  /**
   * Driver's-license context. Provided by the server when slot.kind
   * === 'drivers_license'. Drives the sequential Step 1 (front) → Step 2
   * (back) → done flow inside this single page.
   */
  dl?: DlContext;
}) {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const router = useRouter();
  // Re-key state on dl.step so when the server transitions us from
  // front → back, we get a fresh clean state machine for the next side
  // (no stale documentId, no stale classification).
  const [state, setState] = React.useState<LocalState>(() => fromInitialDoc(initialDoc));
  const stepKey = dl?.step ?? null;
  const lastStepKeyRef = React.useRef(stepKey);
  React.useEffect(() => {
    if (lastStepKeyRef.current !== stepKey) {
      lastStepKeyRef.current = stepKey;
      setState(fromInitialDoc(initialDoc));
    }
  }, [stepKey, initialDoc]);

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
        // Bind the upload to this slot. For DL we use the side-specific
        // effective slot id (`<slot>-front` / `<slot>-back`) so the
        // finalize worker can apply DriversLicenseFront / Back filename
        // substitution and the server can compute the next active step.
        slotId: dl?.effectiveSlotId ?? slot.id,
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
  // Filename composition is fully server-owned now — no override.
  // For DL slots, after the front is accepted we DON'T navigate back
  // to the overview — we let the server recompute dl.step and surface
  // Step 2 (back) on the same page. Once both sides are accepted the
  // server returns dl.step = 'done' and the user taps "Back to
  // documents" themselves from the done state.
  const onAccept = async () => {
    if (!state.documentId) return;
    setState((prev) => ({ ...prev, phase: 'accepted' }));
    const result = await acceptDocClassification({
      documentId: state.documentId,
    });
    if (!result.ok) {
      setState((prev) => ({ ...prev, phase: 'parsed', errorMessage: result.error }));
      return;
    }
    if (dl) {
      // Stay on the page; let the server recompute the active step.
      // router.refresh re-runs the server component which now sees the
      // accepted front doc and surfaces dl.step = 'back'. The state
      // machine re-keys via the stepKey effect.
      router.refresh();
      return;
    }
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
          <Stack gap={6}>
            <H1 t={t}>{slot.title}</H1>
            <Body t={t} size={14}>
              {dlSubtitle(slot, dl)}
            </Body>
          </Stack>
        </div>

        <div style={{ padding: '14px 24px 0', flex: 1 }}>
          <PhaseBlock
            t={t}
            slot={slot}
            state={state}
            dl={dl}
            onFileChosen={onFileChosen}
            onAccept={onAccept}
            onRetake={onRetake}
            onBack={onBack}
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
  dl,
  onFileChosen,
  onAccept,
  onRetake,
  onBack,
}: {
  t: Theme;
  slot: ExpectedDoc;
  state: LocalState;
  dl?: DlContext;
  onFileChosen: (file: File) => void;
  onAccept: () => void;
  onRetake: () => void;
  onBack: () => void;
}) {
  // ─── DL: both sides done ───
  // Special branch — no upload state machine, just acknowledgement.
  // Reached when the user navigates to /docs/identity-dl after both
  // front + back are already accepted. The status indicator on the
  // overview row will show the green check; this page just confirms.
  if (dl && dl.step === 'done') {
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
            <div
              style={{
                fontFamily: t.serif,
                fontSize: 17,
                color: t.ink,
                letterSpacing: -0.2,
              }}
            >
              Both sides saved
            </div>
            <div
              style={{
                fontSize: 12,
                color: t.muted,
                marginTop: 3,
                lineHeight: 1.4,
                fontFamily: t.serif,
                fontStyle: 'italic',
              }}
            >
              Front and back of your driver&apos;s license.
            </div>
          </div>
        </div>
        <Button t={t} onClick={onBack} style={{ width: '100%' }}>
          Back to documents
        </Button>
      </Stack>
    );
  }

  // ─── Empty / idle ───
  // Document-shape skeleton in SHIMMER mode. The user clicked into
  // this slot; the placeholder previews what they're about to capture
  // (DL-shaped if it's a DL slot, SSN-shaped if SSN, etc.). Glimmers
  // calmly while waiting for them to tap "Take a photo" or "Upload."
  if (state.phase === 'idle') {
    return (
      <Stack gap={20}>
        <DocPlaceholder t={t} slot={slot} dl={dl} variant="shimmer" />
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
  // Same document-shape skeleton, switched to WAVE mode. Wave reads
  // as "the doc is moving / being transmitted" rather than the calm
  // shimmer of "we're looking at it" — feels right for the file
  // physically being PUT to R2.
  if (state.phase === 'uploading') {
    return (
      <Stack gap={20}>
        <DocPlaceholder t={t} slot={slot} dl={dl} variant="wave" />
        <ProgressBar t={t} percent={state.uploadProgress} />
      </Stack>
    );
  }

  // ─── Reading (uploaded / classifying) ───
  // Back to SHIMMER — file's in R2, AI vision is now reading. The
  // calm sweep matches the "we're looking at it" beat.
  if (state.phase === 'uploaded' || state.phase === 'classifying') {
    return (
      <Stack gap={20}>
        <DocPlaceholder t={t} slot={slot} dl={dl} variant="shimmer" />
        <div
          style={{
            textAlign: 'center',
            fontFamily: t.serif,
            fontStyle: 'italic',
            fontSize: 14,
            color: t.muted,
          }}
        >
          Reading your {readingLabel(slot)}…
        </div>
      </Stack>
    );
  }

  // ─── Parsed: verification UI (the redesigned editorial pattern) ───
  if (state.phase === 'parsed' && state.classification && state.documentId) {
    return (
      <VerificationCard
        t={t}
        slot={slot}
        dl={dl}
        documentId={state.documentId}
        mimeType={inferMimeType(state.filename)}
        classification={state.classification}
        onAccept={onAccept}
        onRetake={onRetake}
      />
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
  // Calm "settled" treatment — sage-tinted disc with a medium-green
  // check stroke. Matches the overview's status indicator language so
  // moving between the two screens feels like the same product.
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
            <div
              style={{
                fontFamily: t.serif,
                fontSize: 17,
                color: t.ink,
                letterSpacing: -0.2,
              }}
            >
              Saved
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
// Verification card — the redesigned parsed phase.
//
// Pattern reference: Stripe Identity, TurboTax W-2 import, Apple
// Wallet "Add a card." Three-stack:
//
//   1. Document image preview (the source of truth — what you uploaded)
//   2. One-line friendly description in Fraunces italic
//   3. 4-6 humanized field rows with formatted values
//
// Plus a single primary CTA and a subtle retake link. No filename
// input — server fully owns naming. No "READ SUCCESSFULLY" eyebrow
// stack — the photo + description carry confidence.
// ────────────────────────────────────────────────────────────────

function VerificationCard({
  t,
  slot,
  dl,
  documentId,
  mimeType,
  classification,
  onAccept,
  onRetake,
}: {
  t: Theme;
  slot: ExpectedDoc;
  dl?: DlContext;
  documentId: string;
  mimeType: string;
  classification: NonNullable<DocumentRow['classification']>;
  onAccept: () => void;
  onRetake: () => void;
}) {
  const fields = classification.extractedFields ?? {};
  const fieldRows = renderableFields(fields).slice(0, 6);
  const friendly = friendlyDescriptionFor(classification.docKind, fields);
  const shouldShowRetakeWarning =
    classification.legibility < 0.5 && classification.retakeHint;

  // Slot vs classification mismatch — e.g., uploaded a DL into the
  // W-2 slot. We don't block accept (the user might know what they're
  // doing — an out-of-template doc, or the AI mis-classified), but
  // we surface a clear warning so they can retake before saving the
  // wrong file under the wrong name.
  const mismatchLabel = slotMismatchLabelFor(slot, classification.docKind);

  return (
    <Stack gap={20}>
      {/* 1. Document image preview — the verification anchor. */}
      <DocumentPreview
        t={t}
        documentId={documentId}
        mimeType={mimeType}
      />

      {/* 2. One-line friendly description — calm confidence. */}
      <div style={{ textAlign: 'center', padding: '0 4px' }}>
        <div
          style={{
            fontFamily: t.serif,
            fontStyle: 'italic',
            fontSize: 17,
            color: t.ink,
            lineHeight: 1.4,
            letterSpacing: -0.2,
          }}
        >
          {friendlyHeadlineFor(slot, dl, classification.docKind, friendly)}
        </div>
      </div>

      {/* 3. Detected fields as quiet rows. No eyebrow, no card chrome. */}
      {fieldRows.length > 0 && (
        <div
          style={{
            padding: '4px 4px',
          }}
        >
          <Stack gap={10}>
            {fieldRows.map(({ key, label, value }) => (
              <Row key={key} justify="space-between" align="center">
                <span
                  style={{
                    fontSize: 13,
                    color: t.muted,
                    letterSpacing: 0,
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    fontFamily: t.serif,
                    fontSize: 14.5,
                    color: t.ink,
                    textAlign: 'right',
                    marginLeft: 12,
                    letterSpacing: -0.1,
                  }}
                >
                  {value}
                </span>
              </Row>
            ))}
          </Stack>
        </div>
      )}

      {/* Soft warning if legibility is low. */}
      {shouldShowRetakeWarning && (
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
          {classification.retakeHint}
        </div>
      )}

      {/* Slot/classification mismatch warning — same warm-amber
          treatment as the legibility warning. Doesn't block accept;
          informs the user that the AI thinks they uploaded the wrong
          document for this slot. */}
      {mismatchLabel && (
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
          {mismatchLabel}
        </div>
      )}

      {/* Primary CTA + subtle retake link. */}
      <Stack gap={10}>
        <Button t={t} onClick={onAccept} style={{ width: '100%' }}>
          Yes, this looks right
        </Button>
        <button
          type="button"
          onClick={onRetake}
          style={{
            background: 'transparent',
            border: 'none',
            fontFamily: t.serif,
            fontStyle: 'italic',
            fontSize: 14,
            color: t.muted,
            cursor: 'pointer',
            padding: '4px 0',
            textAlign: 'center',
            width: '100%',
          }}
        >
          Retake photo
        </button>
      </Stack>
    </Stack>
  );
}

// ────────────────────────────────────────────────────────────────
// DocumentPreview — fetches a 5-min signed GET URL from the server
// and renders the actual uploaded image (or a friendly PDF placeholder).
//
// PDFs render as a calm "PDF document" tile with the doc-hero look —
// browsers can't reliably inline-preview PDFs in mobile viewports
// inside React without an iframe, and an iframe inside the editorial
// flow looks like a foreign element. The image-vs-PDF distinction
// is decided by the original mime type (the user's upload).
// ────────────────────────────────────────────────────────────────

function DocumentPreview({
  t,
  documentId,
  mimeType,
}: {
  t: Theme;
  documentId: string;
  mimeType: string;
}) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [errored, setErrored] = React.useState(false);
  const isPdf = mimeType === 'application/pdf';

  React.useEffect(() => {
    let cancelled = false;
    if (isPdf) return;
    (async () => {
      try {
        const result = await getDocumentViewUrl({ documentId });
        if (cancelled) return;
        if (result.ok) setUrl(result.url);
        else setErrored(true);
      } catch {
        if (!cancelled) setErrored(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId, isPdf]);

  // PDF — show a calm tile rather than try to inline-render.
  if (isPdf) {
    return (
      <div
        style={{
          aspectRatio: '4 / 3',
          borderRadius: 14,
          background: t.ease.keylimeWash,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <div
          style={{
            fontFamily: t.mono,
            fontSize: 9.5,
            color: t.rustInk,
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          PDF document
        </div>
        <div
          style={{
            fontFamily: t.serif,
            fontSize: 14,
            color: t.muted,
            fontStyle: 'italic',
          }}
        >
          You uploaded a PDF.
        </div>
      </div>
    );
  }

  // Loading state — pulse skeleton on the same keylime card so the
  // verification preview doesn't reflow when the image arrives.
  // Pulse (not shimmer) here because this is a quick fetch, not a
  // dense doc render — pulse reads as "almost there" rather than the
  // more deliberate shimmer cadence.
  if (!url && !errored) {
    return (
      <SkeletonGroup
        variant="pulse"
        panel
        label="Loading document preview"
        style={{
          aspectRatio: '4 / 3',
          borderRadius: 14,
          background: t.ease.keylimeWash,
          padding: '28px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          justifyContent: 'center',
        }}
      >
        <SkeletonHeading width="42%" />
        <SkeletonLine width="100%" />
        <SkeletonLine width="86%" />
        <SkeletonLine width="64%" />
      </SkeletonGroup>
    );
  }

  // Error fallback — no preview, but don't block the user from accepting.
  if (errored || !url) {
    return (
      <div
        style={{
          aspectRatio: '4 / 3',
          borderRadius: 14,
          background: t.ease.keylimeWash,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontFamily: t.serif,
            fontStyle: 'italic',
            fontSize: 14,
            color: t.muted,
          }}
        >
          Preview unavailable.
        </div>
      </div>
    );
  }

  // Image preview. Soft drop shadow + rounded corners gives the
  // "document on a desk" feel. Object-fit contain so phone-camera
  // photos that are tighter than 4:3 don't crop the edges.
  return (
    <div
      style={{
        aspectRatio: '4 / 3',
        borderRadius: 14,
        background: t.ease.keylimeWash,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Your uploaded document"
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          borderRadius: 6,
          boxShadow: '0 6px 20px rgba(15, 62, 23, 0.12)',
        }}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Hero card — used in idle / uploading / reading / saving states.
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
// PUT helper.
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

// ────────────────────────────────────────────────────────────────
// Field rendering — humanize keys + format values.
//
// The classifier emits programmer-shaped keys: "dob_iso", "fullName",
// "expiry_iso", "ein_masked", "wages_cents", "federal_tax_cents".
// Users see "Date of birth", "Name", "Expires", "EIN", "Wages",
// "Federal tax withheld" — and dates as "Nov 26, 2001" instead of
// "2001-11-26", states expanded, dollars rendered with a $ sign.
//
// Out-of-allowlist keys still surface (so the UI never silently drops
// data) but with a humanized fallback derived from the key itself.
// ────────────────────────────────────────────────────────────────

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'Washington, DC',
};

const KEY_LABEL_OVERRIDES: Record<string, string> = {
  fullName: 'Name',
  full_name: 'Name',
  firstName: 'First name',
  lastName: 'Last name',
  dob: 'Date of birth',
  dob_iso: 'Date of birth',
  dateOfBirth: 'Date of birth',
  expiry: 'Expires',
  expiry_iso: 'Expires',
  expiryDate: 'Expires',
  expirationDate: 'Expires',
  ssn: 'SSN',
  ssn_masked: 'SSN',
  ein: 'EIN',
  ein_masked: 'EIN',
  state: 'State',
  city: 'City',
  zip: 'ZIP',
  zipCode: 'ZIP',
  postalCode: 'ZIP',
  employer: 'Employer',
  payer: 'Payer',
  lender: 'Lender',
  institution: 'Institution',
  entityName: 'Entity',
  taxYear: 'Tax year',
  noticeType: 'Notice type',
  marketplaceId: 'Marketplace',
  statementPeriod: 'Period',
  // Money keys — we render the number with a $ sign in formatValue.
  wages_cents: 'Wages',
  federal_tax_cents: 'Federal tax withheld',
  state_tax_cents: 'State tax withheld',
  social_security_wages_cents: 'Social Security wages',
  medicare_wages_cents: 'Medicare wages',
  rent_paid_cents: 'Rent paid',
  interest_income_cents: 'Interest income',
  ordinary_dividends_cents: 'Ordinary dividends',
  qualified_dividends_cents: 'Qualified dividends',
  gross_distribution_cents: 'Gross distribution',
  taxable_amount_cents: 'Taxable amount',
  mortgage_interest_cents: 'Mortgage interest',
  scholarship_grants_cents: 'Scholarships',
  qualified_expenses_cents: 'Qualified expenses',
};

// Keys to hide from the verification UI (already encoded in the
// document title or carry no taxpayer signal). Examples: the AI
// sometimes emits a `documentType` echo of the classification we
// already display in the headline.
const HIDDEN_KEYS = new Set<string>([
  'documentType',
  'docKind',
  'pageNumber',
  'page',
]);

type RenderableField = { key: string; label: string; value: string };

function renderableFields(extracted: Record<string, unknown>): RenderableField[] {
  const out: RenderableField[] = [];
  for (const [k, v] of Object.entries(extracted)) {
    if (v == null) continue;
    if (HIDDEN_KEYS.has(k)) continue;
    if (typeof v === 'string' && !v.trim()) continue;
    if (typeof v === 'object') continue; // skip nested for now
    const label = KEY_LABEL_OVERRIDES[k] ?? humanizeKey(k);
    const value = formatValue(k, v);
    if (!value) continue;
    out.push({ key: k, label, value });
  }
  return out;
}

function humanizeKey(k: string): string {
  // Strip common suffixes that betray the schema (e.g., "_iso", "_cents", "_masked").
  const stripped = k
    .replace(/_iso$/, '')
    .replace(/_cents$/, '')
    .replace(/_masked$/, '');
  const spaced = stripped
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim();
  // Sentence case.
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

function formatValue(key: string, v: unknown): string {
  const lowerKey = key.toLowerCase();

  // Money — keys ending in _cents OR matching common money name patterns.
  if (typeof v === 'number') {
    if (
      lowerKey.endsWith('_cents') ||
      lowerKey.includes('amount') ||
      lowerKey.includes('income') ||
      lowerKey.includes('wage') ||
      lowerKey.includes('tax') ||
      lowerKey.includes('balance') ||
      lowerKey.includes('value') ||
      lowerKey.includes('premium') ||
      lowerKey.includes('payment') ||
      lowerKey.includes('paid') ||
      lowerKey.includes('comp') ||
      lowerKey.includes('div') ||
      lowerKey.includes('int') ||
      lowerKey.includes('rent')
    ) {
      const dollars = lowerKey.endsWith('_cents') ? v / 100 : v;
      return `$${dollars.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }
    return String(v);
  }

  if (typeof v === 'boolean') return v ? 'Yes' : 'No';

  if (typeof v !== 'string') return JSON.stringify(v);

  const trimmed = v.trim();

  // ISO date keys → "Nov 26, 2001"
  if (
    lowerKey.endsWith('_iso') ||
    lowerKey.includes('date') ||
    lowerKey.includes('dob') ||
    lowerKey.includes('expiry') ||
    lowerKey === 'expirationdate'
  ) {
    const formatted = formatIsoDate(trimmed);
    if (formatted) return formatted;
  }

  // 2-letter state code → full state name.
  if (lowerKey === 'state' && /^[A-Z]{2}$/.test(trimmed)) {
    return STATE_NAMES[trimmed] ?? trimmed;
  }

  // Names: title-case if the AI gave us shouty all-caps ("KIM MINSEO" → "Kim Minseo").
  if (
    (lowerKey.includes('name') || lowerKey === 'employer' || lowerKey === 'payer' ||
      lowerKey === 'lender' || lowerKey === 'institution' || lowerKey === 'entityname') &&
    trimmed === trimmed.toUpperCase() &&
    /[A-Z]/.test(trimmed)
  ) {
    return titleCase(trimmed);
  }

  return trimmed;
}

function formatIsoDate(input: string): string | null {
  // Accept YYYY-MM-DD or full ISO timestamps.
  const match = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || !month || !day) return null;
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const monthName = months[month - 1];
  if (!monthName) return null;
  return `${monthName} ${day}, ${year}`;
}

function titleCase(input: string): string {
  return input
    .toLowerCase()
    .split(/\s+/)
    .map((word) =>
      word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word,
    )
    .join(' ');
}

// ────────────────────────────────────────────────────────────────
// Headline copy + assist.
// ────────────────────────────────────────────────────────────────

function friendlyHeadlineFor(
  slot: ExpectedDoc,
  dl: DlContext | undefined,
  docKind: string,
  friendly: string | null,
): string {
  // Driver's license: "A California driver's license, expires Nov 26, 2029."
  // is overkill on a small screen — keep it short and let the field rows
  // carry the detail. Side comes from the dl context, not slot.subtitle
  // (the overview slot's subtitle is "Front and back of your card", not
  // a per-step prompt).
  if (docKind === 'drivers_license') {
    const side = dl?.step === 'back' ? 'back' : 'front';
    return `Looks like the ${side} of a driver's license.`;
  }

  if (docKind === 'ssn_card') {
    return 'Looks like a Social Security card.';
  }

  // Otherwise prefer the existing friendly description ("From TikTok Inc"
  // for a 1099, "From Riverside Unified" for a W-2). Fall back to a
  // calm "We read your <kind>" line.
  if (friendly) {
    return `${friendly}.`;
  }
  return `We read your ${readingLabel(slot)}.`;
}

function readingLabel(slot: ExpectedDoc): string {
  // For headlines + reading state. Lower-case "driver's license" reads
  // more naturally than the title-cased page heading.
  switch (slot.kind) {
    case 'drivers_license':
      return "driver's license";
    case 'ssn_card':
      return 'Social Security card';
    case 'w2':
      return 'W-2';
    case '1099_nec':
      return '1099-NEC';
    case '1099_misc':
      return '1099-MISC';
    case '1099_int':
      return '1099-INT';
    case '1099_div':
      return '1099-DIV';
    case '1099_r':
      return '1099-R';
    case '1098_mortgage':
      return 'mortgage statement';
    case '1098_t':
      return '1098-T';
    case '1095_a':
      return '1095-A';
    case 'k1_1065':
    case 'k1_1120s':
      return 'K-1';
    case 'bank_statement':
      return 'bank statement';
    case 'brokerage_statement':
      return 'brokerage statement';
    case 'prior_return':
      return 'prior return';
    case 'irs_notice':
      return 'IRS notice';
    default:
      return 'document';
  }
}

// Document-shape skeleton placeholder for the per-slot upload page.
//
// Layout:
//   - Outer keylime-tinted hero frame at 4:3 aspect, full-width — same
//     visual size as the original DocHero (which the user explicitly
//     liked). Provides the green "panel" the document silhouette sits
//     on. The .doc-card inside is now transparent so OUR keylime is
//     what shows through, not the prototype's sage-50.
//   - Inner: a document-shaped skeleton picked by slot.kind. DL front
//     or back, SSN card, or generic titled tax-form for everything
//     else. The skeleton scales to fit the hero, preserving its
//     native aspect ratio.
//
// Variant is driven by the upload phase:
//   IDLE      → shimmer (waiting for the user to act)
//   UPLOADING → wave    (file is moving to R2)
//   READING   → shimmer (AI is looking at it)
//
//   drivers_license + dl.step === 'back'  → DL back silhouette
//   drivers_license (front or unset)      → DL front silhouette
//   ssn_card                              → SSN-card silhouette
//   tax docs                              → titled tax-form skeleton
function DocPlaceholder({
  t,
  slot,
  dl,
  variant,
}: {
  t: Theme;
  slot: ExpectedDoc;
  dl: DlContext | undefined;
  variant: 'shimmer' | 'wave';
}) {
  let inner: React.ReactNode;
  switch (slot.kind) {
    case 'drivers_license':
      inner = dl?.step === 'back'
        ? <DriversLicenseBackSkeleton variant={variant} />
        : <DriversLicenseFrontSkeleton variant={variant} />;
      break;
    case 'ssn_card':
      inner = <SocialSecurityCardSkeleton variant={variant} />;
      break;
    default:
      inner = (
        <TaxFormSkeleton
          title={slot.title}
          subtitle={taxFormSubtitleFor(slot)}
          variant={variant}
        />
      );
      break;
  }

  return (
    <div
      style={{
        // Match DocHero's outer dimensions exactly — the user liked
        // this size; we're just swapping the inner illustration for
        // a per-doc-kind silhouette.
        position: 'relative',
        aspectRatio: '4 / 3',
        borderRadius: 14,
        background: t.ease.keylimeWash,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      {inner}
    </div>
  );
}

// Subtitle for the tax-form skeleton header — the IRS-friendly long
// name (lowercase) under the form code.
function taxFormSubtitleFor(slot: ExpectedDoc): string | undefined {
  switch (slot.kind) {
    case 'w2':                  return 'Wage and Tax Statement';
    case '1099_nec':            return 'Nonemployee Compensation';
    case '1099_misc':           return 'Miscellaneous Information';
    case '1099_int':            return 'Interest Income';
    case '1099_div':            return 'Dividends and Distributions';
    case '1099_r':              return 'Distributions From Retirement';
    case '1098_mortgage':       return 'Mortgage Interest Statement';
    case '1098_t':              return 'Tuition Statement';
    case '1095_a':              return 'Health Insurance Marketplace';
    case 'k1_1065':             return 'Partner’s Share of Income';
    case 'k1_1120s':            return 'Shareholder’s Share of Income';
    case 'bank_statement':      return 'Bank Statement';
    case 'brokerage_statement': return 'Brokerage Statement';
    case 'prior_return':        return 'Prior Year Return';
    case 'irs_notice':          return 'IRS Notice';
    default:                    return undefined;
  }
}

// Page-header subtitle helper. For DL slots, surfaces the active step
// (e.g., "Front side · Step 1 of 2"). Other slots get the slot's own
// subtitle as authored in required-docs.ts.
function dlSubtitle(slot: ExpectedDoc, dl: DlContext | undefined): string {
  if (!dl) return slot.subtitle;
  if (dl.step === 'front') return 'Front side · Step 1 of 2';
  if (dl.step === 'back') return 'Back side · Step 2 of 2';
  return 'Both sides captured';
}

// Build a human warning when the AI's classification doesn't match
// the slot the user was filling. Returns null when the kinds line up
// (or when the classification is ambiguous enough that warning would
// be more confusing than helpful).
//
// Examples:
//   slot=W-2,        classification=drivers_license  → warn
//   slot=DL-front,   classification=ssn_card         → warn
//   slot=1099-NEC,   classification=1099_misc        → warn (different form)
//   slot=DL-front,   classification=drivers_license  → no warn (match)
//   slot=Other,      classification=anything         → no warn
function slotMismatchLabelFor(
  slot: ExpectedDoc,
  classifiedKind: string,
): string | null {
  if (!classifiedKind) return null;
  if (slot.kind === classifiedKind) return null;

  const expected = humanDocKindFor(slot.kind);
  const actual = humanDocKindFor(classifiedKind);
  return `This looks like ${actual}, but you opened the ${expected} slot. Save this here only if you're sure — otherwise tap Retake and upload it under the right slot.`;
}

function humanDocKindFor(kind: string): string {
  switch (kind) {
    case 'drivers_license':       return "a driver's license";
    case 'ssn_card':              return 'a Social Security card';
    case 'w2':                    return 'a W-2';
    case '1099_nec':              return 'a 1099-NEC';
    case '1099_misc':             return 'a 1099-MISC';
    case '1099_int':              return 'a 1099-INT';
    case '1099_div':              return 'a 1099-DIV';
    case '1099_r':                return 'a 1099-R';
    case '1098_mortgage':         return 'a 1098 mortgage statement';
    case '1098_t':                return 'a 1098-T';
    case '1095_a':                return 'a 1095-A';
    case 'k1_1065':               return 'a K-1 (1065)';
    case 'k1_1120s':              return 'a K-1 (1120-S)';
    case 'bank_statement':        return 'a bank statement';
    case 'brokerage_statement':   return 'a brokerage statement';
    case 'prior_return':          return 'a prior tax return';
    case 'irs_notice':            return 'an IRS notice';
    default:                      return 'a different document';
  }
}

function inferMimeType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}
