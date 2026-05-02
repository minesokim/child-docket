// Documents panel for the per-client detail page.
//
// Lists every file the client has uploaded — original filename, AI-
// classified type (W-2, 1099-NEC, etc.), upload time, parse phase.
// Documents are read in the parent Server Component via withTenant
// so RLS scopes the query to Antonio's tenant.
//
// Day 5 wiring: just lists. Click-to-view + download URL signing lands
// when R2 storage wires up.

import type { Theme } from '@docket/ui';

type DocumentRow = {
  id: string;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  aiClassification: string | null;
  aiConfidence: number | null;
  parsePhase: string;
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
        <div
          key={doc.id}
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
            <div
              style={{
                fontSize: 14,
                color: t.ink,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {doc.originalFilename}
            </div>
            <div
              style={{
                fontFamily: t.mono,
                fontSize: 10.5,
                color: t.muted,
                marginTop: 3,
                letterSpacing: 0.3,
              }}
            >
              {doc.aiClassification ? (
                <>
                  {doc.aiClassification}
                  {doc.aiConfidence != null && (
                    <span style={{ marginLeft: 6, opacity: 0.7 }}>
                      {Math.round(doc.aiConfidence * 100)}%
                    </span>
                  )}
                </>
              ) : (
                <span style={{ opacity: 0.6 }}>unclassified</span>
              )}
              <span style={{ marginLeft: 10, opacity: 0.7 }}>
                {formatBytes(doc.sizeBytes)}
              </span>
            </div>
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
      ))}
    </div>
  );
}

function ParsePhasePill({ t, phase }: { t: Theme; phase: string }) {
  const palette =
    phase === 'parsed' || phase === 'classified'
      ? { bg: t.tintAccent, fg: t.rustInk }
      : phase === 'awaiting_review'
      ? { bg: '#fde9c2', fg: '#7a4a08' }
      : { bg: t.borderSoft, fg: t.muted };
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
        background: palette.bg,
        color: palette.fg,
      }}
    >
      {phase.replace(/_/g, ' ')}
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
