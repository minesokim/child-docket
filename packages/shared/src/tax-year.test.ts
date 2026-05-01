// Tests for taxYearForDate. The whole point of having a timezone-aware
// helper is to nail down exactly what tax year the system computes for
// boundary cases that previously (with naive new Date()) were buggy.

import { describe, expect, test } from 'bun:test';
import { taxYearForDate } from './intake.js';

describe('taxYearForDate — Pacific timezone (Vazant default)', () => {
  test('Mid-year falls into prior year (Jan–Oct rule)', () => {
    // May 1, 2026 noon Pacific. Active intake = 2025 returns.
    const may1 = new Date('2026-05-01T19:00:00Z'); // 12:00 PDT
    expect(taxYearForDate(may1)).toBe(2025);
  });

  test('Late October still prior year', () => {
    const oct31 = new Date('2026-10-31T22:00:00Z'); // 3:00 PDT
    expect(taxYearForDate(oct31)).toBe(2025);
  });

  test('Early November rolls to current year', () => {
    const nov1 = new Date('2026-11-01T20:00:00Z'); // 12:00 PST
    expect(taxYearForDate(nov1)).toBe(2026);
  });

  test('December 15 stays current year', () => {
    const dec15 = new Date('2026-12-15T20:00:00Z'); // 12:00 PST
    expect(taxYearForDate(dec15)).toBe(2026);
  });

  test('January 1 wraps back to prior year', () => {
    const jan1 = new Date('2027-01-01T20:00:00Z'); // 12:00 PST 2027
    expect(taxYearForDate(jan1)).toBe(2026);
  });
});

describe('taxYearForDate — TZ boundary cases (the bug-fix evidence)', () => {
  test('Pacific 11:55 PM Dec 31 stays in prior tax year, even when UTC has rolled to Jan 1', () => {
    // 2026-12-31 23:55 PST = 2027-01-01 07:55 UTC.
    // Naive Date.getMonth() in UTC would say Jan -> active tax year 2026
    // (their NEXT tax year). User in Pacific wall clock thinks it's still
    // December -> active tax year should be 2026 (the CURRENT tax year
    // they're early-filing for). Both happen to land at 2026 here, but
    // the buggy version flips the rule at this boundary.
    const pst11_55pm_dec31 = new Date('2027-01-01T07:55:00Z');
    expect(taxYearForDate(pst11_55pm_dec31)).toBe(2026);
  });

  test('Pacific 11:55 PM Oct 31 stays prior year (UTC has rolled to Nov 1)', () => {
    // 2026-10-31 23:55 PDT = 2026-11-01 06:55 UTC.
    // Naive Date.getMonth() in UTC would say November -> rolls to
    // current year (2026). Pacific wall clock says October -> stays
    // prior year (2025). This is a REAL year flip, and the buggy code
    // would put two clients on different tax years depending on their
    // 6-hour upload window.
    const pdt11_55pm_oct31 = new Date('2026-11-01T06:55:00Z');
    expect(taxYearForDate(pdt11_55pm_oct31)).toBe(2025);
  });

  test('Pacific 12:30 AM Nov 1 properly rolls to current year', () => {
    // 2026-11-01 00:30 PDT = 2026-11-01 07:30 UTC. Both UTC and Pacific
    // agree it's November.
    const pdt00_30am_nov1 = new Date('2026-11-01T07:30:00Z');
    expect(taxYearForDate(pdt00_30am_nov1)).toBe(2026);
  });
});

describe('taxYearForDate — explicit timezone parameter', () => {
  test('Eastern timezone shifts the rollover', () => {
    // 2026-11-01 00:30 EDT = 2026-11-01 04:30 UTC. Eastern is also
    // November now, so rolls to current year.
    const edt00_30am_nov1 = new Date('2026-11-01T04:30:00Z');
    expect(taxYearForDate(edt00_30am_nov1, 'America/New_York')).toBe(2026);
    // But Pacific time at the same UTC moment is still 2026-10-31 21:30
    // — October. So Pacific stays prior year.
    expect(taxYearForDate(edt00_30am_nov1, 'America/Los_Angeles')).toBe(2025);
  });

  test('UTC explicitly works', () => {
    const may1noonUtc = new Date('2026-05-01T12:00:00Z');
    expect(taxYearForDate(may1noonUtc, 'UTC')).toBe(2025);
  });

  test('Bogus timezone throws', () => {
    expect(() => taxYearForDate(new Date(), 'Not/AReal/Zone')).toThrow();
  });
});
