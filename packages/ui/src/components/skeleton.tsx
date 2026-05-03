'use client';

// Skeleton loaders — three variants (shimmer / pulse / wave).
//
// CSS lives in packages/ui/src/styles.css. The component pattern
// mirrors the design handoff in
// `docs/design_handoff_skeleton_loaders/Skeleton.example.tsx`.
//
// USAGE
//   <SkeletonGroup variant="shimmer" panel label="Loading article">
//     <Skeleton.Heading width="72%" />
//     <Skeleton.Line    width="100%" />
//     <Skeleton.Line    width="94%"  />
//   </SkeletonGroup>
//
// VARIANTS
//   shimmer — diagonal highlight sweep, premium feel. Best for dense
//             documents, hero cards, single focal items.
//   pulse   — uniform opacity breathing. Best for dashboards, cards,
//             list rows, generic content.
//   wave    — staggered top-to-bottom ripple. Best for long lists or
//             multi-row tables, where the eye reads vertically.
//
// PANEL FLAG
//   Add `panel` to the SkeletonGroup for a panel-wide effect:
//     - shimmer: a soft white highlight that sweeps across the whole
//       card, tying the bars together.
//     - pulse: the card's background color also breathes between two
//       cream tones in sync with the bars.

import * as React from 'react';

export type SkeletonVariant = 'shimmer' | 'pulse' | 'wave';

export interface SkeletonGroupProps {
  variant?: SkeletonVariant;
  /** Adds the panel-wide effect (shimmer card sweep / pulse bg breathe). */
  panel?: boolean;
  /** Marks the region as loading for assistive tech. */
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export function SkeletonGroup({
  variant = 'shimmer',
  panel = false,
  label = 'Loading',
  className = '',
  style,
  children,
}: SkeletonGroupProps) {
  const variantClass =
    variant === 'shimmer' ? 'skel-shimmer' :
    variant === 'pulse'   ? 'skel-pulse'   :
                            'skel-wave';
  const composed = [variantClass, panel ? 'skel-panel' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <div
      className={composed}
      style={style}
      aria-busy="true"
      aria-live="polite"
      aria-label={label}
    >
      {children}
    </div>
  );
}

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  /** Slight depth offset under pulse — useful for headings / accents. */
  primary?: boolean;
  /**
   * Override stagger index for wave (when DOM order != visual order, OR
   * when there are more than 12 rows and the default nth-of-type
   * cascade has run out). Index 0 = first row.
   */
  index?: number;
  className?: string;
  style?: React.CSSProperties;
}

function SkeletonBase({
  width,
  height,
  primary,
  index,
  className = '',
  style,
}: SkeletonProps) {
  const computed: React.CSSProperties = { ...style };
  if (width !== undefined) computed.width = typeof width === 'number' ? `${width}px` : width;
  if (height !== undefined) computed.height = typeof height === 'number' ? `${height}px` : height;
  // Manual wave stagger: negative delay keeps the bar pre-rolled at t=0.
  if (index !== undefined) computed.animationDelay = `${-1.8 + index * 0.15}s`;

  return (
    <div
      className={`skel-bar ${className}`.trim()}
      data-skel={primary ? 'primary' : undefined}
      style={computed}
    />
  );
}

// Convenience subcomponents — match the canonical handoff API.
const Line = (p: SkeletonProps) => <SkeletonBase height={12} {...p} />;
const Heading = (p: SkeletonProps) => <SkeletonBase height={18} primary {...p} />;
const Small = (p: SkeletonProps) => <SkeletonBase height={8} {...p} />;
const Circle = ({ size = 40, ...p }: SkeletonProps & { size?: number }) => (
  <SkeletonBase className="skel-circle" width={size} height={size} {...p} />
);

type SkeletonComponent = ((p: SkeletonProps) => React.ReactElement) & {
  Line: typeof Line;
  Heading: typeof Heading;
  Small: typeof Small;
  Circle: typeof Circle;
};

export const Skeleton = SkeletonBase as SkeletonComponent;
Skeleton.Line = Line;
Skeleton.Heading = Heading;
Skeleton.Small = Small;
Skeleton.Circle = Circle;
