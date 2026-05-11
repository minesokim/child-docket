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
import { isEntityOnlyFiling } from './intake.js';

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
  /**
   * Plain-English hint for where the client can find this document.
   * Surfaces on the focused per-doc upload page. Empty for slots
   * where there's no useful hint (driver's license, prior return).
   */
  whereToFind?: string;
  /**
   * Antonio-voiced note that appears on the focused per-doc page.
   * Should sound like a tax preparer talking to a client (warm,
   * specific, not bureaucratic). Empty when the title + subtitle
   * already say enough.
   */
  antonioNote?: string;
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
  // Entity-only filings (Corp / S-Corp / Partnership / LLC-elected-corp)
  // don't have 1040 income — they file 1120 / 1120-S / 1065. Suppress
  // the 1040-relevant income/asset doc slots even if `state.income.types`
  // still carries stale values from a prior personal-path intake session
  // (e.g., user picked W-2 in personal mode, then switched to biz mode).
  //
  // This is the read-time enforcement of the entity-filing gate; the
  // forward-flow gate landed in commit faaa579 (intake-flow.ts skips
  // /income for entity-only). Without this read-time guard a corp client
  // whose intake started on personal and flipped to biz would still see
  // "Upload your W-2" on /docs (the 5/9 Antonio bug, follow-up half).
  //
  // Identity docs (DL, SSN) still fire because the signing officer of
  // any return needs to be identified.
  const incomeTypes: IncomeType[] = isEntityOnlyFiling(state)
    ? []
    : (state.income?.types ?? []);

  // ─── Identity (always) ───
  // Driver's License + SSN card for the primary taxpayer. Required for
  // filing — IRS Pub 1345 requires identity verification on remote
  // signing, and CA FTB has parallel requirements.
  //
  // The DL itself is captured in TWO photos (front + back) — the front
  // carries the photo + DOB + address, the back carries the magnetic
  // stripe / 2D barcode the IRS scan-validation rule reads. But that
  // split is INTERNAL to the per-slot upload page: the user sees ONE
  // "Driver's License" row in the overview, then on the focused page
  // is walked through Step 1 → Step 2.
  //
  // Documents persisted from that flow carry slot_id = 'identity-dl-front'
  // or 'identity-dl-back' so the finalize worker can apply the
  // DriversLicenseFront / DriversLicenseBack filename substitution.
  // The expected-slot list keeps a single 'identity-dl' so the overview
  // shows one row.
  const primaryName = state.personal?.fullName?.trim() || null;
  docs.push({
    id: 'identity-dl',
    kind: 'drivers_license',
    title: "Driver's License",
    subtitle: 'Front and back of your card',
    required: true,
    forPerson: primaryName ?? undefined,
    context: 'Always — primary taxpayer identity verification',
  });
  docs.push({
    id: 'identity-ssn',
    kind: 'ssn_card',
    title: 'Social Security Card',
    subtitle: primaryName
      ? `For ${primaryName}`
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
      subtitle: 'Front and back of the card',
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

  // Populate per-kind copy (whereToFind + antonioNote) from the
  // central DOC_KIND_COPY map. Single source of truth — copy edits
  // happen in one place.
  return docs.map((d) => {
    const c = copyFor(d.kind);
    return {
      ...d,
      whereToFind: d.whereToFind ?? c.whereToFind,
      antonioNote: d.antonioNote ?? c.antonioNote,
    };
  });
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

// ────────────────────────────────────────────────────────────────
// Per-kind copy — Antonio-voiced help text + where-to-find hints.
// Centralized here so both the `requiredDocsFor` derivation AND the
// per-slot focused page can pull from the same source. Empty entries
// mean "no hint surface needed beyond title + subtitle."
// ────────────────────────────────────────────────────────────────
type DocKindCopy = {
  whereToFind?: string;
  antonioNote?: string;
};

const DOC_KIND_COPY: Partial<Record<ExpectedDocKind, DocKindCopy>> = {
  w2: {
    whereToFind:
      "Look for an email titled 'Your 2024 W-2 is ready' from your HR or payroll system, or check your employer's portal (ADP, Workday, Paychex, Gusto). Many employers also mail a paper copy in late January.",
    antonioNote:
      "If you worked multiple jobs this year, you'll get one of these from each employer. Upload them all here.",
  },
  '1099_nec': {
    whereToFind:
      'Each company that paid you $600+ for self-employment work sends one of these. Check your email + the tax-doc section of any payment platforms (Stripe, PayPal, Square, Venmo).',
    antonioNote:
      "Don't have the form yet but know the income? Upload anything you have for now (a payment summary, a screenshot) and I'll work with it.",
  },
  '1099_misc': {
    whereToFind:
      'For rents, royalties, prizes, or other miscellaneous income $600+. Less common than the NEC.',
    antonioNote: 'Skip this if nothing comes to mind.',
  },
  '1099_int': {
    whereToFind:
      "From your bank or credit union — usually mailed by January 31. Most banks also have it in their app under 'Tax documents' or 'Statements'.",
    antonioNote:
      'Even small interest amounts count, but if your total interest is under $10 across all accounts, the bank may not send a form.',
  },
  '1099_div': {
    whereToFind:
      "From your brokerage (Fidelity, Schwab, Vanguard, Robinhood). Look in the 'Tax forms' section of your account.",
    antonioNote:
      'If you have a brokerage statement, the 1099-DIV info is usually combined into a single composite tax document — that works too.',
  },
  '1099_r': {
    whereToFind:
      'From the company that paid out the distribution — IRA custodian, 401(k) plan administrator, or pension provider.',
    antonioNote:
      'Even rollovers between retirement accounts get reported on a 1099-R, so upload it even if no tax was withheld.',
  },
  '1098_mortgage': {
    whereToFind:
      "From your mortgage lender, usually in late January. Check your lender's online portal under 'Tax documents'.",
    antonioNote:
      'If you refinanced or sold the home this year, you may have multiple 1098s. Upload all of them.',
  },
  '1098_t': {
    whereToFind:
      "From the college, usually downloadable from the student portal. Look for it under 'Financial' or 'Bursar'.",
    antonioNote:
      'Even if scholarships covered most tuition, the 1098-T is what unlocks credits like the AOTC. Upload it.',
  },
  '1095_a': {
    whereToFind:
      'Mailed by the marketplace (Covered California, healthcare.gov) in late January or available in your account online.',
    antonioNote:
      'This one is easy to forget but legally required if you got marketplace insurance — without it, the IRS can hold up your refund.',
  },
  k1_1065: {
    whereToFind:
      "From the partnership's accountant, usually mailed in March. K-1s often arrive late, so don't wait on this one.",
    antonioNote:
      "If yours hasn't arrived yet, upload last year's so I can flag what to expect. We can substitute when the real one comes.",
  },
  k1_1120s: {
    whereToFind:
      "From your S-corp's accountant, usually around March. If you're a single-member S-corp, you may be preparing this yourself.",
    antonioNote:
      'If you control the entity, get the K-1 issued ASAP — the longer it waits, the longer your personal return waits.',
  },
  bank_statement: {
    whereToFind:
      "Year-end statement from your bank. Most banks have this in their app under 'Statements'.",
    antonioNote: 'Helpful for backing up cost basis or unusual transactions.',
  },
  brokerage_statement: {
    whereToFind:
      "Year-end statement from your brokerage. Look for 'Year-end summary' or 'Annual statement' in your account.",
    antonioNote:
      'Useful for cost basis on sales — sometimes the 1099-B alone misses adjustments.',
  },
  drivers_license: {
    whereToFind: 'Front of the card. Make sure the photo + DOB are visible.',
    antonioNote:
      'Required for IRS identity verification on the e-filed return — IRS Pub 1345.',
  },
  ssn_card: {
    whereToFind:
      "If you've lost the card, a Social Security Administration letter showing your SSN works too.",
    antonioNote:
      "I match this against your intake to make sure the spelling + number are right — single digit off and the IRS rejects the e-file.",
  },
  prior_return: {
    whereToFind:
      'PDF copy of last year\'s return (1040 + any schedules). If you used a different preparer, ask them for a copy.',
    antonioNote:
      "Helps me catch carryforwards (capital losses, NOLs, foreign tax credit, depreciation) that don't show up anywhere else.",
  },
  irs_notice: {
    whereToFind:
      'Any letter from the IRS — CP2000, CP504, LT11, etc. Letters arrive by mail; scans/photos are fine.',
    antonioNote:
      "If you got a notice and aren't sure if it's urgent, upload it and I'll triage. Some have hard deadlines (30 / 60 / 90 days).",
  },
};

// ────────────────────────────────────────────────────────────────
// Friendly description — turn AI-extracted fields into a one-line
// human-readable identifier shown on the overview row.
//
// Falls back gracefully when extraction is missing (legacy docs, old
// classifications) or sparse — returns null and the UI shows the
// title alone.
//
// Examples:
//   w2 + employer="Riverside Unified"        → "From Riverside Unified"
//   1099_nec + payer="TikTok Inc"            → "From TikTok Inc"
//   1098_mortgage + lender="Wells Fargo"     → "From Wells Fargo"
//   drivers_license + fullName="Jane Doe"    → "Jane Doe"
//   prior_return + taxYear=2023              → "2023 return"
//   irs_notice + noticeType="CP2000"         → "CP2000 notice"
// ────────────────────────────────────────────────────────────────
export function friendlyDescriptionFor(
  docKind: string,
  extractedFields: Record<string, unknown> | null | undefined,
): string | null {
  if (!extractedFields) return null;
  const f = extractedFields;

  const get = (key: string): string | null => {
    const v = f[key];
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  };
  const getYear = (key: string): number | null => {
    const v = f[key];
    if (typeof v === 'number' && v >= 1900 && v <= 2100) return v;
    if (typeof v === 'string' && /^\d{4}$/.test(v)) return parseInt(v, 10);
    return null;
  };

  switch (docKind) {
    case 'w2': {
      const employer = get('employer');
      return employer ? `From ${employer}` : null;
    }
    case '1099_nec':
    case '1099_misc':
    case '1099_int':
    case '1099_div':
    case '1099_r': {
      const payer = get('payer');
      return payer ? `From ${payer}` : null;
    }
    case '1098_mortgage': {
      const lender = get('lender');
      return lender ? `From ${lender}` : null;
    }
    case '1098_t': {
      const institution = get('institution');
      return institution ? `From ${institution}` : null;
    }
    case '1095_a': {
      const marketplace = get('marketplaceId') ?? 'marketplace';
      return `Marketplace 1095-A · ${marketplace}`;
    }
    case 'k1_1065':
    case 'k1_1120s': {
      const entity = get('entityName');
      return entity ? `From ${entity}` : null;
    }
    case 'bank_statement':
    case 'brokerage_statement': {
      const institution = get('institution');
      const period = get('statementPeriod');
      if (institution && period) return `${institution} · ${period}`;
      if (institution) return institution;
      return null;
    }
    case 'drivers_license':
    case 'ssn_card': {
      const name = get('fullName');
      return name;
    }
    case 'prior_return': {
      const taxYear = getYear('taxYear');
      return taxYear ? `${taxYear} return` : null;
    }
    case 'irs_notice': {
      const noticeType = get('noticeType');
      return noticeType ? `${noticeType} notice` : 'IRS notice';
    }
    default:
      return null;
  }
}

// Internal — exported via requiredDocsFor.
function copyFor(kind: ExpectedDocKind): DocKindCopy {
  return DOC_KIND_COPY[kind] ?? {};
}
