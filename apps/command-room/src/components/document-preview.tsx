'use client';

// In-page document preview overlay. Opens when a doc row is clicked
// in DocumentsSection. NO auto-download — the browser renders the
// PDF inline via <iframe>, or images via <img>. Explicit Download +
// View raw buttons live in the overlay header.
//
// Why an iframe vs `window.open`:
//   - window.open is "open in new tab" UX, not "preview built in."
//     The user explicitly asked for inline preview.
//   - <iframe src={signedPdfUrl}> renders the browser's native PDF
//     viewer in place. Same UX as Stripe Dashboard / Mercury when
//     they show an attached invoice.
//   - The signed URL is generated with disposition='inline' (no
//     Content-Disposition: attachment), so the browser inlines.

import * as React from 'react';
import type { Theme } from '@docket/ui';
import { Skeleton, SkeletonGroup } from '@docket/ui';
import {
  getCommandRoomDocumentViewUrl,
  type GetDocumentViewUrlResult,
} from '@/lib/clients/get-document-view-url';

export type PreviewTarget = {
  documentId: string;
  /** Initial source: 'auto' uses the final processed PDF when ready. */
  source: 'auto' | 'original';
  /** Display name for the header bar (final filename or original). */
  headerFilename: string;
};

export function DocumentPreview({
  t,
  target,
  onClose,
}: {
  t: Theme;
  target: PreviewTarget | null;
  onClose: () => void;
}) {
  const [view, setView] = React.useState<GetDocumentViewUrlResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [activeSource, setActiveSource] = React.useState<'auto' | 'original'>('auto');

  // Reset state when target changes.
  React.useEffect(() => {
    if (!target) {
      setView(null);
      setActiveSource('auto');
      return;
    }
    setActiveSource(target.source);
    void loadUrl(target.documentId, target.source);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.documentId, target?.source]);

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

  const loadUrl = async (documentId: string, source: 'auto' | 'original') => {
    setLoading(true);
    try {
      const result = await getCommandRoomDocumentViewUrl({
        documentId,
        source,
        disposition: 'inline',
      });
      setView(result);
    } catch (err) {
      setView({
        ok: false,
        error: err instanceof Error ? err.message : 'Could not load',
      });
    } finally {
      setLoading(false);
    }
  };

  const onDownload = async () => {
    if (!target) return;
    const result = await getCommandRoomDocumentViewUrl({
      documentId: target.documentId,
      source: activeSource,
      disposition: 'attachment',
    });
    if (result.ok) {
      // Triggers browser download instead of navigating away from the
      // app. window.location.href is the simplest reliable trigger.
      const link = document.createElement('a');
      link.href = result.url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  };

  const onSwitchSource = (next: 'auto' | 'original') => {
    if (!target || next === activeSource) return;
    setActiveSource(next);
    void loadUrl(target.documentId, next);
  };

  if (!target) return null;

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
          // DEFINITE height (was maxHeight). Without a definite size,
          // the modal shrink-wraps to the iframe's intrinsic content,
          // which renders as a tiny strip — that was the squished bug.
          // 90vh gives the iframe a proper canvas to fill.
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
                color: t.muted,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                marginTop: 2,
              }}
            >
              {view?.ok
                ? view.source === 'final'
                  ? 'Processed'
                  : 'Raw upload'
                : loading
                ? 'Loading…'
                : 'Preview'}
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

          <button
            type="button"
            onClick={onDownload}
            style={{
              background: 'transparent',
              border: `1px solid ${t.borderSoft}`,
              borderRadius: 8,
              padding: '6px 12px',
              fontFamily: t.sans,
              fontSize: 12,
              color: t.ink,
              cursor: 'pointer',
              letterSpacing: 0.2,
            }}
            title="Download a copy"
          >
            Download
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

// Document-shaped skeleton placeholder while the signed URL is being
// minted + the iframe is loading. Uses the SHIMMER variant from
// @docket/ui (premium feel for a single focal item — see the
// handoff README's variant guidance for "dense documents, hero
// sections"). Two faux paragraphs with heading rules give the silhouette
// of a typical scanned doc page.
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
      <Skeleton.Heading width="50%" />
      <Skeleton.Line width="100%" />
      <Skeleton.Line width="86%" />
      <Skeleton.Line width="100%" />
      <Skeleton.Line width="64%" />
      <div style={{ height: 8 }} />
      <Skeleton.Heading width="32%" />
      <Skeleton.Line width="100%" />
      <Skeleton.Line width="86%" />
      <Skeleton.Line width="100%" />
      <Skeleton.Line width="50%" />
    </SkeletonGroup>
  );
}

// Render the actual preview. PDFs go through an iframe (browsers'
// native PDF viewer renders inline). Images render as <img>. Anything
// else gets a fallback message — shouldn't happen since uploads are
// MIME-allowlisted to PDFs + common image types.
function PreviewBody({ url, mimeType }: { url: string; mimeType: string }) {
  if (mimeType === 'application/pdf') {
    return (
      <iframe
        src={url}
        title="Document preview"
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
