import { describe, expect, it } from 'bun:test';
import {
  NudgeDraftSchema,
  NudgeAgentOutputSchema,
  composeNudgeTitle,
  defaultExpiryDays,
  draftNudge,
  formatImpact,
  type NudgeDraft,
} from './nudge-agent.js';
import type { TenantId, ClientId } from '@docket/shared';

const VALID_DRAFT: NudgeDraft = {
  title: "Patel LLC's revenue crossed $250K · S-corp election conversation",
  body: 'Q3 financials show Patel LLC at $267K revenue. Above the S-corp election threshold.',
  draftOutreach: 'Hi John, want to talk about S-corp election by year-end?',
  recommendedChannel: 'email',
  confidence: 0.85,
  expiresInDays: 14,
  reasoningTrail: [
    { kind: 'fact_query', label: 'Pulled Q3 revenue facts' },
    {
      kind: 'decision',
      label: 'Above $250K threshold',
      detail: 'Reasonable comp analysis next.',
    },
  ],
};

describe('NudgeDraftSchema', () => {
  it('accepts a well-formed draft', () => {
    expect(NudgeDraftSchema.safeParse(VALID_DRAFT).success).toBe(true);
  });

  it('rejects empty title', () => {
    expect(
      NudgeDraftSchema.safeParse({ ...VALID_DRAFT, title: '' }).success,
    ).toBe(false);
  });

  it('rejects title over 500 chars', () => {
    expect(
      NudgeDraftSchema.safeParse({ ...VALID_DRAFT, title: 'a'.repeat(501) })
        .success,
    ).toBe(false);
  });

  it('rejects confidence out of range', () => {
    expect(
      NudgeDraftSchema.safeParse({ ...VALID_DRAFT, confidence: 1.5 }).success,
    ).toBe(false);
    expect(
      NudgeDraftSchema.safeParse({ ...VALID_DRAFT, confidence: -0.1 }).success,
    ).toBe(false);
  });

  it('rejects expiresInDays out of range', () => {
    expect(
      NudgeDraftSchema.safeParse({ ...VALID_DRAFT, expiresInDays: 0 }).success,
    ).toBe(false);
    expect(
      NudgeDraftSchema.safeParse({ ...VALID_DRAFT, expiresInDays: 400 }).success,
    ).toBe(false);
  });

  it('accepts null draftOutreach (agent declined to draft)', () => {
    expect(
      NudgeDraftSchema.safeParse({ ...VALID_DRAFT, draftOutreach: null }).success,
    ).toBe(true);
  });

  it('rejects unknown channel', () => {
    expect(
      NudgeDraftSchema.safeParse({
        ...VALID_DRAFT,
        recommendedChannel: 'fax',
      }).success,
    ).toBe(false);
  });

  it('rejects empty reasoning trail label', () => {
    expect(
      NudgeDraftSchema.safeParse({
        ...VALID_DRAFT,
        reasoningTrail: [{ kind: 'decision', label: '' }],
      }).success,
    ).toBe(false);
  });

  it('rejects unknown reasoning kind', () => {
    expect(
      NudgeDraftSchema.safeParse({
        ...VALID_DRAFT,
        reasoningTrail: [{ kind: 'unknown', label: 'x' }],
      }).success,
    ).toBe(false);
  });
});

describe('NudgeAgentOutputSchema', () => {
  it('accepts a draft', () => {
    const result = NudgeAgentOutputSchema.safeParse({
      draft: VALID_DRAFT,
      skipReason: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a skip with null draft', () => {
    const result = NudgeAgentOutputSchema.safeParse({
      draft: null,
      skipReason: 'client already received this trigger 3 days ago',
    });
    expect(result.success).toBe(true);
  });
});

describe('defaultExpiryDays', () => {
  it('returns 7 for compliance_risk (urgency)', () => {
    expect(defaultExpiryDays('compliance_risk')).toBe(7);
  });
  it('returns 14 for milestone + drift + drift_from_prior', () => {
    expect(defaultExpiryDays('milestone')).toBe(14);
    expect(defaultExpiryDays('drift')).toBe(14);
    expect(defaultExpiryDays('drift_from_prior')).toBe(14);
  });
  it('returns 30 for time_window + life_event', () => {
    expect(defaultExpiryDays('time_window')).toBe(30);
    expect(defaultExpiryDays('life_event')).toBe(30);
  });
});

describe('formatImpact', () => {
  it('formats dollars >= 10000 with no decimal', () => {
    expect(formatImpact({ kind: 'dollars', value: 14000 })).toBe('$14K');
    expect(formatImpact({ kind: 'dollars', value: 100000 })).toBe('$100K');
  });
  it('formats dollars 1000-9999 with one decimal', () => {
    expect(formatImpact({ kind: 'dollars', value: 4200 })).toBe('$4.2K');
    expect(formatImpact({ kind: 'dollars', value: 9999 })).toBe('$10.0K');
  });
  it('formats dollars < 1000 with commas', () => {
    expect(formatImpact({ kind: 'dollars', value: 480 })).toBe('$480');
  });
  it('adds est. prefix when certainty is estimate', () => {
    expect(formatImpact({ kind: 'dollars', value: 14000, certainty: 'estimate' })).toBe(
      'est. $14K',
    );
  });
  it('omits est. prefix when certainty is precise', () => {
    expect(formatImpact({ kind: 'dollars', value: 14000, certainty: 'precise' })).toBe(
      '$14K',
    );
  });
  it('formats positive percent with +', () => {
    expect(formatImpact({ kind: 'percent', value: 40 })).toBe('+40%');
  });
  it('formats negative percent without extra +', () => {
    expect(formatImpact({ kind: 'percent', value: -60 })).toBe('-60%');
  });
  it('formats days with singular/plural agreement', () => {
    expect(formatImpact({ kind: 'days', value: 1 })).toBe('1 day');
    expect(formatImpact({ kind: 'days', value: 23 })).toBe('23 days');
  });
  it('formats count', () => {
    expect(formatImpact({ kind: 'count', value: 5 })).toBe('5');
  });
});

describe('composeNudgeTitle', () => {
  it('joins client name + situation + impact in canonical format', () => {
    expect(
      composeNudgeTitle(
        'Patel LLC',
        'revenue crossed $250K',
        'S-corp election conversation',
      ),
    ).toBe("Patel LLC's revenue crossed $250K · S-corp election conversation");
  });

  it('handles family-name client', () => {
    expect(
      composeNudgeTitle(
        'Patel Family',
        'AOTC eligibility starts Aug 25',
        'est. $2.5K savings',
      ),
    ).toBe(
      "Patel Family's AOTC eligibility starts Aug 25 · est. $2.5K savings",
    );
  });
});

describe('draftNudge (stub)', () => {
  it('returns ok + null draft with stub reason', async () => {
    const result = await draftNudge({
      trigger: {
        triggerClass: 'milestone',
        triggerKey: 'business_revenue_250k',
        context: { current_revenue: 267000 },
      },
      context: {
        tenantId: 'tenant-1' as TenantId,
        clientId: 'client-1' as ClientId,
        clientDisplayName: 'Patel LLC',
      },
    });
    expect(result.ok).toBe(true);
    expect(result.draft).toBeNull();
    expect(result.skipReason).toContain('nudge-agent-stub');
    expect(result.costUsd).toBe(0);
  });
});
