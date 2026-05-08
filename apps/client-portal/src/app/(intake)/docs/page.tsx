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
import { DocsOverviewClient } from './docs-page-client';

export default async function DocsPage() {
  // Diagnostic wrap: prod has been intermittently 500ing with the
  // generic "Failed query: select..." in runtime logs and no detail
  // on which step (resolveClient / getOrCreateIntakeAnswers /
  // listDocuments) failed. Try each independently and surface the
  // driver-level error before re-throwing.
  return await runWithDiag(async () => {
    const auth = await resolveClient();
    if (auth.kind === 'no_session') redirect('/login');
    if (auth.kind === 'no_invite') redirect('/no-access');

    const bundle = await getOrCreateIntakeAnswers();
    const docList = await listDocuments();

    const expected = bundle ? requiredDocsFor(bundle.answers) : [];
    const initialDocs = docList.ok ? docList.documents : [];

    return (
      <DocsOverviewClient
        expected={expected}
        initialDocuments={initialDocs}
      />
    );
  });
}

async function runWithDiag<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const e = err as Error & {
      code?: string;
      digest?: string;
      cause?: { message?: string; code?: string };
    };
    // Skip Next.js redirect-throws (control flow, not errors).
    if (!e.digest?.startsWith('NEXT_REDIRECT')) {
      console.error(
        '[/docs] page render failed',
        JSON.stringify({
          message: e.message,
          code: e.code ?? null,
          digest: e.digest ?? null,
          causeMessage: e.cause?.message ?? null,
          causeCode: e.cause?.code ?? null,
          stack: e.stack?.split('\n').slice(0, 10).join('\n'),
        }),
      );
    }
    throw err;
  }
}
