import { describe, expect, it } from 'bun:test';
import {
  isReasoningTrail,
  truncateTrail,
  type ReasoningStep,
} from './reasoning-trail.js';

describe('isReasoningTrail', () => {
  it('accepts a well-formed trail', () => {
    const trail: ReasoningStep[] = [
      { kind: 'fact_query', label: 'Loaded client facts', detail: '12 rows' },
      { kind: 'authority_lookup', label: 'Found §280A(g)' },
      { kind: 'decision', label: 'Classified Tier 2' },
    ];
    expect(isReasoningTrail(trail)).toBe(true);
  });

  it('accepts an empty array', () => {
    expect(isReasoningTrail([])).toBe(true);
  });

  it('rejects non-arrays', () => {
    expect(isReasoningTrail(null)).toBe(false);
    expect(isReasoningTrail(undefined)).toBe(false);
    expect(isReasoningTrail({})).toBe(false);
    expect(isReasoningTrail('string')).toBe(false);
    expect(isReasoningTrail(42)).toBe(false);
  });

  it('rejects steps with missing kind', () => {
    expect(isReasoningTrail([{ label: 'no kind' }])).toBe(false);
  });

  it('rejects steps with invalid kind', () => {
    expect(isReasoningTrail([{ kind: 'invalid', label: 'x' }])).toBe(false);
  });

  it('rejects steps with empty label', () => {
    expect(isReasoningTrail([{ kind: 'decision', label: '' }])).toBe(false);
  });

  it('rejects steps with overlong label (>80 chars)', () => {
    const long = 'a'.repeat(81);
    expect(isReasoningTrail([{ kind: 'decision', label: long }])).toBe(false);
  });

  it('accepts step with label exactly 80 chars', () => {
    const long = 'a'.repeat(80);
    expect(isReasoningTrail([{ kind: 'decision', label: long }])).toBe(true);
  });

  it('rejects steps with overlong detail (>500 chars)', () => {
    const long = 'a'.repeat(501);
    expect(
      isReasoningTrail([{ kind: 'decision', label: 'x', detail: long }]),
    ).toBe(false);
  });

  it('accepts step without detail', () => {
    expect(isReasoningTrail([{ kind: 'decision', label: 'x' }])).toBe(true);
  });

  it('rejects non-string detail', () => {
    expect(
      isReasoningTrail([{ kind: 'decision', label: 'x', detail: 42 }]),
    ).toBe(false);
  });

  it('accepts all five kinds', () => {
    const allKinds: ReasoningStep[] = [
      { kind: 'fact_query', label: 'a' },
      { kind: 'authority_lookup', label: 'b' },
      { kind: 'decision', label: 'c' },
      { kind: 'consideration', label: 'd' },
      { kind: 'discard', label: 'e' },
    ];
    expect(isReasoningTrail(allKinds)).toBe(true);
  });
});

describe('truncateTrail', () => {
  const trail: ReasoningStep[] = [
    { kind: 'fact_query', label: 's1' },
    { kind: 'fact_query', label: 's2' },
    { kind: 'fact_query', label: 's3' },
    { kind: 'fact_query', label: 's4' },
    { kind: 'fact_query', label: 's5' },
    { kind: 'decision', label: 's6' },
  ];

  it('returns the trail unchanged when shorter than max', () => {
    const result = truncateTrail(trail, 10);
    expect(result).toBe(trail);
    expect(result.length).toBe(6);
  });

  it('returns the trail unchanged when exactly max', () => {
    const result = truncateTrail(trail, 6);
    expect(result.length).toBe(6);
  });

  it('truncates and appends a summary step when over max', () => {
    const result = truncateTrail(trail, 4);
    expect(result.length).toBe(4);
    expect(result[3]!.kind).toBe('consideration');
    expect(result[3]!.label).toMatch(/3 more reasoning steps/);
  });

  it('summary step references the correct overflow count', () => {
    const result = truncateTrail(trail, 2);
    expect(result.length).toBe(2);
    expect(result[1]!.label).toMatch(/5 more reasoning steps/);
  });

  it('preserves original step ordering up to the truncation point', () => {
    const result = truncateTrail(trail, 4);
    expect(result[0]!.label).toBe('s1');
    expect(result[1]!.label).toBe('s2');
    expect(result[2]!.label).toBe('s3');
  });
});
