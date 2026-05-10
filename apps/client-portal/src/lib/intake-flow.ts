// ────────────────────────────────────────────────────────────────
// Intake flow - single declarative source of truth for the 25-step
// onboarding graph.
//
// Every conditional branch (filing → spouse vs deps, income → self-employment
// vs rental vs tax-questions, etc.) lives in this file. Pages call
// getNextStep(currentRoute, state) and stay dumb about the rest of the flow.
//
// The INTAKE_FLOW array drives:
//   - Forward nav    (getNextStep)
//   - Back nav       (getPrevStep - walks applicable steps in order)
//   - Resume on load (getResumeStep - first applicable + incomplete)
//   - Progress bar   (getStepProgress, getApplicableSteps)
//   - Server-side validation of "did the client actually finish intake"
//
// Adding a new conditional branch = edit this file. Don't add inline
// `if` blocks to page components.
// ────────────────────────────────────────────────────────────────

import { isEntityOnlyFiling, type IntakeState } from '@docket/shared';

export type IntakeSection =
  | 'welcome'      // welcome / tutorial / service path
  | 'about-you'   // personal / state / filing / spouse / dependents
  | 'income'      // income / self-employment / rental / business
  | 'deductions'  // tax-questions / deductions / life-events / strategic
  | 'wrap-up'     // refund / docs / contact-info / appt / deposit
  | 'sign';       // engagement / consent / 8879

export type IntakeStep = {
  /** Stable id used for state lookup. Distinct from route. */
  id: string;
  /** Next.js route this step renders at, no leading basePath. */
  route: string;
  /** Short label shown in IntakeHeader and progress chips. */
  label: string;
  /** Visual section this step belongs to. */
  section: IntakeSection;
  /** Whether this step shows up in the flow at all given current state. */
  isApplicable: (s: IntakeState) => boolean;
  /** Whether this step has all its required answers. */
  isComplete: (s: IntakeState) => boolean;
  /** Route to navigate to after this step. null = end of flow. */
  next: (s: IntakeState) => string | null;
};

// ────────────────────────────────────────────────────────────────
// The flow. Order in this array is canonical - getPrevStep walks
// backwards through this list filtered by isApplicable.
//
// Side-path docs (when each step is applicable):
//   - /spouse           - only when filing.status is mfj or mfs
//   - /deps-detail      - only when dependents.count > 0
//   - /self-employment  - only when income.types includes 'self'
//   - /rental-detail    - only when income.types includes 'rental'
//   - /business-info    - only when service.kind is 'biz'
//   - /business-formation - only when service.otherSub is 'formation'
//   - /strategic-topics - only when service.otherSub is 'strategy' (advisory path)
//
// The "happy path" for an individual W-2 filer skips all six side paths
// and walks: welcome → quick-start → tutorial → services → services-addons
// → personal → state → filing → deps → income → tax-questions →
// deductions → life-events → refund → docs → engagement → consent →
// appt → deposit → done.
//
// /quick-start is the 3-stage onboarding (name → DOB → email) right
// after welcome. The standalone /contact-info page is no longer in the
// canonical flow - quick-start already collects everything it would
// have asked for, and the redundant second prompt was confusing. The
// /contact-info route file stays for direct-link fallback only.
// ────────────────────────────────────────────────────────────────

export const INTAKE_FLOW: readonly IntakeStep[] = [
  // ─── Welcome / orientation ─────────────────────────────────────
  {
    id: 'welcome',
    route: '/welcome',
    label: 'Welcome',
    section: 'welcome',
    isApplicable: () => true,
    isComplete: () => true, // pure intro - always passable
    next: () => '/quick-start',
  },
  {
    id: 'quick-start',
    route: '/quick-start',
    label: 'Quick start',
    section: 'welcome',
    isApplicable: () => true,
    // 3 stages: name → DOB → email. Phone is from Clerk OTP login.
    isComplete: (s) =>
      !!s.personal?.fullName && !!s.personal?.dateOfBirth && !!s.personal?.email,
    next: () => '/tutorial',
  },
  {
    id: 'tutorial',
    route: '/tutorial',
    label: 'How it works',
    section: 'welcome',
    isApplicable: () => true,
    isComplete: (s) => !!s.tutorial?.completed,
    next: () => '/services',
  },
  {
    id: 'services',
    route: '/services',
    label: 'Service',
    section: 'welcome',
    isApplicable: () => true,
    // Service kind is required. If they pick 'other', the otherSub
    // sub-selection is required too (the /services page surfaces a
    // second tier of choices in that case).
    isComplete: (s) => {
      if (!s.service?.kind) return false;
      if (s.service.kind === 'other' && !s.service.otherSub) return false;
      return true;
    },
    next: () => '/services-addons',
  },
  {
    id: 'services-addons',
    route: '/services-addons',
    label: 'Add-ons',
    section: 'welcome',
    isApplicable: () => true,
    isComplete: () => true, // optional by design - addons can be empty
    next: () => '/personal',
  },

  // ─── About you ────────────────────────────────────────────────
  {
    id: 'personal',
    route: '/personal',
    label: 'About you',
    section: 'about-you',
    isApplicable: () => true,
    isComplete: (s) =>
      !!s.personal?.fullName &&
      !!s.personal?.dateOfBirth &&
      !!s.personal?.ssn,
    next: () => '/state',
  },
  {
    id: 'state',
    route: '/state',
    label: 'State',
    section: 'about-you',
    isApplicable: () => true,
    isComplete: (s) => !!s.state?.primaryState,
    next: () => '/filing',
  },
  {
    id: 'filing',
    route: '/filing',
    label: 'Filing status',
    section: 'about-you',
    isApplicable: () => true,
    isComplete: (s) => !!s.filing?.status,
    next: (s) => {
      const fs = s.filing?.status;
      return fs === 'mfj' || fs === 'mfs' ? '/spouse' : '/deps';
    },
  },
  {
    id: 'spouse',
    route: '/spouse',
    label: 'Spouse',
    section: 'about-you',
    isApplicable: (s) => s.filing?.status === 'mfj' || s.filing?.status === 'mfs',
    isComplete: (s) =>
      !!s.spouse?.fullName &&
      !!s.spouse?.dateOfBirth &&
      !!s.spouse?.ssn,
    next: () => '/deps',
  },
  {
    id: 'deps',
    route: '/deps',
    label: 'Dependents',
    section: 'about-you',
    isApplicable: () => true,
    isComplete: (s) => s.dependents?.count !== undefined,
    next: (s) => ((s.dependents?.count ?? 0) === 0 ? '/income' : '/deps-detail'),
  },
  {
    id: 'deps-detail',
    route: '/deps-detail',
    label: 'Dependent details',
    section: 'about-you',
    isApplicable: (s) => (s.dependents?.count ?? 0) > 0,
    isComplete: (s) => {
      const count = s.dependents?.count ?? 0;
      const list = s.dependents?.list ?? [];
      return (
        count > 0 &&
        list.length === count &&
        list.every((d) => !!d.fullName && !!d.ssn)
      );
    },
    next: () => '/income',
  },

  // ─── Income ───────────────────────────────────────────────────
  // Skipped for entity-only filings (1120/1120-S/1065) — every option on
  // the /income multi-select is 1040-specific (W-2, 1099, Schedule E,
  // brokerage, retirement). Antonio's bug 2026-05-09: corp clients were
  // being asked about W-2 income, which doesn't apply to the entity's
  // return. See isEntityOnlyFiling for the precise gate.
  //
  // /self-employment and /rental-detail are also gated on !isEntityOnlyFiling
  // so stale `income.types` from before a service-path switch can't leak a
  // biz user into a 1040 sub-flow.
  //
  // V0 known limitation: stale `answers.income`/`selfEmployment`/`rental`
  // from a prior personal-path session persists in the JSONB even after
  // /income is skipped, so requiredDocsFor() (and the command-room intake
  // summary) may still surface W-2 / 1099 doc requests. The mitigation is
  // a service-path-change scrubber (see follow-up task spawned 2026-05-09).
  {
    id: 'income',
    route: '/income',
    label: 'Income',
    section: 'income',
    isApplicable: (s) => !isEntityOnlyFiling(s),
    isComplete: (s) => (s.income?.types?.length ?? 0) > 0,
    next: (s) => {
      // Short-circuit for entity-only: even if types is somehow set (stale
      // value, returning client switching paths), don't route into 1040
      // sub-flows. The defense-in-depth loop in getNextStep evaluates this
      // when /income is skipped.
      if (isEntityOnlyFiling(s)) return '/tax-questions';
      const types = s.income?.types ?? [];
      if (types.includes('self')) return '/self-employment';
      if (types.includes('rental')) return '/rental-detail';
      return '/tax-questions';
    },
  },
  {
    id: 'self-employment',
    route: '/self-employment',
    label: 'Self-employment',
    section: 'income',
    isApplicable: (s) => !isEntityOnlyFiling(s) && (s.income?.types?.includes('self') ?? false),
    isComplete: (s) =>
      !!s.selfEmployment?.businessName && !!s.selfEmployment?.whatYouDo,
    next: (s) => {
      const types = s.income?.types ?? [];
      if (types.includes('rental')) return '/rental-detail';
      return '/tax-questions';
    },
  },
  {
    id: 'rental-detail',
    route: '/rental-detail',
    label: 'Rental property',
    section: 'income',
    isApplicable: (s) => !isEntityOnlyFiling(s) && (s.income?.types?.includes('rental') ?? false),
    isComplete: (s) => (s.rental?.properties?.length ?? 0) > 0,
    next: () => '/tax-questions',
  },

  // ─── Business sub-flow (only when service path is biz/formation) ─
  // Note: these branches don't currently sit on the main forward chain.
  // /services routes to /services-addons regardless. Whether /business-info
  // becomes part of the forward path is a product question Antonio + David
  // need to settle. For now we mark them applicable when relevant so they
  // exist in the graph and getResumeStep can find them, but they're not
  // wired into the linear forward chain yet.
  {
    id: 'business-info',
    route: '/business-info',
    label: 'Business',
    section: 'income',
    isApplicable: (s) => s.service?.kind === 'biz',
    isComplete: (s) => !!s.business?.legalName && !!s.business?.entityType,
    next: () => '/income',
  },
  {
    id: 'business-formation',
    route: '/business-formation',
    label: 'Business formation',
    section: 'income',
    isApplicable: (s) => s.service?.otherSub === 'formation',
    isComplete: (s) => !!s.business?.entityType && !!s.business?.formationState,
    next: () => '/engagement',
  },

  // ─── Tax questions / deductions / events ──────────────────────
  {
    id: 'tax-questions',
    route: '/tax-questions',
    label: 'Tax questions',
    section: 'deductions',
    isApplicable: () => true,
    isComplete: (s) => s.taxQuestions !== undefined,
    next: () => '/deductions',
  },
  {
    id: 'deductions',
    route: '/deductions',
    label: 'Deductions',
    section: 'deductions',
    isApplicable: () => true,
    // Any toggle (or "none") counts as the user having answered.
    isComplete: (s) => {
      const d = s.deductions ?? {};
      return !!(
        d.none ||
        d.mortgage ||
        d.student ||
        d.charity ||
        d.childcare ||
        d.medical ||
        d.education ||
        d.educator
      );
    },
    next: () => '/life-events',
  },
  {
    id: 'life-events',
    route: '/life-events',
    label: 'Life events',
    section: 'deductions',
    isApplicable: () => true,
    isComplete: () => true, // events list can be empty
    next: () => '/refund',
  },
  {
    id: 'strategic-topics',
    route: '/strategic-topics',
    label: 'Tax strategy',
    section: 'deductions',
    isApplicable: (s) => s.service?.otherSub === 'strategy',
    isComplete: (s) => (s.strategicTopics?.selected?.length ?? 0) > 0,
    next: () => '/engagement',
  },

  // ─── Wrap-up ──────────────────────────────────────────────────
  {
    id: 'refund',
    route: '/refund',
    label: 'Refund preference',
    section: 'wrap-up',
    isApplicable: () => true,
    isComplete: (s) => !!s.refund?.preference,
    next: () => '/docs',
  },
  {
    id: 'docs',
    route: '/docs',
    label: 'Documents',
    section: 'wrap-up',
    isApplicable: () => true,
    isComplete: (s) => !!s.documents?.uploadComplete,
    // Contact info already captured at the top of the flow - proceed
    // directly to the legal sign-offs.
    next: () => '/engagement',
  },

  // ─── Sign ─────────────────────────────────────────────────────
  {
    id: 'engagement',
    route: '/engagement',
    label: 'Engagement letter',
    section: 'sign',
    isApplicable: () => true,
    isComplete: (s) => !!s.engagement?.signed,
    next: () => '/consent',
  },
  {
    id: 'consent',
    route: '/consent',
    label: '§7216 consent',
    section: 'sign',
    isApplicable: () => true,
    isComplete: (s) => !!s.consent?.signed,
    next: () => '/appt',
  },

  // ─── Appt + deposit ───────────────────────────────────────────
  {
    id: 'appt',
    route: '/appt',
    label: 'Schedule call',
    section: 'wrap-up',
    isApplicable: () => true,
    isComplete: () => true, // optional - client may skip scheduling
    next: () => '/deposit',
  },
  {
    id: 'deposit',
    route: '/deposit',
    label: 'Deposit',
    section: 'wrap-up',
    isApplicable: () => true,
    isComplete: (s) => !!s.deposit?.paid,
    next: () => '/done',
  },
  {
    id: 'done',
    route: '/done',
    label: 'Done',
    section: 'wrap-up',
    isApplicable: () => true,
    isComplete: () => true,
    next: () => null,
  },
];

// ────────────────────────────────────────────────────────────────
// Lookup tables (computed once at module load)
// ────────────────────────────────────────────────────────────────

const STEP_BY_ROUTE = new Map<string, IntakeStep>(
  INTAKE_FLOW.map((s) => [s.route, s]),
);
const STEP_BY_ID = new Map<string, IntakeStep>(INTAKE_FLOW.map((s) => [s.id, s]));

// ────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────

/** Look up a step by its route or its id. */
export function getStep(routeOrId: string): IntakeStep | undefined {
  return STEP_BY_ROUTE.get(routeOrId) ?? STEP_BY_ID.get(routeOrId);
}

/** All steps that are applicable given the current state. */
export function getApplicableSteps(state: IntakeState): IntakeStep[] {
  return INTAKE_FLOW.filter((s) => s.isApplicable(state));
}

/**
 * Forward navigation. Walks `next()` and skips any step that is currently
 * not applicable, in case state changed since the previous step computed
 * its target.
 */
export function getNextStep(currentRoute: string, state: IntakeState): string | null {
  const step = getStep(currentRoute);
  if (!step) return null;
  let target = step.next(state);
  // Defense-in-depth: skip non-applicable targets in case current state
  // disagrees with the upstream step's prediction.
  while (target) {
    const targetStep = getStep(target);
    if (!targetStep) return target;             // unknown route - let it route anyway
    if (targetStep.isApplicable(state)) return target;
    target = targetStep.next(state);
  }
  return target;
}

/**
 * Back navigation. Walks the canonical INTAKE_FLOW order (filtered by
 * applicable) backwards from the current route. This solves the bug where
 * pages hardcode a back target - e.g. `/income` hardcoding `nav.back('/deps-detail')`
 * even when the user came from `/deps` (because they had 0 dependents).
 */
export function getPrevStep(currentRoute: string, state: IntakeState): string | null {
  const applicable = getApplicableSteps(state);
  const idx = applicable.findIndex((s) => s.route === currentRoute);
  if (idx <= 0) return null;
  return applicable[idx - 1]!.route;
}

/**
 * First applicable step that isn't yet complete. Used by the welcome page
 * server component to render a "Continue where you left off → /personal"
 * button when the client has intake-in-progress.
 */
export function getResumeStep(state: IntakeState): string {
  const next = INTAKE_FLOW.find((s) => s.isApplicable(state) && !s.isComplete(state));
  return next?.route ?? '/done';
}

/**
 * Progress index for the IntakeHeader / progress bar - "Step 4 of 12".
 * Counts only applicable steps so the denominator matches what the client
 * actually walks through.
 */
export function getStepProgress(
  currentRoute: string,
  state: IntakeState,
): { current: number; total: number } {
  const applicable = getApplicableSteps(state);
  const idx = applicable.findIndex((s) => s.route === currentRoute);
  return { current: idx + 1, total: applicable.length };
}

/**
 * Whether the entire intake is complete - every applicable step's
 * isComplete() returns true. Used by command room to show
 * "intake done" status on a client.
 */
export function isIntakeComplete(state: IntakeState): boolean {
  return getApplicableSteps(state).every((s) => s.isComplete(state));
}

// ────────────────────────────────────────────────────────────────
// Continue-button gating
// ────────────────────────────────────────────────────────────────

/**
 * Steps where the Continue button is ALWAYS clickable, regardless of
 * the step's `isComplete()` value. The user shouldn't be locked into
 * uploading documents to keep going (they can skip and come back), and
 * "Welcome" / "Tutorial" / "Add-ons" / "Life events" already mark
 * themselves complete unconditionally.
 *
 * /docs is the special one: its `isComplete` checks
 * `documents.uploadComplete`, which is meaningful for `isIntakeComplete`
 * (full-flow finish detection), but for forward nav we want to let the
 * client move past even if they haven't uploaded yet.
 */
const STEPS_WITHOUT_GATE = new Set<string>([
  'docs',
]);

/**
 * Can the client advance from the current step? Used by intake pages
 * to drive `<Button disabled={!canAdvance}>` so the Continue button is
 * visibly + functionally locked until required fields are filled.
 *
 * Returns true when:
 *   - The step is in the "no gate" list (docs, etc.)
 *   - OR the step's `isComplete(state)` returns true
 *
 * Returns false when the step has required fields and they aren't
 * all filled. Pages whose `isComplete` is `() => true` (welcome,
 * tutorial, services-addons, life-events, appt, done) naturally
 * always pass — no special handling needed.
 */
export function canAdvanceFromStep(currentRoute: string, state: IntakeState): boolean {
  const step = getStep(currentRoute);
  if (!step) return true; // unknown route — let the page handle its own gating
  if (STEPS_WITHOUT_GATE.has(step.id)) return true;
  return step.isComplete(state);
}

/**
 * Has the client touched ANYTHING in the intake?
 *
 * Different from isIntakeComplete (full completion) and from getResumeStep
 * (next incomplete step). This answers "have they made any progress at
 * all" - used by the welcome page to flip between first-time and returning
 * UX without depending on which specific step gates "completion."
 *
 * Returns true if any meaningful field is populated. Empty arrays / false
 * booleans / undefined are treated as no progress.
 */
export function hasIntakeProgress(state: IntakeState): boolean {
  return !!(
    state.tutorial?.completed ||
    state.service?.kind ||
    state.personal?.fullName ||
    state.personal?.ssn ||
    state.personal?.dateOfBirth ||
    state.personal?.email ||
    state.personal?.street ||
    state.state?.primaryState ||
    state.filing?.status ||
    (state.dependents?.count !== undefined && state.dependents.count > 0) ||
    (state.dependents?.list?.length ?? 0) > 0 ||
    (state.income?.types?.length ?? 0) > 0 ||
    state.selfEmployment?.businessName ||
    (state.rental?.properties?.length ?? 0) > 0 ||
    state.business?.legalName ||
    state.deductions?.mortgage ||
    state.deductions?.charity ||
    state.deductions?.childcare ||
    state.deductions?.medical ||
    state.deductions?.none ||
    state.refund?.preference ||
    state.documents?.uploadComplete ||
    state.engagement?.signed ||
    state.consent?.signed ||
    state.contactInfo?.preferredMethod ||
    state.appointment?.format !== undefined ||
    state.deposit?.paid
  );
}
