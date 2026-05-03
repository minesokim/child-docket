// Derive the list of expected documents from intake answers.
//
// Used by the /intake/docs page to render a checklist showing the
// client which documents to upload. As docs get classified, they
// auto-fill matching slots; unmatched uploads land in an "Other"
// section.
//
// SHAPE OF AN EXPECTED DOC
//   - id           stable string slug used as React key + slot match
//   - kind         maps to the doc-classifier's DocKind enum
//   - title        human label rendered in the checklist
//   - subtitle     hint about who provides it / what year / etc.
//   - required     true = must-have for filing; false = recommended
//   - context      the intake answer that triggered the entry (debug)

import type { IntakeState, IncomeType } from './intake.js';

/** Subset of doc-classifier kinds that the checklist slots match against. */
export type ExpectedDocKind =
  | 'w2'
  | '1099_nec'
  | '1099_misc'
  | '1099_int'
  | '1099_div'
  | '1099_r'
  | '1098_mortgage'
  | '1098_t'
  | '1095_a'
  | 'k1_1065'
  | 'k1_1120s'
  | 'bank_statement'
  | 'brokerage_statement'
  | 'drivers_license'
  | 'ssn_card'
  | 'prior_return'
  | 'irs_notice'
  | 'other';

export type ExpectedDoc = {
  /** Stable slug for the slot. Used as React key + slot-match identity. */
  id: string;
  /** DocKind the classifier should match against. */
  kind: ExpectedDocKind;
  /** Display label ("W-2", "Driver's License", etc.). */
  title: string;
  /** Sub-hint ("From your employer", "For 2024 filing year"). */
  subtitle: string;
  /** Required for filing (vs recommended). */
  required: boolean;
  /**
   * For per-person slots (each dependent's SSN), this is the person's
   * name or label. Lets the UI show "Maya Sharma · SSN Card" rather
   * than three identical "SSN Card" rows.
   */
  forPerson?: string;
  /** Tag explaining why this slot exists. Useful for tooltips + tests. */
  context: string;
};

// ────────────────────────────────────────────────────────────────
// The derivation. Pure function over intake state.
//
// Order matters: most-load-bearing first (W-2 before 1098-T, etc.) so
// the visual checklist reads naturally. Required docs all come before
// recommended ones.
// ────────────────────────────────────────────────────────────────

export function requiredDocsFor(state: IntakeState): ExpectedDoc[] {
  const docs: ExpectedDoc[] = [];
  const incomeTypes: IncomeType[] = state.income?.types ?? [];

  // ─── Identity (always) ───
  // Driver's License + SSN card for the primary taxpayer. Required for
  // filing — IRS Pub 1345 requires identity verification on remote
  // signing, and CA FTB has parallel requirements.
  docs.push({
    id: 'identity-dl',
    kind: 'drivers_license',
    title: "Driver's License",
    subtitle: state.personal?.fullName
      ? `For ${state.personal.fullName}`
      : 'For the primary taxpayer',
    required: true,
    context: 'Always — primary taxpayer identity verification',
  });
  docs.push({
    id: 'identity-ssn',
    kind: 'ssn_card',
    title: 'Social Security Card',
    subtitle: state.personal?.fullName
      ? `For ${state.personal.fullName}`
      : 'For the primary taxpayer',
    required: true,
    context: 'Always — primary taxpayer SSN verification',
  });

  // Spouse identity if MFJ.
  if (state.filing?.status === 'mfj') {
    const spouseName = state.spouse?.fullName ?? 'your spouse';
    docs.push({
      id: 'identity-spouse-dl',
      kind: 'drivers_license',
      title: "Spouse's Driver's License",
      subtitle: `For ${spouseName}`,
      required: true,
      forPerson: spouseName,
      context: 'Filing status MFJ — spouse identity verification',
    });
    docs.push({
      id: 'identity-spouse-ssn',
      kind: 'ssn_card',
      title: "Spouse's SSN Card",
      subtitle: `For ${spouseName}`,
      required: true,
      forPerson: spouseName,
      context: 'Filing status MFJ — spouse SSN verification',
    });
  }

  // Per-dependent SSN cards.
  const dependents = state.dependents?.list ?? [];
  dependents.forEach((dep, i) => {
    const name = dep.fullName?.trim() || `dependent ${i + 1}`;
    docs.push({
      id: `dependent-ssn-${i}`,
      kind: 'ssn_card',
      title: `${name}'s SSN Card`,
      subtitle: 'Required to claim as a dependent',
      required: true,
      forPerson: name,
      context: 'Per-dependent SSN — required for the dependent claim',
    });
  });

  // ─── Income — drives most of the rest ───
  if (incomeTypes.includes('w2')) {
    docs.push({
      id: 'income-w2',
      kind: 'w2',
      title: 'W-2',
      subtitle: 'From your employer(s) — one per job',
      required: true,
      context: 'Income types include W-2',
    });
  }

  if (incomeTypes.includes('self')) {
    // Self-employed clients typically receive 1099-NECs from each
    // payer. We surface ONE slot to avoid spamming the UI; the
    // matching is fuzzy ("any 1099-NEC matches this slot") and unmatched
    // additional 1099s go to the Other section.
    docs.push({
      id: 'income-1099nec',
      kind: '1099_nec',
      title: '1099-NEC',
      subtitle: 'From each payer ($600+ in self-employment income)',
      required: true,
      context: 'Income types include self-employment',
    });
    docs.push({
      id: 'income-1099misc',
      kind: '1099_misc',
      title: '1099-MISC (if you got one)',
      subtitle: 'Rents, royalties, prizes, other miscellaneous income',
      required: false,
      context: 'Income types include self-employment — 1099-MISC is common',
    });
  }

  if (incomeTypes.includes('invest')) {
    docs.push({
      id: 'income-1099int',
      kind: '1099_int',
      title: '1099-INT',
      subtitle: 'Interest income from banks / credit unions',
      required: true,
      context: 'Income types include investments',
    });
    docs.push({
      id: 'income-1099div',
      kind: '1099_div',
      title: '1099-DIV',
      subtitle: 'Dividends from stocks / mutual funds',
      required: true,
      context: 'Income types include investments',
    });
    docs.push({
      id: 'income-brokerage',
      kind: 'brokerage_statement',
      title: 'Year-end brokerage statement',
      subtitle: 'For cost basis / wash sales / 1099-B detail',
      required: false,
      context: 'Income types include investments — supports 1099-B reporting',
    });
  }

  if (incomeTypes.includes('retire')) {
    docs.push({
      id: 'income-1099r',
      kind: '1099_r',
      title: '1099-R',
      subtitle: 'Retirement distributions (IRA, 401(k), pension)',
      required: true,
      context: 'Income types include retirement',
    });
  }

  // Rental — the K-1 vs Schedule E split depends on entity structure.
  // For v1 we list 1098 mortgage as the ask; the prep agent figures
  // out the rest from rental property data in intake.
  if (incomeTypes.includes('rental')) {
    docs.push({
      id: 'rental-1098',
      kind: '1098_mortgage',
      title: 'Mortgage Interest Statement (1098)',
      subtitle: 'For each rental property with a mortgage',
      required: false,
      context: 'Income types include rental — 1098 supports Schedule E',
    });
  }

  // ─── Deductions ───
  if (state.deductions?.mortgage) {
    // Don't double-list if already added under rental. Matching is
    // by id; the UI dedupes.
    if (!docs.some((d) => d.kind === '1098_mortgage')) {
      docs.push({
        id: 'deduct-1098',
        kind: '1098_mortgage',
        title: 'Mortgage Interest Statement (1098)',
        subtitle: 'For your primary home',
        required: true,
        context: 'Deductions include mortgage interest',
      });
    }
  }

  if (state.deductions?.education) {
    docs.push({
      id: 'deduct-1098t',
      kind: '1098_t',
      title: '1098-T (Tuition Statement)',
      subtitle: 'From the school — for education credits',
      required: true,
      context: 'Deductions include education',
    });
  }

  // Healthcare marketplace — 1095-A is required to reconcile premium
  // tax credits. We pull this from taxQuestions.healthAll for now;
  // the proper "marketplace boolean" field will arrive when the intake
  // health-coverage screen ships.
  if (state.taxQuestions?.healthAll) {
    docs.push({
      id: 'health-1095a',
      kind: '1095_a',
      title: '1095-A (if marketplace insurance)',
      subtitle: 'Required to reconcile premium tax credit',
      required: false,
      context: 'Health-related question flagged — 1095-A may apply',
    });
  }

  // K-1 if owns business / partnership / S-corp.
  // The intake business sub-flow has entityType (free-text). We match
  // common values to the right K-1 form. Catch-all is K-1 1065.
  if (state.business?.entityType) {
    const t = state.business.entityType.toLowerCase();
    if (t.includes('s-corp') || t.includes('s corp') || t.includes('1120-s')) {
      docs.push({
        id: 'k1-scorp',
        kind: 'k1_1120s',
        title: 'Schedule K-1 (1120-S)',
        subtitle: 'Your S-corp distribution statement',
        required: true,
        context: 'Business entity type S-corp',
      });
    } else if (t.includes('partnership') || t.includes('llc') || t.includes('1065')) {
      docs.push({
        id: 'k1-partnership',
        kind: 'k1_1065',
        title: 'Schedule K-1 (1065)',
        subtitle: 'Your partnership distribution statement',
        required: true,
        context: 'Business entity type partnership/LLC',
      });
    }
  }

  // ─── Always recommended ───
  docs.push({
    id: 'prior-return',
    kind: 'prior_return',
    title: 'Last year’s tax return',
    subtitle: 'Helps us confirm carryforwards + AGI',
    required: false,
    context: 'Always recommended for prep continuity',
  });

  return docs;
}

// ────────────────────────────────────────────────────────────────
// Slot matcher — given an uploaded doc's classified kind + the
// expected list, find the first unfilled slot the upload should fill.
//
// Returns the slot's `id` if a match is found, or null. Caller marks
// that slot as filled and passes the rest to "Other."
//
// Match rule: same kind + slot not yet filled. Slot order = checklist
// order (so the first unfilled W-2 slot fills before the second).
// ────────────────────────────────────────────────────────────────
export function matchUploadToSlot(opts: {
  uploadKind: ExpectedDocKind;
  expected: ExpectedDoc[];
  filledSlotIds: ReadonlySet<string>;
}): string | null {
  for (const slot of opts.expected) {
    if (slot.kind !== opts.uploadKind) continue;
    if (opts.filledSlotIds.has(slot.id)) continue;
    return slot.id;
  }
  return null;
}
