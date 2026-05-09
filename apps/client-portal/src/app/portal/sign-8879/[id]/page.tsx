// /portal/sign-8879/[id] — embedded DocuSign signing surface for Form 8879.
//
// Antonio's preparer flow:
//   1. Antonio clicks "Request 8879 signature" on /clients/[id] in
//      command-room → uploads the 8879 PDF + last-4 SSN → server
//      action creates the envelope + persists a signatures row.
//   2. Antonio shares the link `/portal/sign-8879/[signatureRowId]`
//      with the client (via SMS, email, or portal in-app — all
//      surface the same URL).
//   3. Client opens the link → KBA wall fires (5 LexisNexis-sourced
//      questions) → signature pad → click 'Adopt + Sign' → DocuSign
//      redirects iframe to /sign-8879/[id]/done → webhook lands +
//      flips signatures.status=signed.
//
// This page is the iframe host. It mints a fresh DocuSign signing
// URL on every visit (URLs expire after ~5 min) and embeds it via
// <iframe>. The iframe-handoff is what makes the experience FEEL
// like part of Vazant's portal — the client never sees a DocuSign
// chrome bar.
//
// PUB 1345 COMPLIANCE
//   The KBA wall is gated by the envelope's `requireIdLookup: true`
//   (set in createEnvelope). DocuSign won't show the signature pad
//   until the client passes 4 of 5 LexisNexis-sourced challenge
//   questions matched against the credit-bureau record on file
//   for the SSN-last-4 we passed during envelope creation.
//
// SECURITY
//   Server component — pre-fetches signing URL via getEmbeddedSigningUrlPortal.
//   That action verifies the taxpayer's tenant + clientId match the
//   signature's. RLS-bound; bypassing this page directly with a
//   foreign signatureRowId returns 'not-found'.
//
// USAGE
//   /portal/sign-8879/{signatureRowId}
//
//   The path param is the signatures table PK, NOT DocuSign's
//   envelopeId (envelopeId leaks DocuSign internals; signatureRowId
//   is the Docket abstraction).

import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { getEmbeddedSigningUrlPortal } from '@/lib/docusign/get-embedded-signing-url';
import { Sign8879Iframe } from './sign-iframe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ id: string }> };

export default async function Sign8879Page({ params }: PageProps) {
  const { id: signatureRowId } = await params;

  // returnUrl is where DocuSign redirects the iframe AFTER signing.
  // We use the same-origin /done route so the iframe transitions
  // cleanly. Need to derive the portal's public URL from headers
  // since this is a server component (no window.location).
  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const host = h.get('host') ?? 'docket-portal.vercel.app';
  const returnUrl = `${proto}://${host}/portal/sign-8879/${signatureRowId}/done`;

  const result = await getEmbeddedSigningUrlPortal(signatureRowId, returnUrl);

  if (!result.ok) {
    if (result.reason === 'not-found' || result.reason === 'unauthenticated') {
      notFound();
    }
    if (result.reason === 'already-signed') {
      // Bounce to the success surface — they've already done it.
      return <AlreadySigned />;
    }
    return <SigningUnavailable reason={result.reason} message={result.message} />;
  }

  return (
    <Sign8879Iframe
      signingUrl={result.signingUrl}
      envelopeId={result.envelopeId}
      signatureRowId={result.signatureRowId}
    />
  );
}

function AlreadySigned() {
  return (
    <div
      style={{
        maxWidth: 540,
        margin: '80px auto',
        padding: '32px 28px',
        textAlign: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#2A2419',
      }}
    >
      <div
        style={{
          fontSize: 48,
          marginBottom: 12,
          color: '#1f4621',
        }}
      >
        ✓
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 8 }}>
        Already signed
      </h1>
      <p style={{ fontSize: 14, color: '#5A4F3F', lineHeight: 1.5 }}>
        You've already signed this Form 8879. Your preparer can re-send a fresh
        copy if needed.
      </p>
    </div>
  );
}

function SigningUnavailable({ reason, message }: { reason: string; message: string }) {
  return (
    <div
      style={{
        maxWidth: 540,
        margin: '80px auto',
        padding: '32px 28px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#2A2419',
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 12 }}>
        Signing temporarily unavailable
      </h1>
      <p style={{ fontSize: 14, color: '#5A4F3F', lineHeight: 1.55, marginBottom: 16 }}>
        We couldn't open the signing surface right now. Try refreshing in a
        minute. If it persists, contact your preparer.
      </p>
      <details style={{ fontSize: 12, color: '#8a7d68' }}>
        <summary style={{ cursor: 'pointer' }}>Technical detail</summary>
        <div style={{ marginTop: 8, fontFamily: 'ui-monospace, monospace' }}>
          {reason}: {message}
        </div>
      </details>
    </div>
  );
}
