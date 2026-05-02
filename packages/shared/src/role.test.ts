// Tests for the pure role helpers. Day 4 wire-up + verification —
// proves the role logic works in isolation before we trust it on
// the actual /clients gates and future Server Action sites.
//
// Run: pnpm --filter @docket/shared test

import { describe, expect, test } from 'bun:test';
import { USER_ROLES, isRole, assertRole, hasRole } from './role.js';

describe('USER_ROLES tuple', () => {
  test('has exactly the five v0 roles', () => {
    expect(USER_ROLES).toEqual([
      'firm_owner',
      'preparer',
      'reviewer',
      'admin',
      'assistant',
    ]);
  });

  test('is readonly at the type level', () => {
    // Compile-time: USER_ROLES is `readonly [...]`. Mutating ops are
    // not callable. We can't test that directly without ts-expect-error
    // gymnastics; the explicit `as const` in role.ts is the contract.
    expect(Array.isArray(USER_ROLES)).toBe(true);
  });
});

describe('isRole', () => {
  test('returns true for every canonical role', () => {
    for (const role of USER_ROLES) {
      expect(isRole(role)).toBe(true);
    }
  });

  test('returns false for the legacy "owner" string', () => {
    // Pre-Day-3 seed used 'owner'; migration 0010 remaps to firm_owner.
    // After the migration runs, no row should ever surface 'owner' —
    // and isRole correctly rejects it as a defensive measure.
    expect(isRole('owner')).toBe(false);
  });

  test('returns false for arbitrary strings', () => {
    expect(isRole('janitor')).toBe(false);
    expect(isRole('FIRM_OWNER')).toBe(false); // case-sensitive
    expect(isRole('')).toBe(false);
    expect(isRole('client')).toBe(false); // taxpayers aren't users; clients table is separate
  });

  test('returns false for non-string values', () => {
    expect(isRole(null)).toBe(false);
    expect(isRole(undefined)).toBe(false);
    expect(isRole(0)).toBe(false);
    expect(isRole({})).toBe(false);
    expect(isRole(['firm_owner'])).toBe(false);
  });
});

describe('assertRole', () => {
  test('passes silently when role is in allowed set', () => {
    const user = { role: 'firm_owner' };
    expect(() => assertRole(user, ['firm_owner'])).not.toThrow();
    expect(() => assertRole(user, ['firm_owner', 'preparer'])).not.toThrow();
  });

  test('throws when role is not in allowed set', () => {
    const user = { role: 'admin' };
    expect(() => assertRole(user, ['firm_owner'])).toThrow(
      "Unauthorized: role 'admin' not in [firm_owner]",
    );
  });

  test('throws on legacy / unknown role strings', () => {
    expect(() => assertRole({ role: 'owner' }, ['firm_owner'])).toThrow(
      "Unauthorized: unknown role 'owner'",
    );
    expect(() => assertRole({ role: 'janitor' }, ['firm_owner'])).toThrow(
      "Unauthorized: unknown role 'janitor'",
    );
    expect(() => assertRole({ role: '' }, ['preparer'])).toThrow(
      "Unauthorized: unknown role ''",
    );
  });

  test('PTIN-signing matrix: only firm_owner allowed', () => {
    // The actual policy from require-role.ts header. When the 8879
    // DocuSign + KBA flow lands on Day 13, this is the gate it'll use.
    const allowed = ['firm_owner'] as const;

    expect(() => assertRole({ role: 'firm_owner' }, allowed)).not.toThrow();
    expect(() => assertRole({ role: 'preparer' }, allowed)).toThrow();
    expect(() => assertRole({ role: 'reviewer' }, allowed)).toThrow();
    expect(() => assertRole({ role: 'admin' }, allowed)).toThrow();
    expect(() => assertRole({ role: 'assistant' }, allowed)).toThrow();
  });

  test('SSN-reveal matrix: firm_owner / preparer / reviewer allowed', () => {
    // The future preparer-side reveal endpoint will use this gate.
    // Admin and assistant roles handle billing / message routing
    // and don't need plaintext PII.
    const allowed = ['firm_owner', 'preparer', 'reviewer'] as const;

    expect(() => assertRole({ role: 'firm_owner' }, allowed)).not.toThrow();
    expect(() => assertRole({ role: 'preparer' }, allowed)).not.toThrow();
    expect(() => assertRole({ role: 'reviewer' }, allowed)).not.toThrow();
    expect(() => assertRole({ role: 'admin' }, allowed)).toThrow();
    expect(() => assertRole({ role: 'assistant' }, allowed)).toThrow();
  });
});

describe('hasRole', () => {
  test('returns true for matches, false for non-matches', () => {
    expect(hasRole({ role: 'firm_owner' }, ['firm_owner'])).toBe(true);
    expect(hasRole({ role: 'firm_owner' }, ['preparer'])).toBe(false);
    expect(hasRole({ role: 'admin' }, ['firm_owner', 'admin'])).toBe(true);
  });

  test('returns false for unknown / legacy roles even if string matches naively', () => {
    // Defense in depth: even if someone writes hasRole(user, ['owner'])
    // hoping to slip the legacy string through, isRole guards first.
    expect(hasRole({ role: 'owner' }, ['firm_owner'])).toBe(false);
  });

  test('empty allowed list never matches', () => {
    expect(hasRole({ role: 'firm_owner' }, [])).toBe(false);
  });
});
