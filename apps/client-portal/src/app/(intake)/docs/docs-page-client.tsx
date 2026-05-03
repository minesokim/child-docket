'use client';

// Docs overview — the editorial checklist + drill-down to focused per-doc pages.
//
// LAYOUT (top to bottom)
//   - Header / back button (standard intake frame)
//   - "Documents" H1 + body sentence on progress
//   - Progress bar with required-only count ("6 of 10 ready")
//   - Required section: one row per required slot
//   - Recommended section: one row per recommended slot, w/ inline Skip
//   - "Add another document" CTA → /intake/docs/add
//   - Continue button (always enabled per STEPS_WITHOUT_GATE = ['docs'])
//
// EACH ROW
//   ✓ green check  · doc fully processed (parse_phase=final)
//   ⚠ amber warn   · classification ready, awaiting user verification (parsed)
//   ◐ amber spin   · still processing (uploaded/classifying/accepted/finalizing)
//   ! red excl     · failed
//   ○ empty        · nothing uploaded yet
//
//   Tapping the row navigates to /intake/docs/{slot.id}, which is the
//   focused single-doc upload page. The overview itself never opens
//   a sheet / modal — drill-down is the model.
//
// HIDDEN UPLOADS (Q1b)
//   When a client uploads a doc whose classification doesn't match
//   any expected slot (an IRS notice they weren't expecting, a random
//   receipt), the doc lives in the database + flows to Antonio in
//   command-room — but it does NOT surface on this overview. This
//   keeps the page calm + intentional. The "Add another" CTA still
//   exists for explicit "I have something extra to send" flows.

import * as React from 'react';
import Link from 'next/link';
import {
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
import { usePortalNav } from '@/lib/portal-nav';
import {
  type ExpectedDoc,
  type ExpectedDocKind,
  matchUploadToSlot,
  friendlyDescriptionFor,
} from '@docket/shared';
import type { DocumentRow } from '@/lib/docs/list';
import { useDocPoll, type DocPhase } from './use-doc-poll';

type SlotItem = {
  slot: ExpectedDoc;
  doc: DocumentRow | null;
};

export function DocsOverviewClient({
  expected,
  initialDocuments,
}: {
  expected: ExpectedDoc[];
  initialDocuments: DocumentRow[];
}) {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const nav = usePortalNav();

  // Hydrate matched docs into slots. Unmatched docs are intentionally
  // not surfaced (Q1b) — they exist server-side and Antonio sees
  // them in command-room.
  const [docs, setDocs] = React.useState<DocumentRow[]>(initialDocuments);
  const slots = useMatchedSlots(expected, docs);

  // Polling — keeps in-progress rows live without a refresh.
  const targets = React.useMemo(
    () =>
      docs
        .filter((d) =>
          ['uploaded', 'classifying', 'accepted', 'finalizing'].includes(d.parsePhase),
        )
        .map((d) => ({ documentId: d.documentId, phase: d.parsePhase as DocPhase })),
    [docs],
  );

  useDocPoll(
    targets,
    (event) => {
      setDocs((prev) =>
        prev.map((d) => {
          if (d.documentId !== event.documentId) return d;
          if (event.phase === 'uploaded' || event.phase === 'classifying') {
            return { ...d, parsePhase: event.phase };
          }
          if (event.phase === 'parsed') {
            return {
              ...d,
              parsePhase: 'parsed',
              classification: event.classification,
            };
          }
          if (event.phase === 'accepted' || event.phase === 'finalizing') {
            return { ...d, parsePhase: event.phase };
          }
          if (event.phase === 'final') {
            return {
              ...d,
              parsePhase: 'final',
              finalFilename: event.finalFilename,
              binarized: event.binarized,
            };
          }
          if (event.phase === 'failed') {
            return {
              ...d,
              parsePhase: 'failed',
              errorMessage: event.errorMessage,
            };
          }
          return d;
        }),
      );
    },
    (documentId) => {
      setDocs((prev) =>
        prev.map((d) =>
          d.documentId === documentId
            ? {
                ...d,
                parsePhase: 'failed',
                errorMessage:
                  'Took too long to process. Try uploading again or contact your preparer.',
              }
            : d,
        ),
      );
    },
  );

  // Progress against required slots only — recommended don't pressure.
  const requiredSlots = slots.filter((s) => s.slot.required);
  const requiredFilled = requiredSlots.filter(
    (s) => s.doc && (s.doc.parsePhase === 'final' || s.doc.parsePhase === 'accepted' || s.doc.parsePhase === 'finalizing'),
  ).length;
  const requiredTotal = requiredSlots.length;

  const recommendedSlots = slots.filter((s) => !s.slot.required);

  const handleContinue = () => nav.next('/engagement');
  const handleBack = () => nav.back('/refund');

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
          <IntakeBackButton t={t} onClick={handleBack} />
        </div>

        <div style={{ padding: '20px 24px 12px' }}>
          <Stack gap={12}>
            <H1 t={t}>Documents</H1>
            <Body t={t} size={15}>
              Tap any item to upload it. We&apos;ll figure out what&apos;s what — no
              filing or labeling on your end.
            </Body>
          </Stack>
        </div>

        {/* Progress block */}
        <div style={{ padding: '12px 24px 20px' }}>
          <ProgressIndicator t={t} filled={requiredFilled} total={requiredTotal} />
        </div>

        <div style={{ padding: '0 24px 4px', flex: 1 }}>
          {requiredSlots.length > 0 && (
            <SectionHeader t={t} label="Required" />
          )}
          <Stack gap={6}>
            {requiredSlots.map((s) => (
              <SlotRow key={s.slot.id} t={t} slot={s.slot} doc={s.doc} />
            ))}
          </Stack>

          {recommendedSlots.length > 0 && (
            <>
              <div style={{ marginTop: 24 }}>
                <SectionHeader t={t} label="Recommended" />
              </div>
              <Stack gap={6}>
                {recommendedSlots.map((s) => (
                  <SlotRow key={s.slot.id} t={t} slot={s.slot} doc={s.doc} />
                ))}
              </Stack>
            </>
          )}

          {/* Add another */}
          <div style={{ marginTop: 28 }}>
            <Link
              href="/docs/add"
              style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
            >
              <div
                style={{
                  background: t.tintAccent,
                  border: `1px dashed ${t.border}`,
                  borderRadius: 12,
                  padding: '16px 18px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'background 200ms',
                }}
              >
                <div style={{ fontFamily: t.serif, fontSize: 15, color: t.ink }}>
                  Add another document
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: t.muted,
                    marginTop: 3,
                    fontStyle: 'italic',
                    fontFamily: t.serif,
                  }}
                >
                  Anything else you want me to see
                </div>
              </div>
            </Link>
          </div>
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
          <Button t={t} onClick={handleContinue} style={{ width: '100%' }}>
            Continue
          </Button>
          <div
            style={{
              textAlign: 'center',
              marginTop: 10,
              fontFamily: t.serif,
              fontStyle: 'italic',
              fontSize: 12,
              color: t.muted,
            }}
          >
            You can come back any time to add more.
          </div>
        </div>
      </div>
    </Screen>
  );
}

// ────────────────────────────────────────────────────────────────
// Subcomponents
// ────────────────────────────────────────────────────────────────

function ProgressIndicator({
  t,
  filled,
  total,
}: {
  t: Theme;
  filled: number;
  total: number;
}) {
  const percent = total === 0 ? 0 : Math.round((filled / total) * 100);
  return (
    <div>
      <Row justify="space-between" align="center" style={{ marginBottom: 8 }}>
        <span
          style={{
            fontFamily: t.mono,
            fontSize: 11,
            color: t.muted,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
          }}
        >
          {filled} of {total} ready
        </span>
        <span
          style={{
            fontFamily: t.mono,
            fontSize: 11,
            color: t.rustInk,
            letterSpacing: 0.4,
          }}
        >
          {percent}%
        </span>
      </Row>
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
            transition: 'width 400ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
        />
      </div>
    </div>
  );
}

function SectionHeader({ t, label }: { t: Theme; label: string }) {
  return (
    <div
      style={{
        fontFamily: t.mono,
        fontSize: 10,
        color: t.muted,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: 10,
      }}
    >
      {label}
    </div>
  );
}

function SlotRow({
  t,
  slot,
  doc,
}: {
  t: Theme;
  slot: ExpectedDoc;
  doc: DocumentRow | null;
}) {
  const phase = doc?.parsePhase as DocPhase | undefined;
  const friendly =
    doc && doc.classification
      ? friendlyDescriptionFor(doc.classification.docKind, doc.classification.extractedFields)
      : null;

  return (
    <Link
      href={`/docs/${encodeURIComponent(slot.id)}`}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <div
        style={{
          background: '#fffefc',
          borderRadius: 10,
          padding: '14px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          cursor: 'pointer',
          transition: 'background 160ms',
          border: `1px solid ${t.borderSoft}`,
        }}
      >
        <StatusIndicator t={t} phase={phase} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: t.sans,
              fontSize: 14.5,
              fontWeight: 500,
              color: t.ink,
              letterSpacing: -0.1,
              lineHeight: 1.3,
            }}
          >
            {slot.title}
          </div>
          <div
            style={{
              fontFamily: t.sans,
              fontSize: 12.5,
              color: t.muted,
              marginTop: 2,
              lineHeight: 1.35,
            }}
          >
            <SlotSubtitle slot={slot} doc={doc} friendly={friendly} />
          </div>
        </div>
        <div style={{ flexShrink: 0, color: t.muted }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M5 3l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </Link>
  );
}

function SlotSubtitle({
  slot,
  doc,
  friendly,
}: {
  slot: ExpectedDoc;
  doc: DocumentRow | null;
  friendly: string | null;
}) {
  if (!doc) return <>{slot.subtitle}</>;
  switch (doc.parsePhase) {
    case 'uploaded':
    case 'classifying':
      return <>Reading…</>;
    case 'parsed':
      return <span style={{ color: '#a13d2c' }}>Looks right? Verify →</span>;
    case 'accepted':
    case 'finalizing':
      return <>Saving…</>;
    case 'final':
      return <>{friendly ?? doc.finalFilename ?? slot.title}</>;
    case 'failed':
      return (
        <span style={{ color: '#a13d2c' }}>
          {doc.errorMessage ?? 'Something went wrong — tap to retry'}
        </span>
      );
    default:
      return <>{slot.subtitle}</>;
  }
}

function StatusIndicator({ t, phase }: { t: Theme; phase: DocPhase | undefined }) {
  // Empty / not started.
  if (!phase) {
    return (
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          border: `1.5px solid ${t.borderSoft}`,
          flexShrink: 0,
          background: '#fff',
        }}
      />
    );
  }

  // Final = green check.
  if (phase === 'final') {
    return (
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: '#1f4621',
          color: '#fff',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
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
      </div>
    );
  }

  // Parsed = amber warn (action required).
  if (phase === 'parsed') {
    return (
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: '#fff7e8',
          border: `1.5px solid ${t.tintAccent}`,
          color: t.rust,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'serif',
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        !
      </div>
    );
  }

  // Failed = red dot.
  if (phase === 'failed') {
    return (
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: t.rust,
          color: '#fff',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        ×
      </div>
    );
  }

  // In-progress phases = spinner.
  return (
    <div
      style={{
        width: 22,
        height: 22,
        borderRadius: '50%',
        border: `2px solid ${t.borderSoft}`,
        borderTopColor: t.rust,
        flexShrink: 0,
        animation: 'doc-status-spin 800ms linear infinite',
      }}
    >
      <style>{`
        @keyframes doc-status-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Slot matching — pure function. Walks the docs list in order and
// assigns each classified upload to the first unfilled matching slot.
// Unmatched uploads are dropped (intentionally hidden per Q1b).
// ────────────────────────────────────────────────────────────────
function useMatchedSlots(
  expected: ExpectedDoc[],
  docs: ReadonlyArray<DocumentRow>,
): SlotItem[] {
  return React.useMemo(() => {
    const filled = new Set<string>();
    const slotMap = new Map<string, DocumentRow>();
    for (const d of docs) {
      const kind = (d.classification?.docKind ?? null) as ExpectedDocKind | null;
      if (!kind) continue;
      const slotId = matchUploadToSlot({
        uploadKind: kind,
        expected,
        filledSlotIds: filled,
      });
      if (slotId) {
        slotMap.set(slotId, d);
        filled.add(slotId);
      }
    }
    return expected.map((slot) => ({
      slot,
      doc: slotMap.get(slot.id) ?? null,
    }));
  }, [expected, docs]);
}
