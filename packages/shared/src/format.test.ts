// Tests for the input-formatter helpers. Pure functions, easy to lock in
// boundary cases — empty strings, oversized input, mixed garbage. Each
// formatter must filter at the onChange boundary so a paste from a Notes
// app never lands as `23234234234234234234asdfgsdfgsdfg` in form state.

import { describe, expect, test } from 'bun:test';
import {
  formatDigits,
  formatEin,
  formatMoney,
  formatStateCode,
  formatYear,
  formatZip,
} from './format.js';

describe('formatEin', () => {
  test('formats 9 raw digits to XX-XXXXXXX', () => {
    expect(formatEin('123456789')).toBe('12-3456789');
  });

  test('keeps existing dash, strips letters', () => {
    expect(formatEin('12-3456789abc')).toBe('12-3456789');
  });

  test('caps at 9 digits — extra input ignored', () => {
    expect(formatEin('123456789999999')).toBe('12-3456789');
  });

  test('partial: 1-2 digits stay un-dashed', () => {
    expect(formatEin('1')).toBe('1');
    expect(formatEin('12')).toBe('12');
  });

  test('partial: 3+ digits get the dash', () => {
    expect(formatEin('123')).toBe('12-3');
    expect(formatEin('12345')).toBe('12-345');
  });

  test('strips arbitrary garbage paste', () => {
    expect(formatEin('23234234234234234234asdfgsdfgsdfg')).toBe('23-2342342');
  });

  test('empty input stays empty', () => {
    expect(formatEin('')).toBe('');
  });
});

describe('formatMoney', () => {
  test('formats raw digits with $ + comma grouping', () => {
    expect(formatMoney('50000')).toBe('$50,000');
    expect(formatMoney('1234567')).toBe('$1,234,567');
  });

  test('strips letters + symbols', () => {
    expect(formatMoney('$50,000')).toBe('$50,000');
    expect(formatMoney('asdfasdfasdf')).toBe('');
  });

  test('empty stays empty (no lone $)', () => {
    expect(formatMoney('')).toBe('');
    expect(formatMoney('abc')).toBe('');
  });

  test('zero formats correctly', () => {
    expect(formatMoney('0')).toBe('$0');
  });

  test('handles arbitrarily large input', () => {
    expect(formatMoney('1000000000000')).toBe('$1,000,000,000,000');
  });
});

describe('formatDigits', () => {
  test('caps at maxLen', () => {
    expect(formatDigits('123456789', 4)).toBe('1234');
    expect(formatDigits('99', 4)).toBe('99');
  });

  test('strips non-digits', () => {
    expect(formatDigits('1a2b3c', 6)).toBe('123');
  });

  test('handles maxLen 0', () => {
    expect(formatDigits('123', 0)).toBe('');
  });
});

describe('formatYear', () => {
  test('caps at 4 digits', () => {
    expect(formatYear('20251')).toBe('2025');
    expect(formatYear('99')).toBe('99');
  });

  test('strips letters', () => {
    expect(formatYear('2025abc')).toBe('2025');
  });
});

describe('formatZip', () => {
  test('caps at 5 digits', () => {
    expect(formatZip('123456789')).toBe('12345');
  });

  test('strips dashes (extended ZIP not collected in v0)', () => {
    expect(formatZip('12345-6789')).toBe('12345');
  });
});

describe('formatStateCode', () => {
  test('uppercases and caps at 2 letters', () => {
    expect(formatStateCode('ca')).toBe('CA');
    expect(formatStateCode('California')).toBe('CA');
  });

  test('strips digits + symbols', () => {
    expect(formatStateCode('c1a2')).toBe('CA');
  });

  test('empty stays empty', () => {
    expect(formatStateCode('')).toBe('');
  });
});
