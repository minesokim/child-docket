// Public API of @docket/workers — Inngest functions registered here are
// served via the Next.js route handler at apps/command-room/src/app/api/inngest/route.ts.

export { inngest } from './inngest-client.js';
export { gmailPoll } from './functions/gmail-poll.js';
export { classifyGmailMessage } from './functions/classify-gmail-message.js';
export { classifyDocumentFn } from './functions/classify-document.js';
export { classifyNoticeFn } from './functions/classify-notice.js';
export { finalizeDocumentFn } from './functions/finalize-document.js';
export { verifyActionsChain } from './functions/verify-actions-chain.js';
export { costRunawayAlert } from './functions/cost-runaway-alert.js';

// Re-export the agent factories for direct invocation in tests / scripts.
export { classifySignal } from './agents/triage-classifier.js';
export type {
  ClassifierSignal,
  ClassifierContext,
  ClassifierOutput,
} from './agents/triage-classifier.js';

export { draftReply, isClientFacingIssue } from './agents/inbox-drafter.js';
export type {
  DrafterInput,
  DrafterContext,
  DraftOutput,
} from './agents/inbox-drafter.js';

export { classifyDocument, DOC_KINDS } from './agents/doc-classifier.js';
export type {
  DocKind,
  DocClassifierOutput,
  ClassifyDocumentOptions,
} from './agents/doc-classifier.js';

export {
  runDiscovery,
  DiscoveryAgentNotEnabledError,
  TaxPositionSchema,
  DiscoveryOutputSchema,
  CitationSchema,
} from './agents/discovery-agent.js';
export type {
  DiscoveryContext,
  DiscoveryInput,
  DiscoveryOutput,
  DiscoveryTrustGate,
  TaxPosition,
  Citation,
  DiscoverOptions,
} from './agents/discovery-agent.js';

export { triageNotice, NoticeTriageSchema } from './agents/notice-triage.js';
export type {
  NoticeTriageOutput,
  TriageNoticeInput,
  NoticeIssuingAuthority,
  NoticeSeverity,
  NoticeResponseTemplate,
} from './agents/notice-triage.js';

export { draftNoticeResponse, NoticeDraftSchema } from './agents/notice-drafter.js';
export type {
  NoticeDraftOutput,
  DraftNoticeResponseInput,
} from './agents/notice-drafter.js';

// Function array for Inngest serve() handler — Next.js route uses this.
import { gmailPoll } from './functions/gmail-poll.js';
import { classifyGmailMessage } from './functions/classify-gmail-message.js';
import { classifyDocumentFn } from './functions/classify-document.js';
import { classifyNoticeFn } from './functions/classify-notice.js';
import { finalizeDocumentFn } from './functions/finalize-document.js';
import { verifyActionsChain } from './functions/verify-actions-chain.js';
import { costRunawayAlert } from './functions/cost-runaway-alert.js';
export const functions = [
  gmailPoll,
  classifyGmailMessage,
  classifyDocumentFn,
  classifyNoticeFn,
  finalizeDocumentFn,
  verifyActionsChain,
  costRunawayAlert,
];
