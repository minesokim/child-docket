// Re-export of the shared Inngest client + event types.
//
// The actual definitions live in @docket/shared/inngest-client so apps
// that only SEND events (client-portal) can import without dragging in
// workers' transitive deps (sharp, pdf-lib). Workers re-export from
// here so internal imports inside services/workers don't churn.

export { inngest } from '@docket/shared';
export type { DocketInngestClient } from '@docket/shared';
