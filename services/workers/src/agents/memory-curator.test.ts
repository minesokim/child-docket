// memory-curator schema + helpers tests.

import { describe, expect, it } from 'bun:test';
import {
  ExtractedMemorySchema,
  MemoryCuratorOutputSchema,
  MEMORY_CONFIDENCE_FLOOR,
  filterExtractedMemories,
  memorySourceKind,
  memorySourceRef,
  curateMemories,
  type ExtractedMemory,
  type MemoryCuratorSource,
} from './memory-curator.js';
import type { TenantId, ClientId } from '@docket/shared';

describe('ExtractedMemorySchema', () => {
  it('accepts a well-formed memory', () => {
    const result = ExtractedMemorySchema.safeParse({
      text: 'Daughter Lily starts UC Davis Aug 2026 (AOTC + 529 windowing)',
      confidence: 0.95,
      rationale: 'Client mentioned in last message',
      category: 'family',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty text', () => {
    const result = ExtractedMemorySchema.safeParse({
      text: '',
      confidence: 0.95,
      rationale: 'valid rationale',
      category: 'family',
    });
    expect(result.success).toBe(false);
  });

  it('rejects text over 500 chars', () => {
    const result = ExtractedMemorySchema.safeParse({
      text: 'a'.repeat(501),
      confidence: 0.95,
      rationale: 'long memory',
      category: 'family',
    });
    expect(result.success).toBe(false);
  });

  it('rejects confidence > 1', () => {
    const result = ExtractedMemorySchema.safeParse({
      text: 'valid memory',
      confidence: 1.5,
      rationale: 'valid rationale',
      category: 'family',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown category', () => {
    const result = ExtractedMemorySchema.safeParse({
      text: 'valid memory',
      confidence: 0.9,
      rationale: 'valid rationale',
      category: 'unknown',
    });
    expect(result.success).toBe(false);
  });

  it('accepts all 8 valid categories', () => {
    const categories = [
      'family',
      'business',
      'finance',
      'preference',
      'compliance',
      'position_history',
      'risk_signal',
      'other',
    ] as const;
    for (const category of categories) {
      const result = ExtractedMemorySchema.safeParse({
        text: 'valid memory text',
        confidence: 0.8,
        rationale: 'rationale text',
        category,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe('MemoryCuratorOutputSchema', () => {
  it('accepts a well-formed output with memories', () => {
    const result = MemoryCuratorOutputSchema.safeParse({
      memories: [
        {
          text: 'memory 1',
          confidence: 0.9,
          rationale: 'because',
          category: 'family',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts an output with no memories + reason', () => {
    const result = MemoryCuratorOutputSchema.safeParse({
      memories: [],
      noExtractionReason: 'transcript was too short to extract',
    });
    expect(result.success).toBe(true);
  });

  it('defaults memories to empty array', () => {
    const result = MemoryCuratorOutputSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.memories).toEqual([]);
    }
  });
});

describe('filterExtractedMemories', () => {
  const goodMemory: ExtractedMemory = {
    text: 'Daughter starts college Aug 2026',
    confidence: 0.95,
    rationale: 'mentioned in last meeting',
    category: 'family',
  };

  const lowConfMemory: ExtractedMemory = {
    text: 'might be a freelancer maybe',
    confidence: 0.4, // below floor
    rationale: 'unclear from message',
    category: 'business',
  };

  it('filters out below-floor confidence', () => {
    const result = filterExtractedMemories([goodMemory, lowConfMemory], []);
    expect(result.length).toBe(1);
    expect(result[0]).toBe(goodMemory);
  });

  it('filters out duplicates against existing memories (case-insensitive)', () => {
    const result = filterExtractedMemories(
      [goodMemory],
      ['DAUGHTER STARTS COLLEGE Aug 2026'],
    );
    expect(result.length).toBe(0);
  });

  it('preserves non-duplicate memories', () => {
    const result = filterExtractedMemories(
      [goodMemory],
      ['unrelated existing memory'],
    );
    expect(result.length).toBe(1);
  });

  it('returns empty when input is empty', () => {
    expect(filterExtractedMemories([], [])).toEqual([]);
    expect(filterExtractedMemories([], ['something'])).toEqual([]);
  });

  it('respects MEMORY_CONFIDENCE_FLOOR exact boundary', () => {
    const boundary: ExtractedMemory = {
      text: 'borderline memory',
      confidence: MEMORY_CONFIDENCE_FLOOR,
      rationale: 'valid rationale',
      category: 'other',
    };
    const result = filterExtractedMemories([boundary], []);
    expect(result.length).toBe(1);
  });
});

describe('memorySourceKind', () => {
  it('returns kind for each source type', () => {
    expect(
      memorySourceKind({
        kind: 'message',
        messageId: 'm1',
        direction: 'inbound',
        bodyText: 'x',
        receivedAt: '2026-05-13',
      }),
    ).toBe('message');

    expect(
      memorySourceKind({
        kind: 'meeting_transcript',
        transcriptId: 't1',
        transcriptText: 'x',
        meetingDate: '2026-05-13',
        attendees: [],
      }),
    ).toBe('meeting_transcript');

    expect(
      memorySourceKind({
        kind: 'intake_response',
        intakeId: 'i1',
        stepKey: 'personal',
        questionLabel: 'q',
        answerText: 'a',
      }),
    ).toBe('intake_response');

    expect(
      memorySourceKind({
        kind: 'document_parse',
        documentId: 'd1',
        documentKind: 'w2',
        parsedText: 'x',
      }),
    ).toBe('document_parse');
  });
});

describe('memorySourceRef', () => {
  it('returns the correct id field per source kind', () => {
    expect(
      memorySourceRef({
        kind: 'message',
        messageId: 'm1',
        direction: 'inbound',
        bodyText: 'x',
        receivedAt: '2026-05-13',
      }),
    ).toBe('m1');

    expect(
      memorySourceRef({
        kind: 'meeting_transcript',
        transcriptId: 't2',
        transcriptText: 'x',
        meetingDate: '2026-05-13',
        attendees: [],
      }),
    ).toBe('t2');
  });
});

describe('curateMemories (stub)', () => {
  it('returns ok + empty result with stub reason', async () => {
    const result = await curateMemories({
      source: {
        kind: 'message',
        messageId: 'm1',
        direction: 'inbound',
        bodyText: 'x',
        receivedAt: '2026-05-13',
      },
      context: {
        tenantId: 'tenant-1' as TenantId,
        clientId: 'client-1' as ClientId,
      },
    });
    expect(result.ok).toBe(true);
    expect(result.memories).toEqual([]);
    expect(result.reason).toContain('memory-curator-stub');
    expect(result.costUsd).toBe(0);
  });
});
