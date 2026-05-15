// Community property state detection + Form 8958 allocation surface.
//
// Antonio's #3 ask from 5/14: when a client files Married Filing
// Separately (MFS) in a community property state, the IRS requires
// Form 8958 to allocate community income between the spouses.
// Antonio's California book has a recurring miss here — clients
// don't know about §66 / Pub 555, file MFS without the allocation,
// and Antonio catches it during review or worse, post-filing.
//
// SCOPE OF THIS MODULE
//   This is the intake-side detection + flagging layer. The actual
//   Form 8958 line-item allocation (wages / interest / dividends /
//   self-employment / etc.) happens in command-room when Antonio
//   walks the client through it on the prep call. The intake just
//   ensures (a) we detect the case, (b) we surface the requirement
//   to the client in plain English, and (c) we capture the few
//   structured signals Antonio needs to start the allocation.
//
// THE NINE COMMUNITY PROPERTY STATES (per IRS Pub 555)
//   Arizona, California, Idaho, Louisiana, Nevada, New Mexico,
//   Texas, Washington, Wisconsin.
//
//   Note: Alaska is an OPT-IN community property state (couples can
//   elect community property treatment by agreement). Pub 555 treats
//   it specially; we DON'T trigger the v0 flow for Alaska because the
//   election is rare and the form structure differs. If Antonio's
//   book accumulates an Alaska case, we add the election toggle.

/**
 * The nine mandatory community property states (per IRS Pub 555).
 * Alaska is excluded — its community property regime is opt-in and
 * driven by spousal agreement, not state law default.
 */
export const COMMUNITY_PROPERTY_STATES = [
  'AZ', // Arizona
  'CA', // California
  'ID', // Idaho
  'LA', // Louisiana
  'NV', // Nevada
  'NM', // New Mexico
  'TX', // Texas
  'WA', // Washington
  'WI', // Wisconsin
] as const;

export type CommunityPropertyState = (typeof COMMUNITY_PROPERTY_STATES)[number];

const COMMUNITY_SET = new Set<string>(COMMUNITY_PROPERTY_STATES);

/**
 * True when the 2-letter state code is one of the nine mandatory
 * community property states. Case-sensitive on a normalized 2-letter
 * code — callers should pass uppercase. Returns false for full state
 * names (the caller has access to compactStateName via format.ts if
 * needed).
 */
export function isCommunityPropertyState(stateCode: string): boolean {
  if (!stateCode) return false;
  const code = stateCode.trim().toUpperCase();
  return COMMUNITY_SET.has(code);
}

/**
 * True when the (filingStatus, primaryState) pair triggers the
 * Form 8958 requirement under §66 / Pub 555. Captures the rule
 * exactly: MFS in a community property state.
 *
 * MFJ in a community property state does NOT trigger the form
 * (allocation is moot on a joint return).
 *
 * Single / HoH / QW are by definition not married, so the rule
 * doesn't apply regardless of state.
 */
export function requiresForm8958(
  filingStatus: string | undefined,
  primaryState: string | undefined,
): boolean {
  if (filingStatus !== 'mfs') return false;
  return isCommunityPropertyState(primaryState ?? '');
}

/**
 * Whether the spouses keep finances separately enough that Antonio
 * may be able to argue §66(c) "spousal allocation relief" — relief
 * from joint and several liability for community-income
 * misallocation when (a) the spouses lived apart all year, (b) the
 * income wasn't transferred, and (c) the requesting spouse didn't
 * know about it.
 *
 * Captured as a separate enum so Antonio can surface the §66(c)
 * conversation in command-room when applicable. This is NOT a
 * client-facing legal determination — it's an intake-time signal.
 */
export type CommunityFinanceShape =
  | 'fully_separate'    // separate accounts, separate income, no joint
  | 'mostly_separate'   // separate primary accounts, occasional shared
  | 'mostly_joint'      // joint accounts, shared income, separate filing
  | 'fully_joint';      // everything joint, MFS by election only
