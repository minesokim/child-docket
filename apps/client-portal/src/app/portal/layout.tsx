// /portal route group layout.
//
// Server Component: hydrates the IntakeState from Postgres (same shape +
// same provider as the intake flow), then wraps children in
// <IntakeProvider> so every portal page (home, docs, messages,
// signatures, profile) can read/write via useIntakeField - fully
// migrated off sessionStorage.
//
// The tab-bar logic lives in <PortalFrame> (client component) since it
// needs usePathname + useRouter.

import { redirect } from 'next/navigation';
import { TenantDisplayProvider } from '@docket/ui';
import { resolveClient } from '@/lib/intake/auth';
import { getOrCreateIntakeAnswers } from '@/lib/intake';
import { IntakeProvider } from '@/lib/intake-context';
import { PortalFrame } from './_portal-frame';

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Same phone-binding gate as the (intake) layout — see Day 2
  // post-audit hardening notes there.
  const auth = await resolveClient();
  if (auth.kind === 'no_invite') {
    redirect('/no-access');
  }

  // Same pattern as (intake)/layout.tsx - one DB round trip per page
  // load, memoized per-render via React.cache. Sensitive fields come
  // back masked; portal pages call useFieldReveal for plaintext when
  // the user explicitly wants to see them.
  const bundle = await getOrCreateIntakeAnswers();
  const initialAnswers = bundle?.answers ?? {};

  const tenantName = auth.kind === 'authed' ? auth.client.tenantName : null;
  const firmOwner = auth.kind === 'authed' ? auth.client.firmOwner : null;

  return (
    <TenantDisplayProvider tenantName={tenantName} firmOwner={firmOwner}>
      <IntakeProvider initialAnswers={initialAnswers}>
        <PortalFrame>{children}</PortalFrame>
      </IntakeProvider>
    </TenantDisplayProvider>
  );
}
