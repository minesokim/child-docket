// DocuSign envelope creation for Form 8879 with KBA recipient.
//
// Per IRS Pub 1345: every remote 8879 signing requires NIST IAL2
// knowledge-based authentication (credit-bureau-sourced). DocuSign
// bundles KBA via LexisNexis at ~$3/check. This file shells the
// envelope-creation API call with the KBA recipient block.
//
// SCOPE
//   Scaffold-only. The actual document upload (PDF bytes for the
//   8879) requires the return-prep pipeline to produce the PDF —
//   that's downstream of OLT integration. This file builds the
//   envelope shape with a placeholder document ID; when the PDF
//   pipeline lands, callers replace the placeholder with real
//   bytes.

export interface CreateEnvelopeInput {
  accessToken: string;
  apiBaseUri: string;
  /** DocuSign account ID (firm's). */
  accountId: string;
  /** Display name for the envelope ('Vazant Consulting · 2024 Form 8879'). */
  emailSubject: string;
  /** Plaintext body of the email DocuSign sends to the signer. */
  emailBody: string;
  /** Signer details — taxpayer's legal name + email. */
  signerName: string;
  signerEmail: string;
  /** Last 4 of SSN — required for KBA pre-fill validation. */
  signerLast4Ssn: string;
  /**
   * PDF bytes (base64) for the 8879. REQUIRED in v1 production —
   * DocuSign rejects empty payloads with INVALID_DOCUMENT_BASE64.
   * Antonio uploads via the command-room /clients/[id] surface;
   * caller passes the bytes through.
   */
  documentBase64: string;
  /**
   * Filename DocuSign labels the document with (e.g.,
   * '2024-form-8879-jane-doe.pdf'). Surfaced in the signing iframe
   * + the post-signed receipt.
   */
  documentName?: string;
  /**
   * When set, signer is configured for EMBEDDED mode (clientUserId
   * is the Docket client UUID). createRecipientView then mints the
   * iframe URL. When unset, signer is EMAIL mode — DocuSign emails
   * the signing link to signerEmail. v1 production uses embedded
   * (signing happens INSIDE the portal); email mode is reserved for
   * non-portal-onboarded clients (V1.5).
   */
  clientUserId?: string;
  /** External reference (issue id / engagement id) for our audit trail. */
  externalRef: string;
}

export type CreateEnvelopeResult =
  | {
      ok: true;
      envelopeId: string;
      status: string;
      uri: string;
    }
  | {
      ok: false;
      reason: 'http-error' | 'network' | 'malformed-response';
      message: string;
      statusCode?: number;
      errorCode?: string;
    };

/**
 * Create a DocuSign envelope with a single signer + KBA-required
 * recipient authentication. Returns the envelope id which is
 * persisted in signatures.audit_payload for later status polling.
 *
 * KBA WIRING
 *   recipient.requireIdLookup: true
 *   recipient.idCheckConfigurationName: 'ID Check $'  (DocuSign
 *     default for KBA; firms can configure custom names in their
 *     DocuSign account)
 *   recipient.idCheckInformationInput.dobInformationInput / ssn4
 *     prefills the KBA challenge with what we know; LexisNexis
 *     generates 5 multiple-choice questions from the credit file.
 */
export async function createEnvelope(
  input: CreateEnvelopeInput,
): Promise<CreateEnvelopeResult> {
  const url = `${input.apiBaseUri}/restapi/v2.1/accounts/${input.accountId}/envelopes`;

  const envelope = {
    emailSubject: input.emailSubject,
    emailBlurb: input.emailBody,
    status: 'sent',
    customFields: {
      textCustomFields: [
        {
          name: 'docket_external_ref',
          value: input.externalRef,
          required: 'false',
          show: 'false',
        },
      ],
    },
    documents: [
      {
        documentId: '1',
        name: input.documentName ?? 'Form 8879',
        fileExtension: 'pdf',
        documentBase64: input.documentBase64,
      },
    ],
    recipients: {
      signers: [
        {
          recipientId: '1',
          routingOrder: '1',
          name: input.signerName,
          email: input.signerEmail,
          // clientUserId presence flips the signer to EMBEDDED mode.
          // When set, DocuSign expects createRecipientView to mint
          // the iframe URL. When omitted, DocuSign emails the
          // signer the standard email-link flow.
          ...(input.clientUserId ? { clientUserId: input.clientUserId } : {}),
          requireIdLookup: 'true',
          idCheckConfigurationName: 'ID Check $',
          idCheckInformationInput: {
            ssn4InformationInput: {
              ssn4: input.signerLast4Ssn,
              displayLevelCode: 'Editable',
              receiveInResponse: 'false',
            },
          },
          tabs: {
            signHereTabs: [
              {
                anchorString: '/sig1/',
                anchorYOffset: '0',
                anchorUnits: 'pixels',
                documentId: '1',
                pageNumber: '1',
                recipientId: '1',
              },
            ],
          },
        },
      ],
    },
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(envelope),
    });
  } catch (err) {
    return {
      ok: false,
      reason: 'network',
      message: err instanceof Error ? err.message : 'Network error',
    };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return {
      ok: false,
      reason: 'malformed-response',
      message: 'DocuSign returned non-JSON',
      statusCode: res.status,
    };
  }

  if (
    !res.ok ||
    typeof json !== 'object' ||
    json === null ||
    !('envelopeId' in json) ||
    typeof (json as { envelopeId: unknown }).envelopeId !== 'string'
  ) {
    const errBody = json as { errorCode?: string; message?: string };
    return {
      ok: false,
      reason: 'http-error',
      message: errBody.message ?? `DocuSign returned ${res.status}`,
      statusCode: res.status,
      errorCode: errBody.errorCode,
    };
  }

  const ok = json as { envelopeId: string; status: string; uri: string };
  return {
    ok: true,
    envelopeId: ok.envelopeId,
    status: ok.status,
    uri: ok.uri,
  };
}

// ────────────────────────────────────────────────────────────────
// createRecipientView — mint the embedded signing URL.
//
// After createEnvelope succeeds, this generates a short-lived URL
// the client portal iframes to render the DocuSign signing experience
// without leaving Docket. KBA fires INSIDE the iframe; the client
// answers 5 LexisNexis-sourced questions, then the signature pad
// renders, then on completion DocuSign posts the result to our
// webhook + redirects the iframe to `returnUrl`.
//
// REQUIREMENTS for embedded signing (vs the email flow):
//   - The recipient on the envelope must have `clientUserId` set
//     (any non-empty string — convention is to use the Docket
//     client UUID so we can tie back). createEnvelope's signer
//     entry needs `clientUserId` added when we want embedded mode.
//   - createRecipientView body needs the SAME clientUserId, plus
//     authenticationMethod ('none' is fine; KBA is gated by the
//     recipient's requireIdLookup which we already set).
//
// Reference: https://developers.docusign.com/docs/esign-rest-api/reference/envelopes/envelopeviews/createrecipient/
// ────────────────────────────────────────────────────────────────

export interface CreateRecipientViewInput {
  accessToken: string;
  apiBaseUri: string;
  accountId: string;
  envelopeId: string;
  /** Same client UUID passed as clientUserId on the envelope's signer. */
  clientUserId: string;
  /** Taxpayer's legal name (must match the envelope signer). */
  signerName: string;
  /** Taxpayer's email (must match the envelope signer). */
  signerEmail: string;
  /**
   * Where DocuSign sends the iframe after signing. Should be a
   * /portal/sign-8879/[envelopeId]/done page Docket controls so the
   * embedded surface flips out of the iframe cleanly.
   */
  returnUrl: string;
}

export type CreateRecipientViewResult =
  | { ok: true; signingUrl: string }
  | {
      ok: false;
      reason: 'http-error' | 'network' | 'malformed-response';
      message: string;
      statusCode?: number;
      errorCode?: string;
    };

export async function createRecipientView(
  input: CreateRecipientViewInput,
): Promise<CreateRecipientViewResult> {
  const url =
    `${input.apiBaseUri}/restapi/v2.1/accounts/${input.accountId}` +
    `/envelopes/${input.envelopeId}/views/recipient`;

  const body = {
    returnUrl: input.returnUrl,
    // 'none' here means DocuSign doesn't ADD additional auth — but
    // the envelope's `requireIdLookup: true` (from createEnvelope)
    // means KBA still fires. The two settings are independent: this
    // controls iframe-level auth (none = open in iframe directly);
    // the envelope-level setting controls the KBA wall.
    authenticationMethod: 'none',
    email: input.signerEmail,
    userName: input.signerName,
    clientUserId: input.clientUserId,
    // pingFrequency in seconds — keeps the session alive; DocuSign
    // expects the iframe parent to call Math.min(pingFrequency, 600)
    // ping. We leave default for v0; revisit if iframe sessions
    // expire mid-sign.
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return {
      ok: false,
      reason: 'network',
      message: err instanceof Error ? err.message : 'Network error',
    };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return {
      ok: false,
      reason: 'malformed-response',
      message: 'DocuSign returned non-JSON',
      statusCode: res.status,
    };
  }

  if (
    !res.ok ||
    typeof json !== 'object' ||
    json === null ||
    !('url' in json) ||
    typeof (json as { url: unknown }).url !== 'string'
  ) {
    const errBody = json as { errorCode?: string; message?: string };
    return {
      ok: false,
      reason: 'http-error',
      message: errBody.message ?? `DocuSign returned ${res.status}`,
      statusCode: res.status,
      errorCode: errBody.errorCode,
    };
  }

  return { ok: true, signingUrl: (json as { url: string }).url };
}
