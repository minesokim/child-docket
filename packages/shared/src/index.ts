export type TenantId = string & { readonly __brand: 'TenantId' };
export type ClientId = string & { readonly __brand: 'ClientId' };
export type UserId = string & { readonly __brand: 'UserId' };
export type AgentId =
  | 'morning-brief'
  | 'inbox-drafter'
  | 'document-triage'
  | 'olt-prep-handoff'
  | 'notice-triage';

export type TrustLevel = 1 | 2 | 3 | 4;

export type ActionClass =
  | 'read'
  | 'draft'
  | 'send-internal'
  | 'send-external'
  | 'mutate-tax-software'
  | 'file';

export type ActionLogEntry = {
  id: string;
  tenantId: TenantId;
  clientId: ClientId | null;
  userId: UserId | null;
  agentId: AgentId | null;
  actionClass: ActionClass;
  toolName: string;
  toolInput: unknown;
  toolOutput: unknown;
  modelUsed: 'haiku-4-5' | 'sonnet-4-6' | 'opus-4-7' | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cachedTokens: number | null;
  costUsd: number | null;
  latencyMs: number;
  success: boolean;
  errorMessage: string | null;
  createdAt: Date;
};
