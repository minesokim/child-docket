// @docket/skills — registry of Docket-side Skills.
//
// Per docs/AGENT-PLATFORM.md §1.1 + §2.1 (Skills as the second
// load-bearing primitive, after MCP gateway). Mirrors @docket/prompts'
// pattern: each Skill is a TS module exporting a Skill object; the
// registry holds them in a Map keyed by id; getSkill verifies the
// hash before returning so an edit-without-version-bump becomes a
// load-time error.
//
// WHY THIS PACKAGE EXISTS
//   Skills are versioned, hash-protected, and surface-shareable. By
//   contrast with @docket/prompts (which captures system prompts for
//   long-running agents), Skills capture short-lived methods Claude
//   invokes when relevant — the analogs of Cowork's 15 SMB workflows.
//   They:
//     - Carry their own connector dependencies (substrate trace)
//     - Compose with @docket/mcp-gateway tools at runtime
//     - Surface in Magic Buttons UI (CLAUDE.md §4 + §9)
//     - Can be SKILL.md-file authored (parser.ts) OR TS-module authored
//
// SHAPE
//   Each Skill module under src/registry/ exports a Skill object:
//     - id            stable name ('tax-reconciliation', 'discovery', ...)
//     - version       semver; bump on any content change
//     - name          display name
//     - description   L1 disclosure summary
//     - instructions  L2 disclosure markdown body
//     - category      coarse routing hint
//     - connectors    declared connector dependencies
//     - hash          sha256(version + name + description + instructions)
//     - lastEdited    ISO date string
//
// V0 (C29) — ships the substrate. The first real Skill (C36
// tax-reconciliation) ships separately so the substrate-only commit
// stays clean. The registry is therefore empty in this commit but
// the loader + lookup machinery is wired.

import type { Skill, SkillConnectorRef, SkillMetadata } from './types.js';

export type {
  ParsedSkillMd,
  Skill,
  SkillCategory,
  SkillConnectorRef,
  SkillMetadata,
} from './types.js';
export { parseSkillMd, SkillMdParseError } from './parser.js';

/**
 * Compute the canonical hash for a Skill. Same shape as
 * @docket/prompts' computePromptHash: deterministic, Web-Crypto-based,
 * works in Node 18+, Bun, Edge, browsers.
 *
 * Composed from every field that affects routing or Claude's
 * response: id (drives lookup), version, name + description (L1
 * disclosure), instructions (L2 disclosure), category (drives
 * filtering + UI grouping), connectors (drives agent-loop pruning).
 * lastEdited is NOT hashed (cosmetic only).
 *
 * Codex round 3 P2 (C29): options-object form so every hashed field
 * is required by the type system. The earlier positional form
 * silently defaulted id + category to '', producing a hash that
 * getSkill / verifySkillsRegistry would later reject. With keyed
 * args, authors get a compile error if they omit a field.
 *
 * connectors serialization is canonical (sorted by name + sorted
 * uses[] alphabetically) so the hash is stable regardless of source-
 * file ordering.
 */
export interface ComputeSkillHashInput {
  id: string;
  version: string;
  name: string;
  description: string;
  instructions: string;
  category: string;
  connectors: ReadonlyArray<SkillConnectorRef>;
}

export async function computeSkillHash(
  input: ComputeSkillHashInput,
): Promise<string> {
  const connectorsCanonical = serializeConnectorsCanonical(input.connectors);
  const data = new TextEncoder().encode(
    `${input.id}|${input.version}|${input.name}|${input.description}|${input.instructions}|${input.category}|${connectorsCanonical}`,
  );
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function serializeConnectorsCanonical(
  connectors: ReadonlyArray<SkillConnectorRef>,
): string {
  // Sort by name; sort uses[] within each. Deterministic JSON-shape
  // so re-ordering at source has zero hash impact.
  const normalized = connectors
    .map((c) => ({
      name: c.name,
      uses: c.uses ? [...c.uses].sort() : undefined,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return JSON.stringify(normalized);
}

/**
 * Registry of all known Skills. v0 ships empty — the first real
 * Skill (C36 tax-reconciliation) lands separately.
 *
 * When adding a Skill:
 *   1. Create src/registry/{skill-id}.ts that exports `default` as Skill
 *   2. Import + add to SKILLS below
 *   3. The hash gets recomputed at first load; if missing/wrong,
 *      getSkill throws with the correct value to paste in.
 */
const SKILLS: ReadonlyArray<Skill> = [];

const SKILLS_BY_ID: ReadonlyMap<string, Skill> = (() => {
  const map = new Map<string, Skill>();
  for (const skill of SKILLS) {
    if (map.has(skill.id)) {
      // Throws at module load — prevents shipping a registry with a
      // dup id silently.
      throw new Error(
        `[@docket/skills] duplicate skill id "${skill.id}" in registry.`,
      );
    }
    map.set(skill.id, skill);
  }
  return map;
})();

/**
 * Look up a Skill by id. Throws if unknown OR if the stored hash
 * doesn't match the recomputed hash (instructions/name/description
 * edited without a version bump).
 *
 * Hash verification is async (Web Crypto digest); cache the result
 * at agent startup for the agent's lifetime.
 */
export async function getSkill(id: string): Promise<Skill> {
  const skill = SKILLS_BY_ID.get(id);
  if (!skill) {
    const known = [...SKILLS_BY_ID.keys()].sort().join(', ');
    throw new Error(
      `[@docket/skills] unknown skill id "${id}". Known: ${known.length === 0 ? '(none registered yet)' : known}`,
    );
  }
  const recomputed = await computeSkillHash({
    id: skill.id,
    version: skill.version,
    name: skill.name,
    description: skill.description,
    instructions: skill.instructions,
    category: skill.category,
    connectors: skill.connectors,
  });
  if (recomputed !== skill.hash) {
    throw new Error(
      `[@docket/skills] hash drift on "${id}": stored=${skill.hash} recomputed=${recomputed}. ` +
        `Edit-without-version-bump detected. Bump version, then update hash to ${recomputed}.`,
    );
  }
  return skill;
}

/**
 * Codex round 1 P2 (C29): startup-time hash verification across the
 * entire registry. Sync APIs (listSkillMetadata / listSkills / etc.)
 * don't pay the cost of a per-call hash recompute, but they CAN serve
 * drifted L1 metadata to Claude if any skill was edited without a
 * version bump. Callers (typically the orchestrator at boot) should
 * run this once at startup. If it throws, refuse to serve agent
 * requests until the hashes are reconciled.
 *
 * Returns the count of verified skills. Throws on FIRST drift with
 * the specific skill id and recomputed hash so the operator can paste
 * the corrected value.
 */
export async function verifySkillsRegistry(): Promise<number> {
  for (const skill of SKILLS) {
    const recomputed = await computeSkillHash({
      id: skill.id,
      version: skill.version,
      name: skill.name,
      description: skill.description,
      instructions: skill.instructions,
      category: skill.category,
      connectors: skill.connectors,
    });
    if (recomputed !== skill.hash) {
      throw new Error(
        `[@docket/skills] startup hash drift on "${skill.id}": stored=${skill.hash} recomputed=${recomputed}. ` +
          `Edit-without-version-bump detected. Bump version, then update hash to ${recomputed}.`,
      );
    }
  }
  return SKILLS.length;
}

/**
 * L1-disclosure list. Returns just the metadata fields suitable for
 * Claude's system-prompt injection. Use this on agent startup to give
 * Claude awareness of available skills without paying the context cost
 * of every skill's full instructions.
 *
 * SAFETY (codex round 1 P2 C29): this function does NOT recompute
 * hashes per call (it's sync, all skills, would burn budget). Callers
 * must run `await verifySkillsRegistry()` once at process startup to
 * assert no skill has drifted. Without that startup check, an edited-
 * without-version-bump name/description could ship to Claude silently.
 */
export function listSkillMetadata(): ReadonlyArray<SkillMetadata> {
  return SKILLS.map(({ id, version, name, description, category }) => ({
    id,
    version,
    name,
    description,
    category,
  }));
}

/**
 * Test/admin helper: list every registered skill's id + version + category.
 * Includes hash (useful for build-time invariant checks).
 */
export function listSkills(): ReadonlyArray<
  Pick<Skill, 'id' | 'version' | 'category' | 'hash'>
> {
  return SKILLS.map(({ id, version, category, hash }) => ({
    id,
    version,
    category,
    hash,
  }));
}

/**
 * Search skills by free-text keyword across name + description.
 * Case-insensitive substring match. v0 doesn't do fancy ranking;
 * V1.5+ can add embedding-based semantic search.
 *
 * Returns metadata-only entries (L1) so callers can present a picker
 * UI without loading instructions.
 */
export function searchSkillMetadata(
  query: string,
): ReadonlyArray<SkillMetadata> {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return listSkillMetadata();
  return SKILLS.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q),
  ).map(({ id, version, name, description, category }) => ({
    id,
    version,
    name,
    description,
    category,
  }));
}

/**
 * Filter skills by category. Returns metadata-only entries.
 */
export function listSkillsByCategory(
  category: string,
): ReadonlyArray<SkillMetadata> {
  return SKILLS.filter((s) => s.category === category).map(
    ({ id, version, name, description, category: cat }) => ({
      id,
      version,
      name,
      description,
      category: cat,
    }),
  );
}
