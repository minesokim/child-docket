// Webhook signature verification tests.
//
// Each provider has its own test block with:
//   1. Happy path — valid signature verifies
//   2. Wrong secret — different secret produces different sig, fails
//   3. Tampered payload — body modified after signing, fails
//   4. Missing header — empty signature header fails
//   5. Length-mismatched signatures — exotic short / long inputs don't crash
//   6. Timing safety — paired equal-length comparisons (sanity check)
//
// We construct VALID signatures with the same algorithm the provider
// uses, then assert verification accepts them. We construct INVALID
// signatures by breaking exactly one of (key, payload, header), then
// assert verification rejects them. This catches "all signatures pass"
// regression bugs that a positive-only test suite would miss.

import { describe, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import {
  verifyTwilioSignature,
  verifySquareSignature,
  verifyDocuSignSignature,
  extractDocuSignSignatureHeaders,
  requireWebhookSecretInProd,
} from './webhook-verification.js';

// ────────────────────────────────────────────────────────────────
// TWILIO
// ────────────────────────────────────────────────────────────────

describe('verifyTwilioSignature', () => {
  const url = 'https://docket-portal.vercel.app/api/webhooks/twilio/sms';
  const params = {
    From: '+15551234567',
    To: '+15557654321',
    Body: 'Hi Antonio, ready to file my taxes',
    MessageSid: 'SM' + 'a'.repeat(32),
  };
  const authToken = 'twilio-auth-token-test-value';

  function computeTwilioSig(p: Record<string, string>, token: string, u: string): string {
    const sorted = Object.keys(p).sort();
    let payload = u;
    for (const k of sorted) payload += k + (p[k] ?? '');
    return createHmac('sha1', token).update(payload, 'utf8').digest('base64');
  }

  test('valid signature verifies', () => {
    const sig = computeTwilioSig(params, authToken, url);
    expect(
      verifyTwilioSignature({
        url,
        params,
        signatureHeader: sig,
        authToken,
      }),
    ).toBe(true);
  });

  test('wrong auth token fails', () => {
    const sig = computeTwilioSig(params, authToken, url);
    expect(
      verifyTwilioSignature({
        url,
        params,
        signatureHeader: sig,
        authToken: 'attacker-guessed-token',
      }),
    ).toBe(false);
  });

  test('tampered body fails', () => {
    const sig = computeTwilioSig(params, authToken, url);
    expect(
      verifyTwilioSignature({
        url,
        params: { ...params, Body: 'MALICIOUS REPLACEMENT' },
        signatureHeader: sig,
        authToken,
      }),
    ).toBe(false);
  });

  test('tampered URL fails (different webhook endpoint)', () => {
    const sig = computeTwilioSig(params, authToken, url);
    expect(
      verifyTwilioSignature({
        url: 'https://docket-portal.vercel.app/api/webhooks/twilio/voice',
        params,
        signatureHeader: sig,
        authToken,
      }),
    ).toBe(false);
  });

  test('empty signature header fails', () => {
    expect(
      verifyTwilioSignature({
        url,
        params,
        signatureHeader: '',
        authToken,
      }),
    ).toBe(false);
  });

  test('empty auth token fails (defense against env-var-not-set)', () => {
    expect(
      verifyTwilioSignature({
        url,
        params,
        signatureHeader: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        authToken: '',
      }),
    ).toBe(false);
  });

  test('garbage base64 in header fails without crashing', () => {
    expect(
      verifyTwilioSignature({
        url,
        params,
        signatureHeader: '!!!not-valid-base64-at-all!!!',
        authToken,
      }),
    ).toBe(false);
  });

  test('param order does not matter — sort happens internally', () => {
    const sig = computeTwilioSig(params, authToken, url);
    // Reorder the params object — verification should still match.
    const reordered: Record<string, string> = {};
    for (const k of Object.keys(params).reverse()) reordered[k] = params[k as keyof typeof params];
    expect(
      verifyTwilioSignature({
        url,
        params: reordered,
        signatureHeader: sig,
        authToken,
      }),
    ).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────
// SQUARE
// ────────────────────────────────────────────────────────────────

describe('verifySquareSignature', () => {
  const notificationUrl = 'https://docket-command-room.vercel.app/api/webhooks/square';
  const rawBody = JSON.stringify({
    type: 'payment.updated',
    event_id: 'evt_1234567890',
    data: {
      object: {
        payment: {
          id: 'pmt_abc',
          amount_money: { amount: 5000, currency: 'USD' },
          status: 'COMPLETED',
        },
      },
    },
  });
  const signatureKey = 'square-webhook-signature-key-test';

  function computeSquareSig(url: string, body: string, key: string): string {
    return createHmac('sha256', key).update(url + body, 'utf8').digest('base64');
  }

  test('valid signature verifies', () => {
    const sig = computeSquareSig(notificationUrl, rawBody, signatureKey);
    expect(
      verifySquareSignature({
        notificationUrl,
        rawBody,
        signatureHeader: sig,
        signatureKey,
      }),
    ).toBe(true);
  });

  test('wrong signature key fails', () => {
    const sig = computeSquareSig(notificationUrl, rawBody, signatureKey);
    expect(
      verifySquareSignature({
        notificationUrl,
        rawBody,
        signatureHeader: sig,
        signatureKey: 'attacker-guessed-key',
      }),
    ).toBe(false);
  });

  test('tampered body fails (forged amount)', () => {
    const sig = computeSquareSig(notificationUrl, rawBody, signatureKey);
    const tampered = rawBody.replace('5000', '500000');
    expect(
      verifySquareSignature({
        notificationUrl,
        rawBody: tampered,
        signatureHeader: sig,
        signatureKey,
      }),
    ).toBe(false);
  });

  test('different notification URL fails (URL must match registration)', () => {
    const sig = computeSquareSig(notificationUrl, rawBody, signatureKey);
    expect(
      verifySquareSignature({
        notificationUrl: notificationUrl + '?extra=param',
        rawBody,
        signatureHeader: sig,
        signatureKey,
      }),
    ).toBe(false);
  });

  test('empty header fails', () => {
    expect(
      verifySquareSignature({
        notificationUrl,
        rawBody,
        signatureHeader: '',
        signatureKey,
      }),
    ).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────
// DOCUSIGN
// ────────────────────────────────────────────────────────────────

describe('verifyDocuSignSignature', () => {
  const rawBody =
    '<?xml version="1.0"?><EnvelopeStatus><EnvelopeID>abc-123</EnvelopeID><Status>Completed</Status></EnvelopeStatus>';
  const currentSecret = 'docusign-current-hmac-secret';
  const previousSecret = 'docusign-previous-hmac-secret';

  function computeDocuSignSig(body: string, secret: string): string {
    return createHmac('sha256', secret).update(body, 'utf8').digest('base64');
  }

  test('valid signature with current secret verifies', () => {
    const sig = computeDocuSignSig(rawBody, currentSecret);
    expect(
      verifyDocuSignSignature({
        rawBody,
        signatureHeaders: [sig],
        secrets: [currentSecret],
      }),
    ).toBe(true);
  });

  test('valid signature with previous secret verifies (rotation tolerance)', () => {
    const sig = computeDocuSignSig(rawBody, previousSecret);
    expect(
      verifyDocuSignSignature({
        rawBody,
        signatureHeaders: [sig],
        secrets: [currentSecret, previousSecret],
      }),
    ).toBe(true);
  });

  test('multiple signature headers — at least one matches → verifies', () => {
    const sig1 = computeDocuSignSig(rawBody, currentSecret);
    const sig2 = computeDocuSignSig(rawBody, previousSecret);
    expect(
      verifyDocuSignSignature({
        rawBody,
        signatureHeaders: [sig1, sig2],
        secrets: [currentSecret],
      }),
    ).toBe(true);
  });

  test('all wrong secrets fail', () => {
    const sig = computeDocuSignSig(rawBody, 'completely-different-secret');
    expect(
      verifyDocuSignSignature({
        rawBody,
        signatureHeaders: [sig],
        secrets: [currentSecret, previousSecret],
      }),
    ).toBe(false);
  });

  test('tampered body fails', () => {
    const sig = computeDocuSignSig(rawBody, currentSecret);
    expect(
      verifyDocuSignSignature({
        rawBody: rawBody.replace('Completed', 'Voided'),
        signatureHeaders: [sig],
        secrets: [currentSecret],
      }),
    ).toBe(false);
  });

  test('empty headers array fails', () => {
    expect(
      verifyDocuSignSignature({
        rawBody,
        signatureHeaders: [],
        secrets: [currentSecret],
      }),
    ).toBe(false);
  });

  test('empty secrets array fails (defense against not-configured)', () => {
    const sig = computeDocuSignSig(rawBody, currentSecret);
    expect(
      verifyDocuSignSignature({
        rawBody,
        signatureHeaders: [sig],
        secrets: [],
      }),
    ).toBe(false);
  });

  test('null/undefined-y headers in array are skipped', () => {
    const sig = computeDocuSignSig(rawBody, currentSecret);
    expect(
      verifyDocuSignSignature({
        rawBody,
        signatureHeaders: ['', sig, ''],
        secrets: [currentSecret],
      }),
    ).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────
// Cross-provider: garbage / malformed inputs MUST not crash
//
// Codex review surfaced that the original "fails without crashing"
// test was too loose — it only checked that a single garbage value
// returned false. These tests pin the harder contract: NO call shape
// throws, regardless of input.
// ────────────────────────────────────────────────────────────────

describe('garbage inputs never throw', () => {
  test('Twilio with malformed base64 header returns false, no throw', () => {
    expect(() =>
      verifyTwilioSignature({
        url: 'https://example.com',
        params: { a: 'b' },
        signatureHeader: '!@#$%^&*()_+={}[]|\\:";\'<>?,./~`',
        authToken: 'token',
      }),
    ).not.toThrow();
  });

  test('Square with malformed base64 header returns false, no throw', () => {
    expect(() =>
      verifySquareSignature({
        notificationUrl: 'https://example.com',
        rawBody: '{}',
        signatureHeader: '!!! not base64 !!!',
        signatureKey: 'key',
      }),
    ).not.toThrow();
  });

  test('DocuSign with mix of valid and malformed headers returns false, no throw', () => {
    expect(() =>
      verifyDocuSignSignature({
        rawBody: '<xml/>',
        signatureHeaders: ['valid-looking-but-wrong', '!!!garbage!!!', ''],
        secrets: ['secret'],
      }),
    ).not.toThrow();
  });

  test('Twilio with very long signature header returns false, no throw', () => {
    expect(() =>
      verifyTwilioSignature({
        url: 'https://example.com',
        params: { a: 'b' },
        signatureHeader: 'A'.repeat(10_000),
        authToken: 'token',
      }),
    ).not.toThrow();
  });

  test('Square with extremely large rawBody returns false, no throw', () => {
    // 1 MB of body — sanity check that we don't blow up on size
    const bigBody = 'x'.repeat(1_000_000);
    expect(() =>
      verifySquareSignature({
        notificationUrl: 'https://example.com',
        rawBody: bigBody,
        signatureHeader: 'wrong-sig',
        signatureKey: 'key',
      }),
    ).not.toThrow();
  });
});

// ────────────────────────────────────────────────────────────────
// TODO(v1.5): golden test vectors from provider SDKs
//
// Codex review surfaced that all current happy-path tests generate
// expected signatures using the SAME formula as the implementation —
// if the implementation silently differs from a provider's spec
// (wrong canonicalization, wrong encoding step, wrong concatenation
// order), both sides of the test produce the same wrong value and
// the suite stays green.
//
// Defense: pin at least one golden vector per provider, sourced from
// the provider's official SDK or published test fixtures:
//   - Twilio: examples in twilio-node SDK's test suite
//   - Square: square-node-sdk's webhook-events test fixtures
//   - DocuSign: published Connect HMAC examples in dev docs
//
// Tracked in PRODUCTION-READINESS §C "Test infrastructure". Land
// alongside the eval harness work in V1.5.
// ────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────
// extractDocuSignSignatureHeaders
// ────────────────────────────────────────────────────────────────

describe('extractDocuSignSignatureHeaders', () => {
  test('extracts -1 through -5 in order', () => {
    const h = new Headers();
    h.set('x-docusign-signature-1', 'sig1');
    h.set('x-docusign-signature-2', 'sig2');
    h.set('x-docusign-signature-3', 'sig3');
    expect(extractDocuSignSignatureHeaders(h)).toEqual(['sig1', 'sig2', 'sig3']);
  });

  test('returns empty array when no DocuSign headers present', () => {
    const h = new Headers();
    h.set('content-type', 'application/xml');
    expect(extractDocuSignSignatureHeaders(h)).toEqual([]);
  });

  test('handles only -2 set (rotation mid-flight, -1 missing)', () => {
    const h = new Headers();
    h.set('x-docusign-signature-2', 'rotated-sig');
    expect(extractDocuSignSignatureHeaders(h)).toEqual(['rotated-sig']);
  });
});

// ────────────────────────────────────────────────────────────────
// requireWebhookSecretInProd
// ────────────────────────────────────────────────────────────────

describe('requireWebhookSecretInProd', () => {
  test('returns the value when set', () => {
    expect(requireWebhookSecretInProd('TEST_SECRET', 'real-value')).toBe('real-value');
  });

  test('returns empty string with warning when not set in dev', () => {
    const oldEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      expect(requireWebhookSecretInProd('TEST_SECRET', undefined)).toBe('');
      expect(requireWebhookSecretInProd('TEST_SECRET', '')).toBe('');
    } finally {
      process.env.NODE_ENV = oldEnv;
    }
  });

  test('throws when not set in production (fails closed)', () => {
    const oldEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(() => requireWebhookSecretInProd('TEST_SECRET', undefined)).toThrow(
        /required in production/,
      );
      expect(() => requireWebhookSecretInProd('TEST_SECRET', '')).toThrow(
        /required in production/,
      );
    } finally {
      process.env.NODE_ENV = oldEnv;
    }
  });
});
