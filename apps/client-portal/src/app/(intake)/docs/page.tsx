// Intake docs page — server shell.
//
// Fetches: intake answers (for required-docs derivation) + existing
// uploaded docs (for hydration). Hands off to the client component
// which orchestrates upload + polling + verification.
//
// Per CLAUDE.md §18 STEPS_WITHOUT_GATE = ['docs'], the Continue
// button is always enabled — clients can come back later to upload
// more.

import { redirect } from 'next/navigation';
import { resolveClient } from '@/lib/intake/auth';
import { getOrCreateIntakeAnswers } from '@/lib/intake/read';
import { listDocuments } from '@/lib/docs/list';
import { requiredDocsFor } from '@docket/shared';
import { DocsPageClient } from './docs-page-client';

export default async function DocsPage() {
  const auth = await resolveClient();
  if (auth.kind === 'no_session') redirect('/login');
  if (auth.kind === 'no_invite') redirect('/no-access');

  const bundle = await getOrCreateIntakeAnswers();
  const docList = await listDocuments();

  const expected = bundle ? requiredDocsFor(bundle.answers) : [];
  const initialDocs = docList.ok ? docList.documents : [];

  return (
    <DocsPageClient
      expected={expected}
      initialDocuments={initialDocs}
    />
  );
}
