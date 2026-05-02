// (intake) route group layout.
//
// Server Component: loads (or creates on first visit) the active intake
// row for the signed-in client, then wraps children in <IntakeProvider>
// so every intake page can read/write IntakeState via useIntakeField.
//
// Inner client logic (route-transition direction, AskAntonioChat overlay)
// lives in <IntakeFrame> so this file can stay a Server Component.

import { getOrCreateIntakeAnswers } from '@/lib/intake';
import { IntakeProvider } from '@/lib/intake-context';
import { IntakeFrame } from './_intake-frame';

export default async function IntakeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Hydrate the intake state from Postgres on every (intake) page load.
  // This is one round-trip per navigation, but it's a single-row primary-key
  // lookup (~5-10ms) and gives us a server-validated source of truth.
  const bundle = await getOrCreateIntakeAnswers();

  // Defensive: if Vazant tenant isn't seeded or auth is missing, render
  // with empty answers — pages still work via their default values, and
  // the user gets bounced to /login by the route handlers downstream.
  const initialAnswers = bundle?.answers ?? {};

  return (
    <IntakeProvider initialAnswers={initialAnswers}>
      <IntakeFrame>{children}</IntakeFrame>
    </IntakeProvider>
  );
}
