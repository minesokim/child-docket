// @docket/skills registry tests.
//
// V0 registry ships empty (first real Skill lands separately as C36).
// These tests cover:
//   - computeSkillHash determinism
//   - hash drift detection (changes invalidate)
//   - getSkill on unknown id throws with helpful message
//   - listSkills / listSkillMetadata / searchSkillMetadata / listSkillsByCategory
//     handle the empty registry gracefully
//   - public exports surface the expected names

import { describe, expect, test } from 'bun:test';
import {
  computeSkillHash,
  getSkill,
  listSkillMetadata,
  listSkills,
  listSkillsByCategory,
  parseSkillMd,
  searchSkillMetadata,
  SkillMdParseError,
  verifySkillsRegistry,
} from '../src/index.js';

// Test helper: options-object hash with sensible defaults so tests stay terse.
const H = (overrides: Partial<{
  id: string;
  version: string;
  name: string;
  description: string;
  instructions: string;
  category: string;
  connectors: ReadonlyArray<{ name: string; uses?: string[] }>;
}> = {}) =>
  computeSkillHash({
    id: 'test-id',
    version: '1.0.0',
    name: 'name',
    description: 'desc',
    instructions: 'body',
    category: 'workflow',
    connectors: [],
    ...overrides,
  });

describe('computeSkillHash', () => {
  test('is deterministic for same inputs', async () => {
    const a = await H();
    const b = await H();
    expect(a).toBe(b);
  });

  test('differs when any hashed field changes', async () => {
    const base = await H();
    expect(await H({ id: 'other-id' })).not.toBe(base);
    expect(await H({ version: '1.0.1' })).not.toBe(base);
    expect(await H({ name: 'other-name' })).not.toBe(base);
    expect(await H({ description: 'other-desc' })).not.toBe(base);
    expect(await H({ instructions: 'other-body' })).not.toBe(base);
    expect(await H({ category: 'reconciliation' })).not.toBe(base);
  });

  test('produces 64-char hex (sha256 length)', async () => {
    const h = await H();
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  test('field separators prevent concatenation collisions', async () => {
    // 'ab' + 'cd' should NOT hash the same as 'abcd' + ''.
    const a = await H({ name: 'ab', description: 'cd' });
    const b = await H({ name: 'abcd', description: '' });
    expect(a).not.toBe(b);
  });

  test('connectors included in hash (codex r1 P2 C29)', async () => {
    const base = await H();
    const withConn = await H({ connectors: [{ name: 'ledger' }] });
    const withTwo = await H({
      connectors: [{ name: 'ledger' }, { name: 'quickbooks' }],
    });
    const withUses = await H({
      connectors: [{ name: 'ledger', uses: ['query_actions'] }],
    });
    expect(withConn).not.toBe(base);
    expect(withTwo).not.toBe(withConn);
    expect(withUses).not.toBe(withConn);
  });

  test('connectors order does not affect hash (canonical serialization)', async () => {
    const order1 = await H({
      connectors: [{ name: 'ledger' }, { name: 'quickbooks' }],
    });
    const order2 = await H({
      connectors: [{ name: 'quickbooks' }, { name: 'ledger' }],
    });
    expect(order1).toBe(order2);
  });

  test('uses[] order within a connector does not affect hash', async () => {
    const u1 = await H({
      connectors: [{ name: 'ledger', uses: ['a', 'b', 'c'] }],
    });
    const u2 = await H({
      connectors: [{ name: 'ledger', uses: ['c', 'a', 'b'] }],
    });
    expect(u1).toBe(u2);
  });
});

describe('registry lookup', () => {
  test('getSkill throws on unknown id with helpful list', async () => {
    await expect(getSkill('nonexistent')).rejects.toThrow(/unknown skill id/);
  });

  test('getSkill error message includes empty-registry hint when no skills registered', async () => {
    // The v0 registry is empty; this verifies the friendly fallback text.
    await expect(getSkill('whatever')).rejects.toThrow(/none registered yet/);
  });

  test('listSkills returns empty array for v0', () => {
    expect(listSkills()).toEqual([]);
  });

  test('listSkillMetadata returns empty array for v0', () => {
    expect(listSkillMetadata()).toEqual([]);
  });

  test('searchSkillMetadata with empty query returns full (empty) list', () => {
    expect(searchSkillMetadata('')).toEqual([]);
  });

  test('searchSkillMetadata with any query returns empty on empty registry', () => {
    expect(searchSkillMetadata('reconciliation')).toEqual([]);
  });

  test('listSkillsByCategory returns empty for any category in v0', () => {
    expect(listSkillsByCategory('tax-position')).toEqual([]);
  });

  test('verifySkillsRegistry returns 0 on empty registry', async () => {
    const count = await verifySkillsRegistry();
    expect(count).toBe(0);
  });
});

describe('public exports', () => {
  test('parseSkillMd is re-exported from package root', () => {
    expect(typeof parseSkillMd).toBe('function');
  });

  test('SkillMdParseError is re-exported from package root', () => {
    expect(typeof SkillMdParseError).toBe('function');
  });
});
