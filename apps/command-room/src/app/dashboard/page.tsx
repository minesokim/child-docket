// /dashboard exists only as the post-sign-in redirect target.
// (Configured via NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard.)
// Forwards to / which is the home dashboard.

import { redirect } from 'next/navigation';

export default function DashboardPage() {
  redirect('/');
}
