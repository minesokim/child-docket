// Memory Curator — extracts plain-English memories from client artifacts.
//
// Per CLAUDE.md §9 Memory Curator Agent: "Background job that
// extracts plain-English Memories from every inbound message,
// meeting transcript, doc parse, and intake answer → writes
// client_facts rows tagged kind='memory'. Drives the Memories
// tab UI (§4). Locked 2026-05-13 after Slant.app research; their
// 'Memories' surface is the strongest single steal from their
// product. Ships Phase 5."
//
// Updated 2026-05-13: refactored to write client_memories table
// (migration 0032) rather than reusing client_facts. Separate
// table; cleaner semantics for unstructured prose vs structured
// year-supersession facts.
//
// V0 STATUS (this file): Agent spec + input/output types +
// orchestrator-callable shell. The actual Haiku/Sonnet extraction
// prompt + Inngest hookup ship in C20+ when we wire to message +
// meeting transcript sources.
//
// Model tier: Haiku 4.5 (cost discipline — most memories are
// short factual extractions; doesn't need Sonnet reasoning).

import { z } from 'zod';
import type { TenantId, ClientId } from '@docket/shared';

// ────────────────────────────────────────────────────────────────
// Input schema — the artifact we're extracting memories from.
// ────────────────────────────────────────────────────────────────

export type MemoryCuratorSource =
  | {
      kind: 'message';
      messageId: string;
      direction: 'inbound' | 'outbound';
      bodyText: string;
      receivedAt: string;
    }
  | {
      kind: 'meeting_transcript';
      transcriptId: string;
      transcriptText: string;
      meetingDate: string;
      attendees: string[];
    }
  | {
      kind: 'intake_response';
      intakeId: string;
      stepKey: string;
      questionLabel: string;
      answerText: string;
    }
  | {
      kind: 'document_parse';
      documentId: string;
      documentKind: string;
      parsedText: string;
    };

export type MemoryCuratorContext = {
  tenantId: TenantId;
  clientId: ClientId;
  /** Optional list of existing memory texts to avoid re-extracting. */
  existingMemories?: string[];
};

// ────────────────────────────────────────────────────────────────
// Output schema — what we expect back from the model.
// ────────────────────────────────────────────────────────────────

export const ExtractedMemorySchema = z.object({
  /** Plain English, ≤500 chars enforced at app-layer. */
  text: z.string().min(5).max(500),
  /**
   * Confidence the memory is accurate and useful.
   * Below 0.6 = not surfaced; logged but not written.
   */
  confidence: z.number().min(0).max(1),
  /** Why this memory is worth remembering (audit trail). */
  rationale: z.string().min(5),
  /** Categorization tag for downstream filtering. */
  category: z.enum([
    'family',
    'business',
    'finance',
    'preference',
    'compliance',
    'position_history',
    'risk_signal',
    'other',
  ]),
});

export const MemoryCuratorOutputSchema = z.object({
  memories: z.array(ExtractedMemorySchema).default([]),
  /** Why the curator found nothing (empty memories array). */
  noExtractionReason: z.string().optional(),
});

export type ExtractedMemory = z.infer<typeof ExtractedMemorySchema>;
export type MemoryCuratorOutput = z.infer<typeof MemoryCuratorOutputSchema>;

// ────────────────────────────────────────────────────────────────
// Confidence floor — memories below this confidence are NOT
// written to client_memories. Per Slant's "minimize fields,
// maximize Memories" principle, we'd rather have fewer high-
// quality memories than many low-confidence ones.
// ────────────────────────────────────────────────────────────────
export const MEMORY_CONFIDENCE_FLOOR = 0.6;

/**
 * Filter raw extractions through the confidence floor + dedup
 * against existing memories. Caller writes the surviving memories
 * to client_memories via direct SQL (this module doesn't do DB writes).
 */
export function filterExtractedMemories(
  extracted: ExtractedMemory[],
  existing: string[],
): ExtractedMemory[] {
  const existingLower = new Set(existing.map((s) => s.toLowerCase().trim()));
  return extracted.filter((m) => {
    if (m.confidence < MEMORY_CONFIDENCE_FLOOR) return false;
    if (existingLower.has(m.text.toLowerCase().trim())) return false;
    return true;
  });
}

/**
 * Map the source.kind to the source_kind enum on client_memories.
 */
export function memorySourceKind(
  source: MemoryCuratorSource,
): 'message' | 'meeting_transcript' | 'intake_response' | 'document_parse' {
  return source.kind;
}

/**
 * Get the source_ref string (for the client_memories.source_ref
 * column) corresponding to a source. Polymorphic; caller
 * interprets via source_kind.
 */
export function memorySourceRef(source: MemoryCuratorSource): string {
  switch (source.kind) {
    case 'message':
      return source.messageId;
    case 'meeting_transcript':
      return source.transcriptId;
    case 'intake_response':
      return source.intakeId;
    case 'document_parse':
      return source.documentId;
  }
}

// ────────────────────────────────────────────────────────────────
// Agent placeholder.
//
// The actual extraction call lives here once we wire it (C20+).
// Shape mirrors triage-classifier + discovery-agent:
//   - Pull prompt from @docket/prompts registry
//   - Call runDocketAgent with Haiku 4.5 + cached system prompt
//   - Parse JSON output through MemoryCuratorOutputSchema
//   - Filter through MEMORY_CONFIDENCE_FLOOR + existing-memory dedup
//   - Return filtered + tagged memories for caller to persist
// ────────────────────────────────────────────────────────────────

export interface CurateMemoriesArgs {
  source: MemoryCuratorSource;
  context: MemoryCuratorContext;
}

export interface CurateMemoriesResult {
  ok: boolean;
  memories: ExtractedMemory[];
  reason?: string;
  costUsd?: number;
  latencyMs?: number;
}

/**
 * Curate memories from a single source artifact for a single client.
 *
 * V0 STUB: returns empty result + reason='not-yet-implemented'.
 * Wire actual extraction in C20+ once Inngest function + prompt
 * template land.
 *
 * Test harness for the schema types is the contract here — the
 * real implementation will satisfy the same signature.
 */
export async function curateMemories(
  args: CurateMemoriesArgs,
): Promise<CurateMemoriesResult> {
  const { source, context } = args;
  // Stub: confirm types are wired correctly, return empty result.
  // Marks the call as observable so we can verify the function
  // wiring before flipping to live extraction.
  void source;
  void context;

  return {
    ok: true,
    memories: [],
    reason:
      'memory-curator-stub: extraction not yet implemented; see C20+ for live wiring',
    costUsd: 0,
    latencyMs: 0,
  };
}
