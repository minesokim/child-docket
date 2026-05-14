// SKILL.md parser — extracts YAML frontmatter + markdown body.
//
// Follows Anthropic's SKILL.md spec (per docs/AGENT-PLATFORM.md §1.1):
//   ---
//   name: skill-name
//   description: One-paragraph summary
//   <any other frontmatter fields are preserved as extraFrontmatter>
//   ---
//
//   <markdown body here>
//
// Strict v0:
//   - Frontmatter is required (no body-only skills)
//   - `name` + `description` are required and must be strings
//   - Only the FIRST `---` ... `---` pair counts as frontmatter; any
//     `---` inside the body (e.g. inside fenced code blocks) is part of
//     the body
//   - CRLF line endings normalized to LF before parsing
//
// Error handling: throws SkillMdParseError with a descriptive message
// so the CLI / build tool surfaces the file path + reason. Callers that
// want to soft-fail (e.g., a build script aggregating errors) should
// try/catch.

import { parse as parseYaml } from 'yaml';
import type { ParsedSkillMd } from './types.js';

export class SkillMdParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkillMdParseError';
  }
}

const FRONTMATTER_DELIM = '---';

/**
 * Parse a SKILL.md file's raw text into frontmatter + body.
 * Throws SkillMdParseError on any structural or schema problem.
 */
export function parseSkillMd(rawContent: string): ParsedSkillMd {
  if (typeof rawContent !== 'string') {
    throw new SkillMdParseError('SKILL.md content must be a string.');
  }
  // Normalize line endings so CRLF-saved files parse the same as LF.
  const content = rawContent.replace(/\r\n/g, '\n');

  // Frontmatter must START at the very first non-empty character of
  // the file. Allow a leading BOM and optional whitespace before the
  // opening ---. The opening delim line must be EXACTLY "---" after
  // trimming trailing whitespace; codex round 4 P2 (C29): inputs like
  // "---yaml" or "--- frontmatter" were silently accepted, which let
  // a non-frontmatter file pass through with garbled body extraction.
  const stripped = content.replace(/^﻿/, '').trimStart();
  const firstLineEnd = stripped.indexOf('\n');
  const firstLine =
    firstLineEnd === -1 ? stripped : stripped.slice(0, firstLineEnd);
  if (firstLine.replace(/\s+$/, '') !== FRONTMATTER_DELIM) {
    throw new SkillMdParseError(
      'SKILL.md must begin with a YAML frontmatter delimiter line containing only "---" (trailing whitespace allowed).',
    );
  }

  // Find the closing "---" line. Heuristic: incrementally extend the
  // candidate frontmatter region from earliest candidate to latest,
  // attempting YAML parse on each. The LARGEST candidate that parses
  // wins. Codex round 2 P2 (C29): this lets a multiline block scalar
  // contain a "---" line (valid YAML) without the parser truncating
  // frontmatter at the wrong place.
  // Codex round 3 P3 (C29): accept trailing whitespace on the delim
  // line ("---  " or "---\t") since hand-authored SKILL.md files
  // commonly carry invisible trailing whitespace.
  const lines = stripped.split('\n');
  const candidateIdxs: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.replace(/\s+$/, '') === FRONTMATTER_DELIM) {
      candidateIdxs.push(i);
    }
  }
  if (candidateIdxs.length === 0) {
    throw new SkillMdParseError(
      'SKILL.md frontmatter is not closed. Expected a second "---" line after the opening one.',
    );
  }
  // Walk LARGEST → smallest candidate; the largest that produces a
  // parseable YAML object is the true closing delim. Falling back to
  // the smallest preserves the simple-case behavior.
  let closingIdx = -1;
  let frontmatterText = '';
  let parsedCandidate: unknown = undefined;
  for (let k = candidateIdxs.length - 1; k >= 0; k--) {
    const idx = candidateIdxs[k]!;
    const text = lines.slice(1, idx).join('\n');
    try {
      const parsed = parseYaml(text);
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        closingIdx = idx;
        frontmatterText = text;
        parsedCandidate = parsed;
        break;
      }
    } catch {
      // Try the next-smaller candidate.
    }
  }
  if (closingIdx === -1) {
    // No candidate parsed cleanly; fall through to the strict-parse
    // path below which surfaces the YAML error message.
    closingIdx = candidateIdxs[0]!;
    frontmatterText = lines.slice(1, closingIdx).join('\n');
  }
  const body = lines
    .slice(closingIdx + 1)
    .join('\n')
    // Trim surrounding whitespace + collapse trailing blank lines.
    .replace(/^\s*\n/, '')
    .replace(/\s+$/, '');

  // Parse frontmatter YAML. If the largest-candidate walk already
  // produced a successful parse, reuse it; otherwise re-attempt so we
  // can surface the parser's specific error message.
  let parsed: unknown;
  if (parsedCandidate !== undefined) {
    parsed = parsedCandidate;
  } else {
    try {
      parsed = parseYaml(frontmatterText);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new SkillMdParseError(
        `SKILL.md frontmatter is not valid YAML: ${message}`,
      );
    }
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new SkillMdParseError(
      'SKILL.md frontmatter must be a YAML object (key/value mapping).',
    );
  }
  const frontmatter = parsed as Record<string, unknown>;

  // Required fields with type validation.
  const nameField = frontmatter.name;
  if (typeof nameField !== 'string' || nameField.trim().length === 0) {
    throw new SkillMdParseError(
      'SKILL.md frontmatter must include a non-empty `name` string.',
    );
  }
  const descriptionField = frontmatter.description;
  if (
    typeof descriptionField !== 'string' ||
    descriptionField.trim().length === 0
  ) {
    throw new SkillMdParseError(
      'SKILL.md frontmatter must include a non-empty `description` string.',
    );
  }

  // Extra frontmatter fields preserved verbatim. Strip the two required
  // ones so callers iterating extraFrontmatter don't see them twice.
  const extra: Record<string, unknown> = { ...frontmatter };
  delete extra.name;
  delete extra.description;

  return {
    name: nameField.trim(),
    description: descriptionField.trim(),
    extraFrontmatter: extra,
    body,
  };
}
