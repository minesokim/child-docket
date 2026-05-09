'use client';

// Iframe consumer for the DocuSign embedded signing URL.
//
// Renders the URL inside a full-bleed iframe + listens for the
// post-sign redirect. DocuSign sends the iframe to `returnUrl` (the
// /done page) when signing completes.
//
// Why a separate client component: the parent server component
// pre-fetches the signing URL — short-lived (~5 min). Once the
// iframe has it, no further server roundtrips are needed; the
// iframe's lifecycle is purely DocuSign's.
//
// SECURITY
//   The iframe origin is DocuSign's. They control the chrome.
//   Docket's wrapper page provides a thin top-bar so the user
//   knows they're still inside Vazant's portal during the KBA wall.

import * as React from 'react';

interface Props {
  signingUrl: string;
  envelopeId: string;
  signatureRowId: string;
}

export function Sign8879Iframe({ signingUrl, envelopeId, signatureRowId }: Props) {
  // void unused to avoid lint complaints — these are passed in for
  // potential future analytics / state-tracking but the iframe URL
  // contains all the binding info DocuSign needs.
  void envelopeId;
  void signatureRowId;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#fffefc',
      }}
    >
      <header
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid #E4DDCE',
          background: '#fff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: 13,
          color: '#5A4F3F',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div>
          <strong style={{ fontWeight: 500, color: '#2A2419' }}>Form 8879</strong>
          <span style={{ marginLeft: 8 }}>· e-file authorization</span>
        </div>
        <div
          style={{
            fontSize: 11,
            color: '#8a7d68',
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          Secure · DocuSign · IRS Pub 1345 IAL2
        </div>
      </header>
      <iframe
        title="Form 8879 signing"
        src={signingUrl}
        style={{
          flex: 1,
          width: '100%',
          border: 'none',
        }}
        // KBA + signing form needs camera (selfie option in some
        // KBA flows) + autoplay (iframe focus tricks). DocuSign's
        // embedded SDK requires these explicitly.
        allow="camera; microphone; autoplay; clipboard-write"
      />
    </div>
  );
}
