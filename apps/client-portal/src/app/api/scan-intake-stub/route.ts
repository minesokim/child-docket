// POST /api/scan-intake-stub — Discovery Scan form-submit stub.
//
// The /scan landing page collects prospect form data and POSTs it
// here. v0 is a STUB: it validates shape, logs a structured prospect
// record to Sentry (so David sees the lead even before C12b lands),
// and returns 200. No DB write yet — that requires the `prospects`
// table migration + server action queued as C12b.
//
// CONTRACT
//   POST application/json
//   Body: { first_name, last_name, firm_name, designation, firm_size,
//           tax_software, email, phone?, linkedin_url?, source,
//           confirm_redacted: "on" }
//   200: { ok: true, prospectId: <ulid> }      — leads tracked via Sentry
//   400: { ok: false, error: "<reason>" }      — validation failure
//
// SECURITY
//   Public route (allowlisted in middleware). No auth required.
//   Email field is the only PII; logged to Sentry with David's
//   reviewer access. No SSN / financial / sensitive fields are
//   collected by this form.
//
// RATE LIMITING
//   Inherits the per-Vercel-lambda Map rate limiter; abuse would be
//   visible in Sentry breadcrumbs. Upstash swap is on the queue
//   (PRODUCTION-READINESS).

import { type NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getAdminDb, schema } from '@docket/db';
import { consumeRateToken } from '@docket/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ProspectPayload {
  first_name?: string;
  last_name?: string;
  firm_name?: string;
  designation?: string;
  firm_size?: string;
  tax_software?: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  source?: string;
  confirm_redacted?: string;
}

const REQUIRED_FIELDS: ReadonlyArray<keyof ProspectPayload> = [
  'first_name',
  'last_name',
  'firm_name',
  'designation',
  'firm_size',
  'tax_software',
  'email',
  'source',
  'confirm_redacted',
];

// Conservative email regex — full RFC 5322 compliance is overkill
// for a marketing form. Catches typos (missing @, missing TLD).
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Closed allowlists for the select-tied fields. These values land in
// Sentry tags (which the PII scrubber doesn't walk), so a direct
// POST with `source: "leaked@example.com"` would persist PII to
// Sentry. Allowlists enforce the form's intended option set
// (codex C12 R10 P2). Synced with the FAQ + form copy in
// scan-landing-client.tsx and docs/landing-pages/
// discovery-scan-landing-copy.md.
const SOURCE_ALLOWLIST: ReadonlySet<string> = new Set([
  'Boney-Henderson',
  'Cold email',
  'LinkedIn',
  'NAEA event',
  'r/taxpros',
  'Tax Twitter',
  'Referral',
  'Search',
  'Other',
]);
const FIRM_SIZE_ALLOWLIST: ReadonlySet<string> = new Set([
  'Solo',
  '2-5 preparers',
  '6-10',
  '11-20',
  '21+',
]);
const DESIGNATION_ALLOWLIST: ReadonlySet<string> = new Set([
  'EA',
  'CPA',
  'PTIN-holder',
  'Other',
]);

function isString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Rate limit BEFORE doing any work, including JSON parsing — this
  // endpoint is public and unauthenticated, so anyone can POST. Key
  // by client IP so individual bad actors get throttled without
  // affecting legitimate prospects on shared egress. 10 requests
  // per 5 minutes is generous for a real submission flow
  // (form-fill takes minutes) while clipping spam fast.
  // (codex C12 R2 P2.)
  //
  // Vercel surfaces the client IP via x-forwarded-for. NextRequest
  // doesn't expose it directly in middleware-less routes; pull from
  // headers. Falls back to a global bucket if no IP is present
  // (better than letting requests through without any throttle).
  const clientIp =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'global';
  const rl = consumeRateToken(`scan-intake:${clientIp}`, 10, 5 * 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Too many submissions. Try again in a few minutes.',
      },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    );
  }

  let body: ProspectPayload;
  try {
    const raw = (await req.json()) as unknown;
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      // Object-shape gate — `null`, arrays, strings, numbers parse as
      // valid JSON but break the field-indexing below. Without this,
      // a body of `null` returns 500 instead of the documented 400
      // (codex C12 R2 P2 first finding).
      return NextResponse.json(
        { ok: false, error: 'Body must be a JSON object.' },
        { status: 400 },
      );
    }
    body = raw as ProspectPayload;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Body must be valid JSON.' },
      { status: 400 },
    );
  }

  // Required-field check.
  for (const field of REQUIRED_FIELDS) {
    if (!isString(body[field])) {
      return NextResponse.json(
        { ok: false, error: `Missing required field: ${field}` },
        { status: 400 },
      );
    }
  }

  // Email shape check.
  if (!EMAIL_REGEX.test(body.email!)) {
    return NextResponse.json(
      { ok: false, error: 'Email format looks invalid.' },
      { status: 400 },
    );
  }

  // Closed-allowlist checks for fields that land in Sentry tags. A
  // direct POST that smuggles PII into one of these (e.g.,
  // `source: "leaked@example.com"`) would persist to Sentry because
  // the scrubber doesn't walk tags. Enforce the form's select
  // options at the API boundary (codex C12 R10 P2).
  if (!SOURCE_ALLOWLIST.has(body.source!)) {
    return NextResponse.json(
      { ok: false, error: 'source value not recognized.' },
      { status: 400 },
    );
  }
  if (!FIRM_SIZE_ALLOWLIST.has(body.firm_size!)) {
    return NextResponse.json(
      { ok: false, error: 'firm_size value not recognized.' },
      { status: 400 },
    );
  }
  if (!DESIGNATION_ALLOWLIST.has(body.designation!)) {
    return NextResponse.json(
      { ok: false, error: 'designation value not recognized.' },
      { status: 400 },
    );
  }

  // Optional-field type guards. JSON callers may legitimately omit
  // phone/linkedin_url (form sends "" or undefined), but a malicious
  // caller can send `phone: 123` or `linkedin_url: {}`. Without
  // these guards, the .trim() below throws and the request falls
  // into the 500/DB-error path with no useful diagnostics
  // (codex C12 R9 P2). Defensive 400 for shape mismatches.
  if (
    body.phone !== undefined &&
    typeof body.phone !== 'string'
  ) {
    return NextResponse.json(
      { ok: false, error: 'phone must be a string if provided.' },
      { status: 400 },
    );
  }
  if (
    body.linkedin_url !== undefined &&
    typeof body.linkedin_url !== 'string'
  ) {
    return NextResponse.json(
      { ok: false, error: 'linkedin_url must be a string if provided.' },
      { status: 400 },
    );
  }

  // Confirmation checkbox — the form sends "on" when checked,
  // undefined when unchecked. Both cases reach here only via the
  // REQUIRED_FIELDS gate above, so this is belt-and-suspenders.
  if (body.confirm_redacted !== 'on' && body.confirm_redacted !== 'true') {
    return NextResponse.json(
      {
        ok: false,
        error:
          'You must confirm that the upload will be redacted of client PII.',
      },
      { status: 400 },
    );
  }

  // Persist to the prospects table (migration 0030). The Sentry
  // scrubber redacts email/phone from event.extra (PII discipline),
  // so Sentry alone is unusable for lead capture (codex C12 R3 P1).
  // The prospects table is the structured persistence layer; Sentry
  // breadcrumb fires alongside for observability.
  const db = getAdminDb();
  let prospectId: string;
  try {
    // Normalize blank optional fields to NULL. FormData submits an
    // unchecked input as "" (empty string), not undefined, so a bare
    // `?? null` leaves empty-string in the DB and breaks any
    // `IS NULL` query for "left this field blank" (codex C12 R7 P2).
    const phoneVal = body.phone?.trim();
    const linkedinVal = body.linkedin_url?.trim();
    const inserted = await db
      .insert(schema.prospects)
      .values({
        firstName: body.first_name!,
        lastName: body.last_name!,
        firmName: body.firm_name!,
        designation: body.designation!,
        firmSize: body.firm_size!,
        taxSoftware: body.tax_software!,
        email: body.email!,
        phone: phoneVal && phoneVal.length > 0 ? phoneVal : null,
        linkedinUrl:
          linkedinVal && linkedinVal.length > 0 ? linkedinVal : null,
        source: body.source!,
        redactedConfirmed: true,
        ipAddress: clientIp === 'global' ? null : clientIp,
        userAgent: req.headers.get('user-agent') ?? null,
      })
      .returning({ id: schema.prospects.id });
    prospectId = inserted[0]!.id;
  } catch (err) {
    // DB write failed — log operational context (DB error, source
    // channel) but NOT prospect contact info. Codex C12 R8 P1: the
    // earlier "preserve PII via tags" approach leaked email/phone/
    // name to Sentry because the scrubber in
    // `packages/shared/src/sentry-scrubber.ts` only walks message /
    // extra / breadcrumbs / request / user — not tags.
    //
    // Trade-off: in the DB-outage path, this stub does NOT preserve
    // the prospect's identity. The user-facing 500 explicitly tells
    // them to email david@petal.tax directly — that's the
    // documented recovery channel. Acceptable because:
    //   1. DB outages are rare (Neon Launch tier, auto-suspend OFF).
    //   2. Most prospects will retry once the DB recovers.
    //   3. PII discipline (SOC 2 + privacy promise) > occasional
    //      lead-loss in exceptional failure modes.
    //
    // FOLLOWUP queued: extend sentry-scrubber.ts to also walk
    // event.tags as defense-in-depth.
    Sentry.captureException(err, {
      tags: {
        app: 'portal',
        surface: 'scan-intake',
        // Operational context only — no PII in tags.
        prospect_source: body.source!.slice(0, 195),
        firm_size: body.firm_size!.slice(0, 195),
      },
    });
    return NextResponse.json(
      {
        ok: false,
        error:
          'We received your submission but encountered a server error storing it. Please email david@petal.tax directly so we can follow up.',
      },
      { status: 500 },
    );
  }

  // Sentry breadcrumb — observability only, contact info not needed
  // here (we have it in the DB now). Email/phone deliberately
  // omitted to match the Sentry scrubber discipline.
  Sentry.addBreadcrumb({
    category: 'scan-intake',
    level: 'info',
    message: 'Discovery Scan form submitted',
    data: {
      prospectId,
      // No firm_name here — solo practitioners often use their
      // personal surname as the firm name, so it's effectively PII.
      // The Sentry scrubber pattern-redacts emails/phones but NOT
      // arbitrary names (codex C12 R11 P2). prospectId is the link
      // back to the prospects table for full contact info.
      designation: body.designation,
      firm_size: body.firm_size,
      tax_software: body.tax_software,
      source: body.source,
    },
  });
  Sentry.captureMessage('Discovery Scan prospect submitted', {
    level: 'info',
    tags: {
      app: 'portal',
      surface: 'scan-intake',
      source: body.source ?? 'unknown',
      // Tags are safe from the email/phone scrubber regex.
      // `prospect_id` lets David click from Sentry → query prospects
      // table by id for full contact info.
      prospect_id: prospectId,
    },
  });

  return NextResponse.json({ ok: true, prospectId });
}
