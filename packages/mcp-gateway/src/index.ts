// @docket/mcp-gateway — multi-tenant routing layer for MCP-shaped connectors.
//
// See ./gateway.ts for the McpGateway class + usage example.
// See ./types.ts for the connector contract.
// See docs/AGENT-PLATFORM.md for the full architecture context.

export { McpGateway } from './gateway.js';
export type {
  CredentialResolver,
  McpGatewayOptions,
  TrustLevelResolver,
} from './gateway.js';
export type {
  CallToolOptions,
  ConnectorDefinition,
  ReadResourceOptions,
  ResourceContent,
  ResourceDefinition,
  ResourceErrorCode,
  ResourceResult,
  ToolContext,
  ToolDefinition,
  ToolErrorCode,
  ToolResult,
} from './types.js';
