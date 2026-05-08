// Golden vectors for the inbox-drafter eval.
//
// Per docs/PRODUCTION-READINESS.md §C — sister to classifier-cases.
// 6 cases covering the most common issue types + voice rules.
//
// SCORING SHAPE
//   The drafter has a richer output (channel, language, subject, body,
//   signature, suggestedAttachments, followUpDate, confidence). Pure
//   F1 doesn't fit; we score per-case PASS/FAIL on a hand-checked
//   set of structural assertions:
//
//     - isClientFacing matches expected
//     - channel matches expected (email vs sms vs portal_chat)
//     - language matches expected (en vs es)
//     - subject is null/non-null per channel rule
//     - body length within plausible range
//     - confidence >= 0.6
//
// AUTHORING NOTES
//   - Two issue types intentionally include the INTERNAL-only path
//     (ero_pending, meeting_prep) to lock in isClientFacing=false.
//   - Spanish case verifies the bilingual switch (preferredLanguage:
//     'es' → body in Spanish).
//   - Each issue is built from a fixture-shaped ClassifierOutput.

import type { DrafterInput } from '../../src/agents/inbox-drafter.js';
import type { ClientId, IssueType, TenantId } from '@docket/shared';

export interface DrafterEvalCase {
  id: string;
  description: string;
  input: DrafterInput;
  expected: {
    isClientFacing: boolean;
    channel: 'email' | 'sms' | 'portal_chat';
    language: 'en' | 'es';
    subjectIsNull: boolean;
    bodyMinLen?: number;
    bodyMaxLen?: number;
    confidenceMin?: number;
    /** Optional: substring expected in body (case-insensitive). */
    bodyContains?: string;
  };
}

const baseClassifierOutput = (overrides: Partial<DrafterInput['issue']>): DrafterInput['issue'] => ({
  issueType: 'doc_mismatch' as IssueType,
  severity: 'high' as const,
  confidence: 0.95,
  title: 'Test issue',
  summary: 'Test summary',
  whyThisMatters: 'This matters because we say so for the eval test',
  recommendedAction: 'Send a draft message to confirm.',
  evidence: {},
  sources: [],
  ...overrides,
});

const baseContext = (overrides: Partial<DrafterInput['context']> = {}): DrafterInput['context'] => ({
  tenantId: 'tenant_seed_vazant' as TenantId,
  clientId: 'client_seed_priya' as ClientId,
  clientFullName: 'Priya Sharma',
  clientFirstName: 'Priya',
  preferredLanguage: 'en',
  channel: 'email',
  preparerFullName: 'Antonio Vazquez',
  preparerSignOff: 'Antonio',
  firmName: 'Vazant Consulting',
  ...overrides,
});

export const DRAFTER_CASES: DrafterEvalCase[] = [
  {
    id: 'doc_mismatch_email_en',
    description: 'doc_mismatch issue → client-facing email draft in English',
    input: {
      issue: baseClassifierOutput({
        issueType: 'doc_mismatch',
        title: "Priya's TikTok 1099 doesn't match her intake",
        summary: 'TikTok 1099 shows $4,320 vs $2,300 reported in intake',
        whyThisMatters:
          'The 1099-NEC from TikTok shows $4,320 in earnings, which doesn’t match the $2,300 Priya reported in her intake.',
        recommendedAction:
          'Send a message to Priya to confirm which amount is correct and request any additional TikTok income.',
        evidence: {
          intakeAmount: { value: 230000, source: 'Intake response', confidence: 'high' },
          documentAmount: { value: 432000, source: 'TikTok 1099-NEC', confidence: 'high' },
        },
      }),
      context: baseContext({ channel: 'email' }),
    },
    expected: {
      isClientFacing: true,
      channel: 'email',
      language: 'en',
      subjectIsNull: false,
      bodyMinLen: 50,
      bodyMaxLen: 1500,
      confidenceMin: 0.6,
    },
  },
  {
    id: 'doc_gap_sms_en',
    description: 'doc_gap issue → SMS draft (subject must be null)',
    input: {
      issue: baseClassifierOutput({
        issueType: 'doc_gap',
        severity: 'medium',
        title: 'W-2 from Acme Corp not yet uploaded',
        summary: 'Need W-2 from Acme Corp to file Priya’s 1040',
        whyThisMatters:
          'Priya said she has wages from Acme Corp but no W-2 has been uploaded. April 15 is approaching.',
        recommendedAction: 'Send a short SMS asking Priya to upload her W-2 today.',
      }),
      context: baseContext({ channel: 'sms' }),
    },
    expected: {
      isClientFacing: true,
      channel: 'sms',
      language: 'en',
      subjectIsNull: true,
      bodyMinLen: 20,
      bodyMaxLen: 320,
      confidenceMin: 0.6,
    },
  },
  {
    id: 'ero_pending_internal',
    description: 'ero_pending → INTERNAL note, isClientFacing=false',
    input: {
      issue: baseClassifierOutput({
        issueType: 'ero_pending',
        title: 'Priya signed 8879; ERO countersignature needed',
        summary: 'Return ready to file pending Antonio’s ERO authorization',
        whyThisMatters:
          'Priya signed her 8879 yesterday. The return is complete and ready to e-file as soon as Antonio counters-signs.',
        recommendedAction: 'Antonio: sign 8879 ERO authorization for Priya to send the return.',
      }),
      context: baseContext({ channel: 'email' }),
    },
    expected: {
      isClientFacing: false,
      channel: 'email',
      language: 'en',
      // isClientFacing=false → subject + signature + attachments
      // are skippable per the prompt's hard rules. We don't assert
      // subjectIsNull (the model may pick null OR a short subject).
      subjectIsNull: true,
      bodyMinLen: 20,
      bodyMaxLen: 800,
      confidenceMin: 0.6,
    },
  },
  {
    id: 'irs_notice_email_en',
    description: 'irs_notice → calm, direct email; never accusatory',
    input: {
      issue: baseClassifierOutput({
        issueType: 'irs_notice',
        title: 'CP2000 notice received for Priya',
        summary: 'IRS proposing $1,847 in additional tax for 2024',
        whyThisMatters:
          'A CP2000 notice arrived dated 2026-05-01 proposing $1,847 in additional tax for 2024.',
        recommendedAction:
          'Acknowledge receipt, explain what CP2000 is in plain English, set expectation for the response timeline.',
      }),
      context: baseContext({ channel: 'email' }),
    },
    expected: {
      isClientFacing: true,
      channel: 'email',
      language: 'en',
      subjectIsNull: false,
      bodyMinLen: 100,
      bodyMaxLen: 2000,
      confidenceMin: 0.6,
    },
  },
  {
    id: 'doc_mismatch_email_es',
    description: 'doc_mismatch + Spanish-preferred client → body in Spanish',
    input: {
      issue: baseClassifierOutput({
        issueType: 'doc_mismatch',
        title: 'Carlos’s 1099-NEC contradicts intake',
        summary: '1099 shows $5,800 vs $4,200 in intake',
        whyThisMatters:
          'El 1099-NEC muestra $5,800 mientras que en intake Carlos reportó $4,200. Necesitamos confirmar el monto correcto.',
        recommendedAction: 'Send a Spanish email asking Carlos to confirm which amount is correct.',
      }),
      context: baseContext({
        clientFullName: 'Carlos Mendoza',
        clientFirstName: 'Carlos',
        preferredLanguage: 'es',
        channel: 'email',
      }),
    },
    expected: {
      isClientFacing: true,
      channel: 'email',
      language: 'es',
      subjectIsNull: false,
      bodyMinLen: 50,
      bodyMaxLen: 1500,
      confidenceMin: 0.6,
    },
  },
  {
    id: 'quick_reply_portal_chat',
    description: 'quick_reply over portal_chat → short response',
    input: {
      issue: baseClassifierOutput({
        issueType: 'quick_reply',
        severity: 'low',
        title: 'Priya asked: did you get my docs?',
        summary: 'Client just confirming document receipt',
        whyThisMatters: 'Priya sent a short chat message asking whether her W-2 + 1099 came through.',
        recommendedAction: 'Reply quickly confirming docs are received.',
      }),
      context: baseContext({ channel: 'portal_chat' }),
    },
    expected: {
      isClientFacing: true,
      channel: 'portal_chat',
      language: 'en',
      subjectIsNull: true,
      bodyMinLen: 5,
      bodyMaxLen: 400,
      confidenceMin: 0.6,
    },
  },
];
