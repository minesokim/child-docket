// classify-notice — Inngest function that runs after a document is
// classified as an IRS / state notice.
//
// Trigger: 'notice/uploaded' event, fired by classify-document (this
// commit's other half).
//
// FLOW
//   1. If noticeText is missing on the event, fetch the document and
//      use whatever OCR text we have (fallback). If we have neither,
//      mark the issue with status='in_progress' + a needs-OCR note.
//   2. Call notice-triage agent with the noticeText.
//   3. Insert an issue with type='irs_notice', the triage's severity,
//      title from the triage's summary, summary from the triage's
//      why_this_matters.
//   4. Audit row was already written by the agent (action_class=
//      'classify'); we don't double-write here.
//
// CONCURRENCY
//   Keyed on documentId so the same notice can't get triaged twice
//   in parallel even if the event fires twice.

import { eq } from 'drizzle-orm';
import { inngest } from '../inngest-client.js';
import { schema, withTenant } from '@docket/db';
import { asClientId, asTenantId } from '@docket/shared';
import { triageNotice } from '../agents/notice-triage.js';

interface NoticeUploadedEventData {
  tenantId: string;
  clientId: string;
  documentId: string;
  noticeText: string | null;
}

export const classifyNoticeFn = inngest.createFunction(
  {
    id: 'classify-notice',
    name: 'Classify uploaded notice via notice-triage',
    concurrency: { limit: 5, key: 'event.data.documentId' },
    retries: 2,
  },
  { event: 'notice/uploaded' },
  async ({ event, step, logger }) => {
    const { tenantId, clientId, documentId, noticeText } =
      event.data as NoticeUploadedEventData;

    // ─── 1. Resolve notice text ───
    let textToTriage = noticeText;
    if (!textToTriage || textToTriage.length < 50) {
      // Fallback: read the document row's ai_extracted.fullText if it
      // exists. In v1 we'll re-OCR through the doc-classifier with a
      // notice-specific prompt; today we just surface the gap.
      textToTriage = await step.run('fetch-fallback-text', async () => {
        return await withTenant(asTenantId(tenantId), async (db) => {
          const [row] = await db
            .select({ aiExtracted: schema.documents.aiExtracted })
            .from(schema.documents)
            .where(eq(schema.documents.id, documentId))
            .limit(1);
          if (!row) return null;
          const extracted = row.aiExtracted as Record<string, unknown> | null;
          const full = extracted?.['fullText'];
          return typeof full === 'string' && full.length >= 50 ? full : null;
        });
      });
    }

    if (!textToTriage || textToTriage.length < 50) {
      // No usable text. Insert an issue marked needs-ocr; preparer can
      // re-upload or retry via the UI.
      await step.run('insert-needs-ocr-issue', async () => {
        await withTenant(asTenantId(tenantId), async (db) => {
          await db.insert(schema.issues).values({
            tenantId,
            clientId,
            type: 'irs_notice',
            severity: 'medium',
            status: 'open',
            title: 'IRS notice received — needs OCR retry',
            summary:
              'A notice document was uploaded but we could not extract enough text to triage. Re-upload a clearer photo or attach the notice text manually.',
            classifiedBy: 'classify-notice',
          });
        });
      });
      logger.warn('classify-notice: insufficient OCR text; inserted needs-ocr issue', {
        documentId,
      });
      return { ok: true, triaged: false, reason: 'insufficient-ocr-text' };
    }

    // ─── 2. Triage the notice ───
    const triage = await step.run('triage-notice', async () => {
      return await triageNotice({
        tenantId: asTenantId(tenantId),
        clientId: asClientId(clientId),
        noticeText: textToTriage!,
        documentId,
      });
    });

    // ─── 3. Insert the issue ───
    const issueId = await step.run('insert-issue', async () => {
      return await withTenant(asTenantId(tenantId), async (db) => {
        const [issue] = await db
          .insert(schema.issues)
          .values({
            tenantId,
            clientId,
            type: 'irs_notice',
            severity: triage.output.severity,
            status: 'open',
            title: `${triage.output.notice_type}: ${triage.output.summary.slice(0, 80)}`,
            summary: triage.output.summary,
            whyThisMatters: triage.output.why_this_matters,
            recommendedAction: triage.output.recommended_action,
            classifiedBy: 'notice-classifier',
            aiConfidence: triage.output.confidence,
            evidence: {
              triage_action_id: triage.triageActionId,
              document_id: documentId,
              notice_type: triage.output.notice_type,
              issuing_authority: triage.output.issuing_authority,
              tax_period: triage.output.tax_period,
              amount_at_issue: triage.output.amount_at_issue,
              response_deadline: triage.output.response_deadline,
              recommended_response_template:
                triage.output.recommended_response_template,
              gaps_to_confirm: triage.output.gaps_to_confirm,
            },
          })
          .returning({ id: schema.issues.id });
        return issue?.id;
      });
    });

    logger.info('classify-notice complete', {
      documentId,
      issueId,
      noticeType: triage.output.notice_type,
      severity: triage.output.severity,
      responseDeadline: triage.output.response_deadline,
      costUsd: triage.costUsd,
    });

    // ─── 4. Emit issue/created so other consumers (UI, future
    //         notice-drafter chain) can react ───
    if (issueId) {
      await step.sendEvent('emit-issue-created', {
        name: 'issue/created',
        data: {
          tenantId: asTenantId(tenantId),
          issueId,
          type: 'irs_notice',
          severity: triage.output.severity,
        },
      });
    }

    return {
      ok: true,
      triaged: true,
      issueId,
      noticeType: triage.output.notice_type,
      severity: triage.output.severity,
      costUsd: triage.costUsd,
    };
  },
);
