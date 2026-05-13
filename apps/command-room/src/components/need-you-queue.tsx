// NeedYouQueue — 4-lane workflow primitive on the command-room home.
//
// Per CLAUDE.md §4 Command Room:
//   "Need You queue — the operational primitive that replaces
//    'generic dashboard.' Four workflow sub-sections, each its own
//    swim-lane with its own metric: New Intakes / Ready to Prep /
//    Ready to File / Sign & File. Sub-sections are the *structural
//    primitive*; Pipeline is the *visualization* of how clients
//    flow between them."
//
// VOICE
//   - Operational-modern (Inter / oklch / soft 1px borders).
//   - Lane header = lane name + total count; rows = client name +
//     cue (which state they're in) + relative-time entered-lane-at.
//   - Empty lane reads as "nothing to do here right now," not as
//     a blocker. Negative space is the signal.
//   - 5 rows max per lane; "View all" link drills to /clients.
//
// EDGE CASES
//   - Lane with 0 clients → empty-state copy
//   - Lane with >5 clients → 5 rows + "View all" link surfaces total
//   - Mobile narrow viewport → lanes stack vertically (handled via
//     grid-auto-flow + minmax in container)

import Link from 'next/link';
import type { NeedYouLanes, NeedYouLaneClient } from '@/lib/home-queries';

type LaneKey = 'new_intakes' | 'ready_to_prep' | 'ready_to_file' | 'sign_and_file';

const LANE_META: Record<
  LaneKey,
  { label: string; description: string; href: string }
> = {
  new_intakes: {
    label: 'New Intakes',
    description: 'completed intake, not yet routed',
    href: '/clients?lane=new_intakes',
  },
  ready_to_prep: {
    label: 'Ready to Prep',
    description: 'docs gathered, workpapers awaiting',
    href: '/clients?lane=ready_to_prep',
  },
  ready_to_file: {
    label: 'Ready to File',
    description: 'drafted, awaiting EA review + 8879',
    href: '/clients?lane=ready_to_file',
  },
  sign_and_file: {
    label: 'Sign & File',
    description: '8879 signed, awaiting e-file',
    href: '/clients?lane=sign_and_file',
  },
};

const LANE_ORDER: LaneKey[] = [
  'new_intakes',
  'ready_to_prep',
  'ready_to_file',
  'sign_and_file',
];

type Props = {
  data: NeedYouLanes;
};

export function NeedYouQueue({ data }: Props) {
  return (
    <section
      aria-label="Need You workflow queue"
      style={{
        marginBottom: 32,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <h2
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: 'oklch(20% 0.01 85)',
            margin: 0,
            letterSpacing: -0.2,
          }}
        >
          Need You
        </h2>
        <span
          style={{
            fontSize: 11,
            color: 'oklch(50% 0.01 85)',
            letterSpacing: 0.3,
            textTransform: 'uppercase',
          }}
        >
          what to act on next
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
        }}
      >
        {LANE_ORDER.map((key) => (
          <Lane
            key={key}
            label={LANE_META[key].label}
            description={LANE_META[key].description}
            href={LANE_META[key].href}
            count={data.counts[key]}
            clients={data[key]}
          />
        ))}
      </div>
    </section>
  );
}

function Lane({
  label,
  description,
  href,
  count,
  clients,
}: {
  label: string;
  description: string;
  href: string;
  count: number;
  clients: NeedYouLaneClient[];
}) {
  return (
    <article
      style={{
        background: 'oklch(99% 0.005 85)',
        border: '1px solid oklch(92% 0.008 85)',
        borderRadius: 12,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 180,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}
      >
        <h3
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'oklch(20% 0.01 85)',
            margin: 0,
            letterSpacing: 0.1,
          }}
        >
          {label}
        </h3>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: count > 0 ? 'oklch(42% 0.09 150)' : 'oklch(60% 0.01 85)',
          }}
        >
          {count}
        </span>
      </header>
      <div
        style={{
          fontSize: 11,
          color: 'oklch(50% 0.01 85)',
          marginBottom: 12,
          letterSpacing: 0.1,
        }}
      >
        {description}
      </div>

      {clients.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            color: 'oklch(60% 0.01 85)',
            fontStyle: 'italic',
          }}
        >
          nothing here
        </div>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            flex: 1,
          }}
        >
          {clients.map((c) => (
            <li key={c.engagement_id}>
              <Link
                href={`/clients/${c.client_id}`}
                style={{
                  display: 'block',
                  padding: '8px 10px',
                  textDecoration: 'none',
                  background: 'oklch(98% 0.005 85)',
                  border: '1px solid oklch(94% 0.008 85)',
                  borderRadius: 8,
                  transition: 'background 120ms ease',
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'oklch(22% 0.01 85)',
                    lineHeight: 1.4,
                  }}
                >
                  {c.client_name}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: 'oklch(50% 0.01 85)',
                    marginTop: 2,
                    letterSpacing: 0.1,
                  }}
                >
                  {c.engagement_type.replace(/_/g, ' ')}
                  {c.cue && <> · {c.cue}</>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {count > clients.length && (
        <Link
          href={href}
          style={{
            marginTop: 8,
            fontSize: 11,
            color: 'oklch(42% 0.09 150)',
            textDecoration: 'none',
            textAlign: 'right',
          }}
        >
          View all {count} →
        </Link>
      )}
    </article>
  );
}
