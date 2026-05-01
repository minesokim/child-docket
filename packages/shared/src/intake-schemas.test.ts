// Tests for intake validation schemas. Locks down the contract between
// the client portal (sending writes) and the server action (accepting them).

import { describe, test, expect } from 'bun:test';
import {
  validateIntakeField,
  getSchemaForPath,
  listKnownPaths,
} from './intake-schemas.js';

describe('validateIntakeField — accept correct values', () => {
  test('SSN with dashes', () => {
    const r = validateIntakeField('personal.ssn', '123-45-6789');
    expect(r.ok).toBe(true);
  });
  test('SSN without dashes', () => {
    const r = validateIntakeField('personal.ssn', '123456789');
    expect(r.ok).toBe(true);
  });
  test('Filing status enum value', () => {
    const r = validateIntakeField('filing.status', 'mfj');
    expect(r.ok).toBe(true);
  });
  test('Dependents count in range', () => {
    const r = validateIntakeField('dependents.count', 3);
    expect(r.ok).toBe(true);
  });
  test('ISO date', () => {
    const r = validateIntakeField('personal.dateOfBirth', '1990-04-15');
    expect(r.ok).toBe(true);
  });
  test('EIN with dash', () => {
    const r = validateIntakeField('selfEmployment.ein', '12-3456789');
    expect(r.ok).toBe(true);
  });
  test('Bank routing exactly 9 digits', () => {
    const r = validateIntakeField('refund.bankRouting', '123456789');
    expect(r.ok).toBe(true);
  });
  test('Glob path: dependents.list.0.ssn matches dependents.list.*.ssn', () => {
    const r = validateIntakeField('dependents.list.0.ssn', '111-22-3333');
    expect(r.ok).toBe(true);
  });
  test('Glob path: rental.properties.2.address', () => {
    const r = validateIntakeField('rental.properties.2.address', '123 Main St');
    expect(r.ok).toBe(true);
  });
});

describe('validateIntakeField — reject malformed values', () => {
  test('SSN too short', () => {
    const r = validateIntakeField('personal.ssn', '123');
    expect(r.ok).toBe(false);
  });
  test('SSN with letters', () => {
    const r = validateIntakeField('personal.ssn', 'ABC-DE-FGHI');
    expect(r.ok).toBe(false);
  });
  test('Filing status invalid enum', () => {
    const r = validateIntakeField('filing.status', 'married');
    expect(r.ok).toBe(false);
  });
  test('Dependents count negative', () => {
    const r = validateIntakeField('dependents.count', -1);
    expect(r.ok).toBe(false);
  });
  test('Dependents count too high', () => {
    const r = validateIntakeField('dependents.count', 100);
    expect(r.ok).toBe(false);
  });
  test('Date in wrong format', () => {
    const r = validateIntakeField('personal.dateOfBirth', '04/15/1990');
    expect(r.ok).toBe(false);
  });
  test('Routing number wrong length', () => {
    const r = validateIntakeField('refund.bankRouting', '12345678');
    expect(r.ok).toBe(false);
  });
  test('Routing number with letters', () => {
    const r = validateIntakeField('refund.bankRouting', '12345678A');
    expect(r.ok).toBe(false);
  });
});

describe('validateIntakeField — reject unknown paths', () => {
  test('Unknown top-level path', () => {
    const r = validateIntakeField('hackerStuff.payload', 'whatever');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('No schema');
  });
  test('Path that exists in IntakeState type but not registered', () => {
    // tutorial.somethingElse isn't registered
    const r = validateIntakeField('tutorial.somethingElse', true);
    expect(r.ok).toBe(false);
  });
});

describe('getSchemaForPath — direct + glob lookup', () => {
  test('Direct lookup works', () => {
    expect(getSchemaForPath('personal.ssn')).not.toBeNull();
  });
  test('Glob lookup for array index', () => {
    expect(getSchemaForPath('dependents.list.0.ssn')).not.toBeNull();
    expect(getSchemaForPath('dependents.list.99.firstName')).not.toBeNull();
    expect(getSchemaForPath('rental.properties.1.address')).not.toBeNull();
  });
  test('Returns null for unregistered path', () => {
    expect(getSchemaForPath('totally.unknown.path')).toBeNull();
  });
});

describe('listKnownPaths — auditing', () => {
  test('Returns all SENSITIVE_INTAKE_PATHS plus more', () => {
    const paths = listKnownPaths();
    expect(paths.length).toBeGreaterThan(50); // we have 60+ registered
    expect(paths).toContain('personal.ssn');
    expect(paths).toContain('refund.bankRouting');
    expect(paths).toContain('selfEmployment.ein');
  });

  test('Sorted alphabetically (predictable for diff review)', () => {
    const paths = listKnownPaths();
    const sorted = [...paths].sort();
    expect(paths).toEqual(sorted);
  });
});
