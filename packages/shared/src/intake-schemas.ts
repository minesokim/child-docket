// ────────────────────────────────────────────────────────────────
// Zod schemas for the IntakeState. Source of truth for what we will
// accept at the server-action boundary.
//
// Every saveIntakeField() call validates the (path, value) pair against
// these schemas before writing to Postgres or encrypting. Anything not
// listed here gets rejected with a typed error — defensive against
// malformed client requests, type drift between client/server, and
// outright malicious input.
//
// Why explicit per-path schemas instead of one big nested IntakeState
// schema with auto-walking: a flat path → schema map is easier to read,
// easier to audit ("which paths do we accept SSNs at?"), easier to
// extend when the flow grows. The cost is verbosity. Worth it.
// ────────────────────────────────────────────────────────────────

import { z } from 'zod';
import { matchPathGlob } from './intake.js';

// ────────────────────────────────────────────────────────────────
// Atomic schemas — leaves of the tree
// ────────────────────────────────────────────────────────────────

export const FilingStatusSchema = z.enum(['single', 'mfj', 'mfs', 'hoh', 'qw']);

export const IncomeTypeSchema = z.enum(['w2', 'self', 'rental', 'invest', 'retire']);

export const ServiceKindSchema = z.enum(['personal', 'self', 'biz', 'other']);
export const ServiceOtherSubKindSchema = z.enum(['intro', 'formation', 'books', 'strategy']);

export const LifeEventSchema = z.enum([
  'married',
  'divorced',
  'baby',
  'home_purchase',
  'home_sale',
  'move',
  'death_in_family',
  'job_change',
]);

export const DeductionKindSchema = z.enum(['standard', 'itemized']);

export const RefundPreferenceSchema = z.enum([
  'direct_deposit',
  'check',
  'apply_to_next_year',
]);

export const BankAccountTypeSchema = z.enum(['checking', 'savings']);

export const BusinessEntityTypeSchema = z.enum([
  'sole_prop',
  'llc',
  'sole_member_llc',
  's_corp',
  'c_corp',
  'partnership',
]);

export const DependentRelationshipSchema = z.enum([
  'child',
  'stepchild',
  'foster_child',
  'parent',
  'sibling',
  'other',
]);

export const AppointmentTypeSchema = z.enum(['phone', 'video', 'in_person']);

export const ContactMethodSchema = z.enum(['sms', 'email', 'phone']);

export const StrategicTopicSchema = z.enum([
  'planning',
  'entity',
  'estimated',
  'retirement',
  'realestate',
  'irs',
  'other',
]);

// ────────────────────────────────────────────────────────────────
// Format primitives — re-used across the tree
// ────────────────────────────────────────────────────────────────

// ISO date YYYY-MM-DD. Zod's date() coerces from Date objects which is
// not what we want — we want exactly the string format we store.
const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

// SSN: 9 digits with optional dashes. Stored encrypted, never logged.
const SsnSchema = z
  .string()
  .regex(/^\d{3}-?\d{2}-?\d{4}$/, 'SSN must be 9 digits (XXX-XX-XXXX)');

// EIN: 9 digits with optional dash. Stored encrypted.
const EinSchema = z
  .string()
  .regex(/^\d{2}-?\d{7}$/, 'EIN must be 9 digits (XX-XXXXXXX)');

// Bank routing number: exactly 9 digits. Stored encrypted.
const BankRoutingSchema = z
  .string()
  .regex(/^\d{9}$/, 'Routing number must be exactly 9 digits');

// Bank account number: 4-17 digits (US ABA range). Stored encrypted.
const BankAccountNumberSchema = z
  .string()
  .regex(/^\d{4,17}$/, 'Account number must be 4-17 digits');

// 2-letter US state code.
const StateCodeSchema = z
  .string()
  .regex(/^[A-Z]{2}$/, 'State must be 2-letter uppercase code');

// Phone: loose international format. Strict E.164 happens at write boundary.
const PhoneSchema = z.string().regex(/^\+?[\d\s()-]{7,20}$/);

// (MoneySchema removed — every money field is currently a free-form display
// string per the UX. v1+ may reintroduce when forms collect numeric values.)

// ────────────────────────────────────────────────────────────────
// Object shapes — for paths that write whole subtrees
// ────────────────────────────────────────────────────────────────

const DependentSchema = z.object({
  fullName: z.string().min(1).max(200).optional(),
  dateOfBirth: IsoDateSchema.optional(),
  ssn: SsnSchema.optional(),
  relationship: z.string().max(60).optional(),
  monthsLivedWithYou: z.string().max(2).optional(),
});

const RentalTypeSchema = z.enum(['long', 'short', 'commercial', 'mixed']);

const RentalPropertySchema = z.object({
  rentalType: RentalTypeSchema.optional(),
  address: z.string().max(300).optional(),
  monthlyRent: z.string().max(50).optional(),
  monthlyMortgage: z.string().max(50).optional(),
  yearAcquired: z.string().regex(/^\d{4}$/, 'Use YYYY').optional().or(z.literal('')),
  rentalCount: z.string().max(3).optional(),
});

// ────────────────────────────────────────────────────────────────
// PATH_SCHEMAS — registered paths the server action will accept.
//
// Glob convention: `*` matches one segment (typically array indices).
// Lookup uses matchPathGlob from intake.ts to resolve `dependents.list.0.ssn`
// against the registered `dependents.list.*.ssn` glob.
// ────────────────────────────────────────────────────────────────

export const PATH_SCHEMAS: Readonly<Record<string, z.ZodTypeAny>> = {
  // Meta — last-visited route for resume-where-you-left-off
  '_meta.lastVisitedRoute': z.string().regex(/^\/[a-z0-9-/?=&]*$/i, 'Invalid route'),

  // Tutorial / service path
  'tutorial.completed': z.boolean(),
  'service.kind': ServiceKindSchema,
  'service.otherSub': ServiceOtherSubKindSchema,
  'service.addons': z.array(z.string().max(60)).max(20),

  // Personal — primary taxpayer
  'personal.fullName': z.string().min(1).max(200),
  'personal.dateOfBirth': IsoDateSchema,
  'personal.ssn': SsnSchema,
  'personal.occupation': z.string().max(200),
  'personal.email': z.string().email().max(254),
  'personal.phone': PhoneSchema,
  'personal.street': z.string().max(300),
  'personal.city': z.string().max(100),
  'personal.addressState': StateCodeSchema,
  'personal.zip': z.string().regex(/^\d{5}(-\d{4})?$/, 'ZIP must be 5 or 9 digits'),

  // State + prior year (free-form strings — see intake.ts comment)
  'state.primaryState': z.string().min(1).max(100),
  'state.additionalState': z.string().max(100),
  'state.filedLast': z.enum(['yes', 'no']),
  'state.preparer': z.string().max(200),

  // Filing status
  'filing.status': FilingStatusSchema,

  // Spouse (only collected when MFJ/MFS — server should also gate)
  'spouse.fullName': z.string().min(1).max(200),
  'spouse.dateOfBirth': IsoDateSchema,
  'spouse.ssn': SsnSchema,
  'spouse.occupation': z.string().max(200),

  // Dependents — free-form per /deps-detail UX (Antonio normalizes during prep)
  'dependents.count': z.number().int().min(0).max(15),
  'dependents.list': z.array(DependentSchema).max(15),
  'dependents.list.*.fullName': z.string().min(1).max(200),
  'dependents.list.*.dateOfBirth': IsoDateSchema,
  'dependents.list.*.ssn': SsnSchema,
  'dependents.list.*.relationship': z.string().max(60),
  'dependents.list.*.monthsLivedWithYou': z.string().max(2),

  // Income
  'income.types': z.array(IncomeTypeSchema).max(5),

  // Self-employment (free-form strings to match UX — Antonio normalizes)
  'selfEmployment.businessName': z.string().min(1).max(200),
  'selfEmployment.whatYouDo': z.string().max(300),
  'selfEmployment.entityType': z.string().max(100),
  'selfEmployment.ein': EinSchema,
  'selfEmployment.revenue': z.string().max(50),
  'selfEmployment.homeOffice': z.boolean(),
  'selfEmployment.vehicle': z.boolean(),
  'selfEmployment.cash': z.boolean(),

  // Rental properties — free-form per /rental-detail UX
  'rental.properties': z.array(RentalPropertySchema).max(20),
  'rental.properties.*.rentalType': RentalTypeSchema,
  'rental.properties.*.address': z.string().max(300),
  'rental.properties.*.monthlyRent': z.string().max(50),
  'rental.properties.*.monthlyMortgage': z.string().max(50),
  'rental.properties.*.yearAcquired': z.string().max(4),
  'rental.properties.*.rentalCount': z.string().max(3),

  // Business sub-flow — free-form per /business-info + /business-formation UX
  'business.legalName': z.string().min(1).max(200),
  'business.dba': z.string().max(200),
  'business.ein': EinSchema,
  'business.entityType': z.string().max(60),
  'business.industry': z.string().max(200),
  'business.formationState': z.string().max(100),
  'business.formationDate': z.string().max(50),
  'business.activity': z.string().max(200),
  'business.employees': z.string().max(10),
  'business.accountingMethod': z.string().max(60),
  'business.fiscalYearEnd': z.string().max(20),
  'business.street': z.string().max(300),
  'business.city': z.string().max(100),
  'business.addressState': z.string().max(2),
  'business.zip': z.string().regex(/^\d{5}(-\d{4})?$/, 'ZIP must be 5 or 9 digits').or(z.literal('')),
  'business.accountingSoftware': z.string().max(100),
  'business.payrollProvider': z.string().max(100),
  'business.ownerName': z.string().max(200),
  'business.ownerSsn': SsnSchema,
  'business.ownerPercent': z.string().max(5),
  'business.ownerTitle': z.string().max(100),
  'business.ownerCount': z.string().max(3),
  'business.preparingPersonal': z.enum(['yes', 'no']),

  // Tax questions — names match the UI checkboxes
  'taxQuestions.crypto': z.boolean(),
  'taxQuestions.estimated': z.boolean(),
  'taxQuestions.healthAll': z.boolean(),
  'taxQuestions.retirement': z.boolean(),
  'taxQuestions.foreign': z.boolean(),
  'taxQuestions.overtime': z.boolean(),
  'taxQuestions.tips': z.boolean(),

  // Deductions — booleans matching /deductions UI toggles
  'deductions.mortgage': z.boolean(),
  'deductions.student': z.boolean(),
  'deductions.charity': z.boolean(),
  'deductions.childcare': z.boolean(),
  'deductions.medical': z.boolean(),
  'deductions.education': z.boolean(),
  'deductions.educator': z.boolean(),
  'deductions.none': z.boolean(),
  'deductions.childcareDetails.providerName': z.string().max(200),
  'deductions.childcareDetails.providerAddress': z.string().max(300),
  'deductions.childcareDetails.providerEin': EinSchema,
  'deductions.childcareDetails.amountPaid': z.string().max(50),

  // Life events — booleans matching /life-events UI toggles
  'lifeEvents.marriage': z.boolean(),
  'lifeEvents.baby': z.boolean(),
  'lifeEvents.home': z.boolean(),
  'lifeEvents.business': z.boolean(),
  'lifeEvents.inherit': z.boolean(),
  'lifeEvents.retire': z.boolean(),
  'lifeEvents.none': z.boolean(),

  // Strategic topics
  'strategicTopics.selected': z.array(StrategicTopicSchema).max(10),

  // Refund + bank
  'refund.preference': RefundPreferenceSchema,
  'refund.bankName': z.string().max(100),
  'refund.bankRouting': BankRoutingSchema,
  'refund.bankAccount': BankAccountNumberSchema,
  'refund.bankAccountType': BankAccountTypeSchema,

  // Documents (intake-side flag only — actual files live in `documents` table)
  'documents.uploadComplete': z.boolean(),

  // Sign — both engagement and consent split into "checked" + "signed"
  'engagement.checked': z.boolean(),
  'engagement.signed': z.boolean(),
  'consent.checked': z.boolean(),
  'consent.signed': z.boolean(),

  // Contact preferences
  'contactInfo.preferredMethod': ContactMethodSchema,
  'contactInfo.bestTimeToReach': z.string().max(200),

  // Appointment — calendar slot indices for v0; v1 stores actual ISO datetime.
  // 'phone' was removed May 2026 — Antonio prefers face-to-face. We accept
  // legacy rows that already have it (no schema migration needed) but the
  // UI no longer offers it. Validation accepts only video/inperson on writes.
  'appointment.format': z.enum(['video', 'inperson']),
  'appointment.dateIdx': z.number().int().min(0).max(50),
  'appointment.timeIdx': z.number().int().min(0).max(50),

  // Deposit
  'deposit.paid': z.boolean(),
  'deposit.amountCents': z.number().int().min(0).max(1_000_000_00),
  'deposit.stripePaymentIntentId': z.string().max(200),
};

// ────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────

/**
 * Look up a Zod schema for a given dotted path. Tries an exact match
 * first, then falls back to glob match (for array index paths like
 * `dependents.list.0.ssn`).
 */
export function getSchemaForPath(path: string): z.ZodTypeAny | null {
  // Direct hit (most common)
  const direct = PATH_SCHEMAS[path];
  if (direct) return direct;

  // Glob fallback for array-indexed paths
  for (const pattern in PATH_SCHEMAS) {
    if (pattern.includes('*') && matchPathGlob(pattern, path)) {
      return PATH_SCHEMAS[pattern]!;
    }
  }
  return null;
}

/**
 * Validate a single field write. Returns `{ ok: true, value }` with the
 * (possibly coerced) value on success, or `{ ok: false, error }` with a
 * user-facing error message.
 *
 * Used by the saveIntakeField server action before encryption + write.
 */
export type IntakeValidationResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string; path: string };

export function validateIntakeField(
  path: string,
  value: unknown,
): IntakeValidationResult {
  const schema = getSchemaForPath(path);
  if (!schema) {
    return { ok: false, error: `No schema registered for path: ${path}`, path };
  }
  const result = schema.safeParse(value);
  if (!result.success) {
    const first = result.error.issues[0];
    return {
      ok: false,
      error: first?.message ?? 'Validation failed',
      path,
    };
  }
  return { ok: true, value: result.data };
}

/** All paths the server action will accept (for debugging / introspection). */
export function listKnownPaths(): string[] {
  return Object.keys(PATH_SCHEMAS).sort();
}
