// Tests for the pure logic in @docket/storage. Network calls
// (presigned URL generation, GET / PUT / HEAD) require live R2
// creds and aren't tested here — covered by manual smoke tests
// against a real bucket.

import { describe, it, expect } from 'bun:test';
import { sanitizeFilename, buildStorageKey } from './index.js';
import { ulid } from './ulid.js';
import type { TenantId, ClientId } from '@docket/shared';

const TENANT = 'tenant-aaa-bbb-ccc' as TenantId;
const CLIENT = 'client-111-222-333' as ClientId;

describe('sanitizeFilename', () => {
  it('passes safe filenames through unchanged', () => {
    expect(sanitizeFilename('w2.pdf')).toBe('w2.pdf');
    expect(sanitizeFilename('2024_W-2_Acme.pdf')).toBe('2024_W-2_Acme.pdf');
  });

  it('strips path separators (defense vs. ../../etc/passwd)', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFilename('foo/bar.pdf')).toBe('bar.pdf');
    expect(sanitizeFilename('foo\\bar\\evil.pdf')).toBe('evil.pdf');
  });

  it('replaces unsafe chars with underscore', () => {
    expect(sanitizeFilename('My File (final) v2.pdf')).toBe('My_File_final_v2.pdf');
    expect(sanitizeFilename("client's W-2.pdf")).toBe('client_s_W-2.pdf');
  });

  it('trims leading/trailing underscores', () => {
    expect(sanitizeFilename('  spaces  .pdf')).toBe('spaces_.pdf');
    expect(sanitizeFilename('___leading')).toBe('leading');
  });

  it('returns "file" for empty input', () => {
    expect(sanitizeFilename('')).toBe('file');
    expect(sanitizeFilename('   ')).toBe('file');
    expect(sanitizeFilename('@@@@@')).toBe('file');
  });

  it('truncates long filenames preserving the extension', () => {
    const long = 'a'.repeat(100) + '.pdf';
    const result = sanitizeFilename(long);
    expect(result.length).toBeLessThanOrEqual(80);
    expect(result.endsWith('.pdf')).toBe(true);
  });

  it('truncates long filenames without extension', () => {
    const long = 'a'.repeat(100);
    const result = sanitizeFilename(long);
    expect(result.length).toBe(80);
  });
});

describe('buildStorageKey', () => {
  it('uses the tenants/clients/docs layout', () => {
    const key = buildStorageKey({
      tenantId: TENANT,
      clientId: CLIENT,
      filename: 'w2.pdf',
      id: '01HXYZ',
    });
    expect(key).toBe(`tenants/${TENANT}/clients/${CLIENT}/docs/01HXYZ-w2.pdf`);
  });

  it('sanitizes the filename component', () => {
    const key = buildStorageKey({
      tenantId: TENANT,
      clientId: CLIENT,
      filename: '../../etc/passwd',
      id: '01HXYZ',
    });
    expect(key).toBe(`tenants/${TENANT}/clients/${CLIENT}/docs/01HXYZ-passwd`);
    expect(key).not.toContain('..');
  });

  it('generates a fresh ulid when none is provided', () => {
    const a = buildStorageKey({ tenantId: TENANT, clientId: CLIENT, filename: 'a.pdf' });
    const b = buildStorageKey({ tenantId: TENANT, clientId: CLIENT, filename: 'a.pdf' });
    expect(a).not.toBe(b);
    // ulid component is 26 chars between "/docs/" and "-a.pdf"
    const ulidA = a.split('/docs/')[1]!.split('-')[0]!;
    expect(ulidA.length).toBe(26);
  });
});

describe('ulid', () => {
  it('returns a 26-character string', () => {
    const id = ulid();
    expect(id.length).toBe(26);
  });

  it('uses Crockford base32 alphabet (no I L O U)', () => {
    const id = ulid();
    expect(id).toMatch(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]+$/);
  });

  it('is monotonic when seeded with later timestamps', () => {
    const a = ulid(1700000000000);
    const b = ulid(1700000001000);
    expect(b > a).toBe(true);
  });

  it('generates unique values on repeated calls', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) ids.add(ulid());
    expect(ids.size).toBe(100);
  });
});
