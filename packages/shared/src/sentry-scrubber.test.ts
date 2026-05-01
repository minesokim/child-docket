// Tests lock in the scrubber's behavior. Crypto-grade isn't the goal —
// defense in depth IS. Every assertion below proves a real PII pattern
// gets caught somewhere in the event tree.

import { describe, expect, test } from 'bun:test';
import { scrubEvent } from './sentry-scrubber.js';

describe('scrubEvent — substring patterns', () => {
  test('SSN with dashes', () => {
    const event = { message: 'User SSN is 123-45-6789 in this error' };
    const out = scrubEvent(event);
    expect(out.message).toBe('User SSN is [REDACTED-SSN] in this error');
  });

  test('SSN without dashes', () => {
    const event = { message: 'Raw 123456789 number' };
    const out = scrubEvent(event);
    expect(out.message).toBe('Raw [REDACTED-SSN] number');
  });

  test('EIN with dash', () => {
    const event = { message: 'Business EIN 12-3456789 here' };
    const out = scrubEvent(event);
    // Either redaction is acceptable (SSN regex also matches 9 consecutive
    // digits in 12-3456789 if dashes are stripped); both indicate PII.
    expect(out.message).toMatch(/\[REDACTED-(SSN|EIN)\]/);
  });

  test('Email', () => {
    const event = { message: 'Contact: alice.smith@example.com please' };
    const out = scrubEvent(event);
    expect(out.message).toBe('Contact: [REDACTED-EMAIL] please');
  });

  test('US phone', () => {
    const event = { message: 'Reach me at (951) 555-0234 anytime' };
    const out = scrubEvent(event);
    expect(out.message).toBe('Reach me at [REDACTED-PHONE] anytime');
  });

  test('exception message with PII', () => {
    const event = {
      exception: {
        values: [{ value: 'Failed to validate ssn=123-45-6789 for user' }],
      },
    };
    const out = scrubEvent(event);
    expect(out.exception?.values?.[0]?.value).toBe(
      'Failed to validate ssn=[REDACTED-SSN] for user',
    );
  });
});

describe('scrubEvent — sensitive field names', () => {
  test('extra.ssn redacted regardless of contents', () => {
    const event = { extra: { ssn: '123-45-6789', other: 'safe value' } };
    const out = scrubEvent(event);
    expect(out.extra?.ssn).toBe('[REDACTED-FIELD]');
    expect(out.extra?.other).toBe('safe value');
  });

  test('nested ein redacted', () => {
    const event = {
      extra: { client: { ein: '12-3456789', name: 'Acme Co' } },
    };
    const out = scrubEvent(event);
    const client = out.extra?.client as { ein?: unknown; name?: unknown };
    expect(client.ein).toBe('[REDACTED-FIELD]');
    expect(client.name).toBe('Acme Co');
  });

  test('password / token / api_key redacted', () => {
    const event = {
      extra: {
        password: 'hunter2',
        token: 'abc123xyz',
        api_key: 'sk-test-...',
        api_Key: 'mixed-case',
      },
    };
    const out = scrubEvent(event);
    expect(out.extra?.password).toBe('[REDACTED-FIELD]');
    expect(out.extra?.token).toBe('[REDACTED-FIELD]');
    expect(out.extra?.api_key).toBe('[REDACTED-FIELD]');
    expect(out.extra?.api_Key).toBe('[REDACTED-FIELD]');
  });

  test('bank routing/account redacted', () => {
    const event = {
      extra: { bank_routing: '123456789', bank_account: '987654321' },
    };
    const out = scrubEvent(event);
    expect(out.extra?.bank_routing).toBe('[REDACTED-FIELD]');
    expect(out.extra?.bank_account).toBe('[REDACTED-FIELD]');
  });

  test('non-sensitive keys pass through', () => {
    const event = {
      extra: {
        user_id: 'user_abc',
        action: 'click',
        path: '/personal',
      },
    };
    const out = scrubEvent(event);
    expect(out.extra?.user_id).toBe('user_abc');
    expect(out.extra?.action).toBe('click');
    expect(out.extra?.path).toBe('/personal');
  });
});

describe('scrubEvent — request fields', () => {
  test('cookies fully redacted', () => {
    const event = {
      request: { cookies: { session: 'abc' } as unknown },
    };
    const out = scrubEvent(event);
    expect(out.request?.cookies).toBe('[REDACTED-COOKIES]');
  });

  test('Authorization header redacted', () => {
    const event = {
      request: {
        headers: { Authorization: 'Bearer abc123', 'User-Agent': 'firefox' },
      },
    };
    const out = scrubEvent(event);
    expect(out.request?.headers?.Authorization).toBe('[REDACTED]');
    expect(out.request?.headers?.['User-Agent']).toBe('firefox');
  });

  test('query string with email scrubbed', () => {
    const event = {
      request: { query_string: 'email=alice@x.com&page=2' },
    };
    const out = scrubEvent(event);
    expect(out.request?.query_string).toBe('email=[REDACTED-EMAIL]&page=2');
  });
});

describe('scrubEvent — user identity', () => {
  test('user.email + user.ip_address redacted', () => {
    const event = { user: { email: 'alice@x.com', ip_address: '1.2.3.4' } };
    const out = scrubEvent(event);
    expect(out.user?.email).toBe('[REDACTED]');
    expect(out.user?.ip_address).toBe('[REDACTED]');
  });
});

describe('scrubEvent — pass-through', () => {
  test('event with no PII unchanged', () => {
    const event = {
      message: 'A normal log line about a click',
      extra: { route: '/home', count: 5 },
    };
    const out = scrubEvent(event);
    expect(out.message).toBe('A normal log line about a click');
    expect(out.extra?.route).toBe('/home');
    expect(out.extra?.count).toBe(5);
  });

  test('handles undefined fields', () => {
    const event = {};
    const out = scrubEvent(event);
    expect(out).toEqual({});
  });
});
