'use client';

// Returning portal - Docs tab. Document tracker grouped by category with
// progress bar + upload zone. Simplified port: drops the deep preview/info
// modal flow from the JSX prototype (defer until docs pipeline is wired).

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
import * as React from 'react';

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

export default function PortalDocsPage() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });

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

          <div
            style={{
              border: `1.5px dashed ${t.border}`,
              borderRadius: t.radius,
              padding: '22px 18px',
              background: t.bgElev,
              textAlign: 'center',
            }}
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
            <button
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
            </button>
          </div>

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
