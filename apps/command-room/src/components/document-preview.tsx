'use client';

// In-page document preview overlay.
//
// Behaviors that matter:
//
//   - HONEST PHASE LABELING. The header pill reflects the row's
//     parse_phase, not just whether final_storage_key happens to be
//     set. "Processed" only when phase='final'. Mid-pipeline phases
//     ('finalizing', 'accepted') render "Processing…" with a relative
//     timestamp. 'failed' renders an error label + "Retry" button.
//
//   - RETRY for stuck or failed docs. When phase is 'failed' (Inngest
//     exhausted retries — onFailure persisted state) OR 'finalizing'
//     (likely stuck — long enough that the user is confused), the
//     header shows a Retry button that resets phase='accepted' and
//     re-fires document/accepted. See lib/clients/retry-document-finalize.
//
//   - RACE-SAFE FETCHES. loadUrl uses a request-generation token; a
//     stale fetch's setView is dropped if a newer request started
//     since. Without this, opening doc A → quickly closing → opening
//     doc B can cause A's promise to win and show A's URL inside B's
//     overlay.
//
//   - NO STALE-URL FLASH ON TOGGLE. Switching Processed↔Raw clears
//     view first so the iframe blanks to the skeleton during the URL
//     swap, instead of momentarily flashing the prior source's PDF.
//
//   - DOWNLOAD HARDENING. Button disabled while in flight; double-
//     click can't mint two URLs and trigger two downloads.

import * as React from 'react';
import type { Theme } from '@docket/ui';
import { SkeletonGroup, SkeletonHeading, SkeletonLine } from '@docket/ui';
import {
  getCommandRoomDocumentViewUrl,
  type GetDocumentViewUrlResult,
  type DocumentLifecyclePhase,
} from '@/lib/clients/get-document-view-url';
import { retryDocumentFinalize } from '@/lib/clients/retry-document-finalize';

export type PreviewTarget = {
  documentId: string;
  /** Initial source: 'auto' uses the final processed PDF when ready. */
  source: 'auto' | 'original';
  /** Display name for the header bar (final filename or original). */
  headerFilename: string;
};

type ViewOk = Extract<GetDocumentViewUrlResult, { ok: true }>;

export function DocumentPreview({
  t,
  target,
  onClose,
  onRetried,
}: {
  t: Theme;
  target: PreviewTarget | null;
  onClose: () => void;
  /**
   * Optional: parent can refresh its data when a retry succeeds (e.g.,
   * the documents list re-renders so the user sees the new state).
   */
  onRetried?: () => void;
}) {
  const [view, setView] = React.useState<GetDocumentViewUrlResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [activeSource, setActiveSource] = React.useState<'auto' | 'original'>('auto');
  const [downloading, setDownloading] = React.useState(false);
  const [retrying, setRetrying] = React.useState(false);
  const [retryNotice, setRetryNotice] = React.useState<string | null>(null);

  // Race-guard: every loadUrl bumps this and only writes back if its
  // generation is still current.
  const reqGen = React.useRef(0);

  const loadUrl = React.useCallback(
    async (documentId: string, source: 'auto' | 'original') => {
      const myGen = ++reqGen.current;
      setLoading(true);
      try {
        const result = await getCommandRoomDocumentViewUrl({
          documentId,
          source,
          disposition: 'inline',
        });
        if (myGen !== reqGen.current) return; // stale
        setView(result);
      } catch (err) {
        if (myGen !== reqGen.current) return;
        setView({
          ok: false,
          error: err instanceof Error ? err.message : 'Could not load',
        });
      } finally {
        if (myGen === reqGen.current) setLoading(false);
      }
    },
    [],
  );

  // Reset state when target changes (new doc opened, or closed).
  React.useEffect(() => {
    if (!target) {
      setView(null);
      setActiveSource('auto');
      setRetryNotice(null);
      reqGen.current++; // invalidate any in-flight fetch
      return;
    }
    setActiveSource(target.source);
    setRetryNotice(null);
    void loadUrl(target.documentId, target.source);
  }, [target?.documentId, target?.source, loadUrl]);

  // ESC closes.
  React.useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [target, onClose]);

  // Lock body scroll while open.
  React.useEffect(() => {
    if (!target) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [target]);

  const onDownload = async () => {
    if (!target || downloading) return;
    setDownloading(true);
    try {
      const result = await getCommandRoomDocumentViewUrl({
        documentId: target.documentId,
        source: activeSource,
        disposition: 'attachment',
      });
      if (result.ok) {
        const link = document.createElement('a');
        link.href = result.url;
        link.download = result.filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } finally {
      setDownloading(false);
    }
  };

  const onSwitchSource = (next: 'auto' | 'original') => {
    if (!target || next === activeSource || loading) return;
    setActiveSource(next);
    // Clear current view so the body re-renders the skeleton during
    // the swap rather than flashing the previous URL's content.
    setView(null);
    void loadUrl(target.documentId, next);
  };

  const onRetry = async () => {
    if (!target || retrying) return;
    setRetrying(true);
    setRetryNotice(null);
    try {
      const result = await retryDocumentFinalize({
        documentId: target.documentId,
      });
      if (result.ok) {
        setRetryNotice('Retry queued — refreshing in a moment.');
        // Re-fetch the view so the header reflects the new phase.
        await loadUrl(target.documentId, activeSource);
        onRetried?.();
      } else {
        setRetryNotice(result.error);
      }
    } finally {
      setRetrying(false);
    }
  };

  if (!target) return null;

  // Phase + age signals for header rendering.
  const phase: DocumentLifecyclePhase | null =
    view && view.ok ? view.parsePhase : null;
  const finalizedAtIso = view && view.ok ? view.finalizedAtIso : null;
  const headerInfo = renderHeaderInfo(phase, view, finalizedAtIso);
  const showRetry =
    phase === 'failed' ||
    (phase === 'finalizing' && finalizedAtIso == null);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 18, 14, 0.55)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: t.bg,
          width: '100%',
          maxWidth: 1100,
          height: '90vh',
          borderRadius: 14,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: `1px solid ${t.border}`,
          boxShadow: '0 30px 80px rgba(15, 18, 14, 0.35)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 18px',
            borderBottom: `1px solid ${t.borderSoft}`,
            background: t.card,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: t.mono,
                fontSize: 12,
                color: t.ink,
                letterSpacing: 0.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {view?.ok ? view.filename : target.headerFilename}
            </div>
            <div
              style={{
                fontFamily: t.mono,
                fontSize: 9.5,
                color: headerInfo.color ?? t.muted,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                marginTop: 2,
              }}
            >
              {loading && !view ? 'Loading…' : headerInfo.label}
            </div>
          </div>

          {/* Toggle: processed vs raw */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 0,
              border: `1px solid ${t.borderSoft}`,
              borderRadius: 999,
              padding: 2,
              background: t.bg,
            }}
          >
            <ToggleButton
              t={t}
              active={activeSource === 'auto'}
              onClick={() => onSwitchSource('auto')}
              label="Processed"
            />
            <ToggleButton
              t={t}
              active={activeSource === 'original'}
              onClick={() => onSwitchSource('original')}
              label="Raw"
            />
          </div>

          {showRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              style={{
                background: t.rust,
                border: 'none',
                borderRadius: 8,
                padding: '6px 12px',
                fontFamily: t.sans,
                fontSize: 12,
                color: '#fff',
                cursor: retrying ? 'wait' : 'pointer',
                letterSpacing: 0.2,
                opacity: retrying ? 0.7 : 1,
              }}
              title="Reset state and re-run the finalize worker"
            >
              {retrying ? 'Retrying…' : 'Retry'}
            </button>
          )}

          <button
            type="button"
            onClick={onDownload}
            disabled={downloading}
            style={{
              background: 'transparent',
              border: `1px solid ${t.borderSoft}`,
              borderRadius: 8,
              padding: '6px 12px',
              fontFamily: t.sans,
              fontSize: 12,
              color: t.ink,
              cursor: downloading ? 'wait' : 'pointer',
              letterSpacing: 0.2,
              opacity: downloading ? 0.6 : 1,
            }}
            title="Download a copy"
          >
            {downloading ? 'Preparing…' : 'Download'}
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 6,
              cursor: 'pointer',
              color: t.muted,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M4.5 4.5l9 9M13.5 4.5l-9 9"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {retryNotice && (
          <div
            style={{
              padding: '8px 18px',
              fontFamily: t.sans,
              fontSize: 12,
              color: t.rustInk,
              background: t.tintAccent,
              borderBottom: `1px solid ${t.borderSoft}`,
            }}
          >
            {retryNotice}
          </div>
        )}

        {/* Body */}
        <div
          style={{
            flex: 1,
            background: '#1f2520',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {loading && !view && <DocumentSkeleton />}
          {view && view.ok && <PreviewBody url={view.url} mimeType={view.mimeType} />}
          {view && !view.ok && (
            <div
              style={{
                fontFamily: t.serif,
                fontStyle: 'italic',
                fontSize: 14,
                color: '#f5dcd0',
                padding: 24,
                textAlign: 'center',
              }}
            >
              {view.error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Header label rendering.
//
// Maps parse_phase + finalizedAt + source → a human-readable label
// in the header pill. The label is the SOURCE OF TRUTH on what the
// user is actually seeing — earlier versions lied (showing
// "Processed" while serving raw color content).
// ────────────────────────────────────────────────────────────────

function renderHeaderInfo(
  phase: DocumentLifecyclePhase | null,
  view: GetDocumentViewUrlResult | null,
  finalizedAtIso: string | null,
): { label: string; color?: string } {
  if (!view || !view.ok) return { label: 'Preview' };

  // Explicit "Raw" toggle wins regardless of phase.
  if (view.source === 'original') return { label: 'Raw upload' };

  switch (phase) {
    case 'final':
      return { label: 'Processed' };
    case 'failed': {
      const msg = view.errorMessage
        ? `Processing failed — ${truncateLabel(view.errorMessage)}`
        : 'Processing failed';
      return { label: msg, color: '#a13d2c' };
    }
    case 'finalizing': {
      const age = finalizedAtIso
        ? `started ${relativeAgo(finalizedAtIso)}`
        : 'in progress';
      return { label: `Processing… (${age})` };
    }
    case 'accepted':
      return { label: 'Queued for processing' };
    case 'parsed':
      return { label: 'Awaiting verification' };
    case 'classifying':
    case 'uploaded':
      return { label: 'Reading…' };
    default:
      return view.source === 'original-fallback'
        ? { label: 'Raw — finalize pending' }
        : { label: 'Preview' };
  }
}

function truncateLabel(s: string): string {
  return s.length > 64 ? s.slice(0, 61) + '…' : s;
}

function relativeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 'a moment ago';
  const diffMs = Date.now() - t;
  if (diffMs < 60_000) return 'just now';
  const m = Math.round(diffMs / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}

function ToggleButton({
  t,
  active,
  onClick,
  label,
}: {
  t: Theme;
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: active ? t.ink : 'transparent',
        color: active ? '#fff' : t.muted,
        border: 'none',
        padding: '5px 12px',
        borderRadius: 999,
        fontFamily: t.mono,
        fontSize: 10.5,
        letterSpacing: 0.5,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function DocumentSkeleton() {
  return (
    <SkeletonGroup
      variant="shimmer"
      panel
      label="Loading document preview"
      style={{
        background: '#fdfcf7',
        width: 'min(72%, 640px)',
        aspectRatio: '8.5 / 11',
        maxHeight: '88%',
        borderRadius: 6,
        boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
        padding: '36px 40px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <SkeletonHeading width="50%" />
      <SkeletonLine width="100%" />
      <SkeletonLine width="86%" />
      <SkeletonLine width="100%" />
      <SkeletonLine width="64%" />
      <div style={{ height: 8 }} />
      <SkeletonHeading width="32%" />
      <SkeletonLine width="100%" />
      <SkeletonLine width="86%" />
      <SkeletonLine width="100%" />
      <SkeletonLine width="50%" />
    </SkeletonGroup>
  );
}

function PreviewBody({ url, mimeType }: { url: string; mimeType: string }) {
  if (mimeType === 'application/pdf') {
    // No sandbox attribute — earlier we shipped
    // sandbox="allow-scripts allow-same-origin" as a defense-in-depth
    // measure (P3 hardening), but it broke Chrome's native PDF viewer:
    // the iframe rendered as a broken-image icon instead of the PDF.
    // Chrome's PDF rendering pipeline needs more privileges than the
    // sandbox flags expose, and the alternative (allow-popups +
    // allow-top-navigation-by-user-activation, etc.) is not actually
    // safer than no sandbox.
    //
    // Trade-off:
    //   - Lost: a malicious PDF could navigate the command-room window
    //     or trigger a popup. R2 only serves files we processed, so
    //     "malicious PDF" requires a tenant-internal upload — admin
    //     viewing their own client's doc is the threat model anyway.
    //   - Kept: cross-origin restrictions still apply. Iframe content
    //     can't read parent's cookies, localStorage, or DOM.
    //   - referrerPolicy stays "no-referrer" so R2 logs don't show
    //     internal command-room URLs.
    return (
      <iframe
        src={url}
        title="Document preview"
        referrerPolicy="no-referrer"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          background: '#1f2520',
        }}
      />
    );
  }
  if (mimeType.startsWith('image/')) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt="Document preview"
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
        }}
      />
    );
  }
  return (
    <div
      style={{
        fontFamily: 'sans-serif',
        fontSize: 13,
        color: '#cdd2c8',
        padding: 24,
        textAlign: 'center',
      }}
    >
      Preview not available for {mimeType}
    </div>
  );
}
