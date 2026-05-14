// SKILL.md parser tests.
//
// Covers all 12 enumerated edge cases for /edge-cases gate (C29):
//   1. Missing `name` → throws
//   2. Missing `description` → throws
//   3. Malformed YAML → throws
//   4. Missing closing --- delim → throws
//   5. Extra frontmatter fields → preserved in extraFrontmatter
//   6. Empty body (frontmatter-only) → valid
//   7. Body contains --- inside fenced code → first delim pair only
//   8. CRLF line endings → normalized
//   9. Leading BOM → tolerated
//  10. No opening --- → throws
//  11. Non-string content → throws
//  12. Whitespace-only name/description → throws

import { describe, expect, test } from 'bun:test';
import { parseSkillMd, SkillMdParseError } from '../src/parser.js';

describe('parseSkillMd — happy paths', () => {
  test('minimal valid SKILL.md', () => {
    const md = `---
name: test-skill
description: A simple test skill
---

This is the body.`;
    const result = parseSkillMd(md);
    expect(result.name).toBe('test-skill');
    expect(result.description).toBe('A simple test skill');
    expect(result.body).toBe('This is the body.');
    expect(result.extraFrontmatter).toEqual({});
  });

  test('preserves extra frontmatter fields', () => {
    const md = `---
name: extras
description: Has extra fields
category: tax-position
owner: antonio
tags:
  - tier-2
  - 8275-required
---

Body here.`;
    const result = parseSkillMd(md);
    expect(result.name).toBe('extras');
    expect(result.extraFrontmatter.category).toBe('tax-position');
    expect(result.extraFrontmatter.owner).toBe('antonio');
    expect(result.extraFrontmatter.tags).toEqual(['tier-2', '8275-required']);
  });

  test('empty body (frontmatter-only) is valid', () => {
    const md = `---
name: meta-only
description: Body comes later
---`;
    const result = parseSkillMd(md);
    expect(result.body).toBe('');
  });

  test('normalizes CRLF line endings', () => {
    const md = `---\r\nname: crlf\r\ndescription: Windows-saved\r\n---\r\n\r\nBody.\r\n`;
    const result = parseSkillMd(md);
    expect(result.name).toBe('crlf');
    expect(result.body).toBe('Body.');
  });

  test('preserves body containing --- inside fenced code', () => {
    const md = `---
name: code-with-delim
description: Has --- inside body
---

\`\`\`yaml
---
inner: yaml
---
\`\`\`

End.`;
    const result = parseSkillMd(md);
    expect(result.body).toContain('inner: yaml');
    expect(result.body).toContain('End.');
  });

  test('tolerates BOM prefix', () => {
    const md = `﻿---
name: bom
description: With byte-order mark
---

Body.`;
    const result = parseSkillMd(md);
    expect(result.name).toBe('bom');
  });

  test('closing delim with trailing whitespace accepted (codex r3 P3 C29)', () => {
    // Hand-authored files often have invisible trailing whitespace.
    const md = `---
name: trailing-ws
description: Closing delim has trailing spaces
---

Body.`;
    const result = parseSkillMd(md);
    expect(result.name).toBe('trailing-ws');
    expect(result.body).toBe('Body.');
  });

  test('multiline block scalar containing --- (codex r2 P2 C29)', () => {
    // A YAML literal block scalar (|) may contain a --- line. Frontmatter
    // parsing must not truncate at the first --- when a later --- is
    // the real closing delim.
    const md = `---
name: block-scalar
description: Has --- inside a block scalar
notes: |
  This is line 1
  ---
  This is line 3
---

Body.`;
    const result = parseSkillMd(md);
    expect(result.name).toBe('block-scalar');
    expect(result.body).toBe('Body.');
    // The block-scalar content is preserved in extraFrontmatter.
    expect(result.extraFrontmatter.notes).toContain('---');
  });

  test('trims surrounding whitespace from name + description', () => {
    const md = `---
name: "  padded-name  "
description: "  padded-desc  "
---

Body.`;
    const result = parseSkillMd(md);
    expect(result.name).toBe('padded-name');
    expect(result.description).toBe('padded-desc');
  });
});

describe('parseSkillMd — error paths', () => {
  test('throws on missing `name` field', () => {
    const md = `---
description: No name here
---

Body.`;
    expect(() => parseSkillMd(md)).toThrow(SkillMdParseError);
    expect(() => parseSkillMd(md)).toThrow(/`name`/);
  });

  test('throws on missing `description` field', () => {
    const md = `---
name: missing-desc
---

Body.`;
    expect(() => parseSkillMd(md)).toThrow(/`description`/);
  });

  test('throws on whitespace-only name', () => {
    const md = `---
name: "   "
description: Has desc but blank name
---`;
    expect(() => parseSkillMd(md)).toThrow(/non-empty.*name/);
  });

  test('throws on whitespace-only description', () => {
    const md = `---
name: has-name
description: "   "
---`;
    expect(() => parseSkillMd(md)).toThrow(/non-empty.*description/);
  });

  test('throws on malformed YAML', () => {
    const md = `---
name: bad
description: [unclosed array
---

Body.`;
    expect(() => parseSkillMd(md)).toThrow(/not valid YAML/);
  });

  test('throws when frontmatter is not closed', () => {
    const md = `---
name: never-closed
description: missing closing delim

Body without delim.`;
    expect(() => parseSkillMd(md)).toThrow(/not closed/);
  });

  test('throws when file does not start with frontmatter', () => {
    const md = `# Just markdown

No frontmatter at all.`;
    expect(() => parseSkillMd(md)).toThrow(/must begin with .* frontmatter/);
  });

  test('rejects malformed opening delim like ---yaml (codex r4 P2 C29)', () => {
    const md = `---yaml
name: bad-open
description: Opening delim has trailing token
---

Body.`;
    expect(() => parseSkillMd(md)).toThrow(/must begin with/);
  });

  test('rejects malformed opening delim like --- frontmatter', () => {
    const md = `--- frontmatter
name: bad-open-2
description: Opening delim has trailing word
---

Body.`;
    expect(() => parseSkillMd(md)).toThrow(/must begin with/);
  });

  test('throws when content is not a string', () => {
    // @ts-expect-error — runtime guard for callers that bypass TS
    expect(() => parseSkillMd(123)).toThrow(/must be a string/);
  });

  test('throws when frontmatter is a YAML array, not object', () => {
    const md = `---
- item1
- item2
---

Body.`;
    expect(() => parseSkillMd(md)).toThrow(/YAML object/);
  });
});
