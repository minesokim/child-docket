// ────────────────────────────────────────────────────────────────
// IntakeState — canonical shape of intake_responses.answers JSONB.
//
// Single source of truth for what the intake flow asks and what gets
// stored. Both the client portal (for branching) and the server actions
// (for validation + encryption) consume this same type.
//
// All fields are optional because intake fills in over time. Resume-on-
// load logic looks at which fields are populated to decide where to send
// the client back to.
// ────────────────────────────────────────────────────────────────

export type FilingStatus = 'single' | 'mfj' | 'mfs' | 'hoh' | 'qw';

export type IncomeType = 'w2' | 'self' | 'rental' | 'invest' | 'retire';

// Mirrors `ServicePathId` from @docket/ui — same values so the migration
// from sessionStorage to Postgres is a 1:1 path change.
export type ServiceKind = 'personal' | 'self' | 'biz' | 'other';

// Mirrors `ServiceOtherSubId` from @docket/ui.
export type ServiceOtherSubKind = 'intro' | 'formation' | 'books' | 'strategy';

// Catalog addon ids vary per ServiceKind (rental, crypto, states, fbar,
// amend, books). We type them as `string` here because the registry
// (SERVICE_CATALOG.addons) is the source of truth — we don't want a
// duplicated literal union to drift.
export type ServiceAddonId = string;

export type LifeEvent =
  | 'married'
  | 'divorced'
  | 'baby'
  | 'home_purchase'
  | 'home_sale'
  | 'move'
  | 'death_in_family'
  | 'job_change';

export type DeductionKind = 'standard' | 'itemized';

export type RefundPreference = 'direct_deposit' | 'check' | 'apply_to_next_year';

export type BankAccountType = 'checking' | 'savings';

export type BusinessEntityType =
  | 'sole_prop'
  | 'llc'
  | 'sole_member_llc'
  | 's_corp'
  | 'c_corp'
  | 'partnership';

export type DependentRelationship =
  | 'child'
  | 'stepchild'
  | 'foster_child'
  | 'parent'
  | 'sibling'
  | 'other';

export type AppointmentType = 'phone' | 'video' | 'in_person';

export type ContactMethod = 'sms' | 'email' | 'phone';

// Mirrors the /strategic-topics UX. Each id maps to a multi-select card the
// client picks before booking a strategic consultation. Antonio reads the
// list pre-meeting to prep.
export type StrategicTopic =
  | 'planning'      // "Tax planning & projections"
  | 'entity'        // "Entity restructuring (LLC to S-Corp, etc.)"
  | 'estimated'     // "Estimated tax payments"
  | 'retirement'    // "Retirement planning"
  | 'realestate'    // "Real estate strategy"
  | 'irs'           // "IRS notice or audit"
  | 'other';

// ────────────────────────────────────────────────────────────────
// IntakeState — the shape of intakeResponses.answers
// ────────────────────────────────────────────────────────────────

// Free-form fields match the /deps-detail UX (single fullName, free-text
// relationship, numeric-string months). Antonio normalizes (split name,
// canonical relationship, integer months) during prep when the form needs it.
export type IntakeDependent = {
  fullName?: string;
  dateOfBirth?: string;          // ISO date (YYYY-MM-DD)
  ssn?: string;                  // encrypted at rest
  relationship?: string;         // e.g. "Son", "Daughter", "Parent"
  monthsLivedWithYou?: string;   // e.g. "12"
};

// Free-form fields match the /rental-detail UX. Antonio normalizes during
// prep (annual gross rent, depreciation schedule, days rented, personal-use
// allocation) — those v1+ fields can be added when the form gets richer.
export type IntakeRentalProperty = {
  rentalType?: 'long' | 'short' | 'commercial' | 'mixed';
  address?: string;
  monthlyRent?: string;          // free-form $ string
  monthlyMortgage?: string;      // free-form $ string
  yearAcquired?: string;         // 4-digit year as string
  rentalCount?: string;          // numeric string ("1", "12", etc.)
};

export type IntakeState = {
  // ── Meta ─────────────────────────────────────────────────────────
  // Internal book-keeping; not user-facing data. Tracks the last
  // intake route the client visited so /welcome can resume to that
  // exact page (not just the first-incomplete-step). Updated by the
  // (intake) layout on every navigation.
  _meta?: {
    lastVisitedRoute?: string;
  };

  // ── Welcome / tutorial / service path ────────────────────────────
  tutorial?: { completed?: boolean };

  service?: {
    kind?: ServiceKind;
    otherSub?: ServiceOtherSubKind;
    addons?: ServiceAddonId[];
  };

  // ── About-you ───────────────────────────────────────────────────
  // Note: full legal name collected as one string per the /personal UX.
  // Antonio splits into First/Middle/Last during prep when the return form
  // requires it. v1+ may collect split fields here directly.
  personal?: {
    fullName?: string;
    dateOfBirth?: string;        // ISO YYYY-MM-DD
    ssn?: string;                // encrypted at rest
    occupation?: string;
    email?: string;
    phone?: string;
    // Home / mailing address that goes on the return
    street?: string;
    city?: string;
    addressState?: string;       // 2-letter; named to avoid colliding with state.primaryState
    zip?: string;
  };

  // State + prior-year filing context. Free-form strings to match the
  // /state UX ("California" not "CA") — Antonio normalizes during prep.
  state?: {
    primaryState?: string;        // e.g. "California"
    additionalState?: string;     // optional second state
    filedLast?: 'yes' | 'no';
    preparer?: string;            // last year's preparer (only when filedLast === 'yes')
  };

  filing?: {
    status?: FilingStatus;
  };

  // ── Head of Household qualification (§2(b) / §7703(b) gate) ──────
  // Antonio's §6694 risk surface: HoH is the single highest-volume
  // mis-claimed filing status on solo-EA returns. We ask all four
  // qualifying questions explicitly so Antonio can defend the claim
  // or downgrade to Single before transmission. Only relevant when
  // filing.status === 'hoh'.
  //
  // All four must be true for face-value HoH qualification:
  //   1. unmarriedOrConsideredUnmarried: legally unmarried OR met the
  //      "considered unmarried" tests (lived apart from spouse last
  //      6 months, paid more than half of separate home, etc.).
  //   2. paidMoreThanHalfHomeCost: paid more than half the cost of
  //      keeping up a home for the year.
  //   3. qualifyingPersonLivedWithYou: a qualifying person (qualifying
  //      child OR qualifying relative) lived in the taxpayer's home
  //      for more than half the year. Exception: a parent doesn't
  //      need to live with the taxpayer if the taxpayer paid more
  //      than half the cost of keeping up the parent's home.
  //   4. qualifyingPersonIsChildOrRelative: the qualifying person
  //      meets the qualifying-child OR qualifying-relative tests
  //      (relationship + age + residency + support + joint-return).
  //
  // Persisting BOTH the answers and a derived qualifiesAtFace flag is
  // intentional — Antonio's audit packet needs the raw client claims,
  // not just our derived classification. See command-room /clients/[id]
  // Audit Trail UI per CLAUDE.md §4.
  hohQualify?: {
    unmarriedOrConsideredUnmarried?: 'yes' | 'no' | 'not_sure';
    paidMoreThanHalfHomeCost?: 'yes' | 'no' | 'not_sure';
    qualifyingPersonLivedWithYou?: 'yes' | 'no' | 'not_sure';
    // §2(b)(1)(B) parent exception: only asked as a follow-up when
    // livedWithYou === 'no'. Drives whether a 'no' on cohabitation
    // is a real §2(b) failure or just routes to 'uncertain' (Antonio
    // verifies the parent-home-cost test).
    qualifyingPersonIsParent?: 'yes' | 'no' | 'not_sure';
    qualifyingPersonIsChildOrRelative?: 'yes' | 'no' | 'not_sure';
    // Optional free-text — relationship to qualifying person
    // (daughter, mother, niece, etc.). Surfaces in command-room as a
    // hint for Antonio's review.
    qualifyingPersonRelationship?: string;
  };

  spouse?: {
    fullName?: string;
    dateOfBirth?: string;
    ssn?: string;                // encrypted at rest
    occupation?: string;
  };

  // ── MFS in community property state → Form 8958 surface ─────────
  // Triggered when filing.status === 'mfs' AND state.primaryState is
  // one of the 9 mandatory community property states (AZ CA ID LA
  // NV NM TX WA WI). The actual line-item allocation happens in
  // command-room; this just flags the case + captures the few
  // signals Antonio needs to start. See packages/shared/src/
  // community-property.ts + IRS Pub 555.
  mfsCommunityProperty?: {
    // Client acknowledged that Form 8958 will be needed on the
    // return. Required to advance past the step.
    acknowledged?: boolean;
    // Shape of the spouses' finances. Drives whether §66(c)
    // spousal-allocation-relief is conversational fit.
    financeShape?:
      | 'fully_separate'
      | 'mostly_separate'
      | 'mostly_joint'
      | 'fully_joint';
    // Have the spouses lived apart for all of 2025? Bears on §66(c)
    // applicability + on community-vs-separate income classification
    // for the year.
    livedApartAllYear?: 'yes' | 'no' | 'not_sure';
    // Free-text — anything the client wants Antonio to know about
    // their financial arrangement that didn't fit above (prenup,
    // post-nup, transmutation agreement, separation agreement).
    notes?: string;
  };

  dependents?: {
    count?: number;
    list?: IntakeDependent[];
  };

  // ── Income ───────────────────────────────────────────────────────
  income?: {
    types?: IncomeType[];
  };

  // Free-form strings for entityType/revenue match the /self-employment UX
  // (the form asks "Sole Prop, LLC, S-Corp, or N/A" not a strict enum).
  // Antonio normalizes during prep.
  selfEmployment?: {
    businessName?: string;
    whatYouDo?: string;
    entityType?: string;
    ein?: string;                // encrypted at rest
    revenue?: string;
    homeOffice?: boolean;
    vehicle?: boolean;
    cash?: boolean;              // "is most of revenue in cash" toggle
  };

  rental?: {
    properties?: IntakeRentalProperty[];
  };

  // ── Business sub-flow (when service.kind includes business) ─────
  // Free-form fields match the /business-info + /business-formation UX.
  // Antonio normalizes (canonical entity types, parsed dates, structured
  // owner records) during prep when the return form needs them.
  business?: {
    // Identity
    legalName?: string;
    dba?: string;
    ein?: string;                // encrypted at rest
    entityType?: string;         // "S-Corp", "LLC", "C-Corp", "Partnership" — free-form
    industry?: string;

    // Formation (covered by /business-formation)
    formationState?: string;
    formationDate?: string;

    // Operations (covered by /business-info)
    activity?: string;           // "Plumbing", "Restaurant", "Consulting"
    employees?: string;          // numeric string
    accountingMethod?: string;   // "Cash" or "Accrual" — free-form
    fiscalYearEnd?: string;      // "12/31"

    // Principal place of business
    street?: string;
    city?: string;
    addressState?: string;       // 2-letter; free-form to mirror /personal
    zip?: string;

    // Software
    accountingSoftware?: string; // "QuickBooks", "Xero", "Wave", "None"
    payrollProvider?: string;    // "ADP", "Gusto", "In-house", "None"

    // Owner (v0 — single owner; v1+ moves to owners[])
    ownerName?: string;
    ownerSsn?: string;           // encrypted at rest
    ownerPercent?: string;       // numeric string
    ownerTitle?: string;
    ownerCount?: string;         // numeric string — "1", "2", … (formation only)
    preparingPersonal?: 'yes' | 'no';

    // CA SoS BE Public Search snapshot — captured at intake time when
    // addressState === 'CA'. Persists Antonio's audit-time view of the
    // entity's standing per CA records (Active / FTB Suspended /
    // Forfeited / etc.). Re-checkable from command-room later if
    // status changes mid-engagement. See packages/shared/src/ca-sos.ts.
    caSoSStatus?: string;        // raw status, e.g. "Active", "FTB Suspended"
    caSoSEntityNumber?: string;  // CA SoS entity number (12 chars)
    caSoSMatchedName?: string;   // canonical name from CA SoS
    caSoSCheckedAt?: string;     // ISO timestamp of lookup
  };

  // ── Tax questions / deductions / events ─────────────────────────
  // Field names match the /tax-questions UX exactly.
  taxQuestions?: {
    crypto?: boolean;
    estimated?: boolean;
    healthAll?: boolean;
    retirement?: boolean;
    foreign?: boolean;
    overtime?: boolean;
    tips?: boolean;
  };

  // Field names match the /deductions UI toggles. "none" is mutually
  // exclusive with everything else; the page handles that gating.
  deductions?: {
    mortgage?: boolean;
    student?: boolean;
    charity?: boolean;
    childcare?: boolean;
    medical?: boolean;
    education?: boolean;
    educator?: boolean;
    none?: boolean;
    childcareDetails?: {
      providerName?: string;
      providerAddress?: string;
      providerEin?: string;       // EIN encrypted at rest (see SENSITIVE_INTAKE_PATHS)
      amountPaid?: string;
    };
  };

  // Field names match the /life-events UI toggles. "none" is mutually
  // exclusive with the rest (page handles that gating).
  lifeEvents?: {
    marriage?: boolean;
    baby?: boolean;
    home?: boolean;
    business?: boolean;
    inherit?: boolean;
    retire?: boolean;
    none?: boolean;
  };

  strategicTopics?: {
    selected?: StrategicTopic[];
  };

  // ── Wrap-up ─────────────────────────────────────────────────────
  refund?: {
    preference?: RefundPreference;
    bankName?: string;           // not sensitive; e.g. "Chase"
    bankRouting?: string;        // encrypted at rest
    bankAccount?: string;        // encrypted at rest
    bankAccountType?: BankAccountType;
  };

  documents?: {
    uploadComplete?: boolean;
    // "What's missing?" free-text captured on /docs. Antonio sees
    // this in command-room before the prep call so he can prepare
    // the right follow-ups. The Soraban-pattern intake escape valve:
    // clients who are waiting on a 1099 or have a complex
    // doc-collection story can communicate the context without
    // blocking on a per-doc upload. v0 single freeform field; v1.5
    // expands to structured pending-items list if Antonio's review
    // of these notes shows a pattern.
    gapNotes?: string;
  };

  engagement?: {
    checked?: boolean;
    signed?: boolean;
  };

  // §7216 disclosure consent. `checked` = user acknowledged the
  // disclosure paragraphs; `signed` = user typed their name as
  // signature. Both required to advance.
  consent?: {
    checked?: boolean;
    signed?: boolean;
  };

  contactInfo?: {
    preferredMethod?: ContactMethod;
    bestTimeToReach?: string;
  };

  // Appointment selection — matches /appt UX. dateIdx/timeIdx point
  // into Antonio's calendar slot list (resolved server-side later).
  appointment?: {
    // Phone removed in May 2026 — Antonio prefers video for the relationship
    // signal (face-to-face) and in-person for new high-touch clients.
    // Existing rows with format='phone' from earlier intakes still parse;
    // the UI just no longer offers it as a choice going forward.
    format?: 'video' | 'inperson';
    dateIdx?: number;
    timeIdx?: number;
  };

  deposit?: {
    paid?: boolean;
    amountCents?: number;
    stripePaymentIntentId?: string;
  };
};

// ────────────────────────────────────────────────────────────────
// Sensitive paths — fields encrypted at rest via app-layer AES-GCM.
//
// Glob syntax:
//   `*` matches exactly one path segment (e.g. an array index or key)
//
// All sensitive writes flow through encryptField() before going into the
// JSONB. Reads decrypt on access. Migration to a KMS-backed key (AWS KMS
// / GCP KMS / HashiCorp Vault) is a single-file change — see
// packages/db/src/encryption.ts.
// ────────────────────────────────────────────────────────────────

export const SENSITIVE_INTAKE_PATHS: readonly string[] = [
  'personal.ssn',
  'spouse.ssn',
  'dependents.list.*.ssn',
  'selfEmployment.ein',
  'business.ein',
  'business.ownerSsn',
  'refund.bankRouting',
  'refund.bankAccount',
  // MFS + community property notes can carry prenup / separation-
  // agreement / financial-arrangement details that the client wouldn't
  // expect to land in plaintext. Encrypted at rest per the same
  // per-tenant DEK path as SSN/EIN. §7216 posture: §301.7216-2 carve-
  // out for the service provider relationship, but defense-in-depth
  // makes the encrypted-at-rest treatment the right floor.
  'mfsCommunityProperty.notes',
] as const;

/** True if the dotted path matches one of the SENSITIVE_INTAKE_PATHS globs. */
export function isSensitivePath(path: string): boolean {
  return SENSITIVE_INTAKE_PATHS.some((pattern) => matchPathGlob(pattern, path));
}

// ────────────────────────────────────────────────────────────────
// Entity-level filing detection.
//
// Distinguishes filings that go on the OWNER'S 1040 (sole prop, single-member
// LLC disregarded, schedule C/E) from filings that go on the ENTITY'S OWN
// return (1120, 1120-S, 1065). Drives intake gating: 1040-specific questions
// (W-2, deductions, refund preference, etc.) only apply to individual filings.
//
// Primary signal: `service.kind === 'biz'`. The /services screen labels this
// option as "Business return — S-Corp, Partnership, LLC" (see SERVICE_CATALOG
// in packages/ui/src/services-catalog.tsx). Sole-prop / Schedule C / 1099
// filers are explicitly directed to the 'self' option ("Self-employed return
// — Schedule C or 1099 income"). So picking 'biz' is a strong user-driven
// commitment to entity-level filing — which is why it's safe to default the
// biz path to entity-only even before /business-info has run.
//
// /business-info collects free-form `business.entityType` which CAN refine
// the gate but is not yet wired into the canonical forward chain (see the
// /business-info comment in intake-flow.ts). When entityType IS set (future
// flow change, direct URL visit, or returning client) it overrides in either
// direction. Free-form parsing follows the existing pattern in
// required-docs.ts.
//
// V0 trade-off (Antonio bug 2026-05-09 fix): the "biz + also preparing
// personal return" override only kicks in if `business.preparingPersonal`
// is set to 'yes', which lives on /business-info — currently off the
// forward chain. That case will route correctly once /business-info is
// wired in. For v0, biz = entity-only is the simplest correct fix.
//
// Known v0 trade-off: a single-member-LLC user who reads the /services
// option literally ("Business return — S-Corp, Partnership, LLC") and
// picks 'biz' is classified as entity-only here, even though a disregarded
// SMLLC actually files Schedule C on the owner's 1040. They won't see
// /income on the forward path. Mitigations: (a) Antonio catches it in
// prep, (b) the user can back-nav into /business-info and set entityType
// to "Sole Prop" / "Disregarded" / "Single Member LLC" to flip the gate,
// (c) the eventual proper fix is to collect entityType BEFORE /income
// (wire /business-info into the forward chain). The Antonio-reported bug
// (corp clients seeing W-2) is the priority for v0.
//
// Entity-level keywords are checked BEFORE individual-grade keywords so
// "Single Member LLC (S-Corp election)" correctly resolves to entity-level —
// the corp election overrides the default disregarded treatment.
// ────────────────────────────────────────────────────────────────

const ENTITY_LEVEL_KEYWORDS = [
  's-corp',
  's_corp',
  's corp',
  '1120-s',
  '1120s',
  'c-corp',
  'c_corp',
  'c corp',
  '1120',
  'partnership',
  '1065',
];

const INDIVIDUAL_ENTITY_KEYWORDS = [
  'sole prop',          // covers sole prop / sole proprietor / sole proprietorship
  'sole-prop',
  'schedule c',
  'sched c',
  'disregarded',
  'single member',      // single-member LLC defaults to disregarded (Schedule C)
  'single-member',
  'smllc',
];

/**
 * True when the filing is for the entity itself (1120/1120-S/1065), not the
 * owner's 1040. Used to gate 1040-specific intake steps.
 *
 * Returns false when:
 *   - service.kind !== 'biz' (no business path → personal 1040)
 *   - business.preparingPersonal === 'yes' (also doing the owner's 1040)
 *   - business.entityType matches an individual-grade keyword (sole prop,
 *     single-member LLC without further election, etc.)
 *
 * Returns true when service.kind === 'biz' AND no individual override fires.
 * Empty entityType on the biz path counts as entity-level — this is how
 * Antonio's bug gets fixed in the current intake flow (where /business-info
 * is not yet on the forward chain, so entityType is unset when /income is
 * reached). The user already said "Business Tax Return" upstream; absent
 * conflicting info we honor that intent and skip 1040-specific questions.
 */
export function isEntityOnlyFiling(state: IntakeState): boolean {
  if (state.service?.kind !== 'biz') return false;
  if (state.business?.preparingPersonal === 'yes') return false;
  const entityType = state.business?.entityType?.trim().toLowerCase() ?? '';
  // Entity-level keyword wins — corp election overrides default disregarded
  // treatment on a single-member LLC.
  if (ENTITY_LEVEL_KEYWORDS.some((kw) => entityType.includes(kw))) return true;
  if (INDIVIDUAL_ENTITY_KEYWORDS.some((kw) => entityType.includes(kw))) return false;
  return true;
}

// ────────────────────────────────────────────────────────────────
// Masking — what the SERVER sends to the CLIENT for sensitive fields
// when they're not actively being edited. The server NEVER sends the
// plaintext SSN/EIN/bank by default. The client receives a masked
// sentinel string; to see plaintext, the client makes an explicit
// revealIntakeField() server-action call which is audit-logged as
// a 'read' action.
//
// Wire format: original-length string with all but the last 4
// characters replaced by MASK_CHAR (UTF-8 middle dot, U+00B7). Length
// preserved so React component layouts don't shift when masked vs
// plaintext. The dot character is non-digit + non-letter, so Zod
// schemas (^\d{3}-?\d{2}-?\d{4}$ etc.) reject masked values as write
// payloads — a masked value can never round-trip back to storage.
//
// THREAT MODEL
//   - Without masking: every (intake) page nav decrypts and ships full
//     plaintext SSN to the client. Plaintext sits in React component
//     state, JS heap, browser DevTools network tab, React DevTools
//     component tree. XSS exfiltration is one bug away.
//   - With masking: plaintext exists in the client only during active
//     edit (after a deliberate revealIntakeField call, until save or
//     navigation). Reveal is audit-logged with the path. Mass-exfil
//     of stored SSNs requires not just stealing client state but
//     calling reveal on every sensitive path with a leaked session.
// ────────────────────────────────────────────────────────────────

/** UTF-8 middle dot. Non-digit, non-letter. */
export const MASK_CHAR = '·';

// ────────────────────────────────────────────────────────────────
// Tax-year computation. The "active" tax year for an intake depends on
// the TENANT's wall-clock month, not the server's UTC clock.
//
// Logic: January–October -> prior year (most filings, extensions, late
// amendments are for the prior tax year). November–December -> current
// year (early filers starting their next return).
//
// The default America/Los_Angeles matches Vazant Consulting (the only
// v0 tenant). When multi-tenant lands, callers pass tenants.timezone
// explicitly.
// ────────────────────────────────────────────────────────────────

export function taxYearForDate(date: Date, timezone = 'America/Los_Angeles'): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(date);

  const monthPart = parts.find((p) => p.type === 'month');
  const yearPart = parts.find((p) => p.type === 'year');
  if (!monthPart || !yearPart) {
    throw new Error(
      `taxYearForDate: Intl.DateTimeFormat returned no month/year for tz=${timezone}`,
    );
  }

  const month = parseInt(monthPart.value, 10); // 1–12
  const year = parseInt(yearPart.value, 10);
  return month <= 10 ? year - 1 : year;
}

/**
 * Mask a sensitive plaintext value for the wire. Preserves length;
 * replaces all but last 4 characters with MASK_CHAR.
 *
 *   maskSensitive('123456789')   → '·····6789'
 *   maskSensitive('12-3456789')  → '······6789'  (dash treated like any char)
 *   maskSensitive('12345')       → '·2345'        (single char masked)
 *   maskSensitive('123')         → '···'          (too short, all masked)
 *   maskSensitive('')            → ''             (empty stays empty)
 */
export function maskSensitive(plaintext: string, keepLast = 4): string {
  if (typeof plaintext !== 'string' || plaintext.length === 0) return plaintext;
  if (plaintext.length <= keepLast) return MASK_CHAR.repeat(plaintext.length);
  // Note: slice(-0) returns the WHOLE string in JS (treated as slice(0)).
  // Special-case keepLast=0 so we return all-mask, not all-mask-plus-original.
  const tail = keepLast > 0 ? plaintext.slice(-keepLast) : '';
  return MASK_CHAR.repeat(plaintext.length - keepLast) + tail;
}

/**
 * True if a value looks like a mask sentinel from the server. Used by
 * client components to decide whether to render the masked view + reveal
 * affordance, vs the editable input.
 *
 * Heuristic: contains MASK_CHAR. Not 100% airtight (a user could in
 * theory paste a middle-dot into a free-text field) but good enough —
 * sensitive fields have schema-enforced character classes that exclude
 * MASK_CHAR.
 */
export function isMaskedSentinel(value: unknown): boolean {
  return typeof value === 'string' && value.includes(MASK_CHAR);
}

/**
 * Walk an IntakeState and replace every value at a SENSITIVE_INTAKE_PATHS
 * leaf with a masked sentinel. Called by the server before sending answers
 * to the client — plaintext SSN/EIN/bank never leaves the server unless
 * the client explicitly calls revealIntakeField() for one path at a time.
 *
 * Handles glob paths like `dependents.list.*.ssn` by enumerating the
 * array at the wildcard position.
 */
export function maskSensitiveFields(state: IntakeState): IntakeState {
  let result = state;
  for (const pattern of SENSITIVE_INTAKE_PATHS) {
    if (!pattern.includes('*')) {
      // Direct path — no array enumeration needed.
      const value = getAtPath(result, pattern);
      if (typeof value === 'string' && value.length > 0) {
        result = setAtPath(result, pattern, maskSensitive(value));
      }
      continue;
    }

    // Glob path — find the array at the wildcard position, iterate.
    const segments = pattern.split('.');
    const starIndex = segments.indexOf('*');
    const beforeStar = segments.slice(0, starIndex).join('.');
    const afterStar = segments.slice(starIndex + 1).join('.');
    const arrayValue = getAtPath(result, beforeStar);
    if (!Array.isArray(arrayValue)) continue;
    for (let i = 0; i < arrayValue.length; i++) {
      const itemPath = afterStar
        ? `${beforeStar}.${i}.${afterStar}`
        : `${beforeStar}.${i}`;
      const value = getAtPath(result, itemPath);
      if (typeof value === 'string' && value.length > 0) {
        result = setAtPath(result, itemPath, maskSensitive(value));
      }
    }
  }
  return result;
}

/**
 * Matches a single-`*`-segment glob against a dotted path.
 *
 *   matchPathGlob('dependents.list.*.ssn', 'dependents.list.0.ssn') → true
 *   matchPathGlob('dependents.list.*.ssn', 'dependents.list.0.name') → false
 */
export function matchPathGlob(pattern: string, path: string): boolean {
  const p = pattern.split('.');
  const a = path.split('.');
  if (p.length !== a.length) return false;
  for (let i = 0; i < p.length; i++) {
    if (p[i] === '*') continue;
    if (p[i] !== a[i]) return false;
  }
  return true;
}

// ────────────────────────────────────────────────────────────────
// Path helpers — read/write a dotted path inside an IntakeState.
// Used by useIntakeField() on the client and saveIntakeField() server action.
// ────────────────────────────────────────────────────────────────

/** Read a value at a dotted path. Returns undefined for any missing segment. */
export function getAtPath(state: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, seg) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[seg];
  }, state);
}

/**
 * Set a value at a dotted path. Returns a new object (immutable update).
 * Creates intermediate objects/arrays as needed. If a segment looks like an
 * integer index (`'0'`, `'1'`, ...), the parent is treated as an array.
 */
export function setAtPath<T>(state: T, path: string, value: unknown): T {
  const segs = path.split('.');
  if (segs.length === 0) return state;
  const next = clone(state);
  let cursor = next as Record<string, unknown>;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i]!;
    const nextSeg = segs[i + 1]!;
    const expectArray = /^\d+$/.test(nextSeg);
    const existing = cursor[seg];
    if (existing == null || typeof existing !== 'object') {
      cursor[seg] = expectArray ? [] : {};
    }
    cursor = cursor[seg] as Record<string, unknown>;
  }
  cursor[segs[segs.length - 1]!] = value;
  return next;
}

function clone<T>(value: T): T {
  // Intake state is plain JSON-serializable data — structuredClone or JSON
  // round-trip both work. JSON is portable across older Node runtimes.
  return JSON.parse(JSON.stringify(value)) as T;
}
