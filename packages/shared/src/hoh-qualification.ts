// Head of Household qualification helper.
//
// Antonio's §6694 risk surface: claiming HoH without proper
// qualification is the single highest-volume preparer-penalty trigger
// on solo-EA returns. Form 8867 (the Paid Preparer's Due Diligence
// Checklist) requires the EA to document the basis for HoH on every
// return — $580 per occurrence if missing or inaccurate.
//
// This module captures the four §2(b) + §7703(b) gating questions
// and the derived face-value qualification flag. Antonio sees the
// raw answers + the derived flag in command-room before transmission.
//
// SCOPE
//   Face-value qualification means: based on the client's own
//   answers, the §2(b) test passes. The actual EA-level due-
//   diligence pass (Form 8867 §B) requires Antonio to verify
//   supporting docs (lease, household expense records, school
//   records for the qualifying child, etc.). This helper does NOT
//   substitute for that pass — it's an intake-time screen.

/**
 * Answers to the §2(b) / §7703(b) qualification questions.
 * Each is yes / no / not_sure. The "not_sure" path lets the client
 * advance without forcing a guess; Antonio's review surfaces it as
 * an open question.
 *
 * §2(b)(1)(B) parent exception: a qualifying parent does NOT need
 * to live with the taxpayer if the taxpayer paid more than half the
 * cost of keeping up the parent's separate home. We surface this via
 * a conditional follow-up question — when livedWithYou === 'no', the
 * client is asked whether the qualifying person is a parent. If yes,
 * the cohabitation 'no' is permissible and routes to 'uncertain'
 * (Antonio verifies the parent-home-cost test).
 */
export type HohQualifyAnswers = {
  unmarriedOrConsideredUnmarried?: 'yes' | 'no' | 'not_sure';
  paidMoreThanHalfHomeCost?: 'yes' | 'no' | 'not_sure';
  qualifyingPersonLivedWithYou?: 'yes' | 'no' | 'not_sure';
  // §2(b)(1)(B) parent-exception flag. Only meaningful when
  // livedWithYou === 'no'; ignored otherwise.
  qualifyingPersonIsParent?: 'yes' | 'no' | 'not_sure';
  qualifyingPersonIsChildOrRelative?: 'yes' | 'no' | 'not_sure';
  qualifyingPersonRelationship?: string;
};

/**
 * Face-value qualification verdict.
 *
 * - 'passes_at_face' — all four gating answers are 'yes'. Antonio
 *   still owes Form 8867 due-diligence; we don't bypass that.
 * - 'fails_at_face' — at least one answer is 'no'. Antonio should
 *   downgrade to Single (or MFS, depending on marital status) before
 *   transmission. Surfaces as a red flag in command-room.
 * - 'uncertain' — at least one answer is 'not_sure' and none are
 *   'no'. Surfaces as an amber flag — Antonio asks the client.
 * - 'incomplete' — the client hasn't answered all four. Render as
 *   "answer required" in command-room.
 */
export type HohVerdict = 'passes_at_face' | 'fails_at_face' | 'uncertain' | 'incomplete';

/**
 * Derive the face-value verdict from the gating answers.
 *
 * Pure function — safe to call repeatedly. Idempotent: same answers
 * always produce the same verdict.
 *
 * Logic:
 *   - §2(b)(1)(B) parent exception applied FIRST: when
 *     livedWithYou === 'no' AND isParent === 'yes', treat the
 *     cohabitation answer as 'uncertain' (Antonio verifies the
 *     parent-home-cost test) rather than failing the §2(b) test.
 *   - any remaining 'no' → fails_at_face (one false short-circuits
 *     the §2(b) test)
 *   - any missing answer → incomplete
 *   - any 'not_sure' (no 'no') → uncertain
 *   - all 'yes' → passes_at_face
 *
 * The four ordered gating values include the parent-exception
 * follow-up only when relevant (livedWithYou === 'no'). When the
 * follow-up is irrelevant (livedWithYou ∈ {'yes', 'not_sure'}), we
 * don't require an answer for it — that keeps the incomplete check
 * tight to the actual gating path.
 */
export function deriveHohVerdict(answers: HohQualifyAnswers | undefined): HohVerdict {
  if (!answers) return 'incomplete';

  // §2(b)(1)(B) parent exception: livedWithYou='no' + isParent='yes'
  // routes to 'uncertain' (Antonio verifies the parent-home-cost
  // test). Doesn't apply when isParent is undefined or 'not_sure' —
  // we ask the question only when livedWithYou='no' so a missing
  // isParent answer in that path is itself incomplete.
  let effectiveLivedWith = answers.qualifyingPersonLivedWithYou;
  if (effectiveLivedWith === 'no') {
    if (answers.qualifyingPersonIsParent === 'yes') {
      effectiveLivedWith = 'not_sure';
    } else if (
      answers.qualifyingPersonIsParent === undefined ||
      !answers.qualifyingPersonIsParent
    ) {
      // Follow-up not answered yet — overall verdict is incomplete.
      return 'incomplete';
    }
    // isParent === 'no' or 'not_sure' → the cohabitation 'no' stands
    // as a real failure; fall through.
  }

  const four = [
    answers.unmarriedOrConsideredUnmarried,
    answers.paidMoreThanHalfHomeCost,
    effectiveLivedWith,
    answers.qualifyingPersonIsChildOrRelative,
  ];
  if (four.some((a) => a === 'no')) return 'fails_at_face';
  // Falsy answer (undefined OR empty string from useIntakeField
  // initialization) → incomplete. `!a` collapses both cases cleanly
  // without a type assertion.
  if (four.some((a) => !a)) return 'incomplete';
  if (four.some((a) => a === 'not_sure')) return 'uncertain';
  return 'passes_at_face';
}

/**
 * UI-facing copy for each verdict. Used on the intake page itself
 * (subtle inline hint when verdict !== 'incomplete') and in
 * command-room Antonio review surface.
 */
export const HOH_VERDICT_COPY: Record<HohVerdict, string> = {
  passes_at_face: 'Looks like you qualify for Head of Household.',
  fails_at_face:
    'One of these answers means Head of Household may not apply — Antonio will help confirm.',
  uncertain:
    "If you’re not sure, that’s fine — Antonio will walk through this with you.",
  incomplete: '',
};
