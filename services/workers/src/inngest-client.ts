// Re-export of the shared Inngest client + event types.
//
// The actual definitions live in @docket/shared/inngest (subpath
// export — NOT the main barrel, because `inngest` internally pulls
// in `node:async_hooks` which breaks browser bundles). Workers
// re-export from here so internal imports inside services/workers
// don't churn.

export { inngest } from '@docket/shared/inngest';
export type { DocketInngestClient } from '@docket/shared/inngest';
