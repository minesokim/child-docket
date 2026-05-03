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
          <div>
            {requiredSlots.map((s, i) => (
              <SlotRow
                key={s.slot.id}
                t={t}
                slot={s.slot}
                doc={s.doc}
                isLast={i === requiredSlots.length - 1}
              />
            ))}
          </div>

          {recommendedSlots.length > 0 && (
            <>
              <div style={{ marginTop: 28 }}>
                <SectionHeader t={t} label="Recommended" />
              </div>
              <div>
                {recommendedSlots.map((s, i) => (
                  <SlotRow
                    key={s.slot.id}
                    t={t}
                    slot={s.slot}
                    doc={s.doc}
                    isLast={i === recommendedSlots.length - 1}
                  />
                ))}
              </div>
            </>
          )}

          {/* Add another — quiet text link, not a dashed CTA box.
              The slot list above already says "here's what we need";
              this is the escape hatch, not a primary action. */}
          <div style={{ marginTop: 28, textAlign: 'center' }}>
            <Link
              href="/docs/add"
              style={{
                textDecoration: 'none',
                fontFamily: t.serif,
                fontStyle: 'italic',
                fontSize: 14,
                color: t.muted,
                letterSpacing: -0.1,
              }}
            >
              + Send something else
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
  isLast,
}: {
  t: Theme;
  slot: ExpectedDoc;
  doc: DocumentRow | null;
  isLast: boolean;
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
          padding: '18px 4px 18px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          cursor: 'pointer',
          // Hairline divider between rows. Last row in a section drops
          // the divider so the next section header carries the rhythm.
          borderBottom: isLast ? 'none' : `1px solid ${t.borderSoft}`,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: t.sans,
              fontSize: 15,
              fontWeight: 500,
              color: t.ink,
              letterSpacing: -0.15,
              lineHeight: 1.3,
            }}
          >
            {slot.title}
          </div>
          <div
            style={{
              fontFamily: t.sans,
              fontSize: 13,
              color: t.muted,
              marginTop: 3,
              lineHeight: 1.4,
            }}
          >
            <SlotSubtitle slot={slot} doc={doc} friendly={friendly} />
          </div>
        </div>
        {/* Single right-side anchor: status indicator replaces the
            chevron entirely. Empty rows get a quiet outlined circle;
            done rows get a sage-tinted check. The shape stays
            consistent across states so the column reads like a
            single column of beats, not a column of competing icons. */}
        <StatusIndicator t={t} phase={phase} />
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
      return <span style={{ color: '#a13d2c' }}>Tap to verify</span>;
    case 'accepted':
    case 'finalizing':
      return <>Saving…</>;
    case 'final': {
      // For ID docs (DL, SSN), the friendlyDescription is the user's
      // own name — echoing it back is redundant and reads as
      // self-congratulating. Keep the original slot subtitle ("Front
      // side", "For Antonio") instead.
      const isIdDoc = slot.kind === 'drivers_license' || slot.kind === 'ssn_card';
      if (isIdDoc) return <>{slot.subtitle}</>;
      return <>{friendly ?? slot.subtitle}</>;
    }
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

// Status indicator — lives on the RIGHT of every row. Same circular
// footprint across states so the right column reads as a single
// vertical rhythm, not a parade of competing icons.
//
// Color story (intentional restraint):
//   empty   → 1px outline of borderSoft, no fill.
//             Reads as "to do" without shouting.
//   parsed  → tint background + rust ! glyph. The only state the user
//             needs to act on; deserves a touch more presence.
//   in-flight → calm spinner over a pale ring.
//   final   → SAGE-tinted background (#e7efde, light keylime) + a
//             medium-green check stroke (#5b7a4f). Deliberately not
//             dark forest with white check — that's an "achievement
//             unlocked!" badge. We want "settled, done."
//   failed  → quiet rust dot.
//
// Footprint: 18px (was 22px). Smaller indicator, more breathing room.
function StatusIndicator({ t, phase }: { t: Theme; phase: DocPhase | undefined }) {
  const SIZE = 18;
  const SAGE_FILL = '#e7efde';
  const SAGE_STROKE = '#5b7a4f';

  // Empty / not started — just a hairline outline circle.
  if (!phase) {
    return (
      <div
        style={{
          width: SIZE,
          height: SIZE,
          borderRadius: '50%',
          border: `1px solid ${t.borderSoft}`,
          flexShrink: 0,
          background: 'transparent',
        }}
      />
    );
  }

  // Final = sage tint + medium-green check. Calm, not stark.
  if (phase === 'final') {
    return (
      <div
        style={{
          width: SIZE,
          height: SIZE,
          borderRadius: '50%',
          background: SAGE_FILL,
          color: SAGE_STROKE,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label="Done"
      >
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path
            d="M3 6.2l2 2 4-4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  // Parsed = soft amber tint with rust !. Action-required state.
  if (phase === 'parsed') {
    return (
      <div
        style={{
          width: SIZE,
          height: SIZE,
          borderRadius: '50%',
          background: '#fbeede',
          color: t.rust,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: t.serif,
          fontSize: 11,
          fontWeight: 600,
          lineHeight: 1,
        }}
        aria-label="Awaiting verification"
      >
        !
      </div>
    );
  }

  // Failed = rust dot.
  if (phase === 'failed') {
    return (
      <div
        style={{
          width: SIZE,
          height: SIZE,
          borderRadius: '50%',
          background: '#f5dcd0',
          color: t.rust,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1,
        }}
        aria-label="Failed"
      >
        ×
      </div>
    );
  }

  // In-progress = subtle spinner over a sage ring (done-but-thinking).
  return (
    <div
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: '50%',
        border: `1.5px solid ${t.borderSoft}`,
        borderTopColor: SAGE_STROKE,
        flexShrink: 0,
        animation: 'doc-status-spin 900ms linear infinite',
      }}
      aria-label="Processing"
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
