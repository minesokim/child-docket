// Free upload page — for documents the client wants to send but
// don't match the expected checklist (an IRS notice, an unusual
// 1099, a receipt). Per Q1b, these don't surface on the overview
// after upload — they flow to Antonio in command-room, and the
// client gets a quiet "Sent" confirmation.

import { redirect } from 'next/navigation';
import { resolveClient } from '@/lib/intake/auth';
import { DocAddClient } from './doc-add-client';

export default async function DocAddPage() {
  const auth = await resolveClient();
  if (auth.kind === 'no_session') redirect('/login');
  if (auth.kind === 'no_invite') redirect('/no-access');

  return <DocAddClient />;
}
