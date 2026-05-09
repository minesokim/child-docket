// /settings/credentials — per-tenant credential vault management.
//
// Surfaces 4 cards (Twilio / Square / DocuSign / Gmail) each showing
// connection state + safe-display fields + Edit / Test / Delete
// actions. The actual mutations go through server actions in
// lib/credentials/actions.ts (auth + role + rate-limit + audit + format
// validation). The decryption pass that produces the safe-display
// fields runs server-side here on first render via
// loadCredentialStatuses; secrets never leave the server.
//
// ROLE GATE
//   This page is reachable by any signed-in user, but every server
//   action behind the buttons requires firm_owner. Non-owners see the
//   read-only state of the cards but the action calls return forbidden.
//   For Antonio's setup (sole firm_owner) this is the right shape;
//   when preparer/reviewer staff land we may add a UI hint for them.
//
// CommandShell-wrapped, operational-modern visual language.

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentDocketUser } from '@/lib/current-user';
import { CommandShell } from '@/components/command-shell';
import { loadCredentialStatuses, type CredentialStatuses } from '@/lib/credentials/status';
import { CredentialCard } from './credential-card';
import './credentials.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function CredentialsPage() {
  const user = await getCurrentDocketUser();
  if (!user) redirect('/sign-in');

  let statuses: CredentialStatuses | null = null;
  let errorMessage: string | null = null;
  try {
    statuses = await loadCredentialStatuses(user.tenantId);
  } catch (err) {
    // Server captures detail via the decrypt-error console logs (sanitized
    // in status.ts). Surface a fixed copy so DB exception fragments
    // never reach the rendered HTML.
    console.error(
      '[settings/credentials] loadCredentialStatuses failed:',
      err instanceof Error ? err.message : 'unknown error',
    );
    errorMessage = 'Could not load credentials. The error has been logged for review.';
  }

  const canEdit = user.role === 'firm_owner';

  return (
    <CommandShell
      user={user}
      tenantName={user.tenantName}
      activeHref="/settings/credentials"
    >
      <div className="creds">
        <header className="creds-header">
          <div className="creds-eyebrow">
            <Link href="/settings" className="creds-breadcrumb">
              Settings
            </Link>
            <span aria-hidden="true">›</span>
            <span>Credentials</span>
          </div>
          <h1 className="creds-title">Integration credentials</h1>
          <p className="creds-subtitle">
            Per-tenant vault for the four integrations Docket drives. Each
            credential is encrypted with a tenant-specific key the moment it's
            saved; the decrypted values never leave this server. Test and
            rotate anytime — every change is logged in the audit chain.
          </p>
          {!canEdit && (
            <div className="creds-banner creds-banner-info" role="status">
              You're signed in as <strong>{user.role}</strong>. Only{' '}
              <strong>firm_owner</strong> can rotate credentials. Ask an owner
              if you need a credential changed.
            </div>
          )}
        </header>

        {errorMessage ? (
          <div className="creds-error" role="alert">
            <div className="creds-error-title">Couldn't load credentials</div>
            <div className="creds-error-body">{errorMessage}</div>
          </div>
        ) : statuses === null ? null : (
          <div className="creds-grid">
            <CredentialCard status={statuses.twilio} />
            <CredentialCard status={statuses.square} />
            <CredentialCard status={statuses.docusign} />
            <CredentialCard status={statuses.gmail} />
          </div>
        )}

        <footer className="creds-footer">
          <h2 className="creds-footer-title">How rotation works</h2>
          <ul className="creds-footer-list">
            <li>
              <strong>Edit</strong> overwrites the stored credential atomically.
              The previous secret is replaced; no rollback. Test the new
              credential before relying on it for client-facing flows.
            </li>
            <li>
              <strong>Test</strong> makes one minimal API call against the
              provider to verify auth and reachability. Failures include the
              provider's reason code plus a remediation hint.
            </li>
            <li>
              <strong>Delete</strong> removes the row from{' '}
              <span className="creds-mono">tenant_credentials</span>. Any
              feature depending on that integration goes dark until the
              credential is re-added. Two-step confirm prevents accidents.
            </li>
            <li>
              All three actions are gated to{' '}
              <span className="creds-mono">firm_owner</span>, rate-limited to
              10/min/user, and recorded in the audit chain with
              redacted-only payloads (never secret bytes).
            </li>
          </ul>
        </footer>
      </div>
    </CommandShell>
  );
}
