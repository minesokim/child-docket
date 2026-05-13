// portal-stage — canonical 5-state status copy + CTA map for the
// taxpayer-facing portal Home tab.
//
// Per CLAUDE.md §4 Client Portal:
//   The Home tab renders a single primary card whose copy is driven
//   by the client's current engagement state. Five canonical states
//   map to five distinct copy + CTA combinations.
//
// CONTRACT
//   State machine drives copy; firms cannot edit individual messages
//   (consistency floor across the platform). Only the firm-name +
//   owner-name tokens interpolate at render time.
//
//   detectPortalStage(input) -> PortalStage
//   getStageCopy(stage, ctx) -> { eyebrow, title, body, cta, ctaHref }
//
// FIVE CANONICAL STAGES
//   first_time          intake started but not complete
//   docs_received       intake complete, prep in progress
//   review_ready        return drafted, 8879 sent, awaiting client sign
//   filed_refund        e-filed; refund expected (or owe with payment plan)
//   off_season          tax-year complete; year-round mode
//
// FUTURE: the stage detector currently reads simplified flags pulled
// from IntakeState (the v0 portal datasource). Phase-2 sub-milestone
// flips it to read from engagements.status + signatures + filings via
// a portal server query. The COPY contract stays stable across both
// data sources.

export type PortalStage =
  | 'first_time'
  | 'docs_received'
  | 'review_ready'
  | 'filed_refund'
  | 'off_season';

export interface PortalStageInputs {
  /** Intake completion progress, 0-1. */
  intakeComplete: boolean;
  /** Whether the client has uploaded any documents. */
  docsUploaded: boolean;
  /** Whether deposit was paid. */
  depositPaid: boolean;
  /** Whether Form 8879 was sent to the client. */
  eightyseventynineSent: boolean;
  /** Whether Form 8879 was signed by the client. */
  eightyseventynineSigned: boolean;
  /** Whether return was filed with IRS. */
  filed: boolean;
  /** Whether IRS acknowledged the filing. */
  filingAcknowledged: boolean;
  /** Days since filing (for off-season detection). */
  daysSinceFiling: number;
}

export interface StageCopy {
  /** Small uppercase label rendered above the title. */
  eyebrow: string;
  /** Main statement copy. */
  title: string;
  /** Body paragraph elaborating on the title. */
  body: string;
  /** Primary CTA label. */
  cta: string;
  /** Where the CTA navigates. */
  ctaHref: string;
  /** Tone of the eyebrow pill. */
  tone: 'action' | 'progress' | 'success' | 'neutral';
}

export interface StageContext {
  firstName: string;
  firmName: string;
  ownerName: string;
  taxYear: string;
  /** When known, ISO date string. */
  filedDate?: string;
  /** When known, dollar amount. */
  refundAmount?: number;
  /** When known, ISO date string for expected refund window. */
  refundExpectedBy?: string;
}

/**
 * Map current state flags to one of the five canonical stages.
 * Precedence is reverse-engagement-lifecycle (newest stage wins
 * when multiple flags are set): filed > review_ready > docs_received >
 * first_time, with off_season as a special-case overlay when
 * daysSinceFiling > 60.
 */
export function detectPortalStage(input: PortalStageInputs): PortalStage {
  // Off-season overlay: filed >60 days ago and IRS acknowledged.
  if (input.filed && input.filingAcknowledged && input.daysSinceFiling > 60) {
    return 'off_season';
  }
  // Filed: return is in IRS's hands.
  if (input.filed) {
    return 'filed_refund';
  }
  // Review-ready: 8879 sent (signed or not — both render the same
  // primary CTA which is "sign" until the signature lands).
  if (input.eightyseventynineSent) {
    return 'review_ready';
  }
  // Docs received: deposit paid + at least one doc up, but no
  // 8879 yet (return still being prepared).
  if (input.depositPaid && input.docsUploaded) {
    return 'docs_received';
  }
  // Default: first-time / intake incomplete.
  return 'first_time';
}

/**
 * Get the canonical copy + CTA for a given stage. Interpolates
 * firstName, firmName, ownerName, taxYear, and the optional
 * filedDate / refundAmount / refundExpectedBy context tokens.
 *
 * The copy strings are FIRM-INDEPENDENT in shape. Only the four
 * named tokens interpolate. Firms cannot author per-stage copy;
 * the platform owns the language for consistency across all
 * firms. The branding customization happens via firm name + owner
 * name + welcome message (separate Welcome surface) + video
 * touchpoints (separate stage-video slot, V1.5 white-label).
 */
export function getStageCopy(stage: PortalStage, ctx: StageContext): StageCopy {
  const { firstName, firmName, ownerName, taxYear } = ctx;
  switch (stage) {
    case 'first_time':
      return {
        eyebrow: 'Get started',
        title: `Welcome, ${firstName}. Let's get to know you.`,
        body: `About 12 minutes of questions, then ${ownerName} reviews and we move forward. You can save and resume anytime.`,
        cta: 'Resume intake',
        ctaHref: '/welcome',
        tone: 'action',
      };

    case 'docs_received':
      return {
        eyebrow: 'In progress',
        title: `We have your documents, ${firstName}.`,
        body: `${ownerName} at ${firmName} is preparing your ${taxYear} return. You'll hear from us when it's ready to review.`,
        cta: 'View document checklist',
        ctaHref: '/portal/docs',
        tone: 'progress',
      };

    case 'review_ready':
      return {
        eyebrow: 'Action needed',
        title: `Your ${taxYear} return is ready to sign.`,
        body: `${ownerName} prepared your return. Review it, then sign Form 8879 to authorize e-filing.`,
        cta: 'Sign Form 8879',
        ctaHref: '/portal/sign-8879',
        tone: 'action',
      };

    case 'filed_refund': {
      const filedAt = ctx.filedDate ? formatShortDate(ctx.filedDate) : 'recently';
      const refundLine = ctx.refundAmount
        ? `Your refund of $${ctx.refundAmount.toLocaleString()} ` +
          (ctx.refundExpectedBy
            ? `is expected by ${formatShortDate(ctx.refundExpectedBy)}.`
            : 'is on its way.')
        : "We'll let you know when the IRS sends acknowledgement.";
      return {
        eyebrow: 'Filed',
        title: `Your ${taxYear} return was filed ${filedAt}.`,
        body: refundLine,
        cta: 'Track refund',
        ctaHref: '/portal/home',
        tone: 'success',
      };
    }

    case 'off_season':
      return {
        eyebrow: 'Year-round',
        title: `Tax year ${taxYear} is done. Anything change for you?`,
        body: `${ownerName} is here year-round for life events, planning questions, and anything tax-related. Reach out anytime.`,
        cta: 'Plan ahead',
        ctaHref: '/portal/messages',
        tone: 'neutral',
      };

    default: {
      // Exhaustiveness check — TypeScript catches new stage values
      // at compile time if this switch falls through.
      const _exhaustive: never = stage;
      throw new Error(`Unknown portal stage: ${String(_exhaustive)}`);
    }
  }
}

function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

/** Stage → video-slot key for the V1.5 white-label per-firm videos. */
export function videoSlotKey(stage: PortalStage): string {
  switch (stage) {
    case 'first_time':
      return 'first_time';
    case 'docs_received':
      return 'docs_received';
    case 'review_ready':
      return 'review_ready';
    case 'filed_refund':
      return 'post_filing';
    case 'off_season':
      return 'returning';
  }
}
