'use client';

// Next.js loading boundary for the per-client detail page.
//
// Renders while the page.tsx server component is fetching client +
// engagement + issues + messages + intake + documents + signatures
// — usually 200-800ms on a warm Neon connection.
//
// WAVE variant reads top-to-bottom in DOM order, matching how the
// eye scans the multi-section page (header → intake → docs →
// signatures → engagement → messages, with open issues in the right
// rail). The staggered ripple feels like the content is filling in
// from the top.
//
// The shell (CommandShell as of the operational-modern migration) is
// intentionally omitted here: it lives inside page.tsx (not a shared
// layout), so during the loading window the previous page's shell
// remains painted. Hoisting the shell to a layout is the proper fix;
// this file just provides a useful skeleton in the meantime.
//
// 'use client' marker — needed because React Server Components can't
// safely consume client-bundled named exports from packages with
// 'use client' at the file level. Marking this module as client makes
// imports from @docket/ui resolve to the actual functions instead of
// opaque client references that break property access.

import {
  buildTheme,
  Skeleton,
  SkeletonCircle,
  SkeletonGroup,
  SkeletonHeading,
  SkeletonLine,
  SkeletonSmall,
} from '@docket/ui';

export default function ClientDetailLoading() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  return (
    <div style={{ padding: '32px 36px 60px', maxWidth: 1200 }}>
      {/* Breadcrumb placeholder */}
      <div style={{ marginBottom: 16 }}>
        <SkeletonGroup variant="wave" label="Loading client">
          <SkeletonSmall width={80} index={0} />
        </SkeletonGroup>
      </div>

      {/* Header — avatar circle + name + meta line */}
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 16,
          marginBottom: 28,
        }}
      >
        <SkeletonGroup variant="wave" label="Loading">
          <SkeletonCircle size={56} index={0} />
        </SkeletonGroup>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SkeletonGroup variant="wave" label="Loading">
            <Skeleton width="42%" height={28} index={1} />
            <SkeletonSmall width="56%" index={2} />
          </SkeletonGroup>
        </div>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.6fr 1fr',
          gap: 28,
          alignItems: 'flex-start',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <SectionCardSkeleton t={t} sectionLabel="Intake" rows={6} />
          <SectionCardSkeleton t={t} sectionLabel="Documents" rows={4} />
          <SectionCardSkeleton t={t} sectionLabel="Signatures" rows={3} />
          <SectionCardSkeleton t={t} sectionLabel="Engagement" rows={4} />
          <SectionCardSkeleton t={t} sectionLabel="Messages" rows={5} />
        </div>

        <div>
          <SectionCardSkeleton t={t} sectionLabel="Open issues" rows={4} />
        </div>
      </div>
    </div>
  );
}

function SectionCardSkeleton({
  t,
  sectionLabel,
  rows,
}: {
  t: ReturnType<typeof buildTheme>;
  sectionLabel: string;
  rows: number;
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: t.mono,
          fontSize: 10.5,
          color: t.muted,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          marginBottom: 10,
        }}
      >
        {sectionLabel}
      </div>
      <SkeletonGroup
        variant="wave"
        label={`Loading ${sectionLabel.toLowerCase()}`}
        style={{
          background: t.card,
          border: `1px solid ${t.border}`,
          borderRadius: 14,
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <SkeletonHeading width="50%" index={0} />
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonLine
            key={i}
            width={`${94 - (i % 4) * 9}%`}
            index={i + 1}
          />
        ))}
      </SkeletonGroup>
    </div>
  );
}
