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
  'retirement_planning',
  'home_purchase_strategy',
  'business_entity_choice',
  'estate_planning',
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

// Money in dollars, allow up to 2 decimals.
const MoneySchema = z.number().nonnegative().multipleOf(0.01);

// ────────────────────────────────────────────────────────────────
// Object shapes — for paths that write whole subtrees
// ────────────────────────────────────────────────────────────────

const DependentSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  dateOfBirth: IsoDateSchema.optional(),
  ssn: SsnSchema.optional(),
  relationship: DependentRelationshipSchema.optional(),
  monthsLivedWithYou: z.number().int().min(0).max(12).optional(),
});

const RentalPropertySchema = z.object({
  address: z.string().max(300).optional(),
  grossRent: MoneySchema.optional(),
  expenses: MoneySchema.optional(),
  daysRented: z.number().int().min(0).max(366).optional(),
  personalUseDays: z.number().int().min(0).max(366).optional(),
});

// ────────────────────────────────────────────────────────────────
// PATH_SCHEMAS — registered paths the server action will accept.
//
// Glob convention: `*` matches one segment (typically array indices).
// Lookup uses matchPathGlob from intake.ts to resolve `dependents.list.0.ssn`
// against the registered `dependents.list.*.ssn` glob.
// ────────────────────────────────────────────────────────────────

export const PATH_SCHEMAS: Readonly<Record<string, z.ZodTypeAny>> = {
  // Tutorial / service path
  'tutorial.completed': z.boolean(),
  'service.kind': ServiceKindSchema,
  'service.otherSub': ServiceOtherSubKindSchema,
  'service.addons': z.array(z.string().max(60)).max(20),

  // Personal — primary taxpayer
  'personal.firstName': z.string().min(1).max(100),
  'personal.middleInitial': z.string().max(2),
  'personal.lastName': z.string().min(1).max(100),
  'personal.dateOfBirth': IsoDateSchema,
  'personal.ssn': SsnSchema,
  'personal.occupation': z.string().max(200),
  'personal.email': z.string().email().max(254),
  'personal.phone': PhoneSchema,

  // State + prior year
  'state.residentState': StateCodeSchema,
  'state.movedDuringYear': z.boolean(),
  'state.otherStates': z.array(StateCodeSchema).max(50),
  'state.filedLastYear': z.boolean(),
  'state.priorYearAGI': MoneySchema,

  // Filing status
  'filing.status': FilingStatusSchema,

  // Spouse (only collected when MFJ/MFS — server should also gate)
  'spouse.firstName': z.string().min(1).max(100),
  'spouse.middleInitial': z.string().max(2),
  'spouse.lastName': z.string().min(1).max(100),
  'spouse.dateOfBirth': IsoDateSchema,
  'spouse.ssn': SsnSchema,
  'spouse.occupation': z.string().max(200),

  // Dependents
  'dependents.count': z.number().int().min(0).max(15),
  'dependents.list': z.array(DependentSchema).max(15),
  // Per-dependent field paths
  'dependents.list.*.firstName': z.string().min(1).max(100),
  'dependents.list.*.lastName': z.string().min(1).max(100),
  'dependents.list.*.dateOfBirth': IsoDateSchema,
  'dependents.list.*.ssn': SsnSchema,
  'dependents.list.*.relationship': DependentRelationshipSchema,
  'dependents.list.*.monthsLivedWithYou': z.number().int().min(0).max(12),

  // Income
  'income.types': z.array(IncomeTypeSchema).max(5),

  // Self-employment
  'selfEmployment.businessName': z.string().min(1).max(200),
  'selfEmployment.businessType': BusinessEntityTypeSchema,
  'selfEmployment.ein': EinSchema,
  'selfEmployment.industry': z.string().max(200),
  'selfEmployment.grossIncome': MoneySchema,
  'selfEmployment.expenses': MoneySchema,
  'selfEmployment.homeOffice': z.boolean(),
  'selfEmployment.vehicleUse': z.boolean(),

  // Rental properties
  'rental.properties': z.array(RentalPropertySchema).max(20),
  'rental.properties.*.address': z.string().max(300),
  'rental.properties.*.grossRent': MoneySchema,
  'rental.properties.*.expenses': MoneySchema,
  'rental.properties.*.daysRented': z.number().int().min(0).max(366),
  'rental.properties.*.personalUseDays': z.number().int().min(0).max(366),

  // Business sub-flow
  'business.legalName': z.string().min(1).max(200),
  'business.dba': z.string().max(200),
  'business.ein': EinSchema,
  'business.entityType': BusinessEntityTypeSchema,
  'business.formationState': StateCodeSchema,
  'business.formationDate': IsoDateSchema,
  'business.industry': z.string().max(200),

  // Tax questions
  'taxQuestions.cryptoTransactions': z.boolean(),
  'taxQuestions.foreignAccounts': z.boolean(),
  'taxQuestions.healthInsurance1095A': z.boolean(),
  'taxQuestions.studentLoanPayments': z.boolean(),
  'taxQuestions.estimatedTaxPayments': z.boolean(),

  // Deductions
  'deductions.kind': DeductionKindSchema,
  'deductions.itemized.mortgageInterest': MoneySchema,
  'deductions.itemized.stateLocalTax': MoneySchema,
  'deductions.itemized.charitable': MoneySchema,
  'deductions.itemized.medical': MoneySchema,

  // Life events
  'lifeEvents.events': z.array(LifeEventSchema).max(10),
  'lifeEvents.notes': z.string().max(2000),

  // Strategic topics
  'strategicTopics.selected': z.array(StrategicTopicSchema).max(10),

  // Refund + bank
  'refund.preference': RefundPreferenceSchema,
  'refund.bankRouting': BankRoutingSchema,
  'refund.bankAccount': BankAccountNumberSchema,
  'refund.bankAccountType': BankAccountTypeSchema,

  // Documents (intake-side flag only — actual files live in `documents` table)
  'documents.uploadComplete': z.boolean(),

  // Sign
  'engagement.signed': z.boolean(),
  'consent.signed': z.boolean(),

  // Contact preferences
  'contactInfo.preferredMethod': ContactMethodSchema,
  'contactInfo.bestTimeToReach': z.string().max(200),

  // Appointment
  'appointment.requested': z.boolean(),
  'appointment.timeSlot': z.string().datetime(),
  'appointment.type': AppointmentTypeSchema,

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
