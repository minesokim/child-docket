'use client';

// Polling hook for document classification + finalization status.
//
// Used by the docs overview AND the focused per-slot page. Polls every
// 1500ms while any doc is in a non-terminal phase (uploaded |
// classifying | accepted | finalizing). Stops automatically once all
// docs reach a terminal state (parsed | final | failed).
//
// Backoff: slows to 3000ms after 30s on a single doc.
// Hard cutoff: 90s per doc — flips to failed with a clear message.

import { useEffect, useRef } from 'react';
import { getDocumentStatus } from '@/lib/docs/upload';

export type DocPhase =
  | 'uploading'
  | 'uploaded'
  | 'classifying'
  | 'parsed'
  | 'accepted'
  | 'finalizing'
  | 'final'
  | 'failed';

const POLL_MS = 1500;
const POLL_SLOW_MS = 3000;
const POLL_SLOW_AFTER_MS = 30_000;
const POLL_GIVE_UP_AFTER_MS = 90_000;

const TERMINAL: ReadonlySet<DocPhase> = new Set([
  'parsed',
  'final',
  'failed',
]);
const STILL_GOING: ReadonlySet<DocPhase> = new Set([
  'uploaded',
  'classifying',
  'accepted',
  'finalizing',
]);

export type StatusEvent =
  | { documentId: string; phase: 'uploaded' | 'classifying' }
  | {
      documentId: string;
      phase: 'parsed';
      classification: {
        docKind: string;
        confidence: number;
        legibility: number;
        extractedFields: Record<string, unknown>;
        suggestedFilename: string;
        retakeHint: string | null;
      };
    }
  | { documentId: string; phase: 'accepted' }
  | { documentId: string; phase: 'finalizing' }
  | {
      documentId: string;
      phase: 'final';
      docKind: string;
      finalFilename: string;
      binarized: boolean;
      extractedFields: Record<string, unknown>;
    }
  | { documentId: string; phase: 'failed'; errorMessage: string };

type PollDescriptor = {
  documentId: string;
  /** Current phase as the caller knows it. Polling stops when terminal. */
  phase: DocPhase;
};

/**
 * Poll one or many documents until all reach terminal phases.
 *
 * `onStatus` fires for every status update including transitions
 * AND repeats of the same phase (caller decides whether to no-op).
 *
 * `targets` may change between renders — hook reconciles by reading
 * the latest from a ref each tick.
 */
export function useDocPoll(
  targets: ReadonlyArray<PollDescriptor>,
  onStatus: (event: StatusEvent) => void,
  onTimeout: (documentId: string) => void,
): void {
  // Stash latest targets + callbacks in refs so the polling loop
  // doesn't restart when they change.
  const targetsRef = useRef(targets);
  targetsRef.current = targets;
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    const startedAt = new Map<string, number>();
    const cancelled = { value: false };
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (cancelled.value) return;

      const now = Date.now();
      const inFlight = targetsRef.current.filter((t) => STILL_GOING.has(t.phase));

      if (inFlight.length === 0) {
        // Nothing to poll. Re-check after the normal interval in case
        // a new doc gets added.
        return scheduleNext();
      }

      let maxElapsedSeen = 0;

      await Promise.all(
        inFlight.map(async (t) => {
          if (!startedAt.has(t.documentId)) startedAt.set(t.documentId, now);
          const elapsed = now - (startedAt.get(t.documentId) ?? now);
          if (elapsed > maxElapsedSeen) maxElapsedSeen = elapsed;

          // Hard cutoff per doc.
          if (elapsed > POLL_GIVE_UP_AFTER_MS) {
            console.error(
              '[useDocPoll] timeout — doc',
              t.documentId,
              'stuck after',
              Math.round(elapsed / 1000),
              's',
            );
            onTimeoutRef.current(t.documentId);
            return;
          }

          try {
            const status = await getDocumentStatus(t.documentId);
            if (cancelled.value) return;
            if ('ok' in status && status.ok === false) {
              // Server-side action error — log + retry on next tick.
              console.error('[useDocPoll] action error:', status.error);
              return;
            }
            if (!('phase' in status) || status.phase === 'not_found') return;

            // Forward the event to the caller.
            const phase = status.phase;
            if (phase === 'uploaded' || phase === 'classifying') {
              onStatusRef.current({ documentId: t.documentId, phase });
            } else if (phase === 'parsed') {
              onStatusRef.current({
                documentId: t.documentId,
                phase,
                classification: status.classification,
              });
            } else if (phase === 'accepted') {
              onStatusRef.current({ documentId: t.documentId, phase });
            } else if (phase === 'finalizing') {
              onStatusRef.current({ documentId: t.documentId, phase });
            } else if (phase === 'final') {
              onStatusRef.current({
                documentId: t.documentId,
                phase,
                docKind: status.docKind,
                finalFilename: status.finalFilename,
                binarized: status.binarized,
                extractedFields: status.extractedFields,
              });
            } else if (phase === 'failed') {
              onStatusRef.current({
                documentId: t.documentId,
                phase,
                errorMessage: status.errorMessage,
              });
            }
          } catch (err) {
            console.error('[useDocPoll] threw:', err);
          }
        }),
      );

      scheduleNext(maxElapsedSeen);
    };

    const scheduleNext = (maxElapsed = 0) => {
      if (cancelled.value) return;
      const interval = maxElapsed > POLL_SLOW_AFTER_MS ? POLL_SLOW_MS : POLL_MS;
      timeoutHandle = setTimeout(tick, interval);
    };

    timeoutHandle = setTimeout(tick, POLL_MS);

    return () => {
      cancelled.value = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
    };
    // Mount once. We deliberately don't restart the loop when
    // targets / callbacks change — refs handle that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
