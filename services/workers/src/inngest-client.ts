// Inngest client for Docket. Single client across all functions.
// Functions are registered via the Next.js route handler at
// apps/command-room/src/app/api/inngest/route.ts.

import { Inngest, EventSchemas } from 'inngest';
import type { TenantId, ClientId } from '@docket/shared';

// ────────────────────────────────────────────────────────────────
// Event types — every event we send/receive is typed.
// Add events here as we build out integrations.
// ────────────────────────────────────────────────────────────────
type DocketEvents = {
  'gmail/message.received': {
    data: {
      tenantId: TenantId;
      gmailMessageId: string;
      gmailThreadId: string;
    };
  };
  'portal/upload.created': {
    data: {
      tenantId: TenantId;
      clientId: ClientId;
      documentId: string;
      storageKey: string;
    };
  };
  /**
   * Triggered after a client (or preparer) successfully uploads a
   * document. Picked up by services/workers/functions/classify-document.ts
   * which fetches the bytes, sends to Haiku vision, updates the
   * documents row with the structured classification.
   */
  'document/uploaded': {
    data: {
      tenantId: TenantId;
      clientId: ClientId;
      documentId: string;
      storageKey: string;
      originalFilename: string;
      mimeType: string;
    };
  };
  'issue/created': {
    data: {
      tenantId: TenantId;
      issueId: string;
      type: string;
      severity: 'high' | 'medium' | 'low';
    };
  };
  'issue/resolved': {
    data: {
      tenantId: TenantId;
      issueId: string;
      resolvedByUserId: string;
    };
  };
};

export const inngest = new Inngest({
  id: 'docket',
  schemas: new EventSchemas().fromRecord<DocketEvents>(),
});

export type DocketInngestClient = typeof inngest;
