'use client';

// Client component for the Approve / Reject buttons on /messages/[id].
// Calls the server actions in lib/messages/resolve-issue.ts and
// surfaces success / error inline.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  approveAndSendDraft,
  rejectDraft,
  type ResolveIssueResult,
} from '@/lib/messages/resolve-issue';

interface Props {
  issueId: string;
  /** Channel from the draft. SMS is wired; others render disabled. */
  channel: string | null;
  /** True when trust-gate verdict is allowed=true (auto-send eligible). */
  trustAllowed: boolean | null;
  /** True when verdict is requires=refusal. Approve button hidden. */
  trustRefused: boolean;
}

type State =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; messageSid?: string }
  | { kind: 'rejecting' }
  | { kind: 'rejected' }
  | { kind: 'error'; message: string };

export function ResolveActions(props: Props) {
  const [state, setState] = React.useState<State>({ kind: 'idle' });
  const router = useRouter();

  const onApprove = React.useCallback(async () => {
    setState({ kind: 'sending' });
    let result: ResolveIssueResult;
    try {
      result = await approveAndSendDraft(props.issueId);
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Send failed',
      });
      return;
    }
    if (result.ok) {
      setState({ kind: 'sent', messageSid: result.messageSid });
      // Refresh so the issue's status='resolved' and the resolution
      // note are reflected on the page.
      router.refresh();
    } else {
      setState({ kind: 'error', message: result.message });
    }
  }, [props.issueId, router]);

  const onReject = React.useCallback(async () => {
    setState({ kind: 'rejecting' });
    let result: ResolveIssueResult;
    try {
      result = await rejectDraft(props.issueId);
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Reject failed',
      });
      return;
    }
    if (result.ok) {
      setState({ kind: 'rejected' });
      router.refresh();
    } else {
      setState({ kind: 'error', message: result.message });
    }
  }, [props.issueId, router]);

  const sendDisabled =
    state.kind === 'sending' ||
    state.kind === 'sent' ||
    state.kind === 'rejecting' ||
    state.kind === 'rejected' ||
    props.trustRefused ||
    props.channel !== 'sms';

  const sendLabel =
    state.kind === 'sending'
      ? 'Sending...'
      : state.kind === 'sent'
        ? 'Sent'
        : props.trustAllowed
          ? 'Send'
          : 'Send as Antonio';

  return (
    <div className="idtl-draft-actions">
      <button
        type="button"
        className="idtl-btn idtl-btn-primary"
        disabled={sendDisabled}
        onClick={onApprove}
      >
        {sendLabel}
      </button>
      <button
        type="button"
        className="idtl-btn idtl-btn-quiet"
        disabled={
          state.kind === 'sending' ||
          state.kind === 'rejecting' ||
          state.kind === 'rejected' ||
          state.kind === 'sent'
        }
        onClick={onReject}
      >
        {state.kind === 'rejecting' ? 'Rejecting...' : state.kind === 'rejected' ? 'Rejected' : 'Reject'}
      </button>
      {props.trustRefused && (
        <span className="idtl-actions-note">
          Trust gate refused — below framework floor. Cannot send.
        </span>
      )}
      {!props.trustRefused && props.channel !== 'sms' && (
        <span className="idtl-actions-note">
          Channel '{props.channel ?? 'unknown'}' send is not yet wired. SMS only for v0.
        </span>
      )}
      {state.kind === 'error' && (
        <span className="idtl-actions-note" style={{ color: 'oklch(58% 0.22 25)' }}>
          {state.message}
        </span>
      )}
      {state.kind === 'sent' && state.messageSid && (
        <span className="idtl-actions-note">Sent · sid={state.messageSid.slice(-8)}</span>
      )}
    </div>
  );
}
