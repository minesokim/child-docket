// Tests for the CA SoS BE Public Search helpers. Pure functions —
// the actual HTTP fetch is exercised separately via integration tests
// against the Route Handler (out of scope for unit tests; fetchCaSoSEntity
// requires CA_SOS_API_KEY to be live).
//
// Coverage:
//   - bucketCaSoSStatus maps every documented raw status correctly
//   - bucketCaSoSStatus defends against unknown future statuses
//   - normalizeCaSoSQuery trims + collapses whitespace, idempotent
//   - parseCaSoSResponse returns not_found on empty entities array
//   - parseCaSoSResponse prefers exact (case-insensitive) name match
//   - parseCaSoSResponse falls back to first match when no exact
//   - parseCaSoSResponse rejects malformed JSON gracefully

import { describe, expect, test } from 'bun:test';
import {
  bucketCaSoSStatus,
  normalizeCaSoSQuery,
  parseCaSoSResponse,
} from './ca-sos.js';

describe('bucketCaSoSStatus', () => {
  test('Active → active', () => {
    expect(bucketCaSoSStatus('Active')).toBe('active');
  });

  test('SoS suspension → suspended', () => {
    expect(bucketCaSoSStatus('Suspended (SOS)')).toBe('suspended');
  });

  test('FTB suspension → suspended (mirrored from FTB)', () => {
    expect(bucketCaSoSStatus('FTB Suspended')).toBe('suspended');
  });

  test('Forfeited → forfeited', () => {
    expect(bucketCaSoSStatus('Forfeited')).toBe('forfeited');
  });

  test('FTB Forfeited → forfeited', () => {
    expect(bucketCaSoSStatus('FTB Forfeited')).toBe('forfeited');
  });

  test('Dissolved → dissolved', () => {
    expect(bucketCaSoSStatus('Dissolved')).toBe('dissolved');
  });

  test('Cancelled / Merged Out / Surrendered all bucket to dissolved', () => {
    expect(bucketCaSoSStatus('Cancelled')).toBe('dissolved');
    expect(bucketCaSoSStatus('Merged Out')).toBe('dissolved');
    expect(bucketCaSoSStatus('Surrendered')).toBe('dissolved');
  });

  test('unknown future status → unknown (defensive)', () => {
    expect(bucketCaSoSStatus('Frozen By Court Order')).toBe('unknown');
    expect(bucketCaSoSStatus('')).toBe('unknown');
  });
});

describe('normalizeCaSoSQuery', () => {
  test('trims leading + trailing whitespace', () => {
    expect(normalizeCaSoSQuery('  Acme LLC  ')).toBe('Acme LLC');
  });

  test('collapses internal whitespace to single space', () => {
    expect(normalizeCaSoSQuery('Acme   Holdings    LLC')).toBe('Acme Holdings LLC');
  });

  test('preserves punctuation as documented in API guide', () => {
    // L.L.C. vs LLC — CA SoS treats them differently, so DON'T normalize.
    expect(normalizeCaSoSQuery('Acme L.L.C.')).toBe('Acme L.L.C.');
  });

  test('idempotent', () => {
    const once = normalizeCaSoSQuery('  Acme  LLC  ');
    expect(normalizeCaSoSQuery(once)).toBe(once);
  });

  test('empty / whitespace-only input', () => {
    expect(normalizeCaSoSQuery('')).toBe('');
    expect(normalizeCaSoSQuery('    ')).toBe('');
  });
});

describe('parseCaSoSResponse', () => {
  test('rejects non-object JSON', () => {
    const result = parseCaSoSResponse(null, 'Acme');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_response');
  });

  test('rejects string JSON', () => {
    const result = parseCaSoSResponse('error', 'Acme');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_response');
  });

  test('empty entities array → not_found', () => {
    const result = parseCaSoSResponse({ entities: [] }, 'Acme');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe('not_found');
      expect(result.entityNumber).toBeNull();
      expect(result.matchedName).toBeNull();
    }
  });

  test('missing entities key → not_found', () => {
    const result = parseCaSoSResponse({}, 'Acme');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.status).toBe('not_found');
  });

  test('single Active match returns bucketed status + entity number', () => {
    const json = {
      entities: [
        {
          entityName: 'Acme Holdings LLC',
          entityNumber: '202100123456',
          entityStatus: 'Active',
          entityType: 'Limited Liability Company',
        },
      ],
    };
    const result = parseCaSoSResponse(json, 'Acme Holdings LLC');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe('active');
      expect(result.entityNumber).toBe('202100123456');
      expect(result.matchedName).toBe('Acme Holdings LLC');
      expect(result.rawStatus).toBe('Active');
    }
  });

  test('FTB Suspended entity buckets to suspended', () => {
    const json = {
      entities: [
        {
          entityName: 'Lapsed Co Inc',
          entityNumber: 'C1234567',
          entityStatus: 'FTB Suspended',
        },
      ],
    };
    const result = parseCaSoSResponse(json, 'Lapsed Co Inc');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe('suspended');
      expect(result.rawStatus).toBe('FTB Suspended');
    }
  });

  test('prefers exact case-insensitive match over first result', () => {
    const json = {
      entities: [
        // First in array but partial — should NOT win.
        { entityName: 'Acme Holdings International LLC', entityStatus: 'Active' },
        // Exact match (case-different) — should win.
        { entityName: 'ACME HOLDINGS LLC', entityNumber: '202100999', entityStatus: 'Active' },
      ],
    };
    const result = parseCaSoSResponse(json, 'Acme Holdings LLC');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.matchedName).toBe('ACME HOLDINGS LLC');
      expect(result.entityNumber).toBe('202100999');
    }
  });

  test('falls back to first result when no exact match', () => {
    const json = {
      entities: [
        { entityName: 'Acme Holdings International LLC', entityStatus: 'Active' },
        { entityName: 'Acme Trucking LLC', entityStatus: 'Active' },
      ],
    };
    const result = parseCaSoSResponse(json, 'Acme');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.matchedName).toBe('Acme Holdings International LLC');
    }
  });

  test('unknown raw status maps to unknown bucket', () => {
    const json = {
      entities: [
        { entityName: 'Test LLC', entityStatus: 'Frozen Under Court Order' },
      ],
    };
    const result = parseCaSoSResponse(json, 'Test LLC');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe('unknown');
      expect(result.rawStatus).toBe('Frozen Under Court Order');
    }
  });

  test('null/undefined entries in entities array are filtered out (codex regression 2026-05-14)', () => {
    const json = {
      entities: [null, undefined, { entityName: 'Real LLC', entityStatus: 'Active' }],
    };
    const result = parseCaSoSResponse(json, 'Real LLC');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe('active');
      expect(result.matchedName).toBe('Real LLC');
    }
  });

  test('all-null entities array degrades to not_found, never throws', () => {
    const json = { entities: [null, null, null] };
    const result = parseCaSoSResponse(json, 'Anything');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.status).toBe('not_found');
  });

  test('entity row missing entityName is tolerated (uses fields as-typed)', () => {
    const json = {
      entities: [
        { entityNumber: 'C9999999', entityStatus: 'Active' },
      ],
    };
    const result = parseCaSoSResponse(json, 'Whatever');
    expect(result.ok).toBe(true);
    if (result.ok) {
      // No exact-name match possible since entityName missing → fall
      // back to first row. matchedName ends up null because the row
      // doesn't carry one.
      expect(result.matchedName).toBeNull();
      expect(result.entityNumber).toBe('C9999999');
      expect(result.status).toBe('active');
    }
  });
});
