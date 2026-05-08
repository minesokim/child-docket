import { describe, expect, test } from 'bun:test';
import { computePromptHash, getPrompt, listPrompts } from './index.js';
import { triageClassifier } from './triage-classifier.js';
import { inboxDrafter } from './inbox-drafter.js';
import { docClassifier } from './doc-classifier.js';
import { discoveryAgent } from './discovery-agent.js';

describe('@docket/prompts / registry', () => {
  test('lists every registered prompt', () => {
    const prompts = listPrompts();
    const ids = prompts.map((p) => p.id).sort();
    expect(ids).toEqual([
      'discovery-agent',
      'doc-classifier',
      'inbox-drafter',
      'triage-classifier',
    ]);
  });

  test('listPrompts returns id + version + model only', () => {
    for (const p of listPrompts()) {
      expect(typeof p.id).toBe('string');
      expect(typeof p.version).toBe('string');
      expect(typeof p.model).toBe('string');
    }
  });
});

describe('@docket/prompts / getPrompt', () => {
  test('returns the registered triage-classifier', async () => {
    const p = await getPrompt('triage-classifier');
    expect(p.id).toBe('triage-classifier');
    expect(p.version).toBe('1.0.0');
    expect(p.model).toBe('haiku-4-5');
    expect(p.template.startsWith('You are the Triage Classifier')).toBe(true);
  });

  test('returns the registered inbox-drafter', async () => {
    const p = await getPrompt('inbox-drafter');
    expect(p.id).toBe('inbox-drafter');
    expect(p.version).toBe('1.0.0');
    expect(p.model).toBe('sonnet-4-6');
    expect(p.template.startsWith('You are the Inbox Drafter')).toBe(true);
  });

  test('returns the registered doc-classifier', async () => {
    const p = await getPrompt('doc-classifier');
    expect(p.id).toBe('doc-classifier');
    expect(p.version).toBe('1.0.0');
    expect(p.model).toBe('haiku-4-5');
    expect(p.template.startsWith('You are the Document Classifier')).toBe(true);
  });

  test('throws on unknown id with helpful message', async () => {
    await expect(getPrompt('nonexistent-agent')).rejects.toThrow(
      /unknown prompt id "nonexistent-agent"\. Known: discovery-agent, doc-classifier, inbox-drafter, triage-classifier/,
    );
  });
});

describe('@docket/prompts / hash verification', () => {
  test('triage-classifier stored hash matches recomputed hash', async () => {
    const recomputed = await computePromptHash(
      triageClassifier.version,
      triageClassifier.template,
    );
    expect(triageClassifier.hash).toBe(recomputed);
  });

  test('inbox-drafter stored hash matches recomputed hash', async () => {
    const recomputed = await computePromptHash(
      inboxDrafter.version,
      inboxDrafter.template,
    );
    expect(inboxDrafter.hash).toBe(recomputed);
  });

  test('doc-classifier stored hash matches recomputed hash', async () => {
    const recomputed = await computePromptHash(
      docClassifier.version,
      docClassifier.template,
    );
    expect(docClassifier.hash).toBe(recomputed);
  });

  test('discovery-agent stored hash matches recomputed hash', async () => {
    const recomputed = await computePromptHash(
      discoveryAgent.version,
      discoveryAgent.template,
    );
    expect(discoveryAgent.hash).toBe(recomputed);
  });

  test('hash is sha256 hex (64 chars)', () => {
    expect(triageClassifier.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(inboxDrafter.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(docClassifier.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(discoveryAgent.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test('hash changes when template changes', async () => {
    const h1 = await computePromptHash('1.0.0', 'hello world');
    const h2 = await computePromptHash('1.0.0', 'hello WORLD');
    expect(h1).not.toBe(h2);
  });

  test('hash changes when version bumps', async () => {
    const h1 = await computePromptHash('1.0.0', 'same body');
    const h2 = await computePromptHash('1.0.1', 'same body');
    expect(h1).not.toBe(h2);
  });

  test('hash is stable for same inputs (deterministic)', async () => {
    const t = 'A test prompt body';
    const h1 = await computePromptHash('1.0.0', t);
    const h2 = await computePromptHash('1.0.0', t);
    expect(h1).toBe(h2);
  });
});
