import { redirect } from 'next/navigation';

// Root URL → dashboard. clerkMiddleware redirects unauthed visitors to /sign-in.
export default function Page() {
  redirect('/dashboard');
}
