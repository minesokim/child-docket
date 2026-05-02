// (intake) route group layout.
//
// Server Component: loads (or creates on first visit) the active intake
// row for the signed-in client, then wraps children in <IntakeProvider>
// so every intake page can read/write IntakeState via useIntakeField.
//
// Inner client logic (route-transition direction, AskAntonioChat overlay)
// lives in <IntakeFrame> so this file can stay a Server Component.

import { redirect } from 'next/navigation';
import { TenantDisplayProvider } from '@docket/ui';
import { resolveClient } from '@/lib/intake/auth';
import { getOrCreateIntakeAnswers } from '@/lib/intake';
import { IntakeProvider } from '@/lib/intake-context';
import { IntakeFrame } from './_intake-frame';

export default async function IntakeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Phone-binding gate (Day 2 post-audit hardening). If the
  // Clerk-authenticated phone doesn't match any pre-seeded client row,
  // we bounce to /no-access. The middleware already covers signed-out
  // users; this layer covers signed-in-but-unprovisioned.
  const auth = await resolveClient();
  if (auth.kind === 'no_invite') {
    redirect('/no-access');
  }

  // Hydrate the intake state from Postgres on every (intake) page load.
  // Single-row primary-key lookup (~5-10ms), server-validated source
  // of truth. Internally this re-resolves the client; we accept the
  // duplicate auth read as the cost of the cleanest layout shape.
  const bundle = await getOrCreateIntakeAnswers();

  // 'no_session' (signed-out) falls through here — middleware will
  // already have redirected to /login. The empty-answers default keeps
  // the render from crashing if we somehow reach this point.
  const initialAnswers = bundle?.answers ?? {};

  // Tenant display data — surfaces the firm owner's name + avatar
  // through AskAntonioBar / AskAntonioChat / AntonioNote / AvatarSlot
  // via context, replacing the hardcoded "Antonio Vazquez" defaults.
  // null when no auth (signed-out fallthrough); UI components have
  // their own fallback to legacy Antonio defaults.
  const tenantName = auth.kind === 'authed' ? auth.client.tenantName : null;
  const firmOwner = auth.kind === 'authed' ? auth.client.firmOwner : null;

  return (
    <TenantDisplayProvider tenantName={tenantName} firmOwner={firmOwner}>
      <IntakeProvider initialAnswers={initialAnswers}>
        <IntakeFrame>{children}</IntakeFrame>
      </IntakeProvider>
    </TenantDisplayProvider>
  );
}
