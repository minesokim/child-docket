// /dashboard exists only to redirect post-sign-in to /clients.
// (Configured via NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard.)

import { redirect } from 'next/navigation';

export default function DashboardPage() {
  redirect('/clients');
}
