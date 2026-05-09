// Final intake step — Form-8879-precursor deposit gate.
//
// Antonio collects an engagement deposit (default $50, configurable
// via Settings → Default deposit amount) before clients access the
// main portal post-intake. Per IRS Pub 1345 + standard EA practice,
// no return work proceeds until the deposit clears.
//
// FLOW
//   1. Server pre-fetches getDepositConfig (engagement + firm_profile)
//      → mode='charge' | 'waived' | 'unconfigured'
//   2. mode=waived: skip the gate, auto-advance
//   3. mode=charge: render DepositForm with Square Web Payments SDK
//   4. mode=unconfigured: tell client to contact preparer; Antonio
//      sees "Configure Square" link in /settings/credentials
//
// PCI POSTURE
//   - Card form lives in Square's iframe (SDK B). PAN never reaches
//     Docket.
//   - Server-side amount re-validation in chargePaymentToken.
//   - Tokenize → charge → setPaid → advance: same pattern as the
//     original Stripe placeholder, just with a real charge layer.

import { getDepositConfig } from '@/lib/square/get-deposit-config';
import { DepositPageInner } from './deposit-page-inner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function DepositPage() {
  const config = await getDepositConfig();

  return <DepositPageInner config={config} />;
}
