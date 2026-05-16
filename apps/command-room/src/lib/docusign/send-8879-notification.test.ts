// Unit tests for buildMessageBody — the pure-function piece of
// send-8879-notification. The Twilio send + DB writes are covered
// by integration paths (request-sign-8879.test.ts patterns +
// production smoke). These tests guard the message-body invariants:
//
//   - English fires for preferredLanguage = 'en' OR null/undefined
//   - Spanish fires for preferredLanguage = 'es'
//   - Tagalog / Vietnamese / Chinese fall back to English
//   - Signing URL is present in the body
//   - Tax year is present in the body
//   - Sender first-name is present
//   - Client first-name is present
//
// If any of those regress, the SMS would land but with wrong
// content — the kind of silent failure that's hard to catch in
// production until a client complains.

import { describe, expect, test } from 'bun:test';
import { buildMessageBody } from './send-8879-notification';

describe('buildMessageBody — language routing', () => {
  test('English path fires for preferredLanguage = "en"', () => {
    const body = buildMessageBody({
      clientFirstName: 'Maria',
      senderFirstName: 'Antonio',
      signingUrl: 'https://docket-portal.vercel.app/portal/sign-8879/abc-123',
      taxYear: 2024,
      preferredLanguage: 'en',
    });
    expect(body).toContain('Hi Maria');
    expect(body).toContain('— Antonio');
    expect(body).toContain('2024 Form 8879');
    expect(body).toContain('https://docket-portal.vercel.app/portal/sign-8879/abc-123');
    expect(body).toContain('identity verification');
    // Should NOT contain Spanish copy
    expect(body).not.toContain('Hola');
    expect(body).not.toContain('Firma aquí');
  });

  test('English path fires when preferredLanguage is null', () => {
    const body = buildMessageBody({
      clientFirstName: 'Maria',
      senderFirstName: 'Antonio',
      signingUrl: 'https://example.com/sign',
      taxYear: 2024,
      preferredLanguage: null,
    });
    expect(body).toContain('Hi Maria');
    expect(body).not.toContain('Hola');
  });

  test('English path fires when preferredLanguage is undefined', () => {
    const body = buildMessageBody({
      clientFirstName: 'Maria',
      senderFirstName: 'Antonio',
      signingUrl: 'https://example.com/sign',
      taxYear: 2024,
      preferredLanguage: undefined,
    });
    expect(body).toContain('Hi Maria');
  });

  test('Spanish path fires for preferredLanguage = "es"', () => {
    const body = buildMessageBody({
      clientFirstName: 'Maria',
      senderFirstName: 'Antonio',
      signingUrl: 'https://docket-portal.vercel.app/portal/sign-8879/abc-123',
      taxYear: 2024,
      preferredLanguage: 'es',
    });
    expect(body).toContain('Hola Maria');
    expect(body).toContain('— Antonio');
    expect(body).toContain('Formulario 8879');
    expect(body).toContain('2024');
    expect(body).toContain('https://docket-portal.vercel.app/portal/sign-8879/abc-123');
    expect(body).toContain('Firma aquí');
    expect(body).toContain('verificación de identidad');
    // Should NOT contain English copy
    expect(body).not.toContain('Hi Maria');
    expect(body).not.toContain('Sign here:');
  });

  test('Tagalog falls back to English (v0 bilingual scope is en/es only)', () => {
    const body = buildMessageBody({
      clientFirstName: 'Joel',
      senderFirstName: 'Antonio',
      signingUrl: 'https://example.com/sign',
      taxYear: 2024,
      preferredLanguage: 'tl',
    });
    // Per CLAUDE.md §11 + the helper's inline comment: tl/vi/zh
    // fall back to English. When V1.5 ships the multilingual
    // surfaces, the helper gets extended; until then, fallback is
    // the safe + visible behavior.
    expect(body).toContain('Hi Joel');
    expect(body).not.toContain('Hola');
  });

  test('Vietnamese falls back to English', () => {
    const body = buildMessageBody({
      clientFirstName: 'Linh',
      senderFirstName: 'Antonio',
      signingUrl: 'https://example.com/sign',
      taxYear: 2024,
      preferredLanguage: 'vi',
    });
    expect(body).toContain('Hi Linh');
  });

  test('Chinese falls back to English', () => {
    const body = buildMessageBody({
      clientFirstName: 'Wei',
      senderFirstName: 'Antonio',
      signingUrl: 'https://example.com/sign',
      taxYear: 2024,
      preferredLanguage: 'zh',
    });
    expect(body).toContain('Hi Wei');
  });
});

describe('buildMessageBody — content invariants', () => {
  test('signing URL is always present verbatim (no truncation, no encoding)', () => {
    const url = 'https://docket-portal.vercel.app/portal/sign-8879/01234567-89ab-cdef-0123-456789abcdef';
    const enBody = buildMessageBody({
      clientFirstName: 'X',
      senderFirstName: 'Y',
      signingUrl: url,
      taxYear: 2024,
      preferredLanguage: 'en',
    });
    const esBody = buildMessageBody({
      clientFirstName: 'X',
      senderFirstName: 'Y',
      signingUrl: url,
      taxYear: 2024,
      preferredLanguage: 'es',
    });
    expect(enBody).toContain(url);
    expect(esBody).toContain(url);
  });

  test('tax year appears verbatim in both languages', () => {
    for (const lang of ['en', 'es']) {
      const body = buildMessageBody({
        clientFirstName: 'X',
        senderFirstName: 'Y',
        signingUrl: 'https://example.com/sign',
        taxYear: 2025,
        preferredLanguage: lang,
      });
      expect(body).toContain('2025');
    }
  });

  test('body length stays under ~10 SMS segments (1600 chars)', () => {
    // Twilio segments at 160 chars (GSM) or 70 chars (Unicode).
    // Realistic Spanish/English text is mostly GSM-compatible —
    // 10 segments ≈ 1600 chars is an absolute upper bound. If a
    // future copy edit pushes past this, send cost balloons.
    const body = buildMessageBody({
      clientFirstName: 'Maria-Carmen',
      senderFirstName: 'Antonio',
      signingUrl:
        'https://docket-portal.vercel.app/portal/sign-8879/01234567-89ab-cdef-0123-456789abcdef',
      taxYear: 2025,
      preferredLanguage: 'es',
    });
    expect(body.length).toBeLessThan(1600);
  });
});
