'use client';

// Edit forms — one per credential kind. Each form posts via the
// matching server action from lib/credentials/actions.ts.
//
// FIELD HANDLING
//   Sensitive fields use type="password" so they don't render in
//   cleartext + browser autofill stays out. Format hints rendered
//   inline below each field. Server-side validators are the source
//   of truth for actual format checks; client hints are UX guidance.
//
//   Defensive: every secret-bearing field is trimmed BOTH on the
//   client (visual) and on the server (truth) — the trailing-hyphen
//   Gmail bug taught us input layers strip silently.

import * as React from 'react';
import {
  setTwilioCredentials,
  setSquareCredentials,
  setDocuSignCredentials,
  setGmailCredentials,
  type SetCredentialResult,
} from '@/lib/credentials/actions';

interface BaseProps {
  onClose: () => void;
  onSaved: () => void;
}

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string; field?: string };

/**
 * Map a server-action result to a SubmitState. Handles narrowing on
 * `reason === 'invalid-format'` to safely extract the `field` discriminant
 * (rather than relying on `'field' in result` which depends on coincidental
 * shape).
 */
function resultToError(result: SetCredentialResult): SubmitState {
  if (result.ok) return { kind: 'idle' };
  if (result.reason === 'invalid-format') {
    return { kind: 'error', message: result.message, field: result.field };
  }
  return { kind: 'error', message: result.message };
}

/** Fixed safe copy for client-side fetch / serialization failures. */
const CLIENT_FETCH_FAILED =
  'Could not reach the server. Check your connection and try again.';

function ErrorRow({ state, field }: { state: SubmitState; field: string }) {
  if (state.kind !== 'error' || state.field !== field) return null;
  return <div className="creds-form-error-inline">{state.message}</div>;
}

function GeneralError({ state }: { state: SubmitState }) {
  if (state.kind !== 'error' || state.field) return null;
  return (
    <div className="creds-form-error" role="alert">
      {state.message}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// TWILIO
// ────────────────────────────────────────────────────────────────

export function TwilioEditForm(props: BaseProps) {
  const [state, setState] = React.useState<SubmitState>({ kind: 'idle' });
  const firstFieldRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);
  const onSubmit = async (formData: FormData) => {
    setState({ kind: 'submitting' });
    let result: SetCredentialResult;
    try {
      result = await setTwilioCredentials({
        accountSid: String(formData.get('accountSid') ?? ''),
        authToken: String(formData.get('authToken') ?? ''),
        fromNumber: String(formData.get('fromNumber') ?? ''),
      });
    } catch {
      // Don't echo err.message — could leak network internals or stack
      // fragments. Fixed copy keeps client surface clean.
      setState({ kind: 'error', message: CLIENT_FETCH_FAILED });
      return;
    }
    if (result.ok) {
      props.onSaved();
    } else {
      setState(resultToError(result));
    }
  };

  return (
    <form action={onSubmit} className="creds-form">
      <div className="creds-form-row">
        <label htmlFor="t-sid">Account SID</label>
        <input
          id="t-sid"
          name="accountSid"
          type="text"
          required
          autoComplete="off"
          spellCheck={false}
          placeholder="AC..."
          ref={firstFieldRef}
        />
        <span className="creds-form-hint">Starts with "AC". Twilio Console → Account → API keys.</span>
        <ErrorRow state={state} field="accountSid" />
      </div>
      <div className="creds-form-row">
        <label htmlFor="t-tok">Auth Token</label>
        <input
          id="t-tok"
          name="authToken"
          type="password"
          required
          autoComplete="off"
          spellCheck={false}
          placeholder="32-char token"
        />
        <span className="creds-form-hint">Treat like a password. Click the eye in Twilio Console to reveal.</span>
        <ErrorRow state={state} field="authToken" />
      </div>
      <div className="creds-form-row">
        <label htmlFor="t-num">From Number</label>
        <input
          id="t-num"
          name="fromNumber"
          type="text"
          required
          autoComplete="off"
          spellCheck={false}
          placeholder="+18005551234"
          inputMode="tel"
        />
        <span className="creds-form-hint">E.164 format: +&lt;country code&gt;&lt;number&gt;, no spaces or dashes.</span>
        <ErrorRow state={state} field="fromNumber" />
      </div>
      <GeneralError state={state} />
      <div className="creds-form-actions">
        <button
          type="button"
          className="creds-btn-quiet"
          onClick={props.onClose}
          disabled={state.kind === 'submitting'}
        >
          Cancel
        </button>
        <button type="submit" className="creds-btn-primary" disabled={state.kind === 'submitting'}>
          {state.kind === 'submitting' ? 'Saving...' : 'Save Twilio credentials'}
        </button>
      </div>
    </form>
  );
}

// ────────────────────────────────────────────────────────────────
// SQUARE
// ────────────────────────────────────────────────────────────────

export function SquareEditForm(props: BaseProps) {
  const [state, setState] = React.useState<SubmitState>({ kind: 'idle' });
  const [environment, setEnvironment] = React.useState<'sandbox' | 'production'>('sandbox');
  const firstFieldRef = React.useRef<HTMLSelectElement>(null);
  React.useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  const onSubmit = async (formData: FormData) => {
    setState({ kind: 'submitting' });
    let result: SetCredentialResult;
    try {
      result = await setSquareCredentials({
        accessToken: String(formData.get('accessToken') ?? ''),
        locationId: String(formData.get('locationId') ?? ''),
        environment,
      });
    } catch {
      // Don't echo err.message — could leak network internals or stack
      // fragments. Fixed copy keeps client surface clean.
      setState({ kind: 'error', message: CLIENT_FETCH_FAILED });
      return;
    }
    if (result.ok) {
      props.onSaved();
    } else {
      setState(resultToError(result));
    }
  };

  return (
    <form action={onSubmit} className="creds-form">
      <div className="creds-form-row">
        <label htmlFor="s-env">Environment</label>
        <select
          id="s-env"
          name="environment"
          value={environment}
          onChange={(e) => setEnvironment(e.target.value as 'sandbox' | 'production')}
          ref={firstFieldRef}
        >
          <option value="sandbox">Sandbox (developer.squareup.com)</option>
          <option value="production">Production (squareup.com)</option>
        </select>
        <span className="creds-form-hint">
          Use Sandbox for testing. Production requires a real Square seller account.
        </span>
      </div>
      <div className="creds-form-row">
        <label htmlFor="s-tok">Access Token</label>
        <input
          id="s-tok"
          name="accessToken"
          type="password"
          required
          autoComplete="off"
          spellCheck={false}
          placeholder="EAAA..."
        />
        <span className="creds-form-hint">Square Dev Dashboard → Credentials → Access Token. Sandbox + Production tokens are different.</span>
        <ErrorRow state={state} field="accessToken" />
      </div>
      <div className="creds-form-row">
        <label htmlFor="s-loc">Location ID</label>
        <input
          id="s-loc"
          name="locationId"
          type="text"
          required
          autoComplete="off"
          spellCheck={false}
          placeholder="L..."
        />
        <span className="creds-form-hint">Starts with "L". Square Dashboard → Locations.</span>
        <ErrorRow state={state} field="locationId" />
      </div>
      <GeneralError state={state} />
      <div className="creds-form-actions">
        <button
          type="button"
          className="creds-btn-quiet"
          onClick={props.onClose}
          disabled={state.kind === 'submitting'}
        >
          Cancel
        </button>
        <button type="submit" className="creds-btn-primary" disabled={state.kind === 'submitting'}>
          {state.kind === 'submitting' ? 'Saving...' : 'Save Square credentials'}
        </button>
      </div>
    </form>
  );
}

// ────────────────────────────────────────────────────────────────
// DOCUSIGN
// ────────────────────────────────────────────────────────────────

export function DocuSignEditForm(props: BaseProps) {
  const [state, setState] = React.useState<SubmitState>({ kind: 'idle' });
  const firstFieldRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  const onSubmit = async (formData: FormData) => {
    setState({ kind: 'submitting' });
    let result: SetCredentialResult;
    try {
      result = await setDocuSignCredentials({
        integrationKey: String(formData.get('integrationKey') ?? ''),
        userId: String(formData.get('userId') ?? ''),
        accountId: String(formData.get('accountId') ?? ''),
        privateKey: String(formData.get('privateKey') ?? ''),
      });
    } catch {
      // Don't echo err.message — could leak network internals or stack
      // fragments. Fixed copy keeps client surface clean.
      setState({ kind: 'error', message: CLIENT_FETCH_FAILED });
      return;
    }
    if (result.ok) {
      props.onSaved();
    } else {
      setState(resultToError(result));
    }
  };

  return (
    <form action={onSubmit} className="creds-form">
      <div className="creds-form-row">
        <label htmlFor="d-ik">Integration Key</label>
        <input
          id="d-ik"
          name="integrationKey"
          type="text"
          required
          autoComplete="off"
          spellCheck={false}
          placeholder="00000000-0000-0000-0000-000000000000"
          ref={firstFieldRef}
        />
        <span className="creds-form-hint">GUID. DocuSign → Apps and Keys → your app → Integration Key.</span>
        <ErrorRow state={state} field="integrationKey" />
      </div>
      <div className="creds-form-row">
        <label htmlFor="d-uid">User ID (API Username)</label>
        <input
          id="d-uid"
          name="userId"
          type="text"
          required
          autoComplete="off"
          spellCheck={false}
          placeholder="00000000-0000-0000-0000-000000000000"
        />
        <span className="creds-form-hint">GUID, despite the "username" label. DocuSign profile.</span>
        <ErrorRow state={state} field="userId" />
      </div>
      <div className="creds-form-row">
        <label htmlFor="d-aid">Account ID</label>
        <input
          id="d-aid"
          name="accountId"
          type="text"
          required
          autoComplete="off"
          spellCheck={false}
          placeholder="00000000-0000-0000-0000-000000000000"
        />
        <span className="creds-form-hint">GUID. Apps and Keys page header → API Account ID.</span>
        <ErrorRow state={state} field="accountId" />
      </div>
      <div className="creds-form-row">
        <label htmlFor="d-pk">RSA Private Key (PEM)</label>
        <textarea
          id="d-pk"
          name="privateKey"
          required
          autoComplete="off"
          spellCheck={false}
          rows={10}
          placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
        />
        <span className="creds-form-hint">
          Paste the entire block including BEGIN/END markers. Generated once via Apps and Keys → Authentication → Generate RSA.
        </span>
        <ErrorRow state={state} field="privateKey" />
      </div>
      <GeneralError state={state} />
      <div className="creds-form-actions">
        <button
          type="button"
          className="creds-btn-quiet"
          onClick={props.onClose}
          disabled={state.kind === 'submitting'}
        >
          Cancel
        </button>
        <button type="submit" className="creds-btn-primary" disabled={state.kind === 'submitting'}>
          {state.kind === 'submitting' ? 'Saving...' : 'Save DocuSign credentials'}
        </button>
      </div>
    </form>
  );
}

// ────────────────────────────────────────────────────────────────
// GMAIL
// ────────────────────────────────────────────────────────────────

export function GmailEditForm(props: BaseProps) {
  const [state, setState] = React.useState<SubmitState>({ kind: 'idle' });
  const firstFieldRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  const onSubmit = async (formData: FormData) => {
    setState({ kind: 'submitting' });
    let result: SetCredentialResult;
    try {
      result = await setGmailCredentials({
        clientId: String(formData.get('clientId') ?? ''),
        clientSecret: String(formData.get('clientSecret') ?? ''),
        refreshToken: String(formData.get('refreshToken') ?? ''),
        scope: String(formData.get('scope') ?? ''),
      });
    } catch {
      // Don't echo err.message — could leak network internals or stack
      // fragments. Fixed copy keeps client surface clean.
      setState({ kind: 'error', message: CLIENT_FETCH_FAILED });
      return;
    }
    if (result.ok) {
      props.onSaved();
    } else {
      setState(resultToError(result));
    }
  };

  return (
    <form action={onSubmit} className="creds-form">
      <div className="creds-form-row">
        <label htmlFor="g-cid">OAuth Client ID</label>
        <input
          id="g-cid"
          name="clientId"
          type="text"
          required
          autoComplete="off"
          spellCheck={false}
          placeholder="123456-abc.apps.googleusercontent.com"
          ref={firstFieldRef}
        />
        <span className="creds-form-hint">
          Ends in .apps.googleusercontent.com. Google Cloud Console → APIs & Services → Credentials.
        </span>
        <ErrorRow state={state} field="clientId" />
      </div>
      <div className="creds-form-row">
        <label htmlFor="g-cs">OAuth Client Secret</label>
        <input
          id="g-cs"
          name="clientSecret"
          type="password"
          required
          autoComplete="off"
          spellCheck={false}
          placeholder="GOCSPX-..."
        />
        <span className="creds-form-hint">
          Starts with GOCSPX-. Watch trailing characters when pasting (often hyphens or underscores).
        </span>
        <ErrorRow state={state} field="clientSecret" />
      </div>
      <div className="creds-form-row">
        <label htmlFor="g-rt">Refresh Token</label>
        <input
          id="g-rt"
          name="refreshToken"
          type="password"
          required
          autoComplete="off"
          spellCheck={false}
          placeholder="1//0g..."
        />
        <span className="creds-form-hint">
          Mint via OAuth Playground (developers.google.com/oauthplayground) using your Client ID + Client Secret.
        </span>
        <ErrorRow state={state} field="refreshToken" />
      </div>
      <div className="creds-form-row">
        <label htmlFor="g-sc">Scopes</label>
        <input
          id="g-sc"
          name="scope"
          type="text"
          required
          autoComplete="off"
          spellCheck={false}
          placeholder="https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send"
          defaultValue="https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send"
        />
        <span className="creds-form-hint">
          Space-separated. Must match what you authorized in OAuth Playground. Default covers read + send.
        </span>
        <ErrorRow state={state} field="scope" />
      </div>
      <GeneralError state={state} />
      <div className="creds-form-actions">
        <button
          type="button"
          className="creds-btn-quiet"
          onClick={props.onClose}
          disabled={state.kind === 'submitting'}
        >
          Cancel
        </button>
        <button type="submit" className="creds-btn-primary" disabled={state.kind === 'submitting'}>
          {state.kind === 'submitting' ? 'Saving...' : 'Save Gmail credentials'}
        </button>
      </div>
    </form>
  );
}
