// Unit tests for send-8879-reminders cron.
//
// The cron's main logic (tenant iteration + signature scan + Twilio
// send) requires a real DB + a real Twilio mock for integration
// coverage. These tests cover the pure-function piece:
// `isInsideQuietHours` math.

import { describe, expect, test } from 'bun:test';
import { _testOnly } from './send-8879-reminders';

const { isInsideQuietHours } = _testOnly;

function at(hour: number, minute = 0): Date {
  // 2026-05-16 is a fixed-day-of-year reference; only hour/minute
  // matter to the function under test.
  const d = new Date('2026-05-16T00:00:00');
  d.setHours(hour, minute, 0, 0);
  return d;
}

describe('isInsideQuietHours', () => {
  test('null start or end → not quiet (unset config means always send)', () => {
    expect(isInsideQuietHours(at(2), null, null)).toBe(false);
    expect(isInsideQuietHours(at(14), 540, null)).toBe(false);
    expect(isInsideQuietHours(at(14), null, 1020)).toBe(false);
  });

  test('equal start + end → not quiet (zero-width window)', () => {
    expect(isInsideQuietHours(at(12), 540, 540)).toBe(false);
  });

  test('non-wrapping window (start < end): inside fires', () => {
    // 12:00 - 14:00
    expect(isInsideQuietHours(at(13), 720, 840)).toBe(true);
  });

  test('non-wrapping window: edge of start fires; edge of end does not', () => {
    expect(isInsideQuietHours(at(12, 0), 720, 840)).toBe(true);
    expect(isInsideQuietHours(at(14, 0), 720, 840)).toBe(false); // half-open
  });

  test('non-wrapping window: outside does not fire', () => {
    expect(isInsideQuietHours(at(10), 720, 840)).toBe(false);
    expect(isInsideQuietHours(at(15), 720, 840)).toBe(false);
  });

  test('wrapping window (start > end): late-night side fires', () => {
    // 19:00 (1140) - 07:00 (420) next day
    expect(isInsideQuietHours(at(22), 1140, 420)).toBe(true);
    expect(isInsideQuietHours(at(23, 30), 1140, 420)).toBe(true);
  });

  test('wrapping window: early-morning side fires', () => {
    expect(isInsideQuietHours(at(2), 1140, 420)).toBe(true);
    expect(isInsideQuietHours(at(6, 30), 1140, 420)).toBe(true);
  });

  test('wrapping window: mid-day does not fire', () => {
    expect(isInsideQuietHours(at(8), 1140, 420)).toBe(false);
    expect(isInsideQuietHours(at(12), 1140, 420)).toBe(false);
    expect(isInsideQuietHours(at(18), 1140, 420)).toBe(false);
  });

  test('wrapping window: exact edges (half-open)', () => {
    expect(isInsideQuietHours(at(19, 0), 1140, 420)).toBe(true);  // start
    expect(isInsideQuietHours(at(7, 0), 1140, 420)).toBe(false);  // end-exact
    expect(isInsideQuietHours(at(6, 59), 1140, 420)).toBe(true);
  });
});
