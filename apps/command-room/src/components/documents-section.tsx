'use client';

// Documents panel for the per-client detail page.
//
// Lists every file the client has uploaded:
//   - Filename: prefers finalFilename when the row has reached the
//     'final' phase (i.e., the finalize-document worker ran the
//     binarize/PDF/rename pipeline). Falls back to originalFilename
//     when the row is still mid-pipeline.
//   - Click-to-open opens a 5-min signed R2 GET URL in a new tab. By
//     default it serves the FINAL processed PDF. A small "view raw"
//     link below the row serves the original upload (debugging
//     mismatches between AI classification and what's on the page).
//   - Per-row metadata: classification + confidence, file size,
//     upload time, and a phase pill so Antonio can tell which docs
//     are still mid-finalize.
//
// Read in the parent Server Component via withTenant so RLS scopes
// the query to Antonio's tenant. Click handlers route through the
// 'use server' action `getCommandRoomDocumentViewUrl`, also tenant-
// scoped + role-gated.

import * as React from 'react';
import type { Theme } from '@docket/ui';
import { getCommandRoomDocumentViewUrl } from '@/lib/clients/get-document-view-url';

type DocumentRow = {
  id: string;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  aiClassification: string | null;
  aiConfidence: number | null;
  parsePhase: string;
  finalStorageKey: string | null;
  finalFilename: string | null;
  finalSizeBytes: number | null;
  finalMimeType: string | null;
  binarized: boolean;
  createdAt: Date;
};

export function DocumentsSection({
  t,
  documents,
}: {
  t: Theme;
  documents: DocumentRow[];
}) {
  if (documents.length === 0) {
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
        No documents uploaded
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
        gap: 8,
      }}
    >
      {documents.map((doc) => (
        <DocumentItem key={doc.id} t={t} doc={doc} />
      ))}
    </div>
  );
}

function DocumentItem({ t, doc }: { t: Theme; doc: DocumentRow }) {
  const isFinal = doc.parsePhase === 'final' && !!doc.finalStorageKey;
  const displayName = isFinal && doc.finalFilename
    ? doc.finalFilename
    : doc.originalFilename;
  const displaySize = isFinal && doc.finalSizeBytes != null
    ? doc.finalSizeBytes
    : doc.sizeBytes;

  const [opening, setOpening] = React.useState<'final' | 'original' | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const open = async (mode: 'auto' | 'original') => {
    setOpening(mode === 'original' ? 'original' : 'final');
    setError(null);
    try {
      const result = await getCommandRoomDocumentViewUrl({
        documentId: doc.id,
        mode,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Open in a new tab. Browsers render PDFs inline; images render too.
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open');
    } finally {
      setOpening(null);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 4px',
        borderBottom: `1px solid ${t.borderSoft}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <button
          type="button"
          onClick={() => open('auto')}
          disabled={opening !== null}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            margin: 0,
            cursor: opening !== null ? 'wait' : 'pointer',
            fontSize: 14,
            color: t.ink,
            textAlign: 'left',
            display: 'block',
            maxWidth: '100%',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textDecoration: 'underline',
            textDecorationColor: t.borderSoft,
            textUnderlineOffset: 3,
            fontFamily: isFinal ? t.mono : t.sans,
            letterSpacing: isFinal ? 0.2 : 0,
          }}
          title={isFinal ? 'Open processed PDF' : 'Open original upload'}
        >
          {opening === 'final' ? 'Opening…' : displayName}
        </button>
        <div
          style={{
            fontFamily: t.mono,
            fontSize: 10.5,
            color: t.muted,
            marginTop: 3,
            letterSpacing: 0.3,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          {doc.aiClassification ? (
            <span>
              {doc.aiClassification}
              {doc.aiConfidence != null && (
                <span style={{ marginLeft: 6, opacity: 0.7 }}>
                  {Math.round(doc.aiConfidence * 100)}%
                </span>
              )}
            </span>
          ) : (
            <span style={{ opacity: 0.6 }}>unclassified</span>
          )}
          <span style={{ opacity: 0.7 }}>{formatBytes(displaySize)}</span>
          {isFinal && doc.binarized && (
            <span
              style={{
                color: t.rustInk,
                opacity: 0.85,
                letterSpacing: 0.5,
              }}
              title="Tax-doc binarization (1-bit B&W) was applied"
            >
              binarized
            </span>
          )}
          {isFinal && !doc.binarized && (
            <span
              style={{
                opacity: 0.6,
                letterSpacing: 0.5,
              }}
              title="ID doc — color preserved (no binarization)"
            >
              color preserved
            </span>
          )}
          {isFinal && (
            <button
              type="button"
              onClick={() => open('original')}
              disabled={opening !== null}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                margin: 0,
                cursor: opening !== null ? 'wait' : 'pointer',
                color: t.muted,
                opacity: 0.7,
                fontFamily: t.mono,
                fontSize: 10.5,
                letterSpacing: 0.4,
                textDecoration: 'underline',
                textUnderlineOffset: 2,
              }}
              title="Open the raw upload"
            >
              {opening === 'original' ? 'opening…' : 'view raw'}
            </button>
          )}
        </div>
        {error && (
          <div style={{ fontSize: 11, color: t.rust, marginTop: 4 }}>{error}</div>
        )}
      </div>
      <div style={{ textAlign: 'right' }}>
        <ParsePhasePill t={t} phase={doc.parsePhase} />
        <div
          style={{
            fontFamily: t.mono,
            fontSize: 10,
            color: t.muted,
            marginTop: 4,
          }}
        >
          {formatRelative(doc.createdAt)}
        </div>
      </div>
    </div>
  );
}

function ParsePhasePill({ t, phase }: { t: Theme; phase: string }) {
  // Friendly labels — phase names from the pipeline read like internal
  // jargon ("classifying", "finalizing"); the pill should match Antonio's
  // mental model.
  const LABEL: Record<string, string> = {
    uploaded: 'uploaded',
    classifying: 'reading',
    parsed: 'awaiting review',
    accepted: 'accepted',
    finalizing: 'processing',
    final: 'ready',
    failed: 'failed',
  };
  const label = LABEL[phase] ?? phase.replace(/_/g, ' ');

  // Three-tier palette: ready (green sage), in-flight (amber tint), failed (rust).
  let bg: string;
  let fg: string;
  if (phase === 'final') {
    bg = '#e7efde';
    fg = '#3b5d36';
  } else if (phase === 'parsed') {
    bg = t.tintAccent;
    fg = t.rustInk;
  } else if (phase === 'failed') {
    bg = '#f5dcd0';
    fg = t.rust;
  } else {
    bg = t.borderSoft;
    fg = t.muted;
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        padding: '2px 8px',
        borderRadius: 999,
        fontFamily: t.mono,
        fontSize: 9.5,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        background: bg,
        color: fg,
      }}
    >
      {label}
    </span>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelative(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffD = Math.floor(diffHr / 24);
  if (diffD < 30) return `${diffD}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
