// NudgesFeed — proactive outreach surface on the command-room home.
//
// Per CLAUDE.md §8 Nudges section: "Daily-firing on a nudge_rules
// table. A Nudge is a moment-that-matters surfaced for human
// approval. Antonio sees: 'Maria Ortega's daughter Lily starts UC
// Davis Aug 25 — AOTC + 529 conversation. Draft ready.' He clicks
// Approve, the email goes; or Edit, then send; or Dismiss with a
// reason that trains the model."
//
// VOICE
//   Operational-modern (Inter, soft borders). Each nudge = one
//   card: title (canonical alert format) + body + draft preview
//   + action buttons (Approve / Edit / Dismiss).
//   Empty state explains what nudges are + that they'll populate
//   when the agent runs.

'use client';

import { useState, useTransition } from 'react';
import {
  approveNudge,
  dismissNudge,
  editNudgeOutreach,
} from '@/app/nudges/actions';

export type NudgeFeedItem = {
  id: string;
  clientId: string;
  clientName: string;
  triggerClass: string;
  triggerKey: string;
  title: string;
  body: string;
  draftOutreach: string | null;
  recommendedChannel: 'sms' | 'email' | 'portal_chat' | 'phone_call' | null;
  confidence: number;
  status: 'pending' | 'approved' | 'sent' | 'edited' | 'dismissed' | 'expired';
  expiresAt: string | null;
  createdAt: string;
};

type Props = {
  nudges: NudgeFeedItem[];
  canEdit: boolean;
};

const TRIGGER_CLASS_LABELS: Record<string, string> = {
  life_event: 'Life event',
  time_window: 'Time window',
  drift: 'Drift',
  milestone: 'Milestone',
  drift_from_prior: 'YoY change',
  compliance_risk: 'Compliance risk',
};

const TRIGGER_CLASS_COLORS: Record<string, string> = {
  life_event: 'oklch(42% 0.09 150)', // forest
  time_window: 'oklch(42% 0.10 240)', // ink-blue
  drift: 'oklch(58% 0.13 75)', // amber
  milestone: 'oklch(42% 0.09 150)', // forest
  drift_from_prior: 'oklch(58% 0.13 75)', // amber
  compliance_risk: 'oklch(52% 0.18 28)', // terra
};

export function NudgesFeed({ nudges, canEdit }: Props) {
  const pending = nudges.filter((n) => n.status === 'pending' || n.status === 'edited');

  return (
    <section
      aria-label="Proactive nudges"
      style={{
        marginTop: 32,
        marginBottom: 32,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: 'oklch(20% 0.01 85)',
              margin: 0,
              letterSpacing: -0.2,
            }}
          >
            Nudges
          </h2>
          <p
            style={{
              fontSize: 12,
              color: 'oklch(50% 0.01 85)',
              margin: '2px 0 0 0',
            }}
          >
            Moments that matter — surfaced before the deadline.
          </p>
        </div>
        <span
          style={{
            fontSize: 11,
            color: 'oklch(50% 0.01 85)',
            letterSpacing: 0.3,
            textTransform: 'uppercase',
          }}
        >
          {pending.length} pending
        </span>
      </header>

      {pending.length === 0 ? (
        <EmptyState />
      ) : (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {pending.map((nudge) => (
            <NudgeCard key={nudge.id} nudge={nudge} canEdit={canEdit} />
          ))}
        </ul>
      )}
    </section>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        padding: '20px 18px',
        background: 'oklch(99% 0.005 85)',
        border: '1px dashed oklch(90% 0.008 85)',
        borderRadius: 10,
        fontSize: 13,
        color: 'oklch(45% 0.01 85)',
        lineHeight: 1.55,
      }}
    >
      <div style={{ fontWeight: 500, color: 'oklch(30% 0.01 85)', marginBottom: 4 }}>
        Nothing to nudge
      </div>
      Nudges surface life events, drift signals, milestones, and compliance risks
      across your client book daily. When the Nudge agent runs and finds a moment
      that matters, it'll show up here with a pre-drafted outreach for your approval.
    </div>
  );
}

function NudgeCard({ nudge, canEdit }: { nudge: NudgeFeedItem; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [outreach, setOutreach] = useState(nudge.draftOutreach ?? '');
  const [showDismissReason, setShowDismissReason] = useState(false);
  const [dismissReason, setDismissReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleApprove() {
    startTransition(async () => {
      const res = await approveNudge(nudge.id);
      if (!res.ok) setError(res.error);
    });
  }

  function handleSaveEdit() {
    if (outreach.trim().length === 0) {
      setError('Outreach cannot be empty.');
      return;
    }
    startTransition(async () => {
      const res = await editNudgeOutreach(nudge.id, outreach);
      if (res.ok) {
        setEditing(false);
        setError(null);
      } else {
        setError(res.error);
      }
    });
  }

  function handleDismiss() {
    startTransition(async () => {
      const res = await dismissNudge(nudge.id, dismissReason);
      if (!res.ok) setError(res.error);
    });
  }

  const classColor = TRIGGER_CLASS_COLORS[nudge.triggerClass] ?? 'oklch(50% 0.01 85)';
  const classLabel = TRIGGER_CLASS_LABELS[nudge.triggerClass] ?? nudge.triggerClass;

  return (
    <li
      style={{
        padding: '14px 16px',
        background: 'oklch(99% 0.005 85)',
        border: '1px solid oklch(92% 0.008 85)',
        borderLeft: `3px solid ${classColor}`,
        borderRadius: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '2px 8px',
            background: 'oklch(96% 0.008 85)',
            border: `1px solid oklch(92% 0.008 85)`,
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 500,
            color: classColor,
            letterSpacing: 0.3,
            textTransform: 'uppercase',
          }}
        >
          {classLabel}
        </span>
        <span
          style={{
            fontSize: 10,
            color: 'oklch(55% 0.01 85)',
            letterSpacing: 0.2,
          }}
        >
          {Math.round(nudge.confidence * 100)}% confidence
        </span>
      </div>

      <h3
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'oklch(20% 0.01 85)',
          margin: '0 0 6px 0',
          lineHeight: 1.4,
        }}
      >
        {nudge.title}
      </h3>

      <p
        style={{
          fontSize: 13,
          color: 'oklch(38% 0.01 85)',
          margin: '0 0 10px 0',
          lineHeight: 1.55,
        }}
      >
        {nudge.body}
      </p>

      {nudge.draftOutreach && !editing && (
        <div
          style={{
            padding: 10,
            background: 'oklch(98% 0.005 85)',
            border: '1px solid oklch(93% 0.008 85)',
            borderRadius: 8,
            fontSize: 12,
            color: 'oklch(30% 0.01 85)',
            lineHeight: 1.55,
            whiteSpace: 'pre-wrap',
            marginBottom: 10,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 500,
              color: 'oklch(50% 0.01 85)',
              letterSpacing: 0.3,
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            Draft outreach
            {nudge.recommendedChannel && (
              <span style={{ marginLeft: 6, color: 'oklch(60% 0.01 85)' }}>
                · via {nudge.recommendedChannel}
              </span>
            )}
          </div>
          {nudge.draftOutreach}
        </div>
      )}

      {editing && canEdit && (
        <div style={{ marginBottom: 10 }}>
          <textarea
            value={outreach}
            onChange={(e) => setOutreach(e.target.value.slice(0, 5000))}
            rows={4}
            disabled={pending}
            style={{
              width: '100%',
              padding: '8px 10px',
              fontFamily: 'inherit',
              fontSize: 13,
              lineHeight: 1.55,
              border: '1px solid oklch(85% 0.008 85)',
              borderRadius: 8,
              resize: 'vertical',
              background: 'oklch(99% 0.005 85)',
              color: 'oklch(20% 0.01 85)',
              boxSizing: 'border-box',
            }}
          />
          <div
            style={{
              marginTop: 4,
              fontSize: 10,
              color: 'oklch(55% 0.01 85)',
              textAlign: 'right',
            }}
          >
            {outreach.length} / 5000
          </div>
        </div>
      )}

      {showDismissReason && canEdit && (
        <div style={{ marginBottom: 10 }}>
          <input
            type="text"
            value={dismissReason}
            onChange={(e) => setDismissReason(e.target.value.slice(0, 500))}
            placeholder="Why dismiss? (helps train the agent; optional)"
            disabled={pending}
            style={{
              width: '100%',
              padding: '6px 10px',
              fontFamily: 'inherit',
              fontSize: 12,
              border: '1px solid oklch(85% 0.008 85)',
              borderRadius: 6,
              background: 'oklch(99% 0.005 85)',
              color: 'oklch(20% 0.01 85)',
              boxSizing: 'border-box',
            }}
          />
        </div>
      )}

      {error && (
        <div
          style={{
            marginBottom: 8,
            fontSize: 11,
            color: 'oklch(52% 0.18 28)',
          }}
        >
          {error}
        </div>
      )}

      {canEdit && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {editing ? (
            <>
              <PrimaryButton onClick={handleSaveEdit} disabled={pending}>
                {pending ? 'Saving…' : 'Save edit'}
              </PrimaryButton>
              <SecondaryButton
                onClick={() => {
                  setEditing(false);
                  setOutreach(nudge.draftOutreach ?? '');
                  setError(null);
                }}
                disabled={pending}
              >
                Cancel
              </SecondaryButton>
            </>
          ) : showDismissReason ? (
            <>
              <PrimaryButton onClick={handleDismiss} disabled={pending}>
                {pending ? 'Dismissing…' : 'Confirm dismiss'}
              </PrimaryButton>
              <SecondaryButton
                onClick={() => {
                  setShowDismissReason(false);
                  setDismissReason('');
                  setError(null);
                }}
                disabled={pending}
              >
                Cancel
              </SecondaryButton>
            </>
          ) : (
            <>
              <PrimaryButton onClick={handleApprove} disabled={pending}>
                Approve & send
              </PrimaryButton>
              {nudge.draftOutreach && (
                <SecondaryButton onClick={() => setEditing(true)} disabled={pending}>
                  Edit
                </SecondaryButton>
              )}
              <SecondaryButton onClick={() => setShowDismissReason(true)} disabled={pending}>
                Dismiss
              </SecondaryButton>
            </>
          )}
        </div>
      )}
    </li>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 12px',
        background: 'oklch(42% 0.09 150)',
        color: 'oklch(98% 0.01 85)',
        border: 'none',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 500,
        cursor: disabled ? 'wait' : 'pointer',
        letterSpacing: 0.1,
      }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 12px',
        background: 'transparent',
        color: 'oklch(35% 0.01 85)',
        border: '1px solid oklch(90% 0.008 85)',
        borderRadius: 6,
        fontSize: 12,
        cursor: disabled ? 'wait' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}
