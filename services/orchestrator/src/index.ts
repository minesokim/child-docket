// Orchestrator entry. v0: just exports the docket-agent factory.
export { runDocketAgent } from './docket-agent.js';
export type { DocketAgentOptions, DocketAgentResult } from './docket-agent.js';

// Vision-enabled variant for image / PDF inputs. Used by the doc
// classification worker.
export { runVisionAgent } from './vision-agent.js';
export type {
  VisionAgentOptions,
  VisionAgentResult,
  VisionImageInput,
} from './vision-agent.js';
