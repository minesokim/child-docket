// Tests for pii-scrubber. Property-driven where possible.

import { describe, expect, test } from 'bun:test';
import { scrubPII, scrubPIIToText, PII_PATTERNS } from './pii-scrubber.js';

describe('scrubPII / SSN', () => {
  test('redacts dashed SSN', () => {
    const r = scrubPII('My SSN is 123-45-6789 thanks');
    expect(r.scrubbed).toBe('My SSN is [REDACTED-SSN] thanks');
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0]?.type).toBe('SSN');
    expect(r.matches[0]?.start).toBe(10);
    expect(r.matches[0]?.end).toBe(21);
    expect(r.counts.SSN).toBe(1);
  });

  test('redacts no-dash SSN', () => {
    const r = scrubPII('SSN: 123456789');
    expect(r.scrubbed).toBe('SSN: [REDACTED-SSN]');
    expect(r.counts.SSN).toBe(1);
  });

  test('redacts multiple SSNs in one string', () => {
    const r = scrubPII('Spouse: 111-22-3333. Dependent: 444-55-6666.');
    expect(r.counts.SSN).toBe(2);
    expect(r.scrubbed).toBe('Spouse: [REDACTED-SSN]. Dependent: [REDACTED-SSN].');
  });

  test('does not match middle-of-token sequences', () => {
    // 'user123456789@example.com' — embedded in a token, not a real SSN.
    const r = scrubPII('Email: user123456789@example.com');
    expect(r.counts.SSN).toBe(0);
    expect(r.scrubbed).toBe('Email: user123456789@example.com');
  });

  test('preserves position metadata against original text', () => {
    const original = 'a b c 123-45-6789 d e f';
    const r = scrubPII(original);
    const m = r.matches[0]!;
    expect(original.slice(m.start, m.end)).toBe('123-45-6789');
    expect(m.length).toBe(11);
  });
});

describe('scrubPII / EIN', () => {
  test('redacts EIN in canonical form', () => {
    const r = scrubPII('EIN 12-3456789 for Acme LLC');
    expect(r.scrubbed).toBe('EIN [REDACTED-EIN] for Acme LLC');
    expect(r.counts.EIN).toBe(1);
  });

  test('does not match EIN without dash', () => {
    // 9-digit run without dash — EIN regex is dash-required to avoid
    // false positives. This intentionally does NOT match as EIN; the
    // SSN regex (which allows no-dash) catches it instead because
    // SSN scans first.
    const r = scrubPII('Number 123456789');
    expect(r.counts.EIN).toBe(0);
    expect(r.counts.SSN).toBe(1);
    expect(r.scrubbed).toBe('Number [REDACTED-SSN]');
  });

  test('redacts EIN + SSN in same string', () => {
    const r = scrubPII('SSN 555-66-7777 EIN 88-9999000');
    expect(r.counts.SSN).toBe(1);
    expect(r.counts.EIN).toBe(1);
    expect(r.scrubbed).toBe('SSN [REDACTED-SSN] EIN [REDACTED-EIN]');
  });
});

describe('scrubPII / BANK', () => {
  test('redacts after "account number"', () => {
    const r = scrubPII('Please send to account number: 9876543210');
    expect(r.counts.BANK).toBe(1);
    expect(r.scrubbed).toBe('Please send to account number: [REDACTED-BANK]');
  });

  test('redacts after "acct #"', () => {
    const r = scrubPII('Wire to acct #12345678');
    expect(r.counts.BANK).toBe(1);
    expect(r.scrubbed).toBe('Wire to acct #[REDACTED-BANK]');
  });

  test('redacts grouped/dashed account format', () => {
    // BANK regex allows internal dashes + spaces so "1234-5678-9012"
    // redacts as a single value rather than just the leading "1234".
    const r = scrubPII('account 1234-5678-9012 was charged');
    expect(r.counts.BANK).toBe(1);
    expect(r.scrubbed).toBe('account [REDACTED-BANK] was charged');
  });

  test('redacts space-grouped account format', () => {
    const r = scrubPII('acct 1234 5678 9012');
    expect(r.counts.BANK).toBe(1);
    expect(r.scrubbed).toBe('acct [REDACTED-BANK]');
  });

  test('redacts routing number with context', () => {
    const r = scrubPII('routing 026009593 for the wire');
    expect(r.counts.BANK).toBe(1);
    expect(r.scrubbed).toBe('routing [REDACTED-BANK] for the wire');
  });

  test('does NOT redact bare digit runs without context', () => {
    // Order numbers, invoice IDs, etc. should pass through.
    const r = scrubPII('Reference 1234567890 for the order');
    expect(r.counts.BANK).toBe(0);
    expect(r.scrubbed).toBe('Reference 1234567890 for the order');
  });

  test('case-insensitive on context word', () => {
    const r = scrubPII('Account Number: 1234567890');
    expect(r.counts.BANK).toBe(1);
  });
});

describe('scrubPII / overlap suppression', () => {
  test('dashed-SSN-shaped digits with account context label as BANK', () => {
    // 'account 123-45-6789'. The new BANK regex (digit-bookended,
    // allows internal dashes/spaces) matches this. Since BANK is
    // first in scan order, it claims; SSN does not double-count.
    // The value IS redacted; the label is BANK rather than SSN.
    // Acceptable — real text rarely contains "account <SSN>" by
    // accident, and defense-in-depth wins over precise labeling.
    const r = scrubPII('Set account 123-45-6789 as primary');
    expect(r.counts.BANK).toBe(1);
    expect(r.counts.SSN).toBe(0);
    expect(r.scrubbed).toBe('Set account [REDACTED-BANK] as primary');
  });

  test('REAL overlap suppression: 9-digit run with bank context → BANK wins, SSN does not double-count', () => {
    // 'account 123456789'. BOTH BANK regex (lookbehind 'account ' +
    // 9 digits) AND SSN regex (no-dash 9 digits) match the same byte
    // range. Because BANK is in SCAN_ORDER first, BANK claims; SSN's
    // pass over the same range gets suppressed by the claimed mask.
    const r = scrubPII('Send to account 123456789 today');
    expect(r.counts.BANK).toBe(1);
    expect(r.counts.SSN).toBe(0);
    expect(r.matches.length).toBe(1);
    expect(r.matches[0]?.type).toBe('BANK');
    expect(r.scrubbed).toBe('Send to account [REDACTED-BANK] today');
  });

  test('routing-9-digit overlap: BANK first, SSN suppressed', () => {
    // 'routing 026009593' — same overlap shape as above. BANK wins.
    const r = scrubPII('Wire via routing 026009593 immediately');
    expect(r.counts.BANK).toBe(1);
    expect(r.counts.SSN).toBe(0);
    expect(r.scrubbed).toBe('Wire via routing [REDACTED-BANK] immediately');
  });

  test('EIN-shaped tokens not double-counted', () => {
    const r = scrubPII('EIN 12-3456789');
    expect(r.matches.length).toBe(1);
    expect(r.matches[0]?.type).toBe('EIN');
  });

  test('matches returned in source order (not scan order)', () => {
    // BANK appears AFTER SSN in source, but BANK is scanned first.
    // The returned matches array must be sorted by start position.
    const r = scrubPII('SSN 111-22-3333 then routing 026009593');
    expect(r.matches.length).toBe(2);
    expect(r.matches[0]?.type).toBe('SSN');
    expect(r.matches[0]?.start).toBeLessThan(r.matches[1]!.start);
    expect(r.matches[1]?.type).toBe('BANK');
  });
});

describe('scrubPII / documented false negatives (intentional v1 misses)', () => {
  test('SSN with periods (123.45.6789) is NOT detected', () => {
    // Period-separated SSN is a real-world variant we don't catch in
    // v1. Documented gap. v1.5 widens regex if real-world data shows
    // this format meaningfully.
    const r = scrubPII('SSN: 123.45.6789');
    expect(r.counts.SSN).toBe(0);
    expect(r.scrubbed).toBe('SSN: 123.45.6789');
  });

  test('account number with 7 or fewer digits and no separators is NOT detected', () => {
    // BANK regex requires total length 8-30 chars with internal
    // separators or a digit run of 8+. "account 1234567" (7 digits)
    // is below the length threshold. Documented gap; small-credit-
    // union account numbers may get missed.
    const r = scrubPII('account 1234567 today');
    expect(r.counts.BANK).toBe(0);
    expect(r.scrubbed).toBe('account 1234567 today');
  });

  test('EIN without dash (123456789) is captured by SSN, not EIN', () => {
    // Dash-required EIN regex misses the no-dash form. The string
    // does fall through to SSN (no-dash 9-digit catches it). This
    // means the value gets redacted, just labeled 'SSN' instead of
    // 'EIN'. Acceptable: caller still gets defense-in-depth.
    const r = scrubPII('Tax ID 123456789');
    expect(r.counts.SSN).toBe(1);
    expect(r.counts.EIN).toBe(0);
    expect(r.scrubbed).toBe('Tax ID [REDACTED-SSN]');
  });
});

describe('scrubPII / robustness', () => {
  test('empty string returns empty', () => {
    const r = scrubPII('');
    expect(r.scrubbed).toBe('');
    expect(r.matches).toEqual([]);
    expect(r.counts).toEqual({ SSN: 0, EIN: 0, BANK: 0 });
  });

  test('plain text without PII passes through unchanged', () => {
    const original = 'Hello Antonio, please review the engagement letter.';
    const r = scrubPII(original);
    expect(r.scrubbed).toBe(original);
    expect(r.matches).toEqual([]);
  });

  test('multiline text scrubs across lines', () => {
    const r = scrubPII('Line 1: SSN 111-22-3333\nLine 2: EIN 44-5566778');
    expect(r.counts.SSN).toBe(1);
    expect(r.counts.EIN).toBe(1);
    expect(r.scrubbed).toBe('Line 1: SSN [REDACTED-SSN]\nLine 2: EIN [REDACTED-EIN]');
  });

  test('idempotent: scrubbing twice yields the same result', () => {
    const original = 'SSN 111-22-3333 EIN 44-5566778';
    const first = scrubPII(original).scrubbed;
    const second = scrubPII(first).scrubbed;
    expect(first).toBe(second);
    // No re-match against the markers.
    expect(scrubPII(first).counts).toEqual({ SSN: 0, EIN: 0, BANK: 0 });
  });

  test('preserves all non-PII characters exactly', () => {
    const original = 'Tabs\there.\nUnicode: café résumé. SSN 111-22-3333.';
    const r = scrubPII(original);
    expect(r.scrubbed).toBe('Tabs\there.\nUnicode: café résumé. SSN [REDACTED-SSN].');
  });

  test('regex factories return fresh instances (no .lastIndex sharing)', () => {
    // Each call to PII_PATTERNS.SSN() should yield a NEW RegExp so
    // concurrent callers don't corrupt each other's iteration state.
    const r1 = PII_PATTERNS.SSN();
    const r2 = PII_PATTERNS.SSN();
    expect(r1).not.toBe(r2);
    r1.exec('111-22-3333');
    expect(r1.lastIndex).toBeGreaterThan(0);
    expect(r2.lastIndex).toBe(0);
  });

  test('many matches in one string all redact', () => {
    const ssns = Array.from({ length: 50 }, (_, i) => {
      const n = String(i).padStart(3, '0');
      return `${n}-12-3456`;
    }).join(' ');
    const r = scrubPII(ssns);
    expect(r.counts.SSN).toBe(50);
    expect(r.scrubbed.split('[REDACTED-SSN]').length - 1).toBe(50);
  });
});

describe('scrubPIIToText convenience', () => {
  test('returns scrubbed string only', () => {
    expect(scrubPIIToText('SSN 111-22-3333')).toBe('SSN [REDACTED-SSN]');
  });

  test('empty in / empty out', () => {
    expect(scrubPIIToText('')).toBe('');
  });
});
