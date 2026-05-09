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
   * PDF bytes (base64) for the 8879. v0 callers can pass an empty
   * placeholder; DocuSign will reject -- intentional. v1 wires the
   * real return PDF from the prep pipeline.
   */
  documentBase64?: string;
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
        name: 'Form 8879',
        fileExtension: 'pdf',
        documentBase64: input.documentBase64 ?? '',
      },
    ],
    recipients: {
      signers: [
        {
          recipientId: '1',
          routingOrder: '1',
          name: input.signerName,
          email: input.signerEmail,
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
