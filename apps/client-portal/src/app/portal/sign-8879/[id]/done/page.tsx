// /portal/sign-8879/[id]/done — landing page after DocuSign signing iframe redirects.
//
// DocuSign appends a `?event=` query param to the returnUrl based on
// the signing outcome:
//   - signing_complete: the happy path. Webhook will land + flip
//                        signatures.status='signed' shortly. We
//                        show a success state.
//   - cancel:           user clicked "Finish later" or closed.
//   - decline:          user actively declined to sign.
//   - exception:        DocuSign threw an error mid-sign (rare).
//   - id_check_failed:  KBA failed 3x — DocuSign locked the signer
//                        for 24h. Antonio needs to either re-send
//                        a fresh envelope OR fall back to in-person
//                        signing on paper.
//   - session_timeout:  the signing URL expired before user finished.
//                        They can re-open /portal/sign-8879/[id] and
//                        we'll mint a new URL.

import { notFound } from 'next/navigation';
import Link from 'next/link';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ event?: string }>;
};

const STATE: Record<
  string,
  { title: string; body: string; severity: 'success' | 'warn' | 'error' }
> = {
  signing_complete: {
    title: 'Signed — thank you!',
    body:
      'Your e-signature on Form 8879 is recorded. Your preparer will be notified ' +
      'and will proceed with e-filing your return. You can close this window.',
    severity: 'success',
  },
  cancel: {
    title: 'Signing paused',
    body:
      'You closed the signing surface before finishing. Re-open the link your ' +
      'preparer sent and you can pick up where you left off.',
    severity: 'warn',
  },
  decline: {
    title: 'Signing declined',
    body:
      'You declined to sign Form 8879. Your preparer has been notified. Reach ' +
      'out to discuss next steps before your filing deadline.',
    severity: 'warn',
  },
  exception: {
    title: 'Something went wrong',
    body:
      'DocuSign hit an unexpected error during signing. Refresh the original ' +
      'link and try again; if it persists, contact your preparer.',
    severity: 'error',
  },
  id_check_failed: {
    title: 'Identity verification failed',
    body:
      'We couldn\'t verify your identity through the standard 5-question check. ' +
      'For your protection DocuSign locks signing for 24 hours after 3 failed ' +
      'attempts. Contact your preparer — they can either re-send a fresh ' +
      'verification challenge after 24h or arrange in-person signing.',
    severity: 'error',
  },
  session_timeout: {
    title: 'Signing session timed out',
    body:
      'The signing surface expired (typically 5 minutes of inactivity). ' +
      'Re-open the original link your preparer sent to pick up where ' +
      'you left off.',
    severity: 'warn',
  },
};

const COLOR: Record<'success' | 'warn' | 'error', { ink: string; bg: string }> = {
  success: { ink: '#1f4621', bg: '#e1f4df' },
  warn: { ink: '#7a4a08', bg: '#fde9c2' },
  error: { ink: '#7a1b1b', bg: '#fad8d8' },
};

export default async function Sign8879DonePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const event = sp.event ?? 'signing_complete';

  // Validate the path param shape, but don't dereference DocuSign's
  // event further — the canonical record is in signatures table
  // (updated by webhook). This page is purely UX feedback.
  if (!id || id.length < 8) notFound();

  const state = STATE[event] ?? STATE.exception;
  const palette = COLOR[state!.severity];

  return (
    <div
      style={{
        maxWidth: 520,
        margin: '80px auto',
        padding: '0 20px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#2A2419',
      }}
    >
      <div
        style={{
          background: palette.bg,
          color: palette.ink,
          padding: '20px 24px',
          borderRadius: 14,
          marginBottom: 24,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: '0 0 8px' }}>
          {state!.title}
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.55, margin: 0 }}>{state!.body}</p>
      </div>
      <div
        style={{
          textAlign: 'center',
          fontSize: 13,
          color: '#5A4F3F',
        }}
      >
        <Link
          href="/portal"
          style={{
            color: '#1f4621',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
          }}
        >
          Back to portal
        </Link>
      </div>
    </div>
  );
}
