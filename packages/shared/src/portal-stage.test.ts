import { describe, expect, it } from 'bun:test';
import {
  detectPortalStage,
  getStageCopy,
  videoSlotKey,
  type PortalStageInputs,
  type StageContext,
} from './portal-stage.js';

const BASE_INPUT: PortalStageInputs = {
  intakeComplete: false,
  docsUploaded: false,
  depositPaid: false,
  eightyseventynineSent: false,
  eightyseventynineSigned: false,
  filed: false,
  filingAcknowledged: false,
  daysSinceFiling: 0,
};

const BASE_CTX: StageContext = {
  firstName: 'Maria',
  firmName: 'Vazant Consulting',
  ownerName: 'Antonio',
  taxYear: '2025',
};

describe('detectPortalStage', () => {
  it('defaults to first_time when nothing is started', () => {
    expect(detectPortalStage(BASE_INPUT)).toBe('first_time');
  });

  it('returns first_time when intake is started but no deposit/docs', () => {
    expect(
      detectPortalStage({ ...BASE_INPUT, intakeComplete: true }),
    ).toBe('first_time');
  });

  it('returns docs_received once deposit is paid AND docs uploaded', () => {
    expect(
      detectPortalStage({
        ...BASE_INPUT,
        depositPaid: true,
        docsUploaded: true,
      }),
    ).toBe('docs_received');
  });

  it('stays first_time if deposit paid but no docs', () => {
    expect(
      detectPortalStage({ ...BASE_INPUT, depositPaid: true, docsUploaded: false }),
    ).toBe('first_time');
  });

  it('returns review_ready when 8879 is sent (even if not signed)', () => {
    expect(
      detectPortalStage({
        ...BASE_INPUT,
        depositPaid: true,
        docsUploaded: true,
        eightyseventynineSent: true,
      }),
    ).toBe('review_ready');
  });

  it('returns review_ready when 8879 is sent + signed but not filed', () => {
    expect(
      detectPortalStage({
        ...BASE_INPUT,
        eightyseventynineSent: true,
        eightyseventynineSigned: true,
      }),
    ).toBe('review_ready');
  });

  it('returns filed_refund when filed (even without ack)', () => {
    expect(
      detectPortalStage({
        ...BASE_INPUT,
        eightyseventynineSent: true,
        eightyseventynineSigned: true,
        filed: true,
      }),
    ).toBe('filed_refund');
  });

  it('returns off_season when filed + acknowledged + >60d past filing', () => {
    expect(
      detectPortalStage({
        ...BASE_INPUT,
        filed: true,
        filingAcknowledged: true,
        daysSinceFiling: 90,
      }),
    ).toBe('off_season');
  });

  it('stays filed_refund when acknowledged but <60d past filing', () => {
    expect(
      detectPortalStage({
        ...BASE_INPUT,
        filed: true,
        filingAcknowledged: true,
        daysSinceFiling: 30,
      }),
    ).toBe('filed_refund');
  });

  it('stays filed_refund when filed but not acknowledged even after 60d', () => {
    expect(
      detectPortalStage({
        ...BASE_INPUT,
        filed: true,
        filingAcknowledged: false,
        daysSinceFiling: 90,
      }),
    ).toBe('filed_refund');
  });
});

describe('getStageCopy', () => {
  it('interpolates firstName into first_time title', () => {
    const copy = getStageCopy('first_time', BASE_CTX);
    expect(copy.title).toContain('Maria');
    expect(copy.cta).toBe('Resume intake');
    expect(copy.tone).toBe('action');
  });

  it('interpolates firmName + ownerName into docs_received body', () => {
    const copy = getStageCopy('docs_received', BASE_CTX);
    expect(copy.body).toContain('Antonio');
    expect(copy.body).toContain('Vazant Consulting');
    expect(copy.tone).toBe('progress');
  });

  it('uses taxYear in review_ready title', () => {
    const copy = getStageCopy('review_ready', BASE_CTX);
    expect(copy.title).toContain('2025');
    expect(copy.cta).toBe('Sign Form 8879');
    expect(copy.tone).toBe('action');
  });

  it('renders filed_refund without refund amount as generic acknowledgement', () => {
    const copy = getStageCopy('filed_refund', BASE_CTX);
    expect(copy.body).toMatch(/acknowledgement/i);
    expect(copy.tone).toBe('success');
  });

  it('renders filed_refund WITH refund amount + expected date', () => {
    const copy = getStageCopy('filed_refund', {
      ...BASE_CTX,
      refundAmount: 3247,
      refundExpectedBy: '2026-07-15',
      filedDate: '2026-04-14',
    });
    expect(copy.body).toContain('$3,247');
    expect(copy.title).toContain('Apr 14');
  });

  it('renders off_season copy in neutral tone', () => {
    const copy = getStageCopy('off_season', BASE_CTX);
    expect(copy.tone).toBe('neutral');
    expect(copy.cta).toBe('Plan ahead');
  });

  it('every stage returns a defined CTA href', () => {
    const stages = ['first_time', 'docs_received', 'review_ready', 'filed_refund', 'off_season'] as const;
    for (const s of stages) {
      const c = getStageCopy(s, BASE_CTX);
      expect(c.ctaHref.length).toBeGreaterThan(0);
      expect(c.ctaHref.startsWith('/')).toBe(true);
    }
  });
});

describe('videoSlotKey', () => {
  it('maps every stage to the right video slot', () => {
    expect(videoSlotKey('first_time')).toBe('first_time');
    expect(videoSlotKey('docs_received')).toBe('docs_received');
    expect(videoSlotKey('review_ready')).toBe('review_ready');
    expect(videoSlotKey('filed_refund')).toBe('post_filing');
    expect(videoSlotKey('off_season')).toBe('returning');
  });
});
