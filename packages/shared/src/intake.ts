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

export type StrategicTopic =
  | 'retirement_planning'
  | 'home_purchase_strategy'
  | 'business_entity_choice'
  | 'estate_planning';

// ────────────────────────────────────────────────────────────────
// IntakeState — the shape of intakeResponses.answers
// ────────────────────────────────────────────────────────────────

export type IntakeDependent = {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;          // ISO date (YYYY-MM-DD)
  ssn?: string;                  // encrypted at rest
  relationship?: DependentRelationship;
  monthsLivedWithYou?: number;
};

export type IntakeRentalProperty = {
  address?: string;
  grossRent?: number;
  expenses?: number;
  daysRented?: number;
  personalUseDays?: number;
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

  spouse?: {
    fullName?: string;
    dateOfBirth?: string;
    ssn?: string;                // encrypted at rest
    occupation?: string;
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
  business?: {
    legalName?: string;
    dba?: string;
    ein?: string;                // encrypted at rest
    entityType?: BusinessEntityType;
    formationState?: string;
    formationDate?: string;
    industry?: string;
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
    bankRouting?: string;        // encrypted at rest
    bankAccount?: string;        // encrypted at rest
    bankAccountType?: BankAccountType;
  };

  documents?: {
    uploadComplete?: boolean;
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

  appointment?: {
    requested?: boolean;
    timeSlot?: string;            // ISO datetime
    type?: AppointmentType;
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
  'refund.bankRouting',
  'refund.bankAccount',
] as const;

/** True if the dotted path matches one of the SENSITIVE_INTAKE_PATHS globs. */
export function isSensitivePath(path: string): boolean {
  return SENSITIVE_INTAKE_PATHS.some((pattern) => matchPathGlob(pattern, path));
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
