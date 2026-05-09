'use client';

// CredentialCard — per-kind card on /settings/credentials.
//
// State machine:
//   idle → editing → idle (saved or cancelled)
//   idle → testing → tested
//   idle → confirming-delete → deleting → idle (deleted)
//   any → error
//
// All destructive actions go through the server actions in
// lib/credentials/actions.ts (auth + role + rate-limit + audit).
// The Delete confirm step is UX safety against fat-finger; the
// security boundary is the firm_owner role gate inside the action.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  TwilioEditForm,
  SquareEditForm,
  DocuSignEditForm,
  GmailEditForm,
} from './edit-forms';
import {
  deleteCredential,
  testCredential,
  type DeleteCredentialResult,
  type TestCredentialActionResult,
} from '@/lib/credentials/actions';
import type { CredentialStatus } from '@/lib/credentials/status';

interface Props {
  status: CredentialStatus;
}

type Mode =
  | { kind: 'idle' }
  | { kind: 'editing' }
  | { kind: 'confirming-delete' }
  | { kind: 'confirming-delete-failed'; message: string }
  | { kind: 'deleting' }
  | { kind: 'testing' }
  | { kind: 'tested'; result: TestCredentialActionResult }
  | { kind: 'error'; message: string };

/** Fixed safe copy for client-side fetch / serialization failures. */
const CLIENT_FETCH_FAILED =
  'Could not reach the server. Check your connection and try again.';

const KIND_META: Record<
  CredentialStatus['kind'],
  { name: string; purpose: string }
> = {
  twilio: {
    name: 'Twilio',
    purpose: 'SMS invites and bidirectional client messaging.',
  },
  square: {
    name: 'Square',
    purpose: 'Engagement deposit checkout links.',
  },
  docusign: {
    name: 'DocuSign',
    purpose: '8879 e-signature with KBA (IRS Pub 1345 IAL2).',
  },
  gmail: {
    name: 'Gmail',
    purpose: 'Inbound email classification and draft reply generation.',
  },
};

export function CredentialCard({ status }: Props) {
  const [mode, setMode] = React.useState<Mode>({ kind: 'idle' });
  const router = useRouter();
  const meta = KIND_META[status.kind];

  const busy =
    mode.kind === 'testing' ||
    mode.kind === 'deleting';

  const onTest = React.useCallback(async () => {
    setMode({ kind: 'testing' });
    let result: TestCredentialActionResult;
    try {
      result = await testCredential(status.kind);
    } catch {
      setMode({ kind: 'error', message: CLIENT_FETCH_FAILED });
      return;
    }
    setMode({ kind: 'tested', result });
  }, [status.kind]);

  const onDelete = React.useCallback(async () => {
    setMode({ kind: 'deleting' });
    let result: DeleteCredentialResult;
    try {
      result = await deleteCredential(status.kind, `delete-${status.kind}`);
    } catch {
      // Preserve the confirm panel + show inline error so the user can
      // retry or cancel without restarting the flow.
      setMode({ kind: 'confirming-delete-failed', message: CLIENT_FETCH_FAILED });
      return;
    }
    if (result.ok) {
      setMode({ kind: 'idle' });
      router.refresh();
    } else {
      setMode({ kind: 'confirming-delete-failed', message: result.message });
    }
  }, [status.kind, router]);

  const onSaved = React.useCallback(() => {
    setMode({ kind: 'idle' });
    router.refresh();
  }, [router]);

  const onClose = React.useCallback(() => {
    setMode({ kind: 'idle' });
  }, []);

  return (
    <article className="creds-card">
      <header className="creds-card-head">
        <div className="creds-card-id">
          <h3 className="creds-card-name">{meta.name}</h3>
          <p className="creds-card-purpose">{meta.purpose}</p>
        </div>
        <span
          className={`creds-card-status creds-card-status-${status.connected ? 'ok' : 'missing'}`}
        >
          {status.connected ? 'Connected' : 'Not configured'}
        </span>
      </header>

      {status.connected ? (
        <dl className="creds-card-fields">
          <DisplayFields status={status} />
          {status.lastUpdatedAt && (
            <div className="creds-card-row">
              <dt>Last updated</dt>
              <dd>
                {formatRelativeTime(status.lastUpdatedAt)}
                <span className="creds-card-iso">{status.lastUpdatedAt}</span>
              </dd>
            </div>
          )}
        </dl>
      ) : null}

      {mode.kind === 'editing' ? (
        <div className="creds-card-edit">
          <FormFor kind={status.kind} onClose={onClose} onSaved={onSaved} />
        </div>
      ) : mode.kind === 'confirming-delete' ||
        mode.kind === 'deleting' ||
        mode.kind === 'confirming-delete-failed' ? (
        <div
          className="creds-card-confirm"
          role="alertdialog"
          aria-labelledby={`confirm-delete-title-${status.kind}`}
          aria-describedby={`confirm-delete-body-${status.kind}`}
        >
          <h4
            id={`confirm-delete-title-${status.kind}`}
            className="creds-card-confirm-title"
          >
            Delete {meta.name} credentials?
          </h4>
          <p
            id={`confirm-delete-body-${status.kind}`}
            className="creds-card-confirm-body"
          >
            The tenant won't be able to use {meta.name} until you re-add them.
            This is logged in the audit chain.
          </p>
          {mode.kind === 'confirming-delete-failed' && (
            <div
              className="creds-card-banner creds-card-banner-error"
              role="alert"
            >
              <strong>Delete failed.</strong> {mode.message}
            </div>
          )}
          <div className="creds-card-actions">
            <button
              type="button"
              className="creds-btn-quiet"
              onClick={onClose}
              disabled={mode.kind === 'deleting'}
            >
              Cancel
            </button>
            <button
              type="button"
              className="creds-btn-danger"
              onClick={onDelete}
              disabled={mode.kind === 'deleting'}
            >
              {mode.kind === 'deleting'
                ? 'Deleting…'
                : mode.kind === 'confirming-delete-failed'
                  ? 'Retry delete'
                  : `Yes, delete ${meta.name}`}
            </button>
          </div>
        </div>
      ) : (
        <div className="creds-card-actions">
          <button
            type="button"
            className={status.connected ? 'creds-btn-quiet' : 'creds-btn-primary'}
            onClick={() => setMode({ kind: 'editing' })}
            disabled={busy}
          >
            {status.connected ? 'Edit' : `Add ${meta.name} credentials`}
          </button>
          {status.connected && (
            <>
              <button
                type="button"
                className="creds-btn-quiet"
                onClick={onTest}
                disabled={busy}
              >
                {mode.kind === 'testing' ? 'Testing…' : 'Test connection'}
              </button>
              <button
                type="button"
                className="creds-btn-danger-quiet"
                onClick={() => setMode({ kind: 'confirming-delete' })}
                disabled={busy}
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}

      {mode.kind === 'tested' && (
        <TestResultPanel
          result={mode.result}
          onDismiss={() => setMode({ kind: 'idle' })}
        />
      )}
      {mode.kind === 'error' && (
        <div
          className="creds-card-banner creds-card-banner-error"
          role="alert"
        >
          <div>{mode.message}</div>
          <button
            type="button"
            className="creds-card-banner-dismiss"
            onClick={() => setMode({ kind: 'idle' })}
          >
            Dismiss
          </button>
        </div>
      )}
    </article>
  );
}

function FormFor({
  kind,
  onClose,
  onSaved,
}: {
  kind: CredentialStatus['kind'];
  onClose: () => void;
  onSaved: () => void;
}) {
  switch (kind) {
    case 'twilio':
      return <TwilioEditForm onClose={onClose} onSaved={onSaved} />;
    case 'square':
      return <SquareEditForm onClose={onClose} onSaved={onSaved} />;
    case 'docusign':
      return <DocuSignEditForm onClose={onClose} onSaved={onSaved} />;
    case 'gmail':
      return <GmailEditForm onClose={onClose} onSaved={onSaved} />;
  }
}

function DisplayFields({ status }: { status: CredentialStatus }) {
  if (status.kind === 'twilio') {
    return (
      <>
        {status.display.fromNumberLast4 ? (
          <Row label="From number">
            <span className="creds-card-mono">···{status.display.fromNumberLast4}</span>
          </Row>
        ) : null}
        {status.display.accountSid ? (
          <Row label="Account SID">
            <span className="creds-card-mono">
              {status.display.accountSid.slice(0, 6)}…{status.display.accountSid.slice(-4)}
            </span>
          </Row>
        ) : null}
      </>
    );
  }
  if (status.kind === 'square') {
    return (
      <>
        {status.display.environment ? (
          <Row label="Environment">
            <span
              className={`creds-card-env creds-card-env-${status.display.environment}`}
            >
              {status.display.environment}
            </span>
          </Row>
        ) : null}
        {status.display.locationId ? (
          <Row label="Location ID">
            <span className="creds-card-mono">{status.display.locationId}</span>
          </Row>
        ) : null}
      </>
    );
  }
  if (status.kind === 'docusign') {
    return (
      <>
        {status.display.accountId ? (
          <Row label="Account ID">
            <span className="creds-card-mono">{status.display.accountId}</span>
          </Row>
        ) : null}
        {status.display.integrationKey ? (
          <Row label="Integration Key">
            <span className="creds-card-mono">
              {status.display.integrationKey.slice(0, 8)}…
            </span>
          </Row>
        ) : null}
      </>
    );
  }
  if (status.kind === 'gmail') {
    return (
      <>
        {status.display.clientIdSuffix ? (
          <Row label="Project number">
            <span className="creds-card-mono">{status.display.clientIdSuffix}</span>
          </Row>
        ) : null}
        {status.display.scope ? (
          <Row label="Authorized scope">
            <span className="creds-card-scope">{status.display.scope}</span>
          </Row>
        ) : null}
      </>
    );
  }
  return null;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="creds-card-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function TestResultPanel({
  result,
  onDismiss,
}: {
  result: TestCredentialActionResult;
  onDismiss: () => void;
}) {
  if (!result.ok) {
    return (
      <div
        className="creds-card-banner creds-card-banner-error"
        role="status"
        aria-live="polite"
      >
        <div>
          <strong>Couldn't run test.</strong> {result.message}
        </div>
        <button type="button" className="creds-card-banner-dismiss" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    );
  }
  if (!result.test.ok) {
    return (
      <div
        className="creds-card-banner creds-card-banner-amber"
        role="status"
        aria-live="polite"
      >
        <div>
          <strong>Test failed: {result.test.reason}.</strong> {result.test.message}
        </div>
        {result.test.remediation ? (
          <div className="creds-card-banner-hint">{result.test.remediation}</div>
        ) : null}
        <div className="creds-card-banner-foot">
          <span className="creds-card-banner-meta">{result.test.latencyMs}ms</span>
          <button type="button" className="creds-card-banner-dismiss" onClick={onDismiss}>
            Dismiss
          </button>
        </div>
      </div>
    );
  }
  return (
    <div
      className="creds-card-banner creds-card-banner-ok"
      role="status"
      aria-live="polite"
    >
      <div>
        <strong>Test passed.</strong> {result.test.detail}
      </div>
      <div className="creds-card-banner-foot">
        <span className="creds-card-banner-meta">{result.test.latencyMs}ms</span>
        <button type="button" className="creds-card-banner-dismiss" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.floor((now - t) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
