// @docket/email — Resend integration for transactional email.
//
// SCOPE
//   v0: the one thing we need to ship Antonio's wedge — deliver a
//   Discovery Scan PDF to a firm with a branded email + signed URL
//   + optional attachment. Future expansion (intake confirmation,
//   status notifications, etc.) reuses the same Resend client.
//
// PROVIDER CHOICE
//   Resend over SendGrid / Mailgun / Postmark because:
//   - Free tier 3K/mo covers founder-cohort + reference-Discovery
//     volume comfortably (CLAUDE.md L7 cost discipline)
//   - Domain verification + DKIM/SPF management is simpler than
//     legacy ESPs
//   - Native attachment support — Discovery PDF can ship inline
//   - TypeScript SDK is first-class
//
// SETUP (operator action, NOT in this commit)
//   1. resend.com → create account
//   2. Verify a sending domain (e.g. docket.com, or a subdomain
//      like mail.docket.com — either works, just register what
//      DNS gives you control over)
//   3. Generate API key + set RESEND_API_KEY in .env.local + Vercel
//   4. Set RESEND_FROM_ADDRESS to a from-address on the verified
//      domain — e.g. "Docket <discovery@yourdomain.com>". REQUIRED:
//      there is no hard-coded default because Resend rejects sends
//      from any unverified domain, so a default would silently fail
//      delivery in every deployment whose verified domain doesn't
//      match. Per-call `opts.from` can override.
//
// COST + LATENCY
//   - $0 within 3K/mo free tier; $20/mo for 50K/mo
//   - ~200-500ms per send (Resend edge POST + Anthropic queue)
//   - Smoke (sendDiscoveryEmail dry-run) is fast; live sends require
//     a verified domain

import { Resend } from 'resend';

let _client: Resend | null = null;

/**
 * Lazy-construct the Resend client. Fail-fast if RESEND_API_KEY is
 * unset — the entire point of this package is to send email, and a
 * silent no-op when the env is misconfigured would mask delivery
 * failures in production.
 */
function getClient(): Resend {
  if (_client) return _client;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error(
      'RESEND_API_KEY not set — cannot send email. Set it in .env.local for dev or Vercel env for prod. See packages/email/src/index.ts header for setup steps.',
    );
  }
  _client = new Resend(key);
  return _client;
}

/**
 * Resolve the from-address for a send. Either `opts.from` (per-call
 * override) or `RESEND_FROM_ADDRESS` env (deployment default) MUST
 * be set — there is no hard-coded fallback.
 *
 * Earlier versions defaulted to `Docket <discovery@docket.com>`, but
 * that silently fails delivery for any Resend account whose verified
 * domain is a subdomain of docket.com or a different domain entirely.
 * Domain verification is per-Resend-account; the sender HAS to match
 * a verified domain or every send is rejected (codex C10 R3 P2).
 *
 * Failing fast at boot is the right trade — missing config surfaces
 * immediately rather than silently rejecting every Discovery Scan
 * delivery.
 */
function resolveFromAddress(perCall?: string): string {
  if (perCall && perCall.length > 0) return perCall;
  const envValue = process.env.RESEND_FROM_ADDRESS;
  if (envValue && envValue.length > 0) return envValue;
  throw new Error(
    'No from-address resolved. Set RESEND_FROM_ADDRESS in env (e.g. "Docket <discovery@yourdomain.com>") OR pass `from` on the send call. The address must match a domain verified in your Resend account; otherwise every send is rejected.',
  );
}

export interface SendDiscoveryScanEmailOptions {
  /** Recipient — typically the firm's contact email. */
  to: string;
  /**
   * Firm name to address in the greeting + subject. The same firm
   * name passed to the PDF renderer.
   */
  firmName: string;
  /** Person prepared for ("Antonio Vazquez, EA"). Used in greeting. */
  preparedFor: string;
  /** Tax year of the scan (subject line + body). */
  taxYear: number;
  /**
   * Signed download URL for the PDF in R2 (from
   * `composeDiscoveryScan().signedUrl`). The email body contains a
   * prominent "Download your Discovery Scan" CTA pointing here.
   */
  signedUrl: string;
  /** ISO timestamp when the signed URL expires (shown in the body). */
  urlExpiresAt: string;
  /**
   * Total dollars surfaced across all tiers (executive summary
   * highlight). Headlines the email subject + opening line.
   */
  totalSurfacedDollars: number;
  /** Number of positions surfaced (executive summary count). */
  positionsCount: number;
  /**
   * Optional PDF buffer for attachment delivery. Without this the
   * email is link-only (smaller, more deliverable). With it the
   * prospect gets the PDF inline even if they click nothing.
   *
   * Belt-and-suspenders: ship BOTH when bytes are available — the
   * link survives if the attachment is stripped by a firewall, the
   * attachment survives if the signed URL expires before the
   * prospect opens the email.
   */
  pdfBuffer?: Buffer;
  /** Optional from-address override. Default: RESEND_FROM_ADDRESS env. */
  from?: string;
  /** Optional reply-to. Default: undefined (Resend uses 'from'). */
  replyTo?: string;
}

export interface SendDiscoveryScanEmailResult {
  /** Resend's email ID — useful for delivery audit-trail + webhooks. */
  emailId: string;
  /** What address the email actually went to. */
  to: string;
  /** From-address used (after default-resolution). */
  from: string;
  /** Time the send completed (after Resend acked the message). */
  sentAt: string;
}

/**
 * HTML-escape a string before interpolating into the email body.
 * Necessary for every tenant/contact-supplied field (firmName,
 * preparedFor, recipient email) and even the signed URL — codex C10
 * R2 P2: without escaping, a firm name like `Mary & Co. <"M&A">`
 * would emit malformed HTML or break out of attribute context. The
 * signed URL itself contains `&` separators between AWS query
 * params; raw `&` should be `&amp;` per HTML spec (browsers forgive
 * it but we shouldn't rely on that).
 *
 * Covers all five HTML-significant characters: & < > " '
 * (apostrophe escaped as &#39; rather than &apos; for legacy email
 * client compatibility — Outlook 2007/2010 don't recognize &apos;).
 */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Format an ISO timestamp into a human-friendly expiry string. Drops
 * to a US Eastern wall-clock + date because most prospects are in
 * US time zones; falls back to the raw ISO if Intl.DateTimeFormat
 * throws (very-old Node, missing locale data). Examples:
 *   2026-05-26T14:00:00.000Z → "May 26, 2026 at 10:00 AM ET"
 */
function formatExpiry(iso: string): string {
  try {
    const date = new Date(iso);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
    // Intl emits "May 26, 2026 at 10:00 AM EDT" on Node 22 (locale
    // data dependent); falls back gracefully when missing pieces.
    return formatter.format(date);
  } catch {
    return iso;
  }
}

/**
 * Build the HTML body for a Discovery Scan delivery email. Plain
 * inline styles + system fonts — keeps the email readable in dark
 * mode and across email clients without external CSS.
 *
 * Copy adapts to whether an attachment was included (codex C10 P2):
 *   - attached:true → "PDF is also attached — open whichever is easier"
 *   - attached:false → "Click the button above to download"
 */
function buildHtmlBody(
  opts: SendDiscoveryScanEmailOptions,
  hasAttachment: boolean,
): string {
  const formattedDollars = `$${Math.round(opts.totalSurfacedDollars).toLocaleString('en-US')}`;
  // Numbers from Number.toLocaleString are always safe-ASCII; HTML
  // escaping is unnecessary on `formattedDollars` and `positionsCount`.
  const formattedExpiry = escapeHtml(formatExpiry(opts.urlExpiresAt));
  const attachmentNote = hasAttachment
    ? 'The full PDF is also attached to this email — open whichever is easier.'
    : 'Click the button above to download your scan.';
  // Escape every tenant/contact-supplied field before interpolating
  // into the HTML body. signedUrl is escaped too — AWS-signed URLs
  // contain `&` between query params which must become `&amp;` per
  // HTML spec (codex C10 R2 P2).
  const safeFirmName = escapeHtml(opts.firmName);
  const safePreparedFor = escapeHtml(opts.preparedFor);
  const safeTo = escapeHtml(opts.to);
  const safeSignedUrl = escapeHtml(opts.signedUrl);

  // Zero-position branch — Discovery legitimately returns an empty
  // surfaced set when the return is already tight (or when every
  // candidate was refused below Reasonable Basis). The "$0 surfaced
  // across 0 positions / Every position carries..." copy from the
  // happy path is factually wrong in that case (codex C10 R6 P2).
  // The product position per docs/DISCOVERY-SCAN-OPERATIONAL.md is
  // explicit: "if the return is already tight, that's the answer."
  // The PDF still ships — the artifact is the proof of the analysis.
  const isEmptyScan = opts.positionsCount === 0;
  const summaryParagraph = isEmptyScan
    ? `We did not surface any defensible deductions the return missed. Either the return is already tight at this AGI bucket + entity shape, or every candidate position fell below the Reasonable Basis floor. The full analysis — what we checked, why each candidate was refused — is in the PDF.`
    : `<strong>${formattedDollars}</strong> in additional defensible deductions surfaced across <strong>${opts.positionsCount} positions</strong>. Every position carries an IRC cite, an audit-risk classification, and a confidence tier. Refused below Reasonable Basis.`;
  const ctaLabel = isEmptyScan ? 'Open the analysis' : 'Download your Discovery Scan';

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Discovery Scan — ${safeFirmName}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#FAF7F1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1A1E2A;">
    <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
      <div style="color:#1F5E3D;font-size:14px;font-weight:700;letter-spacing:2px;margin-bottom:32px;">DOCKET</div>

      <h1 style="font-size:24px;line-height:1.3;margin:0 0 16px;color:#1A1E2A;font-weight:600;">Your Discovery Scan is ready.</h1>

      <p style="font-size:16px;line-height:1.5;color:#1A1E2A;margin:0 0 16px;">${safePreparedFor}, we ran the Position Framework across the Tax Year ${opts.taxYear} return you shared.</p>

      <p style="font-size:16px;line-height:1.5;color:#1A1E2A;margin:0 0 24px;">${summaryParagraph}</p>

      <div style="margin:24px 0;">
        <a href="${safeSignedUrl}" style="display:inline-block;background-color:#1F5E3D;color:#FAF7F1;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">${ctaLabel}</a>
      </div>

      <p style="font-size:13px;color:#6B7280;line-height:1.5;margin:0 0 24px;">The download link is good until ${formattedExpiry}. ${attachmentNote}</p>

      <div style="border-top:1px solid #E3DED4;padding-top:20px;margin-top:32px;">
        <p style="font-size:13px;color:#6B7280;line-height:1.5;margin:0 0 8px;">This is a Position Framework artifact, not an audit-defense file or a substitute for engagement-level workpapers. The EA's PTIN is on the return; every position the AI surfaces is the preparer's decision to accept or reject.</p>
        <p style="font-size:13px;color:#6B7280;line-height:1.5;margin:0;">Sent to ${safeTo} · Petal Inc.</p>
      </div>
    </div>
  </body>
</html>`;
}

/**
 * Send a Discovery Scan delivery email to a firm. Uses Resend's
 * attachment support to embed the PDF inline alongside the signed
 * URL — see SendDiscoveryScanEmailOptions.pdfBuffer for the
 * belt-and-suspenders rationale.
 *
 * Throws if RESEND_API_KEY is unset or if Resend's API returns an
 * error. Callers should catch and route to Sentry; the C11 scans
 * audit-trail table should record the attempt status (delivered /
 * bounced / failed).
 */
export async function sendDiscoveryScanEmail(
  opts: SendDiscoveryScanEmailOptions,
): Promise<SendDiscoveryScanEmailResult> {
  const formattedDollars = `$${Math.round(opts.totalSurfacedDollars).toLocaleString('en-US')}`;
  // Subject line varies on the zero-position branch — "$0 surfaced"
  // reads as a delivery failure, but the scan itself succeeded
  // (codex C10 R6 P2). For empty scans, lead with the framework
  // signal instead.
  const subject =
    opts.positionsCount === 0
      ? `Your Discovery Scan — Tax Year ${opts.taxYear} (already tight)`
      : `Your Discovery Scan — ${formattedDollars} surfaced, Tax Year ${opts.taxYear}`;
  const hasAttachment = opts.pdfBuffer !== undefined && opts.pdfBuffer.length > 0;
  const html = buildHtmlBody(opts, hasAttachment);
  const from = resolveFromAddress(opts.from);

  const attachments = hasAttachment
    ? [
        {
          filename: `Discovery-Scan-${opts.firmName.replace(/\s+/g, '-')}-TY${opts.taxYear}.pdf`,
          content: opts.pdfBuffer as Buffer,
        },
      ]
    : undefined;

  const result = await getClient().emails.send({
    from,
    to: [opts.to],
    subject,
    html,
    ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
    ...(attachments ? { attachments } : {}),
  });

  if (result.error) {
    throw new Error(
      `Resend send failed: ${result.error.name} — ${result.error.message}`,
    );
  }
  if (!result.data || !result.data.id) {
    throw new Error('Resend returned no email ID (unexpected — see Resend status page).');
  }

  return {
    emailId: result.data.id,
    to: opts.to,
    from,
    sentAt: new Date().toISOString(),
  };
}
