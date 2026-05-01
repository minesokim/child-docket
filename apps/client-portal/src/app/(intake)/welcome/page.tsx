// Welcome — first auth'd page after sign-in.
// Server Component: ensures a `clients` row exists for the current Clerk
// session (creates one on first sign-in tied to Antonio's tenant), then
// renders the welcome UI.

import { redirect } from 'next/navigation';
import { getOrCreateCurrentClient } from '@/lib/current-client';
import { WelcomeContent } from './content';

export default async function WelcomePage() {
  const client = await getOrCreateCurrentClient();
  if (!client) {
    // No active session OR tenant not seeded. Bounce to login.
    redirect('/login');
  }
  return <WelcomeContent />;
}
