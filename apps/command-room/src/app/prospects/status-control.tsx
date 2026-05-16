'use client';

// Status-update dropdown for the prospects admin table.
//
// One <select> per row. Calling the server action updateProspect
// Status triggers a revalidatePath('/prospects') so the table
// re-renders with the new status badge + updated metric strip.
//
// Optimistic UX would be nicer (no flash on the dropdown) but
// adds complexity (rollback on failure, intermediate state). v0
// uses the simpler form-submit-on-change pattern; David's volume
// is low enough that the half-second re-render is fine.

import { useTransition } from 'react';
import { updateProspectStatus } from './actions';

const OPTIONS = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'scan_sent', label: 'Scan sent' },
  { value: 'converted', label: 'Converted' },
  { value: 'rejected', label: 'Rejected' },
] as const;

type Status = (typeof OPTIONS)[number]['value'];

export function ProspectStatusControl({
  prospectId,
  currentStatus,
}: {
  prospectId: string;
  currentStatus: string;
}) {
  const [pending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as Status;
    if (next === currentStatus) return;
    startTransition(async () => {
      const result = await updateProspectStatus(prospectId, next);
      if (!result.ok) {
        // Surface the failure to the user. window.alert is the v0
        // simplest path; a toast/banner is V1.5 work.
        // eslint-disable-next-line no-alert
        window.alert(
          `Failed to update prospect status: ${result.error ?? 'unknown error'}`,
        );
      }
    });
  };

  return (
    <select
      value={currentStatus}
      onChange={handleChange}
      disabled={pending}
      style={{
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 12,
        padding: '4px 6px',
        borderRadius: 6,
        border: '1px solid #d4d4d8',
        background: pending ? '#f4f4f5' : '#fff',
        color: '#18181b',
        cursor: pending ? 'wait' : 'pointer',
      }}
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
