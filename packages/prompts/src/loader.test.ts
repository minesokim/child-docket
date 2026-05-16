import { describe, expect, test } from 'bun:test';
import { computePromptHash, getPrompt, listPrompts } from './index.js';
import { triageClassifier } from './triage-classifier.js';
import { inboxDrafter } from './inbox-drafter.js';
import { docClassifier } from './doc-classifier.js';
import { discoveryAgent } from './discovery-agent.js';
import { noticeTriage } from './notice-triage.js';
import { noticeDrafter } from './notice-drafter.js';

describe('@docket/prompts / registry', () => {
  test('lists every registered prompt', () => {
    const prompts = listPrompts();
    const ids = prompts.map((p) => p.id).sort();
    expect(ids).toEqual([
      'discovery-agent',
      'doc-classifier',
      'inbox-drafter',
      'notice-drafter',
      'notice-triage',
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
    // Version 1.1.0 bumped 2026-05-15: removed hardcoded "Antonio"
    // voice + signature defaults; replaced with context.preparerFullName
    // references (Session 8 multi-tenant audit).
    expect(p.version).toBe('1.1.0');
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
      /unknown prompt id "nonexistent-agent"\. Known: discovery-agent, doc-classifier, inbox-drafter, notice-drafter, notice-triage, triage-classifier/,
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

  test('notice-triage stored hash matches recomputed hash', async () => {
    const recomputed = await computePromptHash(
      noticeTriage.version,
      noticeTriage.template,
    );
    expect(noticeTriage.hash).toBe(recomputed);
  });

  test('notice-drafter stored hash matches recomputed hash', async () => {
    const recomputed = await computePromptHash(
      noticeDrafter.version,
      noticeDrafter.template,
    );
    expect(noticeDrafter.hash).toBe(recomputed);
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

// ────────────────────────────────────────────────────────────────
// Prompt content invariants (Session 8 audit, 2026-05-15).
//
// These tests assert SPECIFIC TEXT-LEVEL guarantees that compliance
// or multi-tenant correctness depend on. Each test guards a Tier 0
// finding from the prompt audit:
//
//   1. discovery-agent MUST instruct the model to flag Form 8867
//      on EITC/CTC/ACTC/AOTC/HOH positions per §6695(g). The
//      $580/failure strict-liability penalty falls on the preparer
//      regardless of whether the credit is allowed.
//   2. notice-drafter MUST NOT hardcode any specific preparer's
//      signature ("Antonio Vazquez, EA" was the original v0.1.0
//      bug). Tenant #2's notices would have been signed with
//      Antonio's name + implicit PTIN otherwise.
//   3. inbox-drafter MUST NOT hardcode "Antonio" / "Antonio Vazquez,
//      EA" as signature defaults. Same shape as #2.
//
// If any of these regress in a future edit, the corresponding test
// fails before the prompt cache + Sentry breadcrumb tell us in
// production.
// ────────────────────────────────────────────────────────────────

describe('@docket/prompts / content invariants (Session 8 audit)', () => {
  test('discovery-agent prompt mentions Form 8867 (§6695(g) due diligence)', () => {
    // The hard rule is keyed on "Form 8867" + the explicit
    // reference to §6695(g). Both must be present so a future edit
    // that drops one but not the other still fails.
    expect(discoveryAgent.template).toContain('Form 8867');
    expect(discoveryAgent.template).toContain('§6695(g)');
    // And the strict-liability $580/failure number.
    expect(discoveryAgent.template).toContain('$580');
    // And the canonical trigger list — EITC, CTC, ACTC, AOTC, HOH.
    for (const credit of ['EITC', 'CTC', 'ACTC', 'AOTC']) {
      expect(discoveryAgent.template).toContain(credit);
    }
  });

  test('notice-drafter prompt has no hardcoded preparer signature', () => {
    // The v0.1.0 bug: 'Antonio Vazquez, EA' appeared as a hard
    // signature instruction. v0.2.0 replaces it with explicit
    // guidance to read context.preparerFullName.
    expect(noticeDrafter.template).not.toMatch(
      /MUST read 'Antonio Vazquez/i,
    );
    expect(noticeDrafter.template).not.toContain(
      `'Antonio Vazquez, EA'`,
    );
    // And the FIX must mention context.preparerFullName so a future
    // edit that strips both the bug AND the fix still fails.
    expect(noticeDrafter.template).toContain('context.preparerFullName');
  });

  test('inbox-drafter prompt has no hardcoded preparer name as signature default', () => {
    // The v1.0.0 bug: '"Antonio" | "Antonio Vazquez, EA" | other'
    // appeared as the signature field example. v1.1.0 replaces
    // those defaults with context.preparerSignOff /
    // context.preparerFullName references.
    expect(inboxDrafter.template).not.toContain(
      `"Antonio" | "Antonio Vazquez, EA"`,
    );
    expect(inboxDrafter.template).toContain('context.preparerFullName');
    expect(inboxDrafter.template).toContain('context.preparerSignOff');
  });
});
