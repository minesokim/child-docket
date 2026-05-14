// @docket/skills — type definitions.
//
// A Skill is the Docket-side analog of Anthropic's SKILL.md format
// (per docs/AGENT-PLATFORM.md §1.1). It packages instructions Claude
// follows when invoked, with optional category metadata for routing,
// declared connector dependencies for substrate-trace, and a hash
// for drift detection. Mirrors @docket/prompts' shape so the registry
// patterns + dev affordances carry over.
//
// CROSS-PLATFORM FORMAT (Anthropic spec)
//   A skill on disk is a directory with a SKILL.md file:
//     skills/{skill-id}/SKILL.md
//   The SKILL.md has YAML frontmatter (required: name, description)
//   followed by markdown body. Same format runs in Claude Code, Claude
//   Cowork, Claude.ai, the Agent SDK, and the Developer Platform.
//
// V0 (C29) ships TS-module skills with the same data shape; future
// firm-authored skills can use SKILL.md files parsed via parseSkillMd
// (see ./parser.ts). The migration is additive.

/**
 * Skill category — coarse routing hint for surfaces like Magic Buttons
 * that group skills by purpose. Free-form `string` per codex round 2
 * P2 (C29) — firm-authored skills may add categories the canonical
 * list doesn't enumerate (e.g., 'meeting-brief', 'payroll',
 * 'audit-defense'). The canonical v0 categories are listed in
 * CANONICAL_SKILL_CATEGORIES as authoring guidance; the type
 * deliberately stays open so a stale enum doesn't force authors
 * into 'custom' and lose grouping value.
 */
export type SkillCategory = string;

/**
 * Canonical v0 categories. Use these unless you have a real reason
 * to introduce a new one; new categories should be added here once
 * shipped so /settings/ai/magic-buttons can render them in stable order.
 */
export const CANONICAL_SKILL_CATEGORIES = [
  'tax-position',
  'reconciliation',
  'communication',
  'workflow',
  'analysis',
  'maintenance',
  'custom',
] as const;

/**
 * Connector dependency declaration — which @docket/mcp-gateway
 * connectors a skill expects to be registered when it runs.
 * The agent loop can use this to prune unavailable skills before
 * surfacing them to Claude.
 */
export interface SkillConnectorRef {
  /** Connector name as registered in the gateway, e.g., 'ledger'. */
  name: string;
  /**
   * Required tools / resources the skill calls. Optional — if omitted,
   * the skill is assumed to use any subset. Used for substrate trace
   * (audit-row "skill X invoked tools [a, b, c]") but does not block
   * tool calls at runtime; the gateway validates each call independently.
   */
  uses?: string[];
}

/**
 * Skill metadata — the L1 system-prompt-injected shape. Anthropic's
 * three-tier progressive disclosure pattern says metadata is always
 * loaded, full body on demand, bundled resources only when navigated.
 * Our L1 = SkillMetadata; L2 = full instructions; L3 = future
 * bundled file/script lookup.
 */
export interface SkillMetadata {
  /** Stable identifier. Used for routing, audit-row stamping. */
  id: string;
  /** Semver. Bump on any instructions / metadata change. */
  version: string;
  /** Human-readable display name. From SKILL.md frontmatter `name`. */
  name: string;
  /** One-paragraph summary. From SKILL.md frontmatter `description`.
   *  Surfaces in Magic Buttons UI + Claude's system prompt disclosure. */
  description: string;
  /** Coarse routing/grouping hint. */
  category: SkillCategory;
}

/**
 * Full skill — metadata plus the actual instructions Claude follows
 * (L2 disclosure) plus the hash (drift-detection sentinel).
 */
export interface Skill extends SkillMetadata {
  /** The markdown body Claude reads when L2-disclosed. Contains the
   *  step-by-step instructions, refusal-floor language, and any
   *  inline examples. */
  instructions: string;
  /** Declared connector dependencies. Empty array = no external
   *  connectors needed (pure-LLM skills, e.g., a memo-rewrite skill
   *  that takes a draft and refines it). */
  connectors: ReadonlyArray<SkillConnectorRef>;
  /** sha256(version + '|' + name + '|' + description + '|' + instructions)
   *  hex-encoded. Verified at getSkill() time; mismatch throws so a
   *  silent edit-without-version-bump becomes a load-time error. */
  hash: string;
  /** ISO date (YYYY-MM-DD). Human reference; not security-load-bearing. */
  lastEdited: string;
}

/**
 * Parse result for a SKILL.md file. Distinct from Skill because the
 * parsed form has the frontmatter merged in but does NOT carry the
 * version + hash + connectors fields (those are TS-module-only). The
 * caller composes a Skill from this + the additional fields.
 */
export interface ParsedSkillMd {
  /** Required from frontmatter. */
  name: string;
  /** Required from frontmatter. */
  description: string;
  /** Any non-required fields the frontmatter carried; preserved verbatim
   *  so callers can read custom fields (e.g., category, tags, owner). */
  extraFrontmatter: Record<string, unknown>;
  /** Markdown body after the closing --- delimiter, with surrounding
   *  whitespace trimmed and CRLF normalized to LF. */
  body: string;
}
