// Tests for the wire-format masking that the server applies to sensitive
// fields before sending answers to the client. Pure-function tests, no
// DB or server actions involved.

import { describe, expect, test } from 'bun:test';
import {
  isMaskedSentinel,
  MASK_CHAR,
  maskSensitive,
  maskSensitiveFields,
  type IntakeState,
} from './intake.js';

describe('maskSensitive — single-string masking', () => {
  test('SSN: keeps last 4, masks the first 5', () => {
    expect(maskSensitive('123456789')).toBe('·····6789');
  });

  test('SSN with dashes: same length, last 4 kept including any non-digits', () => {
    expect(maskSensitive('123-45-6789')).toBe('·······6789');
  });

  test('EIN with dash', () => {
    expect(maskSensitive('12-3456789')).toBe('······6789');
  });

  test('value shorter than keepLast: all masked', () => {
    expect(maskSensitive('123')).toBe('···');
    expect(maskSensitive('1')).toBe('·');
  });

  test('value exactly keepLast: all masked', () => {
    expect(maskSensitive('1234')).toBe('····');
  });

  test('empty string passes through', () => {
    expect(maskSensitive('')).toBe('');
  });

  test('configurable keepLast', () => {
    expect(maskSensitive('123456789', 2)).toBe('·······89');
    expect(maskSensitive('123456789', 0)).toBe('·········');
  });

  test('all chars are valid MASK_CHAR', () => {
    const masked = maskSensitive('123456789');
    expect(masked.startsWith(MASK_CHAR.repeat(5))).toBe(true);
    expect(masked.endsWith('6789')).toBe(true);
  });
});

describe('isMaskedSentinel', () => {
  test('detects masked SSN', () => {
    expect(isMaskedSentinel('·····6789')).toBe(true);
  });

  test('rejects raw plaintext SSN', () => {
    expect(isMaskedSentinel('123456789')).toBe(false);
    expect(isMaskedSentinel('123-45-6789')).toBe(false);
  });

  test('rejects empty + non-string', () => {
    expect(isMaskedSentinel('')).toBe(false);
    expect(isMaskedSentinel(null)).toBe(false);
    expect(isMaskedSentinel(undefined)).toBe(false);
    expect(isMaskedSentinel(123)).toBe(false);
    expect(isMaskedSentinel({})).toBe(false);
  });
});

describe('maskSensitiveFields — walks IntakeState SENSITIVE_INTAKE_PATHS', () => {
  test('masks personal.ssn', () => {
    const state: IntakeState = { personal: { ssn: '123456789', fullName: 'John Doe' } };
    const masked = maskSensitiveFields(state);
    expect(masked.personal?.ssn).toBe('·····6789');
    expect(masked.personal?.fullName).toBe('John Doe');
  });

  test('masks spouse.ssn', () => {
    const state: IntakeState = { spouse: { ssn: '987-65-4321', fullName: 'Jane Doe' } };
    const masked = maskSensitiveFields(state);
    expect(masked.spouse?.ssn).toBe('·······4321');
    expect(masked.spouse?.fullName).toBe('Jane Doe');
  });

  test('masks dependents.list[*].ssn (glob path)', () => {
    const state: IntakeState = {
      dependents: {
        count: 2,
        list: [
          { fullName: 'Kid A', ssn: '111-22-3333' },
          { fullName: 'Kid B', ssn: '444-55-6666' },
        ],
      },
    };
    const masked = maskSensitiveFields(state);
    expect(masked.dependents?.list?.[0]?.ssn).toBe('·······3333');
    expect(masked.dependents?.list?.[1]?.ssn).toBe('·······6666');
    // Non-sensitive fields untouched.
    expect(masked.dependents?.list?.[0]?.fullName).toBe('Kid A');
    expect(masked.dependents?.list?.[1]?.fullName).toBe('Kid B');
  });

  test('masks selfEmployment.ein, business.ein, business.ownerSsn', () => {
    const state: IntakeState = {
      selfEmployment: { ein: '12-3456789' },
      business: { ein: '98-7654321', ownerSsn: '111223333' },
    };
    const masked = maskSensitiveFields(state);
    expect(masked.selfEmployment?.ein).toBe('······6789');
    expect(masked.business?.ein).toBe('······4321');
    expect(masked.business?.ownerSsn).toBe('·····3333');
  });

  test('masks refund.bankRouting + refund.bankAccount', () => {
    const state: IntakeState = {
      refund: {
        preference: 'direct_deposit',
        bankName: 'Chase',
        bankRouting: '021000021',
        bankAccount: '1234567890',
      },
    };
    const masked = maskSensitiveFields(state);
    expect(masked.refund?.bankRouting).toBe('·····0021');
    expect(masked.refund?.bankAccount).toBe('······7890');
    // Non-sensitive bank metadata untouched.
    expect(masked.refund?.bankName).toBe('Chase');
    expect(masked.refund?.preference).toBe('direct_deposit');
  });

  test('handles empty/missing sensitive fields gracefully', () => {
    const state: IntakeState = { personal: { fullName: 'Has no SSN yet' } };
    const masked = maskSensitiveFields(state);
    expect(masked.personal?.fullName).toBe('Has no SSN yet');
    expect(masked.personal?.ssn).toBeUndefined();
  });

  test('returns a NEW object (no mutation)', () => {
    const state: IntakeState = { personal: { ssn: '123456789' } };
    const masked = maskSensitiveFields(state);
    expect(masked).not.toBe(state);
    // Original is untouched.
    expect(state.personal?.ssn).toBe('123456789');
  });

  test('round-trip: masked output is detected by isMaskedSentinel', () => {
    const state: IntakeState = { personal: { ssn: '123456789' } };
    const masked = maskSensitiveFields(state);
    expect(isMaskedSentinel(masked.personal?.ssn)).toBe(true);
  });

  test('round-trip: a masked value would NOT pass Zod validation', () => {
    // The point of using non-digit MASK_CHAR is that it can never round-trip
    // back to storage as if it were a real SSN. The Zod schema for
    // personal.ssn is /^\d{3}-?\d{2}-?\d{4}$/ — a string with `·` chars
    // fails immediately.
    const masked = maskSensitive('123456789');
    expect(/^\d{3}-?\d{2}-?\d{4}$/.test(masked)).toBe(false);
  });
});
