// @docket/prompts — versioned registry of agent system prompts.
//
// Per docs/PRODUCTION-READINESS.md §B (V1) and docs/MEMORY-ARCHITECTURE.md §3.
//
// WHY THIS PACKAGE EXISTS
//   System prompts are load-bearing for every agent. When inlined as
//   TS template literals, they're hard to diff, version, or A/B test;
//   their changes get lost in unrelated code commits. Externalizing
//   them into named, versioned modules gives:
//     - Clean PR diffs when a prompt changes
//     - Stable identifiers for cost telemetry (per-prompt cost tracking)
//     - Hash-based invalidation hooks for prompt cache markers
//     - Eventual non-engineer editability (when migrated to MD source
//       with build-time codegen, post-v1)
//
// SHAPE
//   Each prompt is a module under src/ that exports a Prompt object:
//     - id            stable name ('triage-classifier', 'inbox-drafter', ...)
//     - version       semver string; bump on any content change
//     - model         intended modelTier ('haiku-4-5' | 'sonnet-4-6')
//     - template      the prompt text
//     - hash          sha256(version + template) — verified at load time
//     - lastEdited    ISO date string for human reference
//
//   The registry (PROMPTS map) is built once at module load. getPrompt(name)
//   returns the typed Prompt or throws with a helpful error listing
//   available names.
//
// HASH VERIFICATION
//   Each Prompt object stores its expected hash. If a template is edited
//   without bumping the version, the recomputed hash diverges from the
//   stored value and getPrompt throws. This is the safety net against
//   "edit string, forget to bump version" mistakes that would otherwise
//   silently invalidate the prompt cache.
//
//   Recomputation uses Web Crypto SHA-256. Same algorithm everywhere
//   (Node 18+, Bun, Edge runtime, browsers).
//
// ANTI-PATTERN PREVENTED
//   The "edit prompt, ship to prod, forget to bump version, prompt cache
//   serves stale tokens for 5 min until the next deploy" scenario. Hash
//   drift detection makes this a load-time error, not a 5-minute mystery.

import { triageClassifier } from './triage-classifier.js';
import { inboxDrafter } from './inbox-drafter.js';
import { docClassifier } from './doc-classifier.js';

export type PromptModel = 'haiku-4-5' | 'sonnet-4-6' | 'opus-4-7';

export interface Prompt {
  /** Stable identifier. Used for cost telemetry + cache key derivation. */
  id: string;
  /** Semver. Bump on any content change. */
  version: string;
  /** Intended model tier. Agents may override but the registered value is the default. */
  model: PromptModel;
  /** The prompt text. */
  template: string;
  /** sha256(version + '|' + template), hex-encoded, verified at getPrompt time. */
  hash: string;
  /** ISO date string (YYYY-MM-DD). Human reference, not security-load-bearing. */
  lastEdited: string;
}

/**
 * Compute the canonical hash for a prompt. Public so test fixtures can
 * pre-compute and so updateBuildScript can suggest the right hash on
 * a version bump.
 *
 * Uses Web Crypto's SHA-256, available in Node 18+, Bun, edge runtimes,
 * and modern browsers.
 */
export async function computePromptHash(version: string, template: string): Promise<string> {
  const data = new TextEncoder().encode(`${version}|${template}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const PROMPTS: ReadonlyArray<Prompt> = [triageClassifier, inboxDrafter, docClassifier];

const PROMPTS_BY_ID: ReadonlyMap<string, Prompt> = new Map(
  PROMPTS.map((p) => [p.id, p]),
);

/**
 * Look up a prompt by id. Throws if unknown OR if the stored hash
 * doesn't match the recomputed hash (template edited without version
 * bump).
 *
 * Hash verification is async (Web Crypto digest); call once at agent
 * startup and cache the result for the agent's lifetime.
 */
export async function getPrompt(id: string): Promise<Prompt> {
  const prompt = PROMPTS_BY_ID.get(id);
  if (!prompt) {
    const known = [...PROMPTS_BY_ID.keys()].sort().join(', ');
    throw new Error(
      `[@docket/prompts] unknown prompt id "${id}". Known: ${known}`,
    );
  }

  const recomputed = await computePromptHash(prompt.version, prompt.template);
  if (recomputed !== prompt.hash) {
    throw new Error(
      `[@docket/prompts] hash drift on "${id}": stored=${prompt.hash} recomputed=${recomputed}. ` +
        `Template was edited without a version bump. Bump version, then update hash to ${recomputed}.`,
    );
  }

  return prompt;
}

/** Test/admin helper: list every registered prompt's id + version + model. */
export function listPrompts(): ReadonlyArray<Pick<Prompt, 'id' | 'version' | 'model'>> {
  return PROMPTS.map(({ id, version, model }) => ({ id, version, model }));
}
