// Shared Inngest client + event-type definitions.
//
// Lives in @docket/shared (not @docket/workers) so apps that only
// SEND events — like the client-portal's confirmUpload + accept
// flows — can import the typed client without dragging in workers'
// transitive deps (sharp + pdf-lib + the Anthropic SDK).
//
// Workers REGISTER + SERVE functions via the same client; that's all
// in services/workers, and the Next.js Inngest route handler in
// apps/command-room/src/app/api/inngest/route.ts.

import { Inngest, EventSchemas } from 'inngest';

// Branded types are inlined here (rather than imported from ./index.js)
// to avoid the circular: index.ts → re-exports inngest-client.ts →
// imports types from index.ts. `import type` should erase at runtime
// but Vercel's Next.js bundler is finicky about resolving this for
// edge cases in module pre-bundling, so duplicating two type aliases
// is the cheapest fix.
type TenantId = string & { readonly __brand: 'TenantId' };
type ClientId = string & { readonly __brand: 'ClientId' };

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
  /**
   * Triggered after the user accepts the AI classification. Picked up
   * by finalize-document worker which:
   *   - fetches the original from R2
   *   - binarizes (Otsu threshold) for tax docs
   *   - wraps in a single-page PDF
   *   - renames per the suggested/edited filename
   *   - uploads to a NEW R2 key (final_storage_key)
   *   - updates documents row with final-side metadata
   */
  'document/accepted': {
    data: {
      tenantId: TenantId;
      clientId: ClientId;
      documentId: string;
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
