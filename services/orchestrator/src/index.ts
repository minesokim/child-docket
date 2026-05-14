// Orchestrator entry.
//
// Three public functions, two for single-shot completion, one for
// multi-turn tool-use:
//   - runDocketAgent           — single-shot prompt→completion (legacy + 5 existing agents)
//   - runVisionAgent           — single-shot with image/PDF inputs
//   - runDocketAgentWithTools  — multi-turn tool-use loop (C30; Wave 3 skills consume this)

export { runDocketAgent } from './docket-agent.js';
export type { DocketAgentOptions, DocketAgentResult } from './docket-agent.js';

export { runVisionAgent } from './vision-agent.js';
export type {
  VisionAgentOptions,
  VisionAgentResult,
  VisionImageInput,
} from './vision-agent.js';

export { runDocketAgentWithTools } from './agent-loop.js';
export type {
  AgentLoopIteration,
  AgentLoopStopReason,
  AgentLoopToolBinding,
  AgentLoopToolCall,
  RunDocketAgentWithToolsOptions,
  RunDocketAgentWithToolsResult,
} from './agent-loop.js';

// Re-export the normalized provider-layer types for callers that
// need to compose ToolDefinitions, Messages, or inspect StopReason.
export type {
  ContentBlock,
  Message,
  ModelTier,
  Provider,
  StopReason,
  ToolDefinition,
  ToolUse,
} from './providers.js';
