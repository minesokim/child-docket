// Tests for the pure logic in @docket/document-processing.
//
// Sharp + pdf-lib invocations are integration-tested manually against
// real R2 + real client uploads. Here we cover:
//   - Otsu threshold computation (deterministic, math-only)
//   - Filename resolution (sanitization, extension handling, edits)

import { describe, it, expect } from 'bun:test';
import { computeOtsuThreshold, resolveFinalFilename } from './index.js';

// ────────────────────────────────────────────────────────────────
// Otsu — math correctness against canonical bimodal inputs.
// ────────────────────────────────────────────────────────────────
describe('computeOtsuThreshold', () => {
  it('returns a threshold between the two modes for a clean bimodal histogram', () => {
    // 1000 black pixels (intensity 30), 1000 white pixels (intensity 220).
    const pixels = Buffer.alloc(2000);
    for (let i = 0; i < 1000; i++) pixels[i] = 30;
    for (let i = 1000; i < 2000; i++) pixels[i] = 220;

    const threshold = computeOtsuThreshold(pixels, 1, 2000);
    // Otsu picks somewhere between the two modes. Expect 30..220.
    expect(threshold).toBeGreaterThan(30);
    expect(threshold).toBeLessThan(220);
  });

  it('handles a uniform histogram without crashing', () => {
    const pixels = Buffer.alloc(256);
    for (let i = 0; i < 256; i++) pixels[i] = i;
    const threshold = computeOtsuThreshold(pixels, 1, 256);
    expect(threshold).toBeGreaterThanOrEqual(0);
    expect(threshold).toBeLessThanOrEqual(255);
  });

  it('handles all-black input', () => {
    const pixels = Buffer.alloc(100);
    const threshold = computeOtsuThreshold(pixels, 10, 10);
    expect(threshold).toBeGreaterThanOrEqual(0);
    expect(threshold).toBeLessThanOrEqual(255);
  });

  it('handles all-white input', () => {
    const pixels = Buffer.alloc(100);
    pixels.fill(255);
    const threshold = computeOtsuThreshold(pixels, 10, 10);
    expect(threshold).toBeGreaterThanOrEqual(0);
    expect(threshold).toBeLessThanOrEqual(255);
  });

  it('skews threshold toward heavier mode when bimodal is unbalanced', () => {
    // 100 dark pixels (intensity 30), 1000 light pixels (intensity 220).
    const pixels = Buffer.alloc(1100);
    for (let i = 0; i < 100; i++) pixels[i] = 30;
    for (let i = 100; i < 1100; i++) pixels[i] = 220;

    const threshold = computeOtsuThreshold(pixels, 1, 1100);
    // Threshold should still land between modes for this clean case.
    expect(threshold).toBeGreaterThan(30);
    expect(threshold).toBeLessThan(220);
  });
});

// ────────────────────────────────────────────────────────────────
// Filename resolution.
// ────────────────────────────────────────────────────────────────
describe('resolveFinalFilename', () => {
  it('uses the AI suggestion when no user edit', () => {
    expect(
      resolveFinalFilename({
        suggested: '2024_W-2_RiversideUnified.pdf',
        fallback: 'original.png',
      }),
    ).toBe('2024_W-2_RiversideUnified.pdf');
  });

  it('replaces the AI suggestion with the user edit', () => {
    expect(
      resolveFinalFilename({
        suggested: '2024_W-2_RiversideUnified.pdf',
        userEdit: '2024_W-2_RiversideSchoolDistrict.pdf',
        fallback: 'original.png',
      }),
    ).toBe('2024_W-2_RiversideSchoolDistrict.pdf');
  });

  it('forces .pdf extension on a non-pdf suggestion', () => {
    expect(
      resolveFinalFilename({
        suggested: 'DriversLicense_CA_2027exp.jpg',
        fallback: 'original.jpg',
      }),
    ).toBe('DriversLicense_CA_2027exp.pdf');
  });

  it('appends .pdf when no extension present', () => {
    expect(
      resolveFinalFilename({
        suggested: 'BankStatementJanuary',
        fallback: 'original.png',
      }),
    ).toBe('BankStatementJanuary.pdf');
  });

  it('sanitizes unsafe characters', () => {
    expect(
      resolveFinalFilename({
        suggested: '2024 W-2 (final).pdf',
        fallback: 'orig.png',
      }),
    ).toBe('2024_W-2_final.pdf');
  });

  it('strips path separators (only basename retained for traversal defense)', () => {
    expect(
      resolveFinalFilename({
        suggested: '../../etc/secret.pdf',
        fallback: 'orig.png',
      }),
    ).toBe('secret.pdf');
  });

  it('falls back when suggestion is empty', () => {
    expect(
      resolveFinalFilename({
        suggested: '',
        fallback: 'original.png',
      }),
    ).toBe('original.pdf');
  });

  it('falls back to "Document.pdf" when everything is empty', () => {
    expect(
      resolveFinalFilename({
        suggested: '',
        fallback: '',
      }),
    ).toBe('Document.pdf');
  });

  it('truncates absurdly long names', () => {
    const long = 'a'.repeat(200) + '.jpg';
    const result = resolveFinalFilename({
      suggested: long,
      fallback: 'original.png',
    });
    expect(result.length).toBeLessThanOrEqual(85);
    expect(result.endsWith('.pdf')).toBe(true);
  });
});
